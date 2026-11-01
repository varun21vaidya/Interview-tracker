const DAY = 86_400_000;
const dayStart = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Whole calendar days between two instants in device time. Math.round absorbs 23/25-hour DST days. */
export const daysBetween = (from: number, to: number) => Math.round((dayStart(to) - dayStart(from)) / DAY);
export const plural = (n: number) => (n === 1 ? '1 day' : `${n} days`);
/** "3:00 PM" */
export const clock12 = (ms: number) => {
  const d = new Date(ms), h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
