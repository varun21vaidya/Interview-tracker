import { useEffect, useMemo, useState } from 'react';
import { loadBundle } from '../db/repos/bundles';
import { companyDetail } from '../domain/detail';
import { useData } from './useData';

/** Company detail data. `loading` until the first load; `missing` once loaded and the id does not exist. */
export function useCompany(companyId: string) {
  // Wrapped so "not found" (bundle null) is distinguishable from "not loaded yet" (data null).
  const { data, error } = useData(async () => ({ bundle: await loadBundle(companyId) }), [companyId]);
  const [now, setNow] = useState(() => Date.now());
  // Every load yields a new object, so refresh "now" with it, as the Companies list does.
  useEffect(() => { setNow(Date.now()); }, [data]);

  const bundle = data?.bundle ?? null;
  const model = useMemo(() => (bundle ? companyDetail(bundle, now) : null), [bundle, now]);
  return { bundle, model, now, error, loading: data === null && !error, missing: data !== null && bundle === null };
}
