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
