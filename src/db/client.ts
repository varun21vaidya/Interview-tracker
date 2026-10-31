import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './migrations';

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

async function open() {
  const d = await SQLite.openDatabaseAsync('tracker.db');
  await d.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    await d.withTransactionAsync(async () => {
      await d.execAsync(MIGRATIONS[v]);
      await d.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return d;
}

/** Caches the opening promise, so concurrent first calls share one open and one migration run. */
export function getDb() {
  if (!opening) {
    opening = open().catch(e => {
      opening = null; // allow a retry after a failed open
      throw e;
    });
  }
  return opening;
}
