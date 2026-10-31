const DAY = 86_400_000;
const dayStart = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Whole calendar days between two instants in device time. Math.round absorbs 23/25-hour DST days. */
export const daysBetween = (from: number, to: number) => Math.round((dayStart(to) - dayStart(from)) / DAY);
export const plural = (n: number) => (n === 1 ? '1 day' : `${n} days`);
