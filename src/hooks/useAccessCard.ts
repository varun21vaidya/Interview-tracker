import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getCalendarIds } from '../db/repos/settings';
import { getCalendarAccess } from '../services/permissions';

/**
 * True when calendars are set up (or the OS says access is blocked) but the phone no longer allows reading them.
 * Re-checked when the app returns to the foreground, so it clears after the user allows access in system settings.
 * A fresh install that never asked stays quiet: Home's empty state already points to Settings.
 */
export function useAccessCard() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const [access, ids] = await Promise.all([getCalendarAccess(), getCalendarIds()]);
        if (alive) setShow(access !== 'granted' && (access === 'blocked' || ids.length > 0));
      } catch { if (alive) setShow(false); }
    };
    void check();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void check(); });
    return () => { alive = false; sub.remove(); };
  }, []);
  return show;
}
