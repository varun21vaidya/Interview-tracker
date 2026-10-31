import type { Bundle, Round } from '../types/entities';
import { counted, isDone, roundNumber, waitingTarget, type Target } from './rounds';
import { pendingBubble, pingBubble, pingDates, rejectedLabel, type Bubble } from './pings';
import { shortDate } from './status';
import { daysBetween, plural } from './time';

const MODE: Record<Round['type'], string> = { walk_in: 'Walk-in', offline: 'In person', phone: 'Phone', online: 'Online' };
export const modeLabel = (t: Round['type']) => MODE[t];

export interface RoundRowModel {
  round: Round;
  number: number | null;      // null for "Didn't happen" (D1)
  title: string;              // "Round 2 · Technical", or just the label when unnumbered
  detail: string;             // "20 Oct · Online", plus the short note
  bubble: Bubble;
  actions: boolean;           // Mark approved / rejected / didn't happen go under this row
}

export interface CompanyDetailModel {
  rejected: boolean;
  subtitle: string;           // role, plus "out after round 2" when rejected
  bubbles: Bubble[];          // status bubble, then ping bubble
  approved: number;
  awaiting: number;
  rows: RoundRowModel[];      // oldest first
  timeline: boolean;          // no counted rounds: recruiter-call-only view (spec 3.7, C1)
  target: Target | null;
  pings: number[];
}

export function resultBubble(r: Round, now: number): Bubble {
  switch (r.result) {
    case 'approved': return { text: 'Approved', tone: 'green' };
    case 'rejected': return { text: 'Rejected', tone: 'red' };
    case 'didnt_happen': return { text: 'Didn’t happen', tone: 'grey' };
    default:
      // ASSUMPTION: a pending round still in the future reads "Upcoming"; the spec only shows the past case.
      return isDone(r, now)
        ? pendingBubble({ type: 'round', id: r.id, at: r.startsAt }, now)!
        : { text: 'Upcoming', tone: 'blue' };
  }
}

export function companyDetail(b: Bundle, now: number): CompanyDetailModel {
  const { company, rounds, calls, pings } = b;
  const rejected = company.status === 'rejected';
  const target = waitingTarget(rounds, calls, now);
  const c = counted(rounds);

  const rows = [...rounds].sort((x, y) => x.orderAt - y.orderAt).map<RoundRowModel>(round => {
    const number = roundNumber(round, rounds);
    const mode = [shortDate(round.startsAt), modeLabel(round.type)].join(' · ');
    return {
      round, number,
      title: number === null ? round.label : `Round ${number} · ${round.label}`,
      detail: round.note ? `${mode} · ${round.note}` : mode,
      bubble: resultBubble(round, now),
      actions: !rejected && target?.type === 'round' && target.id === round.id,
    };
  });

  const status: Bubble = rejected ? { text: 'Rejected', tone: 'red' }
    : pendingBubble(target, now) ?? { text: 'Active', tone: 'blue' };
  const ping = rejected ? null : pingBubble(target, pings, now);

  return {
    rejected,
    subtitle: [company.role, rejected ? rejectedLabel(company.rejectedReason, company.rejectedAfterRound) : undefined]
      .filter(Boolean).join(' · '),
    bubbles: ping ? [status, ping] : [status],
    approved: c.filter(r => r.result === 'approved').length,
    awaiting: c.filter(r => r.result === 'pending' && isDone(r, now)).length,
    rows,
    timeline: c.length === 0,
    target: rejected ? null : target,
    pings: pingDates(target, pings),
  };
}

/** "23 Oct (8 days ago)" for the Follow up card. */
export function agoText(at: number, now: number) {
  const d = daysBetween(at, now);
  return `${shortDate(at)} (${d <= 0 ? 'today' : `${plural(d)} ago`})`;
}
