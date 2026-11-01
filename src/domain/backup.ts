/**
 * Backup file format, validation and summary text (D14, D-F). Pure; no I/O.
 * Every value that reaches the database passes through a validator here: the file is untrusted input.
 */
import { countWords, MAX_JD_CHARS, MAX_LINK_CHARS } from './jd';

export const SCHEMA_VERSION = 1;
export const MAX_BYTES = 5_000_000;
/** Allowed reminder lead times, in minutes (spec 3.9). */
export const REMINDER_MINUTES = [15, 60, 1440] as const;
export type ReminderMinutes = (typeof REMINDER_MINUTES)[number];
export const MAX_KEYWORDS = 100;
export const MAX_KEYWORD_CHARS = 40;   // the Settings screen cuts keywords at 40
export const MAX_SIGNATURE_CHARS = 5_000;

type Row = Record<string, unknown>;
const fail = (m: string): never => { throw new Error(`Invalid backup: ${m}`); };
const obj = (v: unknown, what = 'object'): Row => (typeof v === 'object' && v && !Array.isArray(v) ? (v as Row) : fail(`${what} expected`));
const arr = (v: unknown, what: string, max = 50_000): Row[] => (Array.isArray(v) && v.length <= max ? v.map(x => obj(x, `${what} row`)) : fail(`${what} list expected`));
const str = (v: unknown, max = 5_000, min = 0) => (typeof v === 'string' && v.length <= max && v.length >= min ? v : fail('text expected'));
const opt = (v: unknown, max?: number) => (v == null ? null : str(v, max));
const int = (v: unknown) => (Number.isSafeInteger(v) ? (v as number) : fail('whole number expected'));
const optInt = (v: unknown) => (v == null ? null : int(v));
const pick = <T extends string>(v: unknown, set: readonly T[]) => (set.includes(v as T) ? (v as T) : fail('unknown value'));
/** Posting links must be https (Part 2 section 7). */
const https = (v: unknown) => {
  const s = opt(v, MAX_LINK_CHARS);
  return s && !/^https:\/\/\S+$/i.test(s) ? fail('link must start with https://') : s;
};

export interface BackupSettings { signature?: string; keywords?: string[]; reminder_minutes?: ReminderMinutes }

/** Settings block. Each key is optional; a key that is present must be valid. */
export function parseSettings(v: unknown): BackupSettings {
  if (v == null) return {};
  const s = obj(v, 'settings');
  const out: BackupSettings = {};
  if (s.signature != null) out.signature = str(s.signature, MAX_SIGNATURE_CHARS);
  if (s.keywords != null) {
    if (!Array.isArray(s.keywords) || s.keywords.length > MAX_KEYWORDS) fail('keywords list expected');
    out.keywords = (s.keywords as unknown[]).map(k => str(k, MAX_KEYWORD_CHARS, 1));
  }
  if (s.reminder_minutes != null) {
    if (!(REMINDER_MINUTES as readonly unknown[]).includes(s.reminder_minutes)) fail('reminder must be 15, 60 or 1440');
    out.reminder_minutes = s.reminder_minutes as ReminderMinutes;
  }
  return out;
}

export function parseBackup(text: string) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) fail('file too large');
  let json: unknown;
  try { json = JSON.parse(text); } catch { fail('not a JSON file'); }
  const raw = obj(json);
  if (raw.schemaVersion !== SCHEMA_VERSION) fail('unsupported version');
  return {
    company: arr(raw.company, 'company').map(r => ({
      id: str(r.id, 64, 1), name: str(r.name, 200, 1), role: opt(r.role, 200),
      status: pick(r.status, ['active', 'rejected'] as const),
      rejected_reason: r.rejected_reason == null ? null : pick(r.rejected_reason, ['round', 'not_moving_forward'] as const),
      rejected_after_round: optInt(r.rejected_after_round), rejected_at: optInt(r.rejected_at),
      jd_text: opt(r.jd_text, MAX_JD_CHARS),
      jd_words: null as number | null,                      // recomputed from jd_text below, never trusted from the file
      jd_link: https(r.jd_link), notes: opt(r.notes, 50_000),
      created_at: int(r.created_at), updated_at: int(r.updated_at),
    })).map(c => ({ ...c, jd_words: c.jd_text && c.jd_text.trim() !== '' ? countWords(c.jd_text) : null })),
    recruiter: arr(raw.recruiter, 'recruiter').map(r => ({
      company_id: str(r.company_id, 64, 1),
      name: opt(r.name, 200), phone: opt(r.phone, 50), email: opt(r.email, 254),
    })),
    recruiter_call: arr(raw.recruiter_call, 'recruiter_call').map(r => ({
      id: str(r.id, 64, 1), company_id: str(r.company_id, 64, 1),
      call_at: int(r.call_at), mode: str(r.mode, 50, 1),
      recruiter_name: opt(r.recruiter_name, 200), recruiter_phone: opt(r.recruiter_phone, 50), said: opt(r.said, 50_000),
    })),
    round: arr(raw.round, 'round').map(r => ({
      id: str(r.id, 64, 1), company_id: str(r.company_id, 64, 1),
      source: 'manual' as const,                         // calendar ids are device-specific (D-F)
      calendar_event_id: null,
      type: pick(r.type, ['walk_in', 'offline', 'phone', 'online'] as const),
      label: str(r.label, 200), starts_at: int(r.starts_at), ends_at: optInt(r.ends_at),
      order_at: typeof r.order_at === 'number' && Number.isFinite(r.order_at) ? r.order_at : fail('number expected'),
      location_or_link: opt(r.location_or_link, 2000), contact_name: opt(r.contact_name, 200),
      contact_phone: opt(r.contact_phone, 50), notes: opt(r.notes, 50_000),
      result: pick(r.result, ['pending', 'approved', 'rejected', 'didnt_happen'] as const),
      result_set_at: optInt(r.result_set_at), change_flag: null, pending_starts_at: null, auto_added_at: null,
      created_at: int(r.created_at), updated_at: int(r.updated_at),
    })),
    ping: arr(raw.ping, 'ping').map(r => ({
      id: str(r.id, 64, 1), company_id: str(r.company_id, 64, 1),
      target_type: pick(r.target_type, ['round', 'recruiter_call'] as const), target_id: str(r.target_id, 64, 1),
      pinged_at: int(r.pinged_at), channel: pick(r.channel, ['mark', 'copy', 'mail'] as const),
    })),
    alias: arr(raw.alias, 'alias').map(r => ({
      id: str(r.id, 64, 1), type: pick(r.type, ['organizer', 'title'] as const),
      pattern: str(r.pattern, 500, 1), company_id: str(r.company_id, 64, 1),
    })),
    settings: parseSettings(raw.settings),
  };
}

export type Backup = ReturnType<typeof parseBackup>;

/** Table order that satisfies foreign keys on insert. Reverse it to delete. */
export const TABLE_ORDER = ['company', 'recruiter', 'recruiter_call', 'round', 'ping', 'alias'] as const;
export type BackupTable = (typeof TABLE_ORDER)[number];

export const countsOf = (b: Pick<Backup, BackupTable>): Record<BackupTable, number> => ({
  company: b.company.length, recruiter: b.recruiter.length, recruiter_call: b.recruiter_call.length,
  round: b.round.length, ping: b.ping.length, alias: b.alias.length,
});

/** Text for the confirm dialog. */
export function countsText(b: Pick<Backup, BackupTable>): string {
  const c = countsOf(b);
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return `${n(c.company, 'company', 'companies')}, ${n(c.round, 'round', 'rounds')}, ${n(c.recruiter_call, 'recruiter call', 'recruiter calls')}, ${n(c.ping, 'follow-up', 'follow-ups')}`;
}

/** Size checks. `bytes` comes from the file on disk, before the file is read into memory. */
export function assertSize(bytes: number | null | undefined) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) fail('could not read the file size');
  if ((bytes as number) > MAX_BYTES) fail('file too large');
}

// ---- Readable summary ----

const pad = (n: number) => String(n).padStart(2, '0');
const day = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const stamp = (ms: number) => { const d = new Date(ms); return `${day(ms)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const RESULT: Record<string, string> = { pending: 'pending', approved: 'approved', rejected: 'rejected', didnt_happen: "didn't happen" };

export const UNENCRYPTED_NOTE =
  'This backup is NOT encrypted. Anyone who gets the files can read it. Keep it somewhere private.';

/** Plain-text summary written next to the JSON file. Notes and job descriptions stay in the JSON only. */
export function buildSummary(b: Pick<Backup, BackupTable>, now: number): string {
  const lines = [
    'Interview Tracker backup summary',
    `Exported ${stamp(now)}`,
    '',
    UNENCRYPTED_NOTE,
    '',
    countsText(b),
    '',
  ];
  for (const c of b.company) {
    const rounds = b.round.filter(r => r.company_id === c.id).sort((a, z) => a.order_at - z.order_at);
    lines.push(`${c.name}${c.role ? ` (${c.role})` : ''} - ${c.status === 'rejected' ? 'rejected' : 'active'}`);
    rounds.forEach((r, i) => lines.push(`  ${i + 1}. ${r.label} - ${stamp(r.starts_at)} - ${RESULT[r.result] ?? r.result}`));
    const calls = b.recruiter_call.filter(r => r.company_id === c.id);
    if (calls.length) lines.push(`  Recruiter calls: ${calls.map(x => day(x.call_at)).join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}
