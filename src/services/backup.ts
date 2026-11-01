/** Backup export and restore (D14, D-F). Platform glue; the rules live in domain/backup.ts. */
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { getDb } from '../db/client';
import { emitChange } from '../db/bus';
import {
  KEYWORDS_KEY, SIGNATURE_KEY, getKeywords, getSignature, writeSetting,
} from '../db/repos/settings';
import {
  assertSize, buildSummary, parseBackup, SCHEMA_VERSION, TABLE_ORDER, type Backup, type ReminderMinutes,
} from '../domain/backup';
import { withSyncPaused } from './calendarSync';
import { getLeadMs, LEAD_KEY, syncReminder, type Lead } from './notifications';

type Row = Record<string, unknown>;

const LEAD_BY_MINUTES: Record<ReminderMinutes, Lead> = { 15: '15m', 60: '1h', 1440: '1d' };
const pad = (n: number) => String(n).padStart(2, '0');
const dateStamp = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** Reads every table (SELECT *), runs it through the same validator an import uses, and returns the canonical backup. */
export async function buildBackup(now = Date.now()) {
  const db = await getDb();
  const rows: Record<string, Row[]> = {};
  for (const t of TABLE_ORDER) rows[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t}`);   // table names are constants
  const reminder = Math.round((await getLeadMs()) / 60_000);
  const raw = {
    schemaVersion: SCHEMA_VERSION, exportedAt: now, ...rows,
    settings: { signature: await getSignature(), keywords: await getKeywords(), reminder_minutes: reminder },
  };
  // Validating here means an export that could not be imported back fails now, with a message, not at restore time.
  const parsed = parseBackup(JSON.stringify(raw));
  return { json: JSON.stringify({ schemaVersion: SCHEMA_VERSION, exportedAt: now, ...parsed }, null, 2), parsed, now };
}

async function shareText(name: string, text: string, mimeType: string) {
  if (Platform.OS === 'web') {                      // browser build (testing): download instead of the share sheet
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone');
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
  } finally {
    try { if (file.exists) file.delete(); } catch { /* the cache copy holds personal data; best effort to remove it */ }
  }
}

/** Opens the share sheet with the backup file. */
export async function exportBackup() {
  const { json, now } = await buildBackup();
  await shareText(`interview-tracker-backup-${dateStamp(now)}.json`, json, 'application/json');
}

/** Opens the share sheet with the readable summary (says the backup is unencrypted). */
export async function exportSummary() {
  const { parsed, now } = await buildBackup();
  await shareText(`interview-tracker-backup-${dateStamp(now)}-summary.txt`, buildSummary(parsed, now), 'text/plain');
}

/** Lets the user pick a file, checks its size on disk, then reads and validates it. Null when cancelled. */
export async function pickBackup(): Promise<Backup | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false, base64: false });   // base64 false: web would otherwise load the whole file before the size check
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web' && asset.file) {        // browser build: the picker hands back a Blob-backed File
    assertSize(asset.file.size);
    return parseBackup(await asset.file.text());
  }
  const file = new File(asset.uri);
  try {
    assertSize(file.size);                       // on-disk size first; the text is not loaded if it is too big
    return parseBackup(await file.text());
  } finally {
    try { if (file.exists) file.delete(); } catch { /* cache copy */ }
  }
}

/**
 * Replaces all data with the backup in one transaction: any throw (bad foreign key, CHECK, duplicate id)
 * rolls everything back and nothing changes. Scheduled reminders are cancelled afterwards because
 * they point at rounds that no longer exist.
 */
export async function restore(b: Backup) {
  const db = await getDb();
  // Exclusive transaction: its own connection, so no other write can interleave. Sync is paused too.
  await withSyncPaused(() => db.withExclusiveTransactionAsync(async txn => {
    // Children first. Table names are constants, never from the file.
    for (const t of [...TABLE_ORDER].reverse()) await txn.runAsync(`DELETE FROM ${t}`);
    for (const t of ['review_item', 'ignored_event', 'calendar_event', 'notification_map']) await txn.runAsync(`DELETE FROM ${t}`);
    for (const t of TABLE_ORDER) {
      const rows = (b as unknown as Record<string, Row[]>)[t];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);                  // keys come from our validator, not the file
      const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
      for (const r of rows) await txn.runAsync(sql, cols.map(c => r[c] as SQLite.SQLiteBindValue));
    }
    const s = b.settings;
    if (s.signature !== undefined) await writeSetting(txn, SIGNATURE_KEY, s.signature);
    if (s.keywords !== undefined) await writeSetting(txn, KEYWORDS_KEY, JSON.stringify(s.keywords));
    if (s.reminder_minutes !== undefined) await writeSetting(txn, LEAD_KEY, LEAD_BY_MINUTES[s.reminder_minutes]);
  }));
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* best effort */ }
  // The old ids are gone with the data; schedule again for the restored future manual rounds (never throws).
  const manual = await db.getAllAsync<{ id: string }>("SELECT id FROM round WHERE source='manual' AND result='pending' AND starts_at > ?", [Date.now()]);
  for (const r of manual) await syncReminder(r.id);
  emitChange();
}
