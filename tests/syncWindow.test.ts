import { readWindow } from '../src/domain/syncWindow';
const DAY = 86_400_000;
describe('readWindow (D-D)', () => {
  it('first read is 14 days back, 120 ahead', () => {
    expect(readWindow(1_000 * DAY, null)).toEqual({ from: 986 * DAY, to: 1_120 * DAY });
  });
  it('later reads are 60 days back, 120 ahead', () => {
    expect(readWindow(1_000 * DAY, 999 * DAY)).toEqual({ from: 940 * DAY, to: 1_120 * DAY });
  });
});
