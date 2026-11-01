import type { Alias, CalEvent, Company, Recruiter } from '../types/entities';

const PUBLIC = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com']);
const GENERIC = /\b(interview|round|call|screen|screening|technical|hr|recruiter|meet|meeting|online|final|with|and|the|for)\b/gi;
export const ATTACH_AT = 3;

export const normName = (s: string) => s.replace(GENERIC, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** "Interview with Acme" or "Acme – Technical round" -> "Acme". Generic titles return null. */
export function titleGuess(title: string): string | null {
  const m = title.match(/interview with\s+(.+)/i) ?? title.match(/^(.+?)\s+[–—-]\s+/);
  return m && normName(m[1]).length >= 2 ? m[1].trim() : null;
}

export interface MatchCtx { aliases: Alias[]; companies: Company[]; recruiters: Recruiter[] }
export interface Match { decision: 'attach' | 'review'; companyId?: string; ranked: string[]; suggestedName?: string }

export function matchEvent(ev: CalEvent, ctx: MatchCtx): Match {
  const pts = new Map<string, number>();
  const add = (id: string, n: number) => pts.set(id, (pts.get(id) ?? 0) + n);
  const org = ev.organizerEmail?.toLowerCase();
  const dom = org?.split('@')[1];
  const title = ev.title.toLowerCase();

  for (const a of ctx.aliases) {
    if (a.type === 'organizer' && a.pattern === org) add(a.companyId, 2);
    if (a.type === 'title' && title.includes(a.pattern)) add(a.companyId, 2);
  }
  if (dom && !PUBLIC.has(dom))
    for (const r of ctx.recruiters) if (r.email?.toLowerCase().endsWith('@' + dom)) add(r.companyId, 2);

  const guess = titleGuess(ev.title);
  const known = guess ? ctx.companies.filter(c => normName(c.name) === normName(guess)) : [];
  known.forEach(c => add(c.id, 2));

  const ranked = [...pts.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  const ok = !!top && top[1] >= ATTACH_AT && (!second || second[1] < ATTACH_AT);
  return {
    decision: ok ? 'attach' : 'review',
    companyId: ok ? top[0] : undefined,
    ranked: ranked.map(r => r[0]),
    suggestedName: guess && known.length === 0 ? guess : undefined, // new company: never created here (decision 6)
  };
}
