import { listEvents } from 'expo-calendar';
import { getDb } from '../db/client';
import { emitChange } from '../db/bus';
import { storedEvents, writeEvent } from '../db/repos/calendarEvents';
import { matchContext, writeReview } from '../db/repos/review';
import { getCalendarIds, getKeywords, getLastSync, writeSetting } from '../db/repos/settings';
import { attachRound, deleteIgnored, flagCancelled, flagMoved, ignoredEvents, restoreIfLinked, updateLink } from '../db/repos/sync';
import { diffEvents, type Change } from '../domain/diff';
import { matchEvent, type MatchCtx } from '../domain/matching';
import { keywordMatcher } from '../domain/extract';
import { toCalEvent } from '../domain/toCalEvent';
import { readWindow } from '../domain/syncWindow';
import type { CalEvent } from '../types/entities';
import { getCalendarAccess } from './permissions';

async function fetchFresh(calendarIds: string[], keywords: string[], from: number, to: number): Promise<CalEvent[]> {
  const kw = keywordMatcher(keywords);
  const raw = await listEvents(calendarIds, new Date(from), new Date(to));
  return raw.map(e => toCalEvent(e, kw)).filter((e): e is CalEvent => e !== null);
}

export async function readEvents(
  calendarIds: string[], keywords: string[], lastSync: number | null, now = Date.now(),
): Promise<CalEvent[]> {
  if (!calendarIds.length) return [];
  if ((await getCalendarAccess()) !== 'granted') return [];
  const { from, to } = readWindow(now, lastSync);
  return fetchFresh(calendarIds, keywords, from, to);
}

// ---- Sync (Phase 8b) ----

export type SyncResult =
  | { status: 'done'; changes: number }
  | { status: 'skipped'; reason: 'no-calendars' | 'no-access' | 'debounced' | 'paused' };

/**
 * Reads the ticked calendars, diffs against the cache and applies the changes in one transaction.
 * Running it twice in a row changes nothing. It never writes notes, result or ping (R34).
 * A failed calendar read throws before anything is written, so an error can never look like mass cancellation.
 */
export async function syncCalendar(now = Date.now()): Promise<SyncResult> {
  const ids = await getCalendarIds();
  if (!ids.length) return { status: 'skipped', reason: 'no-calendars' };
  if ((await getCalendarAccess()) !== 'granted') return { status: 'skipped', reason: 'no-access' }; // Home shows the access card

  const win = readWindow(now, await getLastSync());                                     // D-D
  const fresh = await fetchFresh(ids, await getKeywords(), win.from, win.to);
  const changes = diffEvents(fresh, await storedEvents(ids), await ignoredEvents(), win);
  const ctx = await matchContext();                                                     // aliases, companies, recruiters

  await applyChanges(changes, ctx, now);
  return { status: 'done', changes: changes.length };
}

/** Applies a diff in one transaction, then emits one change event. Exported so tests and tools can feed it events. */
export async function applyChanges(changes: Change[], ctx: MatchCtx, now: number) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const ch of changes) {
      if (ch.kind === 'new') {
        await deleteIgnored(db, ch.ev.eventId);          // it changed, so it is a candidate again
        await writeEvent(db, ch.ev, now);
        if (await restoreIfLinked(db, ch.ev.eventId, now)) continue;   // already has a round: never add or queue it twice
        const m = matchEvent(ch.ev, ctx);
        if (m.decision === 'attach') await attachRound(db, m.companyId!, ch.ev, now);   // sets auto_added_at
        else await writeReview(db, ch.ev.eventId, m.ranked, m.suggestedName, now);
      } else if (ch.kind === 'moved') {
        await writeEvent(db, ch.ev, now);                // cache follows the calendar; the round only gets a flag (R33)
        await flagMoved(db, ch.ev, now);
      } else if (ch.kind === 'cancelled') {
        await flagCancelled(db, ch.eventId, now);
      } else {
        await writeEvent(db, ch.ev, now);
        await updateLink(db, ch.ev, now);                // link change is applied directly
      }
    }
    await writeSetting(db, 'last_sync', now);
  });
  emitChange();
}

const DEBOUNCE_MS = 60_000;
let inFlight: Promise<SyncResult> | null = null;
let lastStart = 0;
let paused = false;

/**
 * Runs `job` while no calendar sync can start or be running (used by restore, which replaces every table).
 * Waits for a sync already in flight, and syncs requested meanwhile are skipped.
 */
export async function withSyncPaused<T>(job: () => Promise<T>): Promise<T> {
  paused = true;
  try {
    if (inFlight) await inFlight.catch(() => undefined);
    return await job();
  } finally {
    paused = false;
  }
}

/**
 * Entry point for every trigger. One sync at a time: a second caller gets the running one.
 * Automatic triggers (app open, return to foreground) are debounced to once per 60 s; buttons and pull-to-refresh pass force.
 */
export function requestSync({ force = false }: { force?: boolean } = {}, now = Date.now()): Promise<SyncResult> {
  if (paused) return Promise.resolve({ status: 'skipped', reason: 'paused' });
  if (inFlight) return inFlight;
  if (!force && now - lastStart < DEBOUNCE_MS) return Promise.resolve({ status: 'skipped', reason: 'debounced' });
  lastStart = now;
  inFlight = syncCalendar(now).finally(() => { inFlight = null; });
  return inFlight;
}
