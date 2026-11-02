import type { Bundle, Round } from '../types/entities';
import { safeHttps } from '../utils/links';
import { resultBubble } from './detail';
import { counted, effectiveResult, isDone, roundNumber, waitingTarget, type Target } from './rounds';
import { pendingBubble, pingBubble, type Bubble } from './pings';
import { shortDate } from './status';
import { needsAttention } from './syncRules';

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
    .flatMap(b => { const round = lastDone(b.rounds, now); return round && effectiveResult(round, b.rounds, now) !== 'pending' ? [{ b, round }] : []; })
    .sort((x, y) => y.round.startsAt - x.round.startsAt)
    .slice(0, 5);                                        // ASSUMPTION: 5 cards

  const changed = active.reduce((n, b) => n + b.rounds.filter(needsAttention).length, 0);
  return { next: upcoming[0], upcoming: upcoming.slice(1), waiting, previous, openReviews, changed };
}

export type HomeModel = ReturnType<typeof buildHome>;

// ---- View models: pure formatting of buildHome output, no queries ----

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Saturday, 31 Oct" */
export const longDate = (ms: number) => { const d = new Date(ms); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
/** "Sat 31 Oct 2026", for the date field. */
export const fullDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return `${DAYS[dt.getDay()].slice(0, 3)} ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
};
const pad2 = (n: number) => String(n).padStart(2, '0');
/** Stored form formats: "2026-10-31" and "14:30". */
export const dateText = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
export const timeText = (ms: number) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
/** "Tue 4 Nov" */
const dayDate = (ms: number) => { const d = new Date(ms); return `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const clock = (ms: number) => {
  const d = new Date(ms), h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** ASSUMPTION: "Updated just now" is from the screenshot; the older wording is inferred. */
export function updatedText(lastSync: number | null, now: number): string | null {
  if (lastSync === null) return null;
  const min = Math.floor((now - lastSync) / 60_000);
  if (min < 1) return 'Updated just now';
  if (min < 60) return `Updated ${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `Updated ${h}h ago` : `Updated ${shortDate(lastSync)}`;
}

export const dateLine = (now: number, lastSync: number | null) =>
  [longDate(now), updatedText(lastSync, now)].filter(Boolean).join(' · ');

/** "in 2h 15m". Rounds up so a fresh minute never shows one minute short. ASSUMPTION: days form and "now". */
export function countdown(startsAt: number, now: number): string {
  const mins = Math.ceil((startsAt - now) / 60_000);
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  const d = Math.floor(h / 24), rh = h % 24;
  return rh ? `in ${d}d ${rh}h` : `in ${d}d`;
}

/** "2:00 PM – 3:00 PM", with the day first when it is not today. */
export function timeRange(startsAt: number, endsAt: number | undefined, now: number) {
  const range = endsAt ? `${clock(startsAt)} – ${clock(endsAt)}` : clock(startsAt);
  return sameDay(startsAt, now) ? range : `${dayDate(startsAt)} · ${range}`;
}

export interface NextModel {
  companyId: string; roundId: string; name: string;
  chips: string[]; countdown: string; title: string; timeText: string;
  link: string | null;                                   // https only
  recruiterName?: string; phone?: string;
}

export function nextModel(item: HomeModel['next'], now: number): NextModel | null {
  if (!item) return null;
  const { b, round } = item;
  const n = roundNumber(round, b.rounds);
  const r = b.recruiter;
  return {
    companyId: b.company.id, roundId: round.id, name: b.company.name,
    chips: [round.source === 'calendar' ? 'Calendar' : 'Manual', ...(n ? [`Round ${n}`] : [])],
    countdown: countdown(round.startsAt, now),
    title: [round.label, b.company.role].filter(Boolean).join(' · '),
    timeText: timeRange(round.startsAt, round.endsAt, now),
    link: safeHttps(round.locationOrLink),
    recruiterName: r?.name, phone: r?.phone,
  };
}

export interface LaterModel { companyId: string; roundId: string; name: string; line: string }
export const laterModels = (items: HomeModel['upcoming'], now: number): LaterModel[] =>
  items.map(({ b, round }) => ({
    companyId: b.company.id, roundId: round.id, name: b.company.name,
    line: [round.label, timeRange(round.startsAt, round.endsAt, now)].join(' · '),
  }));

export interface WaitingModel {
  companyId: string; name: string; line: string;
  pending: Bubble; ping: Bubble | null;
  target: Target; phone?: string;
  template: 'follow_up' | 'check_fit';                   // recruiter-call-only gets Check fit (C1)
}

export const waitingModels = (items: HomeModel['waiting'], now: number): WaitingModel[] =>
  items.map(({ b, t }) => {
    const label = t.type === 'round' ? b.rounds.find(r => r.id === t.id)?.label ?? 'Interview' : 'Recruiter call';
    return {
      companyId: b.company.id, name: b.company.name, line: `${label} · ${shortDate(t.at)}`,
      pending: pendingBubble(t, now)!, ping: pingBubble(t, b.pings, now),
      target: t, phone: b.recruiter?.phone,
      template: t.type === 'round' ? 'follow_up' : 'check_fit',
    };
  });

export interface PreviousModel { companyId: string; name: string; line: string; bubble: Bubble }
export const previousModels = (items: HomeModel['previous'], now: number): PreviousModel[] =>
  items.map(({ b, round }) => ({
    companyId: b.company.id, name: b.company.name,
    line: [round.label, shortDate(round.startsAt), round.type === 'walk_in' ? 'Walk-in' : undefined].filter(Boolean).join(' · '),
    bubble: resultBubble(round, b.rounds, now),
  }));
