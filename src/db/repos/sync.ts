import { getDb } from '../client';
import { emitChange } from '../bus';
import { findNearRound, prefillRecruiter, roundTypeFor, type AutoAdded } from '../../domain/syncRules';
import type { Ignored } from '../../domain/diff';
import type { CalEvent } from '../../types/entities';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
type Db = Awaited<ReturnType<typeof getDb>>;

// Everything here takes `db` and does not emit: syncCalendar runs it all in one transaction and emits once.
// None of it writes notes, result or ping (R34).

export async function ignoredEvents(): Promise<Map<string, Ignored>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ event_id: string; starts_at: number; organizer_email: string | null }>(
    'SELECT event_id, starts_at, organizer_email FROM ignored_event');
  return new Map(rows.map(r => [r.event_id, { startsAt: r.starts_at, organizerEmail: r.organizer_email ?? undefined }]));
}

export const deleteIgnored = (db: Db, eventId: string) => db.runAsync('DELETE FROM ignored_event WHERE event_id=?', [eventId]);

interface Linked { id: string; change_flag: 'moved' | 'cancelled' | null; starts_at: number; result: string }
const linkedRound = (db: Db, eventId: string) =>
  db.getFirstAsync<Linked>('SELECT id, change_flag, starts_at, result FROM round WHERE calendar_event_id=?', [eventId]);

/**
 * An event we already have a round for (it was placed, linked, or came back after a cancellation).
 * A cancelled flag is cleared because the invite is back. Returns true when handled.
 */
export async function restoreIfLinked(db: Db, eventId: string, now: number): Promise<boolean> {
  const r = await linkedRound(db, eventId);
  if (!r) return false;
  if (r.change_flag === 'cancelled' && r.result !== 'didnt_happen')
    await db.runAsync('UPDATE round SET change_flag=NULL, updated_at=? WHERE id=?', [now, r.id]);
  return true;
}

/**
 * Adds the invite to a company. An existing unlinked round within one minute of the start is linked instead of
 * inserting a duplicate (idempotent refresh, restore). A new round is source 'calendar', online when a link exists,
 * otherwise offline, with auto_added_at set so the blue banner shows it. Also prefills the recruiter row (empty fields only).
 */
export async function attachRound(db: Db, companyId: string, ev: CalEvent, now: number): Promise<'linked' | 'added' | 'exists'> {
  if (await linkedRound(db, ev.eventId)) return 'exists';
  const existing = (await db.getAllAsync<{ id: string; starts_at: number; calendar_event_id: string | null }>(
    'SELECT id, starts_at, calendar_event_id FROM round WHERE company_id=?', [companyId]))
    .map(r => ({ id: r.id, startsAt: r.starts_at, calendarEventId: r.calendar_event_id ?? undefined }));
  const near = findNearRound(existing, ev.startsAt);

  let outcome: 'linked' | 'added';
  if (near) {
    await db.runAsync('UPDATE round SET calendar_event_id=?, updated_at=? WHERE id=?', [ev.eventId, now, near.id]);
    outcome = 'linked';
  } else {
    await db.runAsync(
      `INSERT INTO round (id, company_id, source, calendar_event_id, type, label, starts_at, ends_at, order_at, location_or_link, contact_phone, auto_added_at, created_at, updated_at)
       VALUES (?,?,'calendar',?,?,'Interview',?,?,?,?,?,?,?,?)`,
      [uid(), companyId, ev.eventId, roundTypeFor(ev), ev.startsAt, ev.endsAt ?? null, ev.startsAt,
        ev.meetingLink ?? null, ev.phone ?? null, now, now, now]);
    outcome = 'added';
  }
  await prefillRecruiterRow(db, companyId, ev);
  return outcome;
}

async function prefillRecruiterRow(db: Db, companyId: string, ev: CalEvent) {
  const cur = await db.getFirstAsync<{ email: string | null; phone: string | null }>(
    'SELECT email, phone FROM recruiter WHERE company_id=?', [companyId]);
  const fill = prefillRecruiter({ email: cur?.email ?? undefined, phone: cur?.phone ?? undefined }, ev);
  if (!fill) return;
  await db.runAsync(
    `INSERT INTO recruiter (company_id, email, phone) VALUES (?,?,?)
     ON CONFLICT(company_id) DO UPDATE SET email=COALESCE(?, email), phone=COALESCE(?, phone)`,
    [companyId, fill.email ?? null, fill.phone ?? null, fill.email ?? null, fill.phone ?? null]);
}

/** Flag, never change: the new time waits in pending_starts_at. No round (still in Needs review): the caller only updates the cache. */
export async function flagMoved(db: Db, ev: CalEvent, now: number) {
  const r = await linkedRound(db, ev.eventId);
  if (!r) return;
  if (ev.startsAt === r.starts_at) {                        // moved back: nothing to decide any more
    await db.runAsync("UPDATE round SET change_flag=NULL, pending_starts_at=NULL, updated_at=? WHERE id=? AND change_flag='moved'", [now, r.id]);
    return;
  }
  await db.runAsync("UPDATE round SET change_flag='moved', pending_starts_at=?, updated_at=? WHERE id=?", [ev.startsAt, now, r.id]);
}

/**
 * Flags the round if one exists and is still pending (a round with a result keeps its history untouched).
 * The cached event is dropped either way: it stops being re-flagged on every refresh, and an item still in
 * Needs review disappears with it (cascade). If the invite returns it comes back as new and restoreIfLinked clears the flag.
 */
export async function flagCancelled(db: Db, eventId: string, now: number) {
  const r = await linkedRound(db, eventId);
  if (r && r.result === 'pending')
    await db.runAsync("UPDATE round SET change_flag='cancelled', pending_starts_at=NULL, updated_at=? WHERE id=?", [now, r.id]);
  await db.runAsync('DELETE FROM calendar_event WHERE event_id=?', [eventId]);
}

/** Link change is applied directly to a calendar round (a manual round keeps what the user chose). */
export async function updateLink(db: Db, ev: CalEvent, now: number) {
  await db.runAsync(
    "UPDATE round SET location_or_link=?, type=?, updated_at=? WHERE calendar_event_id=? AND source='calendar'",
    [ev.meetingLink ?? null, roundTypeFor(ev), now, ev.eventId]);
}

// ---- Home: auto-added rounds for the blue banner ----

export async function loadAutoAdded(): Promise<AutoAdded[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; company_id: string; name: string; calendar_event_id: string | null; starts_at: number; auto_added_at: number; title: string | null;
  }>(`SELECT r.id, r.company_id, c.name, r.calendar_event_id, r.starts_at, r.auto_added_at, e.title
      FROM round r JOIN company c ON c.id = r.company_id LEFT JOIN calendar_event e ON e.event_id = r.calendar_event_id
      WHERE r.auto_added_at IS NOT NULL AND r.source='calendar' AND c.status='active'`);
  return rows.map(r => ({
    roundId: r.id, companyId: r.company_id, companyName: r.name, eventId: r.calendar_event_id,
    title: r.title ?? '', startsAt: r.starts_at, autoAddedAt: r.auto_added_at,
  }));
}

// ---- User decisions on flagged and auto-added rounds ----

/** Accept a move: the round takes the calendar's time and keeps its place in the order unless the user had placed it by hand. */
export async function acceptMove(roundId: string, now = Date.now()) {
  const db = await getDb();
  const r = await db.getFirstAsync<{ starts_at: number; ends_at: number | null; order_at: number; pending_starts_at: number | null }>(
    "SELECT starts_at, ends_at, order_at, pending_starts_at FROM round WHERE id=? AND change_flag='moved'", [roundId]);
  if (!r || r.pending_starts_at === null) return;
  const delta = r.pending_starts_at - r.starts_at;
  await db.runAsync(
    "UPDATE round SET starts_at=?, ends_at=?, order_at=?, change_flag=NULL, pending_starts_at=NULL, updated_at=? WHERE id=?",
    [r.pending_starts_at, r.ends_at === null ? null : r.ends_at + delta,
      r.order_at === r.starts_at ? r.pending_starts_at : r.order_at, now, roundId]);
  emitChange();
}

/** Keep: leave the round as it was and stop flagging it. */
export async function keepRound(roundId: string, now = Date.now()) {
  const db = await getDb();
  await db.runAsync('UPDATE round SET change_flag=NULL, pending_starts_at=NULL, updated_at=? WHERE id=?', [now, roundId]);
  emitChange();
}

/** Accept a cancellation: the round is marked "Didn't happen" (not counted) and the cancelled flag stays as the record. */
export async function acceptCancel(roundId: string, now = Date.now()) {
  const db = await getDb();
  await db.runAsync(
    "UPDATE round SET result='didnt_happen', result_set_at=?, updated_at=? WHERE id=? AND change_flag='cancelled'", [now, now, roundId]);
  emitChange();
}

/** Reopen a cancelled round: the flag clears so it counts again, and an accepted "Didn't happen" goes back to pending. */
export async function reopenRound(roundId: string, now = Date.now()) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE round SET change_flag=NULL, pending_starts_at=NULL, updated_at=?,
       result = CASE WHEN result='didnt_happen' THEN 'pending' ELSE result END,
       result_set_at = CASE WHEN result='didnt_happen' THEN NULL ELSE result_set_at END
     WHERE id=? AND change_flag='cancelled'`, [now, roundId]);
  emitChange();
}

/**
 * Undo an auto-add: the round goes away and the event returns to Needs review. Returns the event id (for Change),
 * or null when the round is not an auto-added one any more.
 */
export async function undoAutoAdd(roundId: string, now = Date.now()): Promise<string | null> {
  const db = await getDb();
  let eventId: string | null = null;
  await db.withTransactionAsync(async () => {
    const r = await db.getFirstAsync<{ company_id: string; calendar_event_id: string | null }>(
      "SELECT company_id, calendar_event_id FROM round WHERE id=? AND source='calendar' AND auto_added_at IS NOT NULL", [roundId]);
    if (!r) return;
    await db.runAsync('DELETE FROM round WHERE id=?', [roundId]);
    if (r.calendar_event_id) {
      const cached = await db.getFirstAsync<{ event_id: string }>('SELECT event_id FROM calendar_event WHERE event_id=?', [r.calendar_event_id]);
      if (cached) {
        await db.runAsync(
          "INSERT OR REPLACE INTO review_item (event_id, status, ranked_company_ids, suggested_name, created_at) VALUES (?,'open',?,NULL,?)",
          [cached.event_id, JSON.stringify([r.company_id]), now]);
        eventId = cached.event_id;
      }
    }
  });
  emitChange();
  return eventId;
}
