import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadBundles } from '../db/repos/bundles';
import { requestSync } from '../services/calendarSync';
import { matchesQuery, waitingAge } from '../domain/status';
import type { Bundle } from '../types/entities';
import { useData } from './useData';

/** Companies screen data: all bundles loaded once, then filtered in JS (Part 2 section 4), split by outcome. */
export function useCompanies() {
  const { data, error, reload } = useData(loadBundles);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Every load yields a new array: that is the signal that a pull-to-refresh finished.
  useEffect(() => { setNow(Date.now()); setRefreshing(false); }, [data, error]);
  // Pull-to-refresh re-reads the calendar first, then reloads the list (the spinner stops when the reload lands).
  const refresh = useCallback(() => { setRefreshing(true); requestSync({ force: true }).catch(() => null).finally(reload); }, [reload]);

  const { active, rejected, total } = useMemo(() => {
    const all = (data ?? []).filter(b => matchesQuery(b, query));
    const byWait = (a: Bundle, b: Bundle) => waitingAge(b, now) - waitingAge(a, now); // stable sort keeps load order on ties
    return {
      active: all.filter(b => b.company.status === 'active').sort(byWait),
      rejected: all.filter(b => b.company.status === 'rejected'),
      total: data?.length ?? 0,
    };
  }, [data, query, now]);

  return { active, rejected, total, loading: data === null && !error, error, query, setQuery, refreshing, refresh, now };
}
