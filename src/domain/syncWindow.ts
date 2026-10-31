const DAY = 86_400_000;

/** D-D: first read looks 14 days back, later reads 60 days back, always 120 days ahead. */
export function readWindow(now: number, lastSync: number | null) {
  return { from: now - (lastSync === null ? 14 : 60) * DAY, to: now + 120 * DAY };
}
