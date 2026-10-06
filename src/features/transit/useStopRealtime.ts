import { useLiveData } from '@/src/features/lille/useLiveData';
import { getStopDepartures } from '@/src/lib/api';
import type { StopDeparturesResponse, TransitDeparture } from '@/shared/types';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

/** « M1 » chez Google = « M1 » ou « 1 » chez Ilévia. */
function sameLine(a: string, b: string): boolean {
  const x = norm(a).replace(/^M(?=\d)/, '');
  const y = norm(b).replace(/^M(?=\d)/, '');
  return x === y;
}

/** Départs de la bonne ligne, dans la bonne direction si on la reconnaît. */
export function matchDepartures(
  departures: TransitDeparture[],
  line: string,
  headsign: string,
): TransitDeparture | undefined {
  const sameLines = departures.filter((d) => sameLine(d.line, line));
  const words = norm(headsign).split(' ').filter((w) => w.length > 2);
  const score = (d: TransitDeparture) => {
    const dir = ` ${norm(d.direction)} `;
    return words.filter((w) => dir.includes(` ${w} `)).length;
  };
  const best = [...sameLines].sort((a, b) => score(b) - score(a))[0];
  if (!best) return undefined;
  // Direction inconnue et plusieurs directions possibles : on ne devine pas.
  if (score(best) === 0 && new Set(sameLines.map((d) => d.direction)).size > 1) return undefined;
  return best;
}

/** Prochains passages en temps réel (minutes) d'une ligne à un arrêt, ou null. */
export function useStopRealtime(
  stop: string | undefined,
  line: string | undefined,
  headsign: string | undefined,
): number[] | null {
  const { data } = useLiveData<StopDeparturesResponse>(
    stop ? (signal) => getStopDepartures(stop, signal) : null,
    30_000,
    [stop],
  );
  if (!data || !line) return null;
  return matchDepartures(data.departures, line, headsign ?? '')?.minutes ?? null;
}
