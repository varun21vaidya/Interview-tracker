import { getDb } from '../client';
import { emitChange } from '../bus';
import { orderAtFor } from '../../domain/rounds';
import { aliasesFor } from '../../domain/review';
import type { MatchCtx } from '../../domain/matching';
import type { Alias, CalEvent, Company, Recruiter } from '../../types/entities';
import { loadBundles, toRound, type RoundRow } from './bundles';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
type Db = Awaited<ReturnType<typeof getDb>>;

interface ItemRow {
  event_id: string; ranked_company_ids: string; suggested_name: string | null;
  calendar_id: string; title: string; starts_at: number; ends_at: number | null;
  organizer_email: string | null; meeting_link: string | null; phone: string | null;
}
export interface ReviewItem { event: CalEvent; ranked: string[]; suggestedName?: string }

const parseRanked = (s: string): string[] => {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
};
const toItem = (r: ItemRow): ReviewItem => ({
  ranked: parseRanked(r.ranked_company_ids), suggestedName: r.suggested_name ?? undefined,
  event: {
    eventId: r.event_id, calendarId: r.calendar_id, title: r.title, startsAt: r.starts_at, endsAt: r.ends_at ?? undefined,
    organizerEmail: r.organizer_email ?? undefined, meetingLink: r.meeting_link ?? undefined, phone: r.phone ?? undefined,
  },
});
const SELECT = `SELECT v.event_id, v.ranked_company_ids, v.suggested_name, e.calendar_id, e.title, e.starts_at, e.ends_at,
  e.organizer_email, e.meeting_link, e.phone
  FROM review_item v JOIN calendar_event e ON e.event_id = v.event_id WHERE v.status='open'`;

export async function loadOpenReviews(): Promise<ReviewItem[]> {
  const db = await getDb();
  return (await db.getAllAsync<ItemRow>(`${SELECT} ORDER BY e.starts_at`)).map(toItem);
}

/** The open item plus every company bundle, so the screen can list companies and compute positions. Item is null once decided. */
export async function loadReviewScreen(eventId: string) {
  const db = await getDb();
  const [row, bundles] = await Promise.all([
    db.getFirstAsync<ItemRow>(`${SELECT} AND v.event_id=?`, [eventId]),
    loadBundles(),
  ]);
  return { item: row ? toItem(row) : null, bundles };
}

/** Sync (next phase) calls this for events that need a decision. An item already decided or dismissed is not reopened. */
export async function upsertReview(eventId: string, ranked: string[], suggestedName: string | undefined, now: number) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO review_item (event_id, status, ranked_company_ids, suggested_name, created_at) VALUES (?,'open',?,?,?)
     ON CONFLICT(event_id) DO UPDATE SET ranked_company_ids=excluded.ranked_company_ids, suggested_name=excluded.suggested_name
       WHERE review_item.status='open'`,
    [eventId, JSON.stringify(ranked), suggestedName ?? null, now]);
  emitChange();
}

export async function matchContext(): Promise<MatchCtx> {
  const db = await getDb();
  const [al, cs, rs] = await Promise.all([
    db.getAllAsync<{ type: Alias['type']; pattern: string; company_id: string }>('SELECT type, pattern, company_id FROM alias'),
    db.getAllAsync<{ id: string; name: string; status: Company['status'] }>('SELECT id, name, status FROM company'),
    db.getAllAsync<{ company_id: string; email: string | null }>('SELECT company_id, email FROM recruiter'),
  ]);
  return {
    aliases: al.map(a => ({ type: a.type, pattern: a.pattern, companyId: a.company_id })),
    companies: cs.map(c => ({ id: c.id, name: c.name, status: c.status })),
    recruiters: rs.map((r): Recruiter => ({ companyId: r.company_id, email: r.email ?? undefined })),
  };
}

export type Choice = { companyId: string } | { newName: string };

/**
 * Places the event as a calendar round at `position` (D-A) and remembers the choice as aliases.
 * A new company is created here, on confirm only (D6). Returns the company id, or null when the item is no longer open.
 */
export async function placeEvent(eventId: string, choice: Choice, position: number | null, now = Date.now()): Promise<string | null> {
  const db = await getDb();
  let companyId: string | null = null;
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<ItemRow>(`${SELECT} AND v.event_id=?`, [eventId]);
    if (!row) return;
    const ev = toItem(row).event;
    const id = await resolveCompany(db, choice, now);
    const rs = (await db.getAllAsync<RoundRow>('SELECT * FROM round WHERE company_id=?', [id])).map(toRound);
    const orderAt = position === null ? ev.startsAt : orderAtFor(position, ev.startsAt, rs);
    await db.runAsync(
      `INSERT INTO round (id, company_id, source, calendar_event_id, type, label, starts_at, ends_at, order_at, location_or_link, contact_phone, created_at, updated_at)
       VALUES (?,?,'calendar',?,?,'Interview',?,?,?,?,?,?,?)`,
      [uid(), id, eventId, ev.meetingLink ? 'online' : 'offline', ev.startsAt, ev.endsAt ?? null, orderAt,
        ev.meetingLink ?? null, ev.phone ?? null, now, now]);
    for (const a of aliasesFor(ev, id))
      await db.runAsync(
        `INSERT INTO alias (id, type, pattern, company_id) VALUES (?,?,?,?)
         ON CONFLICT(type, pattern) DO UPDATE SET company_id=excluded.company_id`,
        [uid(), a.type, a.pattern, a.companyId]);
    await db.runAsync("UPDATE review_item SET status='decided' WHERE event_id=?", [eventId]);
    companyId = id;
  });
  if (companyId) emitChange();
  return companyId;
}

/** Existing company by id, or a case-insensitive name match, or a new one (D10). */
async function resolveCompany(db: Db, choice: Choice, now: number): Promise<string> {
  if ('companyId' in choice) return choice.companyId;
  const name = choice.newName.trim();
  if (name.length < 1 || name.length > 200) throw new Error('Company name must be 1 to 200 characters');
  const hit = await db.getFirstAsync<{ id: string }>('SELECT id FROM company WHERE lower(name)=lower(?) LIMIT 1', [name]);
  if (hit) return hit.id;
  const id = uid();
  await db.runAsync("INSERT INTO company (id, name, status, created_at, updated_at) VALUES (?,?,'active',?,?)", [id, name, now, now]);
  return id;
}

/** Not an interview (D11): hidden until its time or organizer changes. */
export async function dismissEvent(eventId: string) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO ignored_event (event_id, starts_at, organizer_email)
       SELECT event_id, starts_at, organizer_email FROM calendar_event WHERE event_id=?`, [eventId]);
    await db.runAsync("UPDATE review_item SET status='dismissed' WHERE event_id=?", [eventId]);
  });
  emitChange();
}
