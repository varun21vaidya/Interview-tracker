import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { loadHomeData } from '../db/repos/home';
import { buildHome, laterModels, nextModel, previousModels, waitingModels } from '../domain/home';
import { autoAddedBanners } from '../domain/syncRules';
import { useData } from './useData';

/** Current time, refreshed every minute and when the app returns to the foreground. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') tick(); });
    return () => { clearInterval(id); sub.remove(); };
  }, []);
  return [now, setNow] as const;
}

/** Home data: one load, then buildHome. Cards only format its output. */
export function useHome() {
  const { data, error, reload } = useData(loadHomeData);
  const [now, setNow] = useNow();
  const [refreshing, setRefreshing] = useState(false);

  // Every load yields a new object: that is the signal a refresh finished.
  useEffect(() => { setNow(Date.now()); setRefreshing(false); }, [data, error, setNow]);
  const refresh = useCallback(() => { setRefreshing(true); reload(); }, [reload]);

  const view = useMemo(() => {
    if (!data) return null;
    const home = buildHome(data.bundles, data.openReviews, now);
    return {
      next: nextModel(home.next, now),
      later: laterModels(home.upcoming, now),
      waiting: waitingModels(home.waiting, now),
      previous: previousModels(home.previous, now),
      openReviews: home.openReviews,
      added: autoAddedBanners(data.autoAdded, now),
      changed: home.changed,
      empty: !home.next && home.waiting.length === 0 && home.previous.length === 0,
    };
  }, [data, now]);

  return { view, now, lastSync: data?.lastSync ?? null, loading: data === null && !error, error, refreshing, refresh };
}
