import { getCalendarPermissions, requestCalendarPermissions } from 'expo-calendar';

/** granted: can read. ask: not decided yet, or denied but the OS will still show the prompt. blocked: only the Settings app can change it. */
export type CalendarAccess = 'granted' | 'ask' | 'blocked';

const toAccess = (r: { granted: boolean; canAskAgain: boolean }): CalendarAccess =>
  r.granted ? 'granted' : r.canAskAgain ? 'ask' : 'blocked';

/** Current state. Never shows a prompt, so it is safe to call on screen mount. */
export async function getCalendarAccess(): Promise<CalendarAccess> {
  return toAccess(await getCalendarPermissions());
}

/** Shows the OS prompt (first use only, always from a button press). Read-only: WRITE_CALENDAR is blocked in app.json. */
export async function requestCalendarAccess(): Promise<CalendarAccess> {
  return toAccess(await requestCalendarPermissions());
}
