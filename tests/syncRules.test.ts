import { buildHome } from '../src/domain/home';
import { companyDetail } from '../src/domain/detail';
import { waitingTarget } from '../src/domain/rounds';
import {
  autoAddedBanners, bannerText, changeOf, findNearRound, needsAttention, prefillRecruiter, roundTypeFor, type AutoAdded,
} from '../src/domain/syncRules';
import type { Bundle, Company, RecruiterCall, Round } from '../src/types/entities';

const MIN = 60_000, DAY = 86_400_000;
const at = (d: number, h = 0, m = 0) => new Date(2026, 10, d, h, m).getTime();
const NOW = at(1, 12);

const round = (id: string, startsAt: number, o: Partial<Round> = {}): Round => ({
  id, companyId: 'c', source: 'manual', type: 'online', label: 'x', startsAt, orderAt: startsAt, result: 'pending', ...o,
});

describe('findNearRound (attachRound links instead of inserting)', () => {
  const t = at(4, 15);
  it('links a round within one minute, either side', () => {
    expect(findNearRound([round('a', t + MIN)], t)?.id).toBe('a');
    expect(findNearRound([round('a', t - MIN)], t)?.id).toBe('a');
  });
  it('does not link a round more than a minute away', () => {
    expect(findNearRound([round('a', t + MIN + 1)], t)).toBeUndefined();
  });
  it('does not link a round that already has an event', () => {
    expect(findNearRound([round('a', t, { calendarEventId: 'e1' })], t)).toBeUndefined();
  });
  it('picks the closest of several', () => {
    expect(findNearRound([round('a', t + 50_000), round('b', t + 10_000)], t)?.id).toBe('b');
  });
});

describe('roundTypeFor', () => {
  it('is online with a link, otherwise offline', () => {
    expect(roundTypeFor({ meetingLink: 'https://meet.google.com/a' })).toBe('online');
    expect(roundTypeFor({})).toBe('offline');
  });
});

describe('prefillRecruiter (attachRound prefill)', () => {
  const ev = { organizerEmail: 'hr@acme.com', phone: '+91 98765 43210' };
  it('fills both empty fields from the event', () => {
    expect(prefillRecruiter(undefined, ev)).toEqual({ email: 'hr@acme.com', phone: '+91 98765 43210' });
    expect(prefillRecruiter({ email: '', phone: '  ' }, ev)).toEqual({ email: 'hr@acme.com', phone: '+91 98765 43210' });
  });
  it('never overwrites what the user typed', () => {
    expect(prefillRecruiter({ email: 'me@typed.com', phone: '111' }, ev)).toBeNull();
    expect(prefillRecruiter({ email: 'me@typed.com' }, ev)).toEqual({ phone: '+91 98765 43210' });
    expect(prefillRecruiter({ phone: '111' }, ev)).toEqual({ email: 'hr@acme.com' });
  });
  it('writes nothing when the event has nothing to give', () => {
    expect(prefillRecruiter(undefined, {})).toBeNull();
    expect(prefillRecruiter(undefined, { organizerEmail: '  ' })).toBeNull();
  });
  it('ignores malformed or oversized calendar values', () => {
    expect(prefillRecruiter(undefined, { organizerEmail: 'a@b.com?bcc=x@evil.com', phone: '1'.repeat(31) })).toBeNull();
  });
  it('has no name field to set', () => {
    expect(Object.keys(prefillRecruiter(undefined, ev)!)).not.toContain('name');
  });
});

describe('blue banner', () => {
  const a = (o: Partial<AutoAdded> = {}): AutoAdded => ({
    roundId: 'r', companyId: 'c', companyName: 'Stark Industries', eventId: 'e', title: 'Screening call',
    startsAt: at(4, 15), autoAddedAt: NOW - DAY, ...o,
  });
  it('words it like the spec', () => {
    expect(bannerText(a())).toBe('New interview found: Stark Industries, Screening call on Wed 4 Nov');
  });
  it('does not repeat the company when the title has it', () => {
    expect(bannerText(a({ title: 'Stark Industries – Screening call' })))
      .toBe('New interview found: Stark Industries – Screening call on Wed 4 Nov');
  });
  it('shows recent upcoming auto-adds only', () => {
    const items = [a({ roundId: 'new' }), a({ roundId: 'old', autoAddedAt: NOW - 4 * DAY }), a({ roundId: 'past', startsAt: NOW - MIN })];
    expect(autoAddedBanners(items, NOW).map(x => x.roundId)).toEqual(['new']);
  });
});

describe('moved and cancelled flags', () => {
  it('describes a move without applying it', () => {
    const c = changeOf({ changeFlag: 'moved', pendingStartsAt: at(5, 15), result: 'pending' })!;
    expect(c.kind).toBe('moved');
    expect(c.text).toContain('5 Nov');
    expect(c.text).toContain('3:00 PM');
    expect(c.acknowledged).toBe(false);
  });
  it('a cancelled round is acknowledged once it is marked Didn’t happen', () => {
    expect(changeOf({ changeFlag: 'cancelled', result: 'pending' })!.acknowledged).toBe(false);
    expect(changeOf({ changeFlag: 'cancelled', result: 'didnt_happen' })!.acknowledged).toBe(true);
  });
  it('no flag, no model', () => expect(changeOf({ result: 'pending' })).toBeUndefined());
  it('only unresolved flags need attention', () => {
    expect(needsAttention({ changeFlag: 'moved', result: 'pending' })).toBe(true);
    expect(needsAttention({ changeFlag: 'cancelled', result: 'pending' })).toBe(true);
    expect(needsAttention({ changeFlag: 'cancelled', result: 'didnt_happen' })).toBe(false);
    expect(needsAttention({ result: 'pending' })).toBe(false);
  });

  const company: Company = { id: 'c', name: 'Acme', status: 'active' };
  const bundle = (rounds: Round[]): Bundle => ({ company, rounds, calls: [], pings: [] });

  it('the company page row carries the flag, and Home counts it', () => {
    const flagged = round('a', at(5, 15), { changeFlag: 'moved', pendingStartsAt: at(6, 15) });
    const b = bundle([flagged, round('b', at(7, 15))]);
    const rows = companyDetail(b, NOW).rows;
    expect(rows.find(r => r.round.id === 'a')!.change?.kind).toBe('moved');
    expect(rows.find(r => r.round.id === 'b')!.change).toBeUndefined();
    expect(buildHome([b], 0, NOW).changed).toBe(1);
  });
  it('an acknowledged cancellation is no longer counted by Home', () => {
    const b = bundle([round('a', at(5, 15), { changeFlag: 'cancelled', result: 'didnt_happen' })]);
    expect(buildHome([b], 0, NOW).changed).toBe(0);
  });
});

describe('an invite for a recruiter-call-only company (D2, C3)', () => {
  const call: RecruiterCall = { id: 'k', companyId: 'c', callAt: NOW - 3 * DAY };
  it('is Awaiting schedule before, and the recruiter-call ping stops applying once it is Round 1', () => {
    expect(waitingTarget([], [call], NOW)?.type).toBe('recruiter_call');
    const added = round('new', NOW + 2 * DAY, { source: 'calendar', autoAddedAt: NOW });
    expect(waitingTarget([added], [call], NOW)).toBeNull();                       // upcoming round: nothing to ping yet
    const pastRound = round('new', NOW - DAY, { source: 'calendar' });
    expect(waitingTarget([pastRound], [call], NOW)).toEqual({ type: 'round', id: 'new', at: pastRound.startsAt });
    const detail = companyDetail({ company: { id: 'c', name: 'Wayne Tech', status: 'active' }, rounds: [added], calls: [call], pings: [] }, NOW);
    expect(detail.rows[0].number).toBe(1);
    expect(detail.timeline).toBe(false);
  });
});
