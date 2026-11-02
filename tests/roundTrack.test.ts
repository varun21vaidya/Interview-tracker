import { roundMarks, trackLabel } from '../src/domain/roundTrack';
import type { Round } from '../src/types/entities';

const at = (mo: number, d: number, h = 0) => new Date(2026, mo - 1, d, h).getTime();
const NOW = at(10, 31, 10);
const round = (id: string, startsAt: number, o: Partial<Round> = {}): Round => ({
  id, companyId: 'c', source: 'manual', type: 'online', label: 'Technical', startsAt, orderAt: startsAt, result: 'pending', ...o,
});

describe('roundMarks', () => {
  it('follows orderAt, not input order', () => {
    const rs = [round('b', at(10, 20), { result: 'rejected' }), round('a', at(10, 10), { result: 'approved' })];
    expect(roundMarks(rs, NOW)).toEqual(['approved', 'rejected']);
  });
  it('an earlier pending round with a later round reads approved', () => {
    expect(roundMarks([round('a', at(10, 10)), round('b', at(10, 20))], NOW)).toEqual(['approved', 'pending']);
  });
  it('a future round is upcoming', () => {
    expect(roundMarks([round('a', at(11, 20))], NOW)).toEqual(['upcoming']);
  });
  it('cancelled wins', () => {
    expect(roundMarks([round('a', at(10, 10), { changeFlag: 'cancelled', result: 'approved' })], NOW)).toEqual(['cancelled']);
  });
  it('a stored didnt_happen stays', () => {
    expect(roundMarks([round('a', at(10, 10), { result: 'didnt_happen' })], NOW)).toEqual(['didnt_happen']);
  });
  it('empty list', () => {
    expect(roundMarks([], NOW)).toEqual([]);
    expect(trackLabel([])).toBe('No rounds yet');
  });
  it('label lists the marks in words', () => {
    expect(trackLabel(['approved', 'pending'])).toBe('Rounds: approved, waiting for result');
  });
});
