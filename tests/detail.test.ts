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

describe('helpers', () => {
  it('agoText', () => expect(agoText(at(10, 23), NOW)).toBe('23 Oct (8 days ago)'));
  it('telUri strips formatting, keeps leading plus', () => expect(telUri('+91 90000-00001')).toBe('tel:+919000000001'));
  it('firstName', () => { expect(firstName('Raj Mehta')).toBe('Raj'); expect(firstName(undefined)).toBeUndefined(); });
});
