import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { requestSync, type SyncResult } from '../services/calendarSync';

export const syncMessage = (r: SyncResult): string | null => {
  if (r.status === 'done') return null;
  if (r.reason === 'no-calendars') return 'Tick a calendar in Settings first.';
  if (r.reason === 'no-access') return 'Calendar access is off. Allow it in Settings.';
  return null;                                     // debounced: nothing to say
};

/**
 * Calendar refresh for a screen. `run()` is for buttons and pull-to-refresh and always syncs.
 * With `auto`, it also syncs when the screen mounts (app open) and when the app returns to the foreground;
 * those are debounced to once per 60 s inside requestSync.
 */
export function useSync({ auto = false }: { auto?: boolean } = {}) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const go = useCallback(async (force: boolean) => {
    setSyncing(true);
    try {
      const r = await requestSync({ force });
      if (alive.current) setMessage(force ? syncMessage(r) : null);   // automatic runs stay quiet when nothing is set up
      return r;
    } catch {
      if (alive.current) setMessage(force ? 'Could not refresh the calendar.' : null);
      return null;
    } finally {
      if (alive.current) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    void go(false);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void go(false); });
    return () => sub.remove();
  }, [auto, go]);

  const run = useCallback(() => go(true), [go]);
  return { run, syncing, message };
}
