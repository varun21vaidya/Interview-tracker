import { useCallback, useState } from 'react';

/**
 * Runs a write and turns a failure into a message instead of a silent no-op.
 * `run(fn, message)` returns a handler; show `error` in a banner.
 */
export function useActionRunner() {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(<A extends unknown[]>(fn: (...a: A) => Promise<unknown> | unknown, message: string) =>
    async (...a: A) => {
      try { await fn(...a); setError(null); return true; }
      catch { setError(message); return false; }
    }, []);
  return { error, run, clear: () => setError(null) };
}
