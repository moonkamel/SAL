import { useEffect, useState } from 'react';

/**
 * Charge une donnée temps réel et la rafraîchit périodiquement tant que l'écran est
 * affiché. En cas d'erreur, on garde la dernière valeur connue (ou null).
 */
export function useLiveData<T>(
  load: ((signal: AbortSignal) => Promise<T>) | null,
  refreshMs: number,
  deps: unknown[],
): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!load) return;
    const controller = new AbortController();
    const tick = () =>
      load(controller.signal)
        .then((d) => {
          if (!controller.signal.aborted) {
            setData(d);
            setError(false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        });
    void tick();
    const timer = setInterval(tick, refreshMs);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
    // Les dépendances sont passées explicitement par l'appelant.
  }, deps);

  return { data, error };
}
