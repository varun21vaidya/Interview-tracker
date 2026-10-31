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
