import { DEFAULT_SIGNATURE } from '../../domain/email';
import { getDb } from '../client';
import { emitChange } from '../bus';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key=?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | number) {
  const db = await getDb();
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, String(value)]);
  emitChange();
}

export const SIGNATURE_KEY = 'signature';

/** Saved signature, or the default until the user edits it. */
export async function getSignature(): Promise<string> {
  return (await getSetting(SIGNATURE_KEY)) ?? DEFAULT_SIGNATURE;
}
export const setSignature = (text: string) => setSetting(SIGNATURE_KEY, text);

// ---- Calendar settings (Phase 7) ----
export const DEFAULT_KEYWORDS = ['interview', 'round', 'screening', 'technical', 'HR', 'recruiter'];

async function getList(key: string): Promise<string[] | null> {
  const raw = await getSetting(key);
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
  } catch { return null; }
}

/** No calendar is ticked by default. */
export const getCalendarIds = async () => (await getList('calendar_ids')) ?? [];
export const setCalendarIds = (ids: string[]) => setSetting('calendar_ids', JSON.stringify(ids));

export const getKeywords = async () => (await getList('keywords')) ?? DEFAULT_KEYWORDS;
export const setKeywords = (kws: string[]) => setSetting('keywords', JSON.stringify(kws));

export async function getLastSync(): Promise<number | null> {
  const n = Number(await getSetting('last_sync'));
  return Number.isFinite(n) && n > 0 ? n : null;
}
