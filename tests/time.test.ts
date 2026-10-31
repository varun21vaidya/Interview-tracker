import { daysBetween, plural } from '../src/domain/time';

// All instants are built in device-local time, matching how daysBetween counts days.
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe('daysBetween', () => {
  it('is 0 on the same calendar day', () => {
    expect(daysBetween(at(2026, 10, 29, 9), at(2026, 10, 29, 18))).toBe(0);
  });

  it('counts calendar days, not 24h blocks (23:30 -> 00:30 next day = 1)', () => {
    expect(daysBetween(at(2026, 10, 29, 23, 30), at(2026, 10, 30, 0, 30))).toBe(1);
  });

  it('is 0 for 00:01 -> 23:59 on one day', () => {
    expect(daysBetween(at(2026, 10, 29, 0, 1), at(2026, 10, 29, 23, 59))).toBe(0);
  });

  it('counts across month boundaries (DST-safe via rounding)', () => {
    expect(daysBetween(at(2026, 3, 1, 12), at(2026, 4, 1, 12))).toBe(31);
    expect(daysBetween(at(2026, 10, 1, 12), at(2026, 11, 1, 12))).toBe(31);
  });

  it('is negative when "to" is earlier', () => {
    expect(daysBetween(at(2026, 10, 30), at(2026, 10, 28))).toBe(-2);
  });
});

describe('plural', () => {
  it('singular for 1', () => expect(plural(1)).toBe('1 day'));
  it('plural for 0 and many', () => {
    expect(plural(0)).toBe('0 days');
    expect(plural(8)).toBe('8 days');
  });
});
