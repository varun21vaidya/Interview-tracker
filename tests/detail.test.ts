import { agoText, companyDetail } from '../src/domain/detail';
import { firstName, telUri } from '../src/domain/contact';
import type { Bundle, Company, Ping, Round } from '../src/types/entities';

const at = (mo: number, d: number, h = 0) => new Date(2026, mo - 1, d, h).getTime();
const NOW = at(10, 31, 10);
const company = (o: Partial<Company> = {}): Company => ({ id: 'c', name: 'Co', role: 'SDE II', status: 'active', ...o });
const round = (id: string, startsAt: number, o: Partial<Round> = {}): Round => ({
  id, companyId: 'c', source: 'manual', type: 'online', label: 'Technical', startsAt, orderAt: startsAt, result: 'pending', ...o,
});
const ping = (targetId: string, pingedAt: number): Ping =>
  ({ id: `p${pingedAt}`, companyId: 'c', targetType: 'round', targetId, pingedAt, channel: 'mark' });
const umbrella = (): Bundle => ({
  company: company(), pings: [ping('r3', at(10, 29)), ping('r3', at(10, 26))], calls: [],
  rounds: [
    round('r1', at(10, 16), { type: 'phone', label: 'Recruiter screen', result: 'approved' }),
    round('r2', at(10, 20), { result: 'didnt_happen', note: 'interviewer didn’t join' }),
    round('r3', at(10, 23)),
  ],
});

describe('companyDetail', () => {
  it('Umbrella: Round 1, Didn’t happen without a number, Round 2', () => {
    const m = companyDetail(umbrella(), NOW);
    expect(m.rows.map(r => r.title)).toEqual(['Round 1 · Recruiter screen', 'Technical', 'Round 2 · Technical']);
    expect(m.rows[1].detail).toBe('20 Oct · Online · interviewer didn’t join');
    expect(m.rows.map(r => r.bubble.text)).toEqual(['Approved', 'Didn’t happen', 'Pending · 8 days']);
    expect(m.rows.map(r => r.actions)).toEqual([false, false, true]);
    expect(m.bubbles.map(b => b.text)).toEqual(['Pending · 8 days', 'Pinged 2 days ago']);
    expect([m.approved, m.awaiting, m.timeline]).toEqual([1, 1, false]);
    expect(m.pings).toEqual([at(10, 29), at(10, 26)]);
  });

  it('result set: no ping bubble and no action buttons', () => {
    const b = umbrella();
    b.rounds[2] = { ...b.rounds[2], result: 'approved' };
    const m = companyDetail(b, NOW);
    expect(m.bubbles).toEqual([{ text: 'Active', tone: 'blue' }]);
    expect(m.rows.some(r => r.actions)).toBe(false);
  });

  it('rejected after round 2, then reopened keeps the rounds', () => {
    const b = umbrella();
    b.rounds[2] = { ...b.rounds[2], result: 'rejected' };
    const rej = companyDetail({ ...b, company: company({ status: 'rejected', rejectedReason: 'round', rejectedAfterRound: 2 }) }, NOW);
    expect(rej.subtitle).toBe('SDE II · out after round 2');
    expect(rej.bubbles).toEqual([{ text: 'Rejected', tone: 'red' }]);
    expect(rej.target).toBeNull();
    const reopened = companyDetail(b, NOW);
    expect(reopened.bubbles).toEqual([{ text: 'Active', tone: 'blue' }]);
    expect(reopened.rows.map(r => r.number)).toEqual([1, null, 2]);
  });

  it('Wayne: recruiter call only shows the timeline and Awaiting schedule', () => {
    const b: Bundle = { company: company(), rounds: [], pings: [], calls: [{ id: 'k', companyId: 'c', callAt: at(10, 27, 11) }] };
    const m = companyDetail(b, NOW);
    expect(m.timeline).toBe(true);
    expect(m.target).toEqual({ type: 'recruiter_call', id: 'k', at: at(10, 27, 11) });
    expect(m.bubbles.map(x => x.text)).toEqual(['Awaiting schedule · 4 days', 'Haven’t pinged yet']);
  });

  it('only didn’t-happen rounds also gives the timeline (C1)', () => {
    const b: Bundle = { company: company(), calls: [], pings: [], rounds: [round('x', at(10, 20), { result: 'didnt_happen' })] };
    expect(companyDetail(b, NOW).timeline).toBe(true);
  });

  it('future pending round is Upcoming with no actions', () => {
    const b: Bundle = { company: company(), calls: [], pings: [], rounds: [round('f', at(11, 3))] };
    const m = companyDetail(b, NOW);
    expect(m.rows[0].bubble.text).toBe('Upcoming');
    expect(m.rows[0].actions).toBe(false);
  });
});

describe('earlier rounds count as approved once a later round exists', () => {
  const three = (o: Partial<Round> = {}): Bundle => ({
    company: company(), calls: [], pings: [],
    rounds: [round('r1', at(10, 10)), round('r2', at(10, 15)), round('r3', at(10, 20), o)],
  });

  it('forgotten results on rounds 1 and 2: only round 3 stays pending and gets the buttons', () => {
    const m = companyDetail(three(), NOW);
    expect(m.rows.map(r => r.bubble.text)).toEqual(['Approved', 'Approved', 'Pending · 11 days']);
    expect(m.rows.map(r => r.actions)).toEqual([false, false, true]);
    expect(m.rows.map(r => r.assumed)).toEqual([true, true, false]);
    expect([m.approved, m.awaiting]).toEqual([2, 1]);
  });

  it('a scheduled next round also counts, so nothing is left waiting', () => {
    const m = companyDetail(three({ startsAt: at(11, 5), orderAt: at(11, 5) }), NOW);
    expect(m.rows.map(r => r.bubble.text)).toEqual(['Approved', 'Approved', 'Upcoming']);
    expect(m.target).toBeNull();
    expect(m.awaiting).toBe(0);
  });

  it('a later round cancelled in the calendar proves nothing', () => {
    const m = companyDetail(three({ changeFlag: 'cancelled' }), NOW);
    expect(m.rows[1].bubble.text).not.toBe('Approved');
    expect(m.rows[1].assumed).toBe(false);
  });

  it('a later didn’t-happen round proves nothing, and a real result is never overwritten', () => {
    const none = companyDetail(three({ result: 'didnt_happen' }), NOW);
    expect(none.rows[1].bubble.text).toBe('Pending · 16 days');
    expect(none.rows[0].bubble.text).toBe('Approved');
    const b = three();
    b.rounds[0] = { ...b.rounds[0], result: 'didnt_happen' };
    const m = companyDetail(b, NOW);
    expect(m.rows[0].bubble.text).toBe('Didn’t happen');
    expect(m.rows[0].assumed).toBe(false);
  });

  it('a future round is never assumed approved', () => {
    const b: Bundle = { company: company(), calls: [], pings: [], rounds: [round('a', at(11, 3)), round('b', at(11, 9))] };
    expect(companyDetail(b, NOW).rows.map(r => r.bubble.text)).toEqual(['Upcoming', 'Upcoming']);
  });
});

describe('Change result', () => {
  const rows = (r3: Partial<Round>, c: Partial<Company> = {}) => companyDetail({
    company: company(c), calls: [], pings: [],
    rounds: [round('r1', at(10, 10), { result: 'approved' }), round('r2', at(10, 20), r3)],
  }, NOW).rows;

  it('offered on a set result, not on a pending or assumed one', () => {
    expect(rows({ result: 'approved' }).map(r => r.changeable)).toEqual([true, true]);
    expect(rows({ result: 'didnt_happen' }).map(r => r.changeable)).toEqual([true, true]);
    expect(rows({})[1].changeable).toBe(false);
    const assumed = companyDetail({ company: company(), calls: [], pings: [], rounds: [round('a', at(10, 10)), round('b', at(10, 20))] }, NOW);
    expect(assumed.rows[0].changeable).toBe(false);
  });

  it('in a rejected company only the rejection can be undone', () => {
    expect(rows({ result: 'rejected' }, { status: 'rejected', rejectedReason: 'round', rejectedAfterRound: 2 }).map(r => r.changeable)).toEqual([false, true]);
  });

  it('not offered on a round the calendar flagged, which has its own buttons', () => {
    expect(rows({ result: 'didnt_happen', changeFlag: 'cancelled' })[1].changeable).toBe(false);
  });
});

describe('helpers', () => {
  it('agoText', () => expect(agoText(at(10, 23), NOW)).toBe('23 Oct (8 days ago)'));
  it('telUri strips formatting, keeps leading plus', () => expect(telUri('+91 90000-00001')).toBe('tel:+919000000001'));
  it('firstName', () => { expect(firstName('Raj Mehta')).toBe('Raj'); expect(firstName(undefined)).toBeUndefined(); });
});
