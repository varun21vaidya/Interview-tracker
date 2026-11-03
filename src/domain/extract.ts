// Spec section 5. Copied from Part 2 `domain/extract.ts`.
const MEET = /https:\/\/meet\.google\.com\/[a-z0-9-]+/i;
const ZOOM = /https:\/\/[\w.-]*zoom\.us\/j\/[^\s"<>]+/i;
const TEAMS = /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/i;

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
/** Tags become spaces (line breaks stay line breaks, so a signature keeps its lines) and common entities are decoded. */
export const stripHtml = (s: string) => s
  .replace(/<(?:br|\/p|\/div|\/li|\/tr)\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, m => ENTITIES[m]);

/** Addresses that are never a person to write to: calendars, no-reply senders, image file names. */
const NOT_A_PERSON = /(?:^|[._-])(?:no-?reply|do-?not-?reply|mailer-daemon|notifications?|calendar-notification|invites?)(?:[._-]|@)|@(?:[\w-]+\.)*(?:calendar\.google\.com|resource\.calendar\.google\.com|group\.calendar\.google\.com)$|\.(?:png|jpe?g|gif|svg|webp)$/i;
export const isPersonEmail = (e: string) => !NOT_A_PERSON.test(e);

/** Digits that follow these are a conference code or dial-in, not the recruiter's number. */
const DIAL_IN = /(?:pin|passcode|meeting\s*id|conference\s*id|access\s*code|dial[- ]?in|phone\s*numbers?\s*:?\s*\(?[a-z]{2}\)?)/i;
const PHONE_LABEL = /(?:mobile|mob|cell|phone|ph|tel|telephone|contact|call|whatsapp|m|p|t)\s*[:.\-–]?\s*$/i;
const PHONE_RE = /(?:\+|\b00)?\(?\d{1,4}\)?[\s.-]?\(?\d{2,5}\)?(?:[\s.-]?\d{2,5}){1,3}/g;

/** Plausible phone numbers in order, each with how trustworthy it looks (labelled > later in text). */
function phones(t: string): string[] {
  const text = t.replace(/https?:\/\/\S+/g, ' ');            // URLs hold long digit runs (Zoom IDs)
  const found: { p: string; at: number; labelled: boolean }[] = [];
  for (const m of text.matchAll(PHONE_RE)) {
    const raw = m[0].trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) continue;
    if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(raw) || /^\d{1,2}[-./]\d{1,2}[-./]\d{4}/.test(raw)) continue;   // a date
    const before = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0);
    if (DIAL_IN.test(before)) continue;
    found.push({ p: raw.replace(/\s+/g, ' '), at: m.index ?? 0, labelled: PHONE_LABEL.test(before.trimEnd()) || PHONE_LABEL.test(before) });
  }
  // A labelled number wins; otherwise the last one, because signatures sit at the end of the message.
  const labelled = found.filter(f => f.labelled);
  return [...(labelled.length ? labelled : found.reverse())].map(f => f.p);
}

export function extract(text: string) {
  const t = stripHtml(text);
  const link = [MEET, ZOOM, TEAMS].map(r => t.match(r)?.[0]).find(Boolean);
  const phone = phones(t)[0];
  const seen = new Set<string>();
  const emails = (t.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []).filter(e => {
    const k = e.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  return { link, phone, emails, contactEmail: emails.find(isPersonEmail)?.toLowerCase() };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Word-boundary match, so "HR" does not hit "three". Compile once per sync. */
export function keywordMatcher(kws: string[]) {
  if (!kws.length) return () => false;
  const re = new RegExp(`\\b(?:${kws.map(esc).join('|')})\\b`, 'i');
  return (text: string) => re.test(text);
}
