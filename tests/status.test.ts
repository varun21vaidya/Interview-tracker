import { companyRow, matchesQuery, shortDate, waitingAge } from '../src/domain/status';
import type { Bundle, Company, Ping, Round } from '../src/types/entities';

const at = (mo: number, d: number, h = 0, mi = 0) => new Date(2026, mo - 1, d, h, mi).getTime();
const NOW = at(10, 31, 10, 42); // Sat 31 Oct, as in the screenshot

const company = (o: Partial<Company> = {}): Company => ({ id: 'c', name: 'Co', status: 'active', ...o });
const round = (id: string, startsAt: number, o: Partial<Round> = {}): Round => ({
  id, companyId: 'c', source: 'manual', type: 'online', label: 'Technical', startsAt, orderAt: startsAt, result: 'pending', ...o,
});
const bundle = (o: Partial<Bundle> = {}): Bundle => ({ company: company(), rounds: [], calls: [], pings: [], ...o });
const ping = (targetId: string, pingedAt: number, targetType: Ping['targetType'] = 'round'): Ping =>
  ({ id: `p${pingedAt}`, companyId: 'c', targetType, targetId, pingedAt, channel: 'mark' });

describe('companyRow', () => {
  it('Umbrella: pending round, pinged', () => {
    const b = bundle({
      rounds: [round('r1', at(10, 16), { result: 'approved' }), round('r2', at(10, 23))],
      pings: [ping('r2', at(10, 29)), ping('r2', at(10, 26))],
    });
    expect(companyRow(b, NOW)).toEqual({
      statusLine: 'Last round 23 Oct · Technical',
      bubbles: [{ text: 'Pending · 8 days', tone: 'blue' }, { text: 'Pinged 2 days ago', tone: 'green' }],
    });
  });

  it('Wayne: recruiter call only', () => {
    const b = bundle({ calls: [{ id: 'k', companyId: 'c', callAt: at(10, 27, 11) }] });
    expect(companyRow(b, NOW)).toEqual({
      statusLine: 'Recruiter call 27 Oct · not scheduled',
      bubbles: [{ text: 'Awaiting schedule · 4 days', tone: 'blue' }, { text: 'Haven’t pinged yet', tone: 'grey' }],
    });
  });

  it('Globex: drops a trailing "round" from the label; 1 day, not pinged', () => {
    const b = bundle({ rounds: [round('r1', at(10, 30), { label: 'HR round' })] });
    expect(companyRow(b, NOW)).toEqual({
      statusLine: 'Last round 30 Oct · HR',
      bubbles: [{ text: 'Pending · 1 day', tone: 'blue' }, { text: 'Haven’t pinged yet', tone: 'grey' }],
    });
  });

  it('Acme: latest round approved, next one today, no pending or ping bubble', () => {
    const b = bundle({
      rounds: [
        round('r1', at(10, 1), { result: 'approved' }), round('r2', at(10, 8), { result: 'approved' }),
        round('r3', at(10, 15), { result: 'approved' }), round('r4', at(10, 31, 13), { endsAt: at(10, 31, 14) }),
      ],
      pings: [ping('r3', at(10, 20))], // an old ping must not resurface a bubble
    });
    expect(companyRow(b, NOW)).toEqual({
      statusLine: 'Round 3 approved · round 4 today',
      bubbles: [{ text: 'Interview today', tone: 'blue' }],
    });
  });

  it('a round that did not happen gets no number', () => {
    const b = bundle({
      rounds: [round('r1', at(10, 10), { result: 'approved' }), round('r2', at(10, 12), { result: 'didnt_happen' }),
        round('r3', at(10, 20), { result: 'approved' })],
    });
    expect(companyRow(b, NOW).statusLine).toBe('Round 2 approved · next not scheduled');
  });

  it('upcoming round on a later day', () => {
    const b = bundle({ rounds: [round('r1', at(10, 20), { result: 'approved' }), round('r2', at(11, 4, 15))] });
    expect(companyRow(b, NOW).statusLine).toBe('Round 1 approved · round 2 in 4 days');
    const t = bundle({ rounds: [round('r1', at(10, 20), { result: 'approved' }), round('r2', at(11, 1, 9))] });
    expect(companyRow(t, NOW).statusLine).toBe('Round 1 approved · round 2 tomorrow');
  });

  it('only future rounds, and nothing at all', () => {
    expect(companyRow(bundle({ rounds: [round('r1', at(11, 4))] }), NOW))
      .toEqual({ statusLine: 'Round 1 in 4 days', bubbles: [] });
    expect(companyRow(bundle(), NOW)).toEqual({ statusLine: 'No interviews yet', bubbles: [] });
  });

  it('rejected rows use rejectedLabel (D13) and one red bubble', () => {
    const r1 = bundle({ company: company({ status: 'rejected', rejectedReason: 'round', rejectedAfterRound: 4 }) });
    expect(companyRow(r1, NOW)).toEqual({ statusLine: 'out after round 4', bubbles: [{ text: 'Rejected', tone: 'red' }] });
    const r2 = bundle({ company: company({ status: 'rejected', rejectedReason: 'not_moving_forward' }) });
    expect(companyRow(r2, NOW).statusLine).toBe('Recruiter call only, not moving forward');
  });
});

describe('waitingAge', () => {
  it('is the days waited, or -1 when not waiting', () => {
    expect(waitingAge(bundle({ rounds: [round('r1', at(10, 23))] }), NOW)).toBe(8);
    expect(waitingAge(bundle(), NOW)).toBe(-1);
  });
});

describe('matchesQuery', () => {
  const b = bundle({
    company: company({ name: 'Umbrella Labs', role: 'SDE II' }),
    recruiter: { companyId: 'c', name: 'Raj Mehta', email: 'raj@umbrella.example' },
  });
  it.each(['umbrella', 'SDE', 'raj m', 'RAJ@UMB', '  labs  ', ''])('matches %p', q => expect(matchesQuery(b, q)).toBe(true));
  it('does not match unrelated text, and tolerates missing fields', () => {
    expect(matchesQuery(b, 'zzz')).toBe(false);
    expect(matchesQuery(bundle(), 'raj')).toBe(false);
  });
});

it('shortDate', () => expect(shortDate(at(10, 3))).toBe('3 Oct'));
