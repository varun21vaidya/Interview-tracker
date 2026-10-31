import type { Bundle } from '../types/entities';
import { counted, isDone, roundNumber, waitingTarget } from './rounds';
import { pendingBubble, pingBubble, rejectedLabel, type Bubble } from './pings';
import { daysBetween, plural } from './time';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "23 Oct", device time. */
export const shortDate = (ms: number) => { const d = new Date(ms); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

/** ASSUMPTION: the screenshot shows "HR" for a round labelled "HR round", so a trailing "round" is dropped. */
const shortLabel = (label: string) => label.replace(/\s+round$/i, '') || label;

/** ASSUMPTION: "today" is from the screenshot; "tomorrow" and "in N days" are inferred. */
function when(at: number, now: number) {
  const d = daysBetween(now, at);
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${plural(d)}`;
}

export interface CompanyRowModel { statusLine: string; bubbles: Bubble[] }

export function companyRow(b: Bundle, now: number): CompanyRowModel {
  const { company, rounds, calls, pings } = b;

  // Rejected rows: label from pings.ts (D13). The screen puts it after the role ("Backend Developer · out after round 1").
  if (company.status === 'rejected') {
    return {
      statusLine: rejectedLabel(company.rejectedReason, company.rejectedAfterRound),
      bubbles: [{ text: 'Rejected', tone: 'red' }],
    };
  }

  const c = counted(rounds);
  const done = c.filter(r => isDone(r, now));
  const last = done[done.length - 1];
  const upcoming = c.find(r => !isDone(r, now));

  let statusLine: string;
  if (c.length === 0) {
    const call = [...calls].sort((x, y) => y.callAt - x.callAt)[0];
    // Format from the screenshot. ASSUMPTION: "No interviews yet" when there is no call either.
    statusLine = call ? `Recruiter call ${shortDate(call.callAt)} · not scheduled` : 'No interviews yet';
  } else if (last && last.result === 'pending') {
    statusLine = `Last round ${shortDate(last.startsAt)} · ${shortLabel(last.label)}`; // screenshot
  } else if (last) {
    // "Round 3 approved · round 4 today" is from the screenshot. ASSUMPTION: the other shapes below.
    const head = `Round ${roundNumber(last, rounds)} ${last.result}`;
    statusLine = upcoming
      ? `${head} · round ${roundNumber(upcoming, rounds)} ${when(upcoming.startsAt, now)}`
      : `${head} · next not scheduled`;
  } else {
    // ASSUMPTION: only future rounds exist.
    statusLine = `Round ${roundNumber(upcoming!, rounds)} ${when(upcoming!.startsAt, now)}`;
  }

  const bubbles: Bubble[] = [];
  if (upcoming && daysBetween(now, upcoming.startsAt) === 0) bubbles.push({ text: 'Interview today', tone: 'blue' });
  const target = waitingTarget(rounds, calls, now); // null once the latest round has a result: no ping bubble
  const pending = pendingBubble(target, now), ping = pingBubble(target, pings, now);
  if (pending) bubbles.push(pending);
  if (ping) bubbles.push(ping);
  return { statusLine, bubbles };
}

/**
 * Active list order. ASSUMPTION (inferred from the screenshot: 8, 4, 1 days, then Acme with none):
 * longest wait first, companies not waiting on anything last, ties keep their loaded order.
 */
export function waitingAge(b: Bundle, now: number): number {
  const t = waitingTarget(b.rounds, b.calls, now);
  return t ? daysBetween(t.at, now) : -1;
}

/** Search is a JS filter, not SQL (Part 2 section 4): company, role, recruiter name and email. */
export function matchesQuery(b: Bundle, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [b.company.name, b.company.role, b.recruiter?.name, b.recruiter?.email]
    .some(f => f?.toLowerCase().includes(q));
}
