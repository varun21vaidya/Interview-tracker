import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getDb } from '../db/client';
import { deleteNotificationId, getNotificationId, saveNotificationId } from '../db/repos/notificationMap';
import { getSetting } from '../db/repos/settings';

// Source: docs.expo.dev/versions/v58.0.0/sdk/notifications. Parts known only from a summary are marked UNVERIFIED.
// Without a handler a notification that fires while the app is open is not shown.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const CHANNEL = 'reminders';

/** Reminder lead time. Setting key 'reminder_lead': '15m' | '1h' | '1d'. Default 1 hour. */
export const LEAD_MS = { '15m': 15 * 60_000, '1h': 60 * 60_000, '1d': 24 * 60 * 60_000 } as const;
export type Lead = keyof typeof LEAD_MS;
export const LEAD_KEY = 'reminder_lead';

export async function getLeadMs(): Promise<number> {
  const v = await getSetting(LEAD_KEY);
  return v && v in LEAD_MS ? LEAD_MS[v as Lead] : LEAD_MS['1h'];
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  // Docs: on Android 13+ the permission prompt does not appear until a channel exists.
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Interview reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** True when reminders may be scheduled. With ask=true it shows the OS prompt if the OS still allows it. */
export async function ensureNotificationPermission(ask: boolean): Promise<boolean> {
  await ensureChannel();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!ask || !cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export async function cancelReminder(roundId: string) {
  const id = await getNotificationId(roundId);
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
  await deleteNotificationId(roundId);
}

/**
 * Cancel any old reminder, then schedule a new one for a manual, pending round whose
 * reminder time is still ahead. Never throws: a notification problem must not block a save.
 * Text shows company and time only.
 */
export async function syncReminder(roundId: string, now = Date.now()) {
  try {
    await cancelReminder(roundId);
    const db = await getDb();
    const r = await db.getFirstAsync<{ starts_at: number; name: string }>(
      "SELECT r.starts_at, c.name FROM round r JOIN company c ON c.id=r.company_id WHERE r.id=? AND r.source='manual' AND r.result='pending'",
      [roundId]);
    if (!r) return;
    const at = r.starts_at - (await getLeadMs());
    if (at <= now) return;                                   // time has passed: skip
    if (!(await ensureNotificationPermission(false))) return;
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: r.name, body: `Interview at ${clock(r.starts_at)}` },
      // UNVERIFIED: channelId on the date trigger is from a summary of the docs, not verbatim text.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
    await saveNotificationId(roundId, id);
  } catch {
    /* a notification problem never blocks a save */
  }
}

/** Re-schedule every manual round of a company (renamed, round moved in, merged). */
export async function syncCompanyReminders(companyId: string) {
  const db = await getDb();
  const rs = await db.getAllAsync<{ id: string }>("SELECT id FROM round WHERE company_id=? AND source='manual'", [companyId]);
  for (const r of rs) await syncReminder(r.id);
}
