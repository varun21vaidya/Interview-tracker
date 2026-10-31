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
