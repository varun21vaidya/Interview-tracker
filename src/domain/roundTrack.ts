import type { Round } from '../types/entities';
import { effectiveResult, isDone } from './rounds';

export type RoundMark = 'approved' | 'rejected' | 'pending' | 'upcoming' | 'didnt_happen' | 'cancelled';

/** One mark per round, oldest first. Reuses effectiveResult so it cannot disagree with the bubbles. */
export function roundMarks(rounds: Round[], now: number): RoundMark[] {
  return [...rounds].sort((a, b) => a.orderAt - b.orderAt).map(r => {
    if (r.changeFlag === 'cancelled') return 'cancelled';
    const res = effectiveResult(r, rounds, now);
    if (res !== 'pending') return res;
    return isDone(r, now) ? 'pending' : 'upcoming';
  });
}

const WORD: Record<RoundMark, string> = {
  approved: 'approved', rejected: 'rejected', pending: 'waiting for result',
  upcoming: 'upcoming', didnt_happen: 'didn’t happen', cancelled: 'cancelled',
};
export const trackLabel = (m: RoundMark[]) => (m.length ? `Rounds: ${m.map(x => WORD[x]).join(', ')}` : 'No rounds yet');
