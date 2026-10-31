import { useCallback, useEffect, useState } from 'react';
import { onChange } from '../db/bus';

export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const run = useCallback(() => { load().then(setData).catch(setError); }, deps);
  useEffect(() => { run(); return onChange(run); }, [run]);
  return { data, error, reload: run };
}
