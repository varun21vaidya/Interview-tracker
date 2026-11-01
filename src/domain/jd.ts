/** Job description helpers (spec 3.3, 3.8, 3.10). Pure; no I/O. */
import { safeHttps } from '../utils/links';

export const countWords = (text: string) => {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
};

/** "1,850 words". Grouped by hand: toLocaleString is not reliable on every JS engine. */
export const formatWords = (n: number) =>
  `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${n === 1 ? 'word' : 'words'}`;

/** Preview text for the card: whitespace collapsed. */
export const previewText = (raw?: string | null) => (raw ?? '').replace(/\s+/g, ' ').trim();

// ---- Headings and blocks ----

export const HEADINGS = ['About', 'Responsibilities', 'Requirements', 'Nice to have', 'Benefits'] as const;
export type Heading = (typeof HEADINGS)[number];

const HEADING_RE: Record<Heading, RegExp> = {
  About: /^about\b/i,
  Responsibilities: /^(key |main |your )?responsibilities\b/i,
  Requirements: /^(key |basic |minimum )?requirements\b/i,
  'Nice to have': /^nice[- ]to[- ]haves?\b/i,
  Benefits: /^(perks (and|&) )?benefits\b/i,
};
const MAX_HEADING_CHARS = 40;
const MAX_HEADING_WORDS = 5;

/** The canonical heading a line stands for, or null. Short line, no trailing period (spec 3.8). */
export function headingOf(line: string): Heading | null {
  const t = line.trim().replace(/^#{1,6}\s+/, '').replace(/:$/, '').trim();
  if (t === '' || t.length > MAX_HEADING_CHARS || t.endsWith('.')) return null;
  if (t.split(/\s+/).length > MAX_HEADING_WORDS) return null;
  return HEADINGS.find(h => HEADING_RE[h].test(t)) ?? null;
}

/** One paragraph. A heading line always starts its own block, so a chip can jump to it. */
export interface Block { id: string; heading?: string; body: string }

export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let heading: string | undefined;
  let lines: string[] = [];
  const flush = () => {
    const body = lines.join('\n').trim();
    if (heading !== undefined || body !== '') blocks.push({ id: String(blocks.length), heading, body });
    heading = undefined; lines = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') { flush(); continue; }
    if (headingOf(raw)) { flush(); heading = raw.trim(); continue; }
    lines.push(raw);
  }
  flush();
  return blocks;
}

export interface Jump { label: Heading; index: number }

/** Jump chips: first block for each heading, in text order. Empty when none are found. */
export function jumpTargets(blocks: Block[]): Jump[] {
  const seen = new Set<Heading>();
  const out: Jump[] = [];
  blocks.forEach((b, index) => {
    const h = b.heading ? headingOf(b.heading) : null;
    if (h && !seen.has(h)) { seen.add(h); out.push({ label: h, index }); }
  });
  return out;
}

// ---- Find in description ----

export interface Segment { text: string; hit: boolean }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matcher = (query: string) => {
  const q = query.trim();
  return q === '' ? null : new RegExp(escapeRe(q), 'gi'); // literal, case-insensitive
};

/** Splits text into plain and matching pieces. */
export function matchSegments(text: string, query: string): Segment[] {
  const re = matcher(query);
  if (!re || text === '') return [{ text, hit: false }];
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), hit: false });
    out.push({ text: m[0], hit: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out.length ? out : [{ text, hit: false }];
}

const countIn = (s: string, re: RegExp) => (s.match(re) ?? []).length;

/** Total matches (headings included) and the first block that has one (-1 when none). */
export function findMatches(blocks: Block[], query: string): { total: number; first: number } {
  const re = matcher(query);
  if (!re) return { total: 0, first: -1 };
  let total = 0, first = -1;
  blocks.forEach((b, i) => {
    const n = countIn(b.heading ?? '', re) + countIn(b.body, re);
    if (n > 0 && first < 0) first = i;
    total += n;
  });
  return { total, first };
}

// ---- Saving ----

export const LINK_ERROR = 'Posting link must start with https://';
/** Size caps so a huge paste cannot bloat the database or freeze the screens. */
export const MAX_JD_CHARS = 100_000;
export const MAX_LINK_CHARS = 2048;
export const TEXT_ERROR = `Description is too long (maximum 100,000 characters).`;

export interface JdSave { text: string | null; words: number | null; link: string | null }

/** Edit screen to database values. Blank text clears the description; a non-https link is an error. */
export function prepareJd(text: string, link: string): { value: JdSave; error?: string } {
  const t = text.trim();
  const l = link.trim();
  const ok = l === '' || (l.length <= MAX_LINK_CHARS && safeHttps(l) !== null);
  const tooLong = t.length > MAX_JD_CHARS;
  return {
    value: { text: t === '' ? null : t, words: t === '' ? null : countWords(t), link: l === '' || !ok ? null : l },
    error: tooLong ? TEXT_ERROR : ok ? undefined : LINK_ERROR,
  };
}
