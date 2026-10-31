// Spec section 5. Copied from Part 2 `domain/extract.ts`.
const MEET = /https:\/\/meet\.google\.com\/[a-z0-9-]+/i;
const ZOOM = /https:\/\/[\w.-]*zoom\.us\/j\/[^\s"<>]+/i;
const TEAMS = /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/i;

export const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ');

export function extract(text: string) {
  const t = stripHtml(text);
  const link = [MEET, ZOOM, TEAMS].map(r => t.match(r)?.[0]).find(Boolean);
  const phone = t.replace(/https?:\/\/\S+/g, ' ')        // URLs hold long digit runs (Zoom IDs)
    .match(/\+?\d[\d\s().-]{8,16}\d/g)
    ?.find(p => p.replace(/\D/g, '').length >= 10)?.trim();
  const emails = t.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
  return { link, phone, emails };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Word-boundary match, so "HR" does not hit "three". Compile once per sync. */
export function keywordMatcher(kws: string[]) {
  if (!kws.length) return () => false;
  const re = new RegExp(`\\b(?:${kws.map(esc).join('|')})\\b`, 'i');
  return (text: string) => re.test(text);
}
