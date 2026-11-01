import { titleGuess } from './matching';
import { counted, defaultPosition } from './rounds';
import type { Alias, Bundle, CalEvent, Company } from '../types/entities';

/** Every active company: those in `ranked` first in that order, the rest alphabetical (D7: nothing pre-selected). */
export function orderCompanies(companies: Company[], ranked: string[]): Company[] {
  const active = companies.filter(c => c.status === 'active');
  const byId = new Map(active.map(c => [c.id, c]));
  const first: Company[] = [];
  for (const id of ranked) {
    const c = byId.get(id);
    if (c && !first.includes(c)) first.push(c);
  }
  const rest = active.filter(c => !first.includes(c))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return [...first, ...rest];
}

/** "last: round 4", "recruiter call only" or "no rounds yet". */
export function lastRoundText(b: Pick<Bundle, 'rounds' | 'calls'>): string {
  const n = counted(b.rounds).length;
  if (n > 0) return `last: round ${n}`;
  return b.calls.length > 0 ? 'recruiter call only' : 'no rounds yet';
}

/** Chips run Round 1 to Round N+1; the default follows the event date. */
export function positionOptions(b: Pick<Bundle, 'rounds'>, startsAt: number) {
  const n = counted(b.rounds).length;
  return { positions: Array.from({ length: n + 1 }, (_, i) => i + 1), initial: defaultPosition(startsAt, b.rounds) };
}

/** Title aliases match by substring, so very short names would match unrelated titles. */
const MIN_TITLE_ALIAS = 4;

/** Aliases to remember, lowercased because matching compares lowercase. Generic titles add no title alias. */
export function aliasesFor(ev: CalEvent, companyId: string): Alias[] {
  const out: Alias[] = [];
  const org = ev.organizerEmail?.trim().toLowerCase();
  if (org) out.push({ type: 'organizer', pattern: org, companyId });
  const guess = titleGuess(ev.title)?.trim().toLowerCase();
  if (guess && guess.length >= MIN_TITLE_ALIAS) out.push({ type: 'title', pattern: guess, companyId });
  return out;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Tue 4 Nov, 3:00 PM · Online" */
export function eventWhen(ev: CalEvent): string {
  const d = new Date(ev.startsAt), h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${time} · ${ev.meetingLink ? 'Online' : 'Offline'}`;
}

export const placeLabel = (name: string, pos: number) => `Add to ${name} as round ${pos}`;
