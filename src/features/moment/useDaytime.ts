import { useEffect, useState } from 'react';

import { isDaytime } from '@/src/lib/moment';

/** Vrai entre 6 h et 19 h ; se met à jour tout seul au passage de l'heure. */
export function useDaytime(): boolean {
  const [day, setDay] = useState(() => isDaytime());
  useEffect(() => {
    const timer = setInterval(() => setDay(isDaytime()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return day;
}
