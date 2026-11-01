import type { CalEvent, Recruiter, Round } from '../types/entities';
import { isEmail } from '../utils/links';
import { shortDate } from './status';
import { clock12 } from './time';

export const ONE_MINUTE = 60_000;

/** The existing, not yet linked round in a company that an invite should link to instead of inserting a duplicate. */
export function findNearRound(rounds: Pick<Round, 'id' | 'startsAt' | 'calendarEventId'>[], startsAt: number) {
  return rounds
    .filter(r => !r.calendarEventId && Math.abs(r.startsAt - startsAt) <= ONE_MINUTE)
    .sort((a, b) => Math.abs(a.startsAt - startsAt) - Math.abs(b.startsAt - startsAt))[0];
}

/** online when a link exists, otherwise offline. */
export const roundTypeFor = (ev: Pick<CalEvent, 'meetingLink'>): Round['type'] => (ev.meetingLink ? 'online' : 'offline');

const blank = (s?: string | null) => !s || s.trim() === '';

/**
 * Recruiter fields to write after an invite attaches: the organizer email and extracted phone,
 * only into fields that are empty. Whatever the user typed is never overwritten. Name is never set
 * (CalEvent has no organizer name). Returns null when there is nothing to write.
 */
export function prefillRecruiter(
  existing: Pick<Recruiter, 'email' | 'phone'> | undefined, ev: Pick<CalEvent, 'organizerEmail' | 'phone'>,
): { email?: string; phone?: string } | null {
  // Calendar data is untrusted: only a well-formed address and a phone-sized value are stored.
  const org = ev.organizerEmail?.trim(), tel = ev.phone?.trim();
  const email = blank(existing?.email) && org && isEmail(org) ? org : undefined;
  const phone = blank(existing?.phone) && tel && tel.length <= 30 ? tel : undefined;
  return email || phone ? { email, phone } : null;
}

// ---- Blue banner (rounds the sync added on its own) ----

export interface AutoAdded {
  roundId: string; companyId: string; companyName: string; eventId: string | null;
  title: string; startsAt: number; autoAddedAt: number;
}
/** ASSUMPTION: the banner stays 3 days after the auto-add, or until the interview starts. */
export const BANNER_DAYS = 3;
const DAY = 86_400_000;

export const autoAddedBanners = (items: AutoAdded[], now: number): AutoAdded[] =>
  items
    .filter(a => now - a.autoAddedAt <= BANNER_DAYS * DAY && a.startsAt > now)
    .sort((a, b) => b.autoAddedAt - a.autoAddedAt);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "New interview found: Stark Industries, Screening call on Tue 4 Nov". The company is not repeated when the title has it. */
export function bannerText(a: Pick<AutoAdded, 'companyName' | 'title' | 'startsAt'>): string {
  const d = new Date(a.startsAt);
  const when = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const title = a.title.trim() || 'Interview';
  const what = title.toLowerCase().includes(a.companyName.toLowerCase()) ? title : `${a.companyName}, ${title}`;
  return `New interview found: ${what} on ${when}`;
}

// ---- Moved / cancelled flags ----

export interface ChangeModel { kind: 'moved' | 'cancelled'; text: string; acknowledged: boolean }

/** The flag shown under a round. A cancelled round whose result is "Didn't happen" is acknowledged: only Reopen is left. */
export function changeOf(r: Pick<Round, 'changeFlag' | 'pendingStartsAt' | 'result'>): ChangeModel | undefined {
  if (r.changeFlag === 'moved') {
    const p = r.pendingStartsAt;
    return { kind: 'moved', acknowledged: false, text: p ? `Your calendar moved this to ${shortDate(p)}, ${clock12(p)}.` : 'Your calendar moved this invite.' };
  }
  if (r.changeFlag === 'cancelled') {
    const done = r.result === 'didnt_happen';
    return { kind: 'cancelled', acknowledged: done, text: done ? 'Cancelled in your calendar.' : 'This invite was cancelled in your calendar.' };
  }
  return undefined;
}

/** Rounds still waiting for a decision. An acknowledged cancellation no longer counts. */
export const needsAttention = (r: Pick<Round, 'changeFlag' | 'result'>) =>
  !!r.changeFlag && !(r.changeFlag === 'cancelled' && r.result === 'didnt_happen');
