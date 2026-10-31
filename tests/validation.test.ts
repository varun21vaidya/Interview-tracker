import { parseStart, roundLabel, validateAdd } from '../src/domain/validation';

const ok = { kind: 'online' as const, company: 'Umbrella', date: '2026-11-05', time: '' };

describe('validateAdd', () => {
  it('accepts company + date with no time', () => expect(validateAdd(ok)).toEqual({}));
  it('requires company and date', () => {
    expect(validateAdd({ ...ok, company: '  ', date: '' })).toEqual({ company: 'Company is required', date: 'Date is required' });
  });
  it('rejects impossible dates and bad times', () => {
    expect(validateAdd({ ...ok, date: '2026-02-30' }).date).toBeDefined();
    expect(validateAdd({ ...ok, time: '25:00' }).time).toBeDefined();
    expect(validateAdd({ ...ok, time: '10:30' })).toEqual({});
  });
});

describe('parseStart / roundLabel', () => {
  it('combines date and time in local time', () => {
    expect(parseStart('2026-11-05', '14:30')).toBe(new Date(2026, 10, 5, 14, 30).getTime());
  });
  it('defaults the time to 09:00', () => expect(parseStart('2026-11-05', '')).toBe(new Date(2026, 10, 5, 9, 0).getTime()));
  it('empty round name is Interview', () => {
    expect(roundLabel('  ')).toBe('Interview');
    expect(roundLabel(' Technical round ')).toBe('Technical round');
  });
});
