import { getDb } from '../client';

/** round_id -> scheduled notification id. No emitChange: nothing on screen reads this table. */
export async function getNotificationId(roundId: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ notification_id: string }>('SELECT notification_id FROM notification_map WHERE round_id=?', [roundId]);
  return r?.notification_id ?? null;
}

export async function saveNotificationId(roundId: string, notificationId: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO notification_map (round_id, notification_id) VALUES (?,?) ON CONFLICT(round_id) DO UPDATE SET notification_id=excluded.notification_id',
    [roundId, notificationId]);
}

export async function deleteNotificationId(roundId: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM notification_map WHERE round_id=?', [roundId]);
}
