import { PermissionsAndroid, Platform } from 'react-native';
import { getCalendarPermissions, requestCalendarPermissions } from 'expo-calendar';

/** granted: can read. ask: not decided yet, or denied but the OS will still show the prompt. blocked: only the Settings app can change it. */
export type CalendarAccess = 'granted' | 'ask' | 'blocked';

const toAccess = (r: { granted: boolean; canAskAgain: boolean }): CalendarAccess =>
  r.granted ? 'granted' : r.canAskAgain ? 'ask' : 'blocked';

/**
 * On Android, expo-calendar's permission calls combine READ and WRITE. WRITE_CALENDAR is blocked in app.json
 * to keep the app read-only, so they can never report granted. Reading only needs READ_CALENDAR, so ask for it directly.
 */
const READ = PermissionsAndroid.PERMISSIONS.READ_CALENDAR;

/** Current state. Never shows a prompt, so it is safe to call on screen mount. */
export async function getCalendarAccess(): Promise<CalendarAccess> {
  if (Platform.OS === 'android') {
    // Android cannot tell "not asked yet" from "blocked" without prompting; requestCalendarAccess finds out.
    return (await PermissionsAndroid.check(READ)) ? 'granted' : 'ask';
  }
  return toAccess(await getCalendarPermissions());
}

/** Shows the OS prompt (first use only, always from a button press). */
export async function requestCalendarAccess(): Promise<CalendarAccess> {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(READ);
    return r === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'ask';
  }
  return toAccess(await requestCalendarPermissions());
}
