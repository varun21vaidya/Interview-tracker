# Interview Tracker, Part 2: Schema and core code

Verify expo-sqlite and expo-calendar API names against the SDK version you install. Code below is written to be copied into the folder layout from Part 1.

## 0. Decisions made in this part (ASSUMPTION unless stated)

| ID | Decision | Why |
|---|---|---|
| D-A | `round.order_at` (REAL) defaults to `starts_at`. Round numbers sort by it. "Place it as Round N" sets it to a midpoint. | Spec says numbers are date-derived, but the Which company? screen lets you pick a number. This reconciles both with one column. |
| D-B | Pending and ping state follow the latest done counted round. If the newest round is "Didn't happen", the earlier counted round still drives the bubble. | Spec never drew this case. |
| D-C | Matching points: alias 2, recruiter domain 2, title 2. Attach needs 3+ and no second company at 3+. So one signal alone goes to review. | Spec: attach only when signals agree. Tune `ATTACH_AT`. |
| D-D | First sync reads 14 days back. Later syncs read 60 days back. Always 120 days ahead. | A first sync over 60 days would flood Needs review. |
| D-E | Calendar descriptions are never stored. Only the extracted link and phone are kept. | Less personal data on disk. |
| D-F | Backup excludes `selected_calendar_ids`, `last_sync`, and the calendar cache. Calendar IDs are device-specific. | Restoring them on another phone would be wrong. |

## 1. Schema (migration 001)

```sql
-- PRAGMA foreign_keys = ON is set in client.ts on every open.
CREATE TABLE company (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  role TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','rejected')),
  rejected_reason TEXT CHECK (rejected_reason IN ('round','not_moving_forward')),
  rejected_after_round INTEGER,
  rejected_at INTEGER,
  jd_text TEXT, jd_link TEXT, notes TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE recruiter (          -- ASSUMPTION: one per company
  company_id TEXT PRIMARY KEY REFERENCES company(id) ON DELETE CASCADE,
  name TEXT, phone TEXT, email TEXT
);

CREATE TABLE recruiter_call (     -- timeline entry, NOT a round (decision 2)
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  call_at INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'phone',
  recruiter_name TEXT, recruiter_phone TEXT, said TEXT
);

CREATE TABLE calendar_event (     -- cache of what we read; no description stored (D-E)
  event_id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL, ends_at INTEGER,
  organizer_email TEXT, meeting_link TEXT, phone TEXT,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE round (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('manual','calendar')),
  calendar_event_id TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('walk_in','offline','phone','online')),
  label TEXT NOT NULL DEFAULT 'Interview',
  starts_at INTEGER NOT NULL, ends_at INTEGER,
  order_at REAL NOT NULL,                       -- D-A
  location_or_link TEXT, contact_name TEXT, contact_phone TEXT, notes TEXT,
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending','approved','rejected','didnt_happen')),
  result_set_at INTEGER,
  change_flag TEXT CHECK (change_flag IN ('moved','cancelled')),
  pending_starts_at INTEGER,
  auto_added_at INTEGER,                        -- drives the blue banner (R26)
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX idx_round_company ON round(company_id, order_at);

CREATE TABLE review_item (
  event_id TEXT PRIMARY KEY REFERENCES calendar_event(event_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('open','decided','dismissed')),
  ranked_company_ids TEXT NOT NULL DEFAULT '[]', -- JSON, best guess first (sorts the list, never preselects)
  suggested_name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE ignored_event (                    -- "Not an interview" (decision 11)
  event_id TEXT PRIMARY KEY,
  starts_at INTEGER NOT NULL,
  organizer_email TEXT
);

CREATE TABLE ping (                             -- points at a round OR a recruiter call
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('round','recruiter_call')),
  target_id TEXT NOT NULL,
  pinged_at INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('mark','copy','mail'))  -- decision 8
);
CREATE INDEX idx_ping_target ON ping(target_type, target_id);
CREATE TRIGGER ping_del_round AFTER DELETE ON round
  BEGIN DELETE FROM ping WHERE target_type='round' AND target_id=OLD.id; END;
CREATE TRIGGER ping_del_call AFTER DELETE ON recruiter_call
  BEGIN DELETE FROM ping WHERE target_type='recruiter_call' AND target_id=OLD.id; END;

CREATE TABLE alias (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('organizer','title')),
  pattern TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  UNIQUE (type, pattern)
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- JSON values
CREATE TABLE notification_map (
  round_id TEXT PRIMARY KEY REFERENCES round(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL
);
```

Versioning uses `PRAGMA user_version`, so there is no extra table.

## 2. Types (`src/types/entities.ts`)

```ts
export type Result = 'pending' | 'approved' | 'rejected' | 'didnt_happen';
export type Channel = 'mark' | 'copy' | 'mail';

export interface Company {
  id: string; name: string; role?: string; status: 'active' | 'rejected';
  rejectedReason?: 'round' | 'not_moving_forward'; rejectedAfterRound?: number;
  jdText?: string; jdLink?: string; notes?: string;
}
export interface Recruiter { companyId: string; name?: string; phone?: string; email?: string }
export interface Round {
  id: string; companyId: string; source: 'manual' | 'calendar'; calendarEventId?: string;
  type: 'walk_in' | 'offline' | 'phone' | 'online'; label: string;
  startsAt: number; endsAt?: number; orderAt: number;
  result: Result; changeFlag?: 'moved' | 'cancelled'; autoAddedAt?: number;
}
export interface RecruiterCall { id: string; companyId: string; callAt: number; recruiterName?: string; said?: string }
export interface Ping { id: string; companyId: string; targetType: 'round' | 'recruiter_call'; targetId: string; pingedAt: number; channel: Channel }
export interface Alias { type: 'organizer' | 'title'; pattern: string; companyId: string }
export interface CalEvent {
  eventId: string; calendarId: string; title: string; startsAt: number; endsAt?: number;
  organizerEmail?: string; meetingLink?: string; phone?: string;
}
export interface Bundle { company: Company; recruiter?: Recruiter; rounds: Round[]; calls: RecruiterCall[]; pings: Ping[] }
```

## 3. Domain (pure functions, no React, no DB)

### `domain/time.ts`

```ts
const DAY = 86_400_000;
const dayStart = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Whole calendar days between two instants in device time. Math.round absorbs 23/25-hour DST days. */
export const daysBetween = (from: number, to: number) => Math.round((dayStart(to) - dayStart(from)) / DAY);
export const plural = (n: number) => (n === 1 ? '1 day' : `${n} days`);
```

### `domain/rounds.ts` (R3, R4, R19, decisions 1, 2, 5)

```ts
import type { Round, RecruiterCall } from '../types/entities';

export const isDone = (r: Round, now: number) => (r.endsAt ?? r.startsAt) <= now;

/** Counted rounds in order. "Didn't happen" is excluded, so it never gets a number. */
export const counted = (rs: Round[]) =>
  rs.filter(r => r.result !== 'didnt_happen').sort((a, b) => a.orderAt - b.orderAt);

export function roundNumber(r: Round, rs: Round[]): number | null {
  const i = counted(rs).findIndex(x => x.id === r.id);
  return i < 0 ? null : i + 1;
}

/** Position a new event gets by date alone. */
export const defaultPosition = (startsAt: number, rs: Round[]) =>
  counted(rs).filter(r => r.orderAt <= startsAt).length + 1;

/** order_at that puts a new round at position `pos` (D-A). Equals startsAt when pos is the date default. */
export function orderAtFor(pos: number, startsAt: number, rs: Round[]): number {
  const c = counted(rs);
  pos = Math.max(1, Math.min(pos, c.length + 1));
  if (pos === defaultPosition(startsAt, rs)) return startsAt;
  const after = c[pos - 1]?.orderAt, before = c[pos - 2]?.orderAt;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

export type Target = { type: 'round' | 'recruiter_call'; id: string; at: number };

/**
 * What the company is waiting on, or null. Drives Pending, Awaiting, ping bubble and Home "Waiting".
 * - No counted rounds: the latest recruiter call (Awaiting schedule).
 * - Else the latest DONE counted round, only while its result is pending (R14, decision 5, D-B).
 */
export function waitingTarget(rs: Round[], calls: RecruiterCall[], now: number): Target | null {
  const c = counted(rs);
  if (c.length === 0) {
    const call = [...calls].sort((a, b) => b.callAt - a.callAt)[0];
    return call ? { type: 'recruiter_call', id: call.id, at: call.callAt } : null;
  }
  for (let i = c.length - 1; i >= 0; i--) {
    if (!isDone(c[i], now)) continue;
    return c[i].result === 'pending' ? { type: 'round', id: c[i].id, at: c[i].startsAt } : null;
  }
  return null; // only future rounds exist
}
```

When an invite becomes Round 1 for a recruiter-call-only company (R22), `counted` is no longer empty, so the Awaiting state ends and recruiter-call pings stop applying. No extra code is needed.

### `domain/pings.ts` (R10 to R17, decision 15)

```ts
import type { Ping } from '../types/entities';
import { daysBetween, plural } from './time';
import type { Target } from './rounds';

export type Bubble = { text: string; tone: 'blue' | 'green' | 'grey' | 'red' | 'amber' };

export function pendingBubble(t: Target | null, now: number): Bubble | null {
  if (!t) return null;
  const d = daysBetween(t.at, now);
  const head = t.type === 'round' ? 'Pending' : 'Awaiting schedule';
  return { text: `${head} · ${d === 0 ? 'today' : plural(d)}`, tone: 'blue' };
}

export function pingBubble(t: Target | null, pings: Ping[], now: number): Bubble | null {
  if (!t) return null;                                  // result set, or no pending target: no bubble
  const mine = pings.filter(p => p.targetType === t.type && p.targetId === t.id);
  if (!mine.length) return { text: 'Haven’t pinged yet', tone: 'grey' };
  const d = daysBetween(Math.max(...mine.map(p => p.pingedAt)), now);
  return { text: d === 0 ? 'Pinged today' : `Pinged ${plural(d)} ago`, tone: 'green' };
}

/** "Pings: 29 Oct, 26 Oct" source, newest first. Earlier rounds' pings never show (R14). */
export const pingDates = (t: Target | null, pings: Ping[]) =>
  t ? pings.filter(p => p.targetType === t.type && p.targetId === t.id).map(p => p.pingedAt).sort((a, b) => b - a) : [];

export const rejectedLabel = (reason: 'round' | 'not_moving_forward' | undefined, after?: number) =>
  reason === 'not_moving_forward' ? 'Recruiter call only, not moving forward' : `out after round ${after ?? '?'}`;
```

### `domain/home.ts` (decisions 3, 4, 5; C1)

```ts
import type { Bundle, Round } from '../types/entities';
import { counted, isDone, waitingTarget, type Target } from './rounds';

const lastDone = (rs: Round[], now: number) =>
  rs.filter(r => isDone(r, now)).sort((a, b) => b.startsAt - a.startsAt)[0];

export function buildHome(bundles: Bundle[], openReviews: number, now: number) {
  const active = bundles.filter(b => b.company.status === 'active');

  const upcoming = active
    .flatMap(b => counted(b.rounds)
      .filter(r => !isDone(r, now) && r.changeFlag !== 'cancelled')
      .map(round => ({ b, round })))
    .sort((x, y) => x.round.startsAt - y.round.startsAt);

  const waiting = active
    .map(b => ({ b, t: waitingTarget(b.rounds, b.calls, now) }))
    .filter((x): x is { b: Bundle; t: Target } => x.t !== null)
    .sort((x, y) => x.t.at - y.t.at);                    // longest wait first

  const waitingIds = new Set(waiting.map(w => w.b.company.id));
  const previous = active
    .filter(b => !waitingIds.has(b.company.id))
    .flatMap(b => { const round = lastDone(b.rounds, now); return round && round.result !== 'pending' ? [{ b, round }] : []; })
    .sort((x, y) => y.round.startsAt - x.round.startsAt)
    .slice(0, 5);                                        // ASSUMPTION: 5 cards

  const changed = active.reduce((n, b) => n + b.rounds.filter(r => r.changeFlag).length, 0);
  return { next: upcoming[0], upcoming: upcoming.slice(1), waiting, previous, openReviews, changed };
}
```

### `domain/extract.ts` (spec section 5)

```ts
const MEET = /https:\/\/meet\.google\.com\/[a-z0-9-]+/i;
const ZOOM = /https:\/\/[\w.-]*zoom\.us\/j\/[^\s"<>]+/i;
const TEAMS = /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/i;

export const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ');

export function extract(text: string) {
  const t = stripHtml(text);
  const link = [MEET, ZOOM, TEAMS].map(r => t.match(r)?.[0]).find(Boolean);
  const phone = t.replace(/https?:\/\/\S+/g, ' ')        // URLs hold long digit runs (Zoom IDs)
    .match(/\+?\d[\d\s().-]{8,16}\d/g)
    ?.find(p => p.replace(/\D/g, '').length >= 10)?.trim();
  const emails = t.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
  return { link, phone, emails };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Word-boundary match, so "HR" does not hit "three". Compile once per sync. */
export function keywordMatcher(kws: string[]) {
  if (!kws.length) return () => false;
  const re = new RegExp(`\\b(?:${kws.map(esc).join('|')})\\b`, 'i');
  return (text: string) => re.test(text);
}
```

### `domain/matching.ts` (R25 to R30, decisions 6, 7, D-C)

```ts
import type { Alias, CalEvent, Company, Recruiter } from '../types/entities';

const PUBLIC = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com']);
const GENERIC = /\b(interview|round|call|screen|screening|technical|hr|recruiter|meet|meeting|online|final|with|and|the|for)\b/gi;
export const ATTACH_AT = 3;

export const normName = (s: string) => s.replace(GENERIC, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** "Interview with Acme" or "Acme – Technical round" -> "Acme". Generic titles return null. */
export function titleGuess(title: string): string | null {
  const m = title.match(/interview with\s+(.+)/i) ?? title.match(/^(.+?)\s+[–—-]\s+/);
  return m && normName(m[1]).length >= 2 ? m[1].trim() : null;
}

export interface MatchCtx { aliases: Alias[]; companies: Company[]; recruiters: Recruiter[] }
export interface Match { decision: 'attach' | 'review'; companyId?: string; ranked: string[]; suggestedName?: string }

export function matchEvent(ev: CalEvent, ctx: MatchCtx): Match {
  const pts = new Map<string, number>();
  const add = (id: string, n: number) => pts.set(id, (pts.get(id) ?? 0) + n);
  const org = ev.organizerEmail?.toLowerCase();
  const dom = org?.split('@')[1];
  const title = ev.title.toLowerCase();

  for (const a of ctx.aliases) {
    if (a.type === 'organizer' && a.pattern === org) add(a.companyId, 2);
    if (a.type === 'title' && title.includes(a.pattern)) add(a.companyId, 2);
  }
  if (dom && !PUBLIC.has(dom))
    for (const r of ctx.recruiters) if (r.email?.toLowerCase().endsWith('@' + dom)) add(r.companyId, 2);

  const guess = titleGuess(ev.title);
  const known = guess ? ctx.companies.filter(c => normName(c.name) === normName(guess)) : [];
  known.forEach(c => add(c.id, 2));

  const ranked = [...pts.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  const ok = !!top && top[1] >= ATTACH_AT && (!second || second[1] < ATTACH_AT);
  return {
    decision: ok ? 'attach' : 'review',
    companyId: ok ? top[0] : undefined,
    ranked: ranked.map(r => r[0]),
    suggestedName: guess && known.length === 0 ? guess : undefined, // new company: never created here (decision 6)
  };
}
```

The review screen sorts its radio list by `ranked` and preselects nothing (decision 7). The user can edit `suggestedName`.

### `domain/diff.ts` (R32 to R34, decision 11)

```ts
import type { CalEvent } from '../types/entities';

export type Change =
  | { kind: 'new'; ev: CalEvent } | { kind: 'moved'; ev: CalEvent }
  | { kind: 'link'; ev: CalEvent } | { kind: 'cancelled'; eventId: string };
export interface Ignored { startsAt: number; organizerEmail?: string }

export function diffEvents(
  fresh: CalEvent[], stored: Map<string, CalEvent>, ignored: Map<string, Ignored>,
  win: { from: number; to: number },
): Change[] {
  const out: Change[] = [], seen = new Set<string>();
  for (const ev of fresh) {
    seen.add(ev.eventId);
    const ig = ignored.get(ev.eventId);
    if (ig) {                                            // hidden unless time or organizer changed
      if (ig.startsAt !== ev.startsAt || ig.organizerEmail !== ev.organizerEmail) out.push({ kind: 'new', ev });
      continue;
    }
    const old = stored.get(ev.eventId);
    if (!old) out.push({ kind: 'new', ev });
    else if (old.startsAt !== ev.startsAt) out.push({ kind: 'moved', ev });
    else if (old.meetingLink !== ev.meetingLink) out.push({ kind: 'link', ev });
  }
  for (const [id, old] of stored)                        // missing inside the window = cancelled
    if (!seen.has(id) && !ignored.has(id) && old.startsAt >= win.from && old.startsAt <= win.to)
      out.push({ kind: 'cancelled', eventId: id });
  return out;
}
```

`stored` must contain only events from the currently ticked calendars. Otherwise unticking a calendar would look like mass cancellation.

## 4. Database layer

### `db/client.ts`

```ts
import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './migrations';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (db) return db;
  const d = await SQLite.openDatabaseAsync('tracker.db');
  await d.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    await d.withTransactionAsync(async () => {
      await d.execAsync(MIGRATIONS[v]);                  // MIGRATIONS[0] = section 1 DDL
      await d.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return (db = d);
}
```

### `db/bus.ts` and `hooks/useData.ts` (no state library)

```ts
// db/bus.ts
const subs = new Set<() => void>();
export const onChange = (f: () => void) => (subs.add(f), () => { subs.delete(f); });
export const emitChange = () => subs.forEach(f => f());

// hooks/useData.ts
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const run = useCallback(() => { load().then(setData).catch(setError); }, deps);
  useEffect(() => { run(); return onChange(run); }, [run]);
  return { data, error, reload: run };
}
```

### `db/repos/bundles.ts` (4 queries for the whole app)

```ts
function group<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = key(r), a = m.get(k); a ? a.push(r) : m.set(k, [r]); }
  return m;
}

export async function loadBundles(): Promise<Bundle[]> {
  const db = await getDb();
  const [cs, rec, rs, calls, ps] = await Promise.all([
    db.getAllAsync<CompanyRow>('SELECT * FROM company'),
    db.getAllAsync<RecruiterRow>('SELECT * FROM recruiter'),
    db.getAllAsync<RoundRow>('SELECT * FROM round'),
    db.getAllAsync<CallRow>('SELECT * FROM recruiter_call'),
    db.getAllAsync<PingRow>('SELECT * FROM ping'),
  ]);
  const R = group(rs, r => r.company_id), C = group(calls, r => r.company_id), P = group(ps, r => r.company_id);
  const rc = new Map(rec.map(r => [r.company_id, toRecruiter(r)]));
  return cs.map(c => ({
    company: toCompany(c), recruiter: rc.get(c.id),
    rounds: (R.get(c.id) ?? []).map(toRound), calls: (C.get(c.id) ?? []).map(toCall), pings: (P.get(c.id) ?? []).map(toPing),
  }));
}
// toCompany / toRound / ...: snake_case -> camelCase, null -> undefined. About 8 lines each.
// Search is a JS filter over bundles (name, role, recruiter name and email). 100 companies is tiny, and it avoids SQL string building.
```

### `db/repos/actions.ts` (writes: always parameterized, always `emitChange()`)

```ts
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8); // local-only ids

/** Mark as pinged, Copy text, Open in Mail (decision 8). `target` comes from waitingTarget(). */
export async function markPinged(companyId: string, target: Target, channel: Channel, now = Date.now()) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO ping (id, company_id, target_type, target_id, pinged_at, channel) VALUES (?,?,?,?,?,?)',
    [uid(), companyId, target.type, target.id, now, channel]);
  emitChange();
}

export async function setResult(roundId: string, result: Result, now = Date.now()) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE round SET result=?, result_set_at=?, updated_at=? WHERE id=?', [result, now, now, roundId]);
    if (result !== 'rejected') return;
    const { company_id } = (await db.getFirstAsync<{ company_id: string }>('SELECT company_id FROM round WHERE id=?', [roundId]))!;
    const rs = (await db.getAllAsync<RoundRow>('SELECT * FROM round WHERE company_id=?', [company_id])).map(toRound);
    const n = roundNumber(rs.find(r => r.id === roundId)!, rs);          // stored so the label stays stable (R23)
    await db.runAsync(
      "UPDATE company SET status='rejected', rejected_reason='round', rejected_at=?, rejected_after_round=?, updated_at=? WHERE id=?",
      [now, n, now, company_id]);
  });
  emitChange();
}

export async function notMovingForward(companyId: string, now = Date.now()) {
  const db = await getDb();
  await db.runAsync("UPDATE company SET status='rejected', rejected_reason='not_moving_forward', rejected_at=?, updated_at=? WHERE id=?", [now, now, companyId]);
  emitChange();
}

/** Reopen (decision 9): rounds and results stay; numbers are derived, so they renumber on their own. */
export async function reopenCompany(companyId: string, now = Date.now()) {
  const db = await getDb();
  await db.runAsync("UPDATE company SET status='active', rejected_reason=NULL, rejected_after_round=NULL, rejected_at=NULL, updated_at=? WHERE id=?", [now, companyId]);
  emitChange();
}

/** Move one round: its result and pings go with it; notes are on the round row already. */
export async function moveRound(roundId: string, toCompanyId: string) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE round SET company_id=? WHERE id=?', [toCompanyId, roundId]);
    await db.runAsync("UPDATE ping SET company_id=? WHERE target_type='round' AND target_id=?", [toCompanyId, roundId]);
  });
  emitChange();
}

/** Merge (decision 12): everything moves to the target, the source is deleted. */
export async function mergeCompanies(sourceId: string, targetId: string) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of ['round', 'recruiter_call', 'ping'])
      await db.runAsync(`UPDATE ${t} SET company_id=? WHERE company_id=?`, [targetId, sourceId]);  // t is a constant
    await db.runAsync('UPDATE OR IGNORE alias SET company_id=? WHERE company_id=?', [targetId, sourceId]);
    await db.runAsync('UPDATE OR IGNORE recruiter SET company_id=? WHERE company_id=?', [targetId, sourceId]); // target's own wins
    await db.runAsync(
      `UPDATE company SET
         notes = NULLIF(trim(COALESCE(notes,'') || char(10) || COALESCE((SELECT notes FROM company WHERE id=?),'')), ''),
         jd_text = COALESCE(jd_text, (SELECT jd_text FROM company WHERE id=?))
       WHERE id=?`, [sourceId, sourceId, targetId]);
    await db.runAsync('DELETE FROM company WHERE id=?', [sourceId]);   // cascades leftover alias/recruiter rows
  });
  emitChange();
}
```

## 5. Calendar sync (`services/calendarSync.ts`)

```ts
import * as Calendar from 'expo-calendar';
const DAY = 86_400_000;

function toCalEvent(e: Calendar.Event, kw: (t: string) => boolean): CalEvent | null {
  const text = `${e.title ?? ''} ${e.notes ?? ''}`;
  if (!kw(stripHtml(text))) return null;                 // keyword on title or description
  const x = extract(`${text} ${e.location ?? ''}`);
  return {
    eventId: e.id, calendarId: e.calendarId, title: e.title ?? '',
    startsAt: +new Date(e.startDate), endsAt: +new Date(e.endDate),
    organizerEmail: e.organizerEmail?.toLowerCase(),      // Android-only field; fine for this app
    meetingLink: safeHttps(x.link) ?? undefined, phone: x.phone,
  };
}

export async function syncCalendar(now = Date.now()) {
  const db = await getDb();
  const s = await getSettings();                         // { calendarIds, keywords, lastSync }
  if (!s.calendarIds.length) return;
  if ((await Calendar.getCalendarPermissionsAsync()).status !== 'granted') return; // Home shows the access card

  const from = now - (s.lastSync ? 60 : 14) * DAY, to = now + 120 * DAY;            // D-D
  const kw = keywordMatcher(s.keywords);
  const fresh = (await Calendar.getEventsAsync(s.calendarIds, new Date(from), new Date(to)))
    .map(e => toCalEvent(e, kw)).filter((e): e is CalEvent => e !== null);

  const changes = diffEvents(fresh, await storedEvents(s.calendarIds), await ignoredEvents(), { from, to });
  const ctx = await matchContext();                      // aliases, companies, recruiters

  await db.withTransactionAsync(async () => {
    for (const ch of changes) {
      if (ch.kind === 'new') {
        await deleteIgnored(ch.ev.eventId);              // it changed, so it is a candidate again
        await upsertEvent(ch.ev, now);
        const m = matchEvent(ch.ev, ctx);
        if (m.decision === 'attach') await attachRound(m.companyId!, ch.ev, now); // sets auto_added_at
        else await upsertReview(ch.ev.eventId, m.ranked, m.suggestedName, now);
      } else if (ch.kind === 'moved') await flagMoved(ch.ev);        // flag + pending_starts_at, never silent (R33)
      else if (ch.kind === 'cancelled') await flagCancelled(ch.eventId);
      else await updateLink(ch.ev);                                  // link change is applied directly
    }
    await setSetting('last_sync', now);
  });
  emitChange();
}
```

Helper rules (each is a few lines of SQL):
- `attachRound` first looks for an existing round in that company within one minute of `startsAt` and links the event to it instead of inserting. This keeps refresh idempotent and prevents duplicates after a restore.
- Type is `online` when a link was found, otherwise `offline`.
- `flagMoved` and `flagCancelled` act on the round if one exists. If the event is still in Needs review, they only update the cache or dismiss the item.
- A refresh never writes `notes`, `result` or `ping` (R34).

## 6. Backup export, validation, restore (`services/backup.ts`)

Export dumps each table with `SELECT *`, so JSON keys match table and column names and no mapping layer is needed. It skips `calendar_event`, `review_item`, `ignored_event`, and the settings keys listed in D-F.

```ts
const MAX_BYTES = 5_000_000;
type Row = Record<string, unknown>;
const fail = (m: string): never => { throw new Error(`Invalid backup: ${m}`); };
const obj = (v: unknown): Row => (typeof v === 'object' && v && !Array.isArray(v) ? (v as Row) : fail('object expected'));
const arr = (v: unknown, max = 50_000): Row[] => (Array.isArray(v) && v.length <= max ? v.map(obj) : fail('array expected'));
const str = (v: unknown, max = 5_000) => (typeof v === 'string' && v.length <= max ? v : fail('string expected'));
const opt = (v: unknown, max?: number) => (v == null ? null : str(v, max));
const int = (v: unknown) => (Number.isSafeInteger(v) ? (v as number) : fail('integer expected'));
const optInt = (v: unknown) => (v == null ? null : int(v));
const pick = <T extends string>(v: unknown, set: readonly T[]) => (set.includes(v as T) ? (v as T) : fail('bad value'));
const https = (v: unknown) => { const s = opt(v, 2000); return s && !/^https:\/\//i.test(s) ? fail('link must be https') : s; };

export function parseBackup(text: string) {
  if (text.length > MAX_BYTES) fail('file too large');
  const raw = obj(JSON.parse(text));
  if (raw.schemaVersion !== 1) fail('unsupported version');
  return {
    company: arr(raw.company).map(r => ({
      id: str(r.id, 64), name: str(r.name, 200), role: opt(r.role, 200),
      status: pick(r.status, ['active', 'rejected'] as const),
      rejected_reason: r.rejected_reason == null ? null : pick(r.rejected_reason, ['round', 'not_moving_forward'] as const),
      rejected_after_round: optInt(r.rejected_after_round), rejected_at: optInt(r.rejected_at),
      jd_text: opt(r.jd_text, 200_000), jd_link: https(r.jd_link), notes: opt(r.notes, 50_000),
      created_at: int(r.created_at), updated_at: int(r.updated_at),
    })),
    round: arr(raw.round).map(r => ({
      id: str(r.id, 64), company_id: str(r.company_id, 64),
      source: 'manual' as const,                         // calendar ids are device-specific (D-F)
      calendar_event_id: null,
      type: pick(r.type, ['walk_in', 'offline', 'phone', 'online'] as const),
      label: str(r.label, 200), starts_at: int(r.starts_at), ends_at: optInt(r.ends_at),
      order_at: Number.isFinite(r.order_at) ? (r.order_at as number) : fail('number expected'),
      location_or_link: opt(r.location_or_link, 2000), contact_name: opt(r.contact_name, 200),
      contact_phone: opt(r.contact_phone, 50), notes: opt(r.notes, 50_000),
      result: pick(r.result, ['pending', 'approved', 'rejected', 'didnt_happen'] as const),
      result_set_at: optInt(r.result_set_at), change_flag: null, pending_starts_at: null, auto_added_at: null,
      created_at: int(r.created_at), updated_at: int(r.updated_at),
    })),
    ping: arr(raw.ping).map(r => ({
      id: str(r.id, 64), company_id: str(r.company_id, 64),
      target_type: pick(r.target_type, ['round', 'recruiter_call'] as const), target_id: str(r.target_id, 64),
      pinged_at: int(r.pinged_at), channel: pick(r.channel, ['mark', 'copy', 'mail'] as const),
    })),
    // recruiter, recruiter_call, alias: same pattern, one validator each.
  };
}

const ORDER = ['company', 'recruiter', 'recruiter_call', 'round', 'ping', 'alias'] as const;  // FK-safe order

export async function restore(b: ReturnType<typeof parseBackup>) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of [...ORDER].reverse().concat('review_item' as never, 'ignored_event' as never, 'calendar_event' as never))
      await db.runAsync(`DELETE FROM ${t}`);              // constants, never from the file
    for (const t of ORDER) {
      const rows = (b as Record<string, Row[]>)[t] ?? [];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);                  // keys come from our validator, not the file
      const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
      for (const r of rows) await db.runAsync(sql, cols.map(c => r[c] as SQLite.SQLiteBindValue));
    }
  });                                                     // any throw (bad FK, CHECK) rolls everything back
  emitChange();
}
```

Safety layers on import:
1. File size cap.
2. `JSON.parse` in try/catch.
3. Per-field type, enum and length checks.
4. Foreign keys and CHECK constraints in the schema.
5. A single transaction, so a failed import changes nothing.
6. Check the file's size on disk before reading it into memory.

## 7. Safe link helpers (`utils/links.ts`)

```ts
export const safeHttps = (u?: string | null) => (u && /^https:\/\/\S+$/i.test(u) ? u : null);
export const telUri = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`;
export const mailUri = (to: string, subject: string, body: string) =>
  `mailto:${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ? to : ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
```

## 8. Test cases for this part (Jest, no device needed)

| Function | Cases |
|---|---|
| `roundNumber` | Umbrella sample: 16 Oct = 1, 20 Oct (didn't happen) = null, 23 Oct = 2. |
| `orderAtFor` | Default position returns `startsAt`. Position 1 goes before the first. A middle position gives the midpoint. A position beyond the end is clamped. |
| `waitingTarget` | No rounds plus a call gives the call. Latest done approved gives null. Today's round not yet done gives null (Acme). The latest done round is pending gives that round. |
| `pendingBubble` | 0 gives "today", 1 gives "1 day", 8 gives "8 days". Midnight boundary: a round at 23:30 checked at 00:30 next day gives "1 day". |
| `pingBubble` | No pings gives grey. Pings on a previous round are ignored. Result set gives null. Awaiting target works with recruiter-call pings. |
| `buildHome` | Globex appears in waiting. Wayne Tech appears in waiting with the Awaiting bubble. Acme is next and not in waiting. A rejected company appears nowhere. |
| `matchEvent` | Generic title plus gmail organizer gives review with nothing preselected. Alias plus recruiter domain gives attach. Two companies tied gives review. Unknown "Stark Industries – Screening call" gives review with `suggestedName`. |
| `diffEvents` | Moved. Cancelled inside the window. Outside the window is not cancelled. Ignored and unchanged is skipped. Ignored and time changed gives new. |
| `extract` | Meet, Zoom and Teams links. `+91 90000 00000`. A Zoom meeting ID is not read as a phone number. HTML in notes is stripped. |
| `keywordMatcher` | "HR round" matches. "three" does not match "HR". |
| `parseBackup` | Wrong version. A string where a number is expected. An `http://` link. An oversized file. An unknown enum. |
