import { ATTACH_AT, matchEvent, titleGuess, type MatchCtx } from '../src/domain/matching';
import { aliasesFor, lastRoundText, orderCompanies, positionOptions } from '../src/domain/review';
import { orderAtFor, roundNumber } from '../src/domain/rounds';
import type { CalEvent, Company, Round } from '../src/types/entities';

const co = (id: string, name: string, o: Partial<Company> = {}): Company => ({ id, name, status: 'active', ...o });
const ev = (title: string, organizerEmail?: string): CalEvent => ({ eventId: 'e1', calendarId: 'cal', title, startsAt: 1000, organizerEmail });
const ctx = (o: Partial<MatchCtx> = {}): MatchCtx => ({ aliases: [], companies: [], recruiters: [], ...o });

const acme = co('acme', 'Acme');
const umb = co('umb', 'Umbrella Labs');

describe('matchEvent (D-C)', () => {
  it('keeps ATTACH_AT at 3', () => expect(ATTACH_AT).toBe(3));

  it('generic title plus gmail organizer goes to review with nothing preselected', () => {
    const m = matchEvent(ev('Interview', 'hr@gmail.com'), ctx({ companies: [acme, umb] }));
    expect(m).toEqual({ decision: 'review', companyId: undefined, ranked: [], suggestedName: undefined });
  });

  it('alias plus recruiter domain attaches', () => {
    const m = matchEvent(ev('Technical round', 'hr@acme.com'), ctx({
      companies: [acme],
      aliases: [{ type: 'organizer', pattern: 'hr@acme.com', companyId: 'acme' }],
      recruiters: [{ companyId: 'acme', email: 'jane@acme.com' }],
    }));
    expect(m.decision).toBe('attach');
    expect(m.companyId).toBe('acme');
  });

  it('one signal alone goes to review but is ranked', () => {
    const m = matchEvent(ev('Call', 'hr@acme.com'), ctx({
      aliases: [{ type: 'organizer', pattern: 'hr@acme.com', companyId: 'acme' }],
    }));
    expect(m.decision).toBe('review');
    expect(m.ranked).toEqual(['acme']);
  });

  it('a public recruiter domain never counts', () => {
    const m = matchEvent(ev('Call', 'jane@gmail.com'), ctx({ recruiters: [{ companyId: 'acme', email: 'jane@gmail.com' }] }));
    expect(m.ranked).toEqual([]);
  });

  it('two companies tied at 3+ goes to review', () => {
    const m = matchEvent(ev('Interview with Acme', 'hr@shared.com'), ctx({
      companies: [acme, umb],
      aliases: [
        { type: 'organizer', pattern: 'hr@shared.com', companyId: 'acme' },
        { type: 'organizer', pattern: 'hr@shared.com', companyId: 'umb' },
        { type: 'title', pattern: 'interview', companyId: 'umb' },
      ],
    }));
    expect(m.decision).toBe('review');
    expect(m.companyId).toBeUndefined();
    expect(m.ranked).toHaveLength(2);
  });

  it('unknown "Stark Industries – Screening call" goes to review with suggestedName', () => {
    const m = matchEvent(ev('Stark Industries – Screening call', 'hr@gmail.com'), ctx({ companies: [acme] }));
    expect(m.decision).toBe('review');
    expect(m.suggestedName).toBe('Stark Industries');
  });

  it('a known company name gives points but no suggestedName', () => {
    const m = matchEvent(ev('Interview with Acme'), ctx({ companies: [acme] }));
    expect(m.suggestedName).toBeUndefined();
    expect(m.ranked).toEqual(['acme']);
    expect(m.decision).toBe('review');
  });
});

describe('titleGuess', () => {
  it('reads both title shapes and ignores generic titles', () => {
    expect(titleGuess('Interview with Acme')).toBe('Acme');
    expect(titleGuess('Acme – Technical round')).toBe('Acme');
    expect(titleGuess('Technical round')).toBeNull();
    expect(titleGuess('HR - Interview')).toBeNull();
  });
});

describe('review helpers', () => {
  it('lists every active company, ranked first in order, the rest alphabetical', () => {
    const cs = [co('z', 'Zeta'), co('a', 'alpha'), co('r', 'Rejected Inc', { status: 'rejected' }), co('m', 'Mid'), co('b', 'Beta')];
    expect(orderCompanies(cs, ['m', 'z', 'gone', 'r']).map(c => c.id)).toEqual(['m', 'z', 'a', 'b']);
  });

  it('lowercases aliases and skips generic titles', () => {
    expect(aliasesFor(ev('Stark Industries – Screening', 'HR@Stark.COM '), 'c')).toEqual([
      { type: 'organizer', pattern: 'hr@stark.com', companyId: 'c' },
      { type: 'title', pattern: 'stark industries', companyId: 'c' },
    ]);
    expect(aliasesFor(ev('Interview'), 'c')).toEqual([]);
    expect(aliasesFor(ev('AB – Screening'), 'c')).toEqual([]);   // too short to match safely by substring
  });

  const round = (id: string, orderAt: number, result: Round['result'] = 'pending'): Round => ({
    id, companyId: 'c', source: 'manual', type: 'online', label: 'x', startsAt: orderAt, orderAt, result,
  });

  it('describes the last round and position chips', () => {
    const rs = [round('1', 100), round('2', 200)];
    expect(lastRoundText({ rounds: rs, calls: [] })).toBe('last: round 2');
    expect(lastRoundText({ rounds: [], calls: [{ id: 'k', companyId: 'c', callAt: 1 }] })).toBe('recruiter call only');
    expect(lastRoundText({ rounds: [], calls: [] })).toBe('no rounds yet');
    expect(positionOptions({ rounds: rs }, 150)).toEqual({ positions: [1, 2, 3], initial: 2 });
    expect(positionOptions({ rounds: [] }, 150)).toEqual({ positions: [1], initial: 1 });
  });

  it('placing as round 1 renumbers the later rounds', () => {
    const rs = [round('a', 100), round('b', 200)];
    const startsAt = 300;                                        // by date this would be round 3
    const placed = round('new', orderAtFor(1, startsAt, rs));
    const all = [...rs, { ...placed, startsAt }];
    expect(roundNumber(all.find(r => r.id === 'new')!, all)).toBe(1);
    expect(roundNumber(all.find(r => r.id === 'a')!, all)).toBe(2);
    expect(roundNumber(all.find(r => r.id === 'b')!, all)).toBe(3);
  });
});
