import { isNearLille, parseLatLng } from '@/server/params';
import { PlacesError } from '@/server/places';
import { currentWeather } from '@/server/weather';
import { GRAND_PLACE } from '@/shared/geo';
import { parisHour, weatherSuggestion } from '@/shared/suggest';
import type { WeatherResponse } from '@/shared/types';

/** GET /api/weather?near=lat,lng → météo actuelle + idée de sortie adaptée. */
export async function GET(request: Request): Promise<Response> {
  const near = parseLatLng(new URL(request.url).searchParams.get('near'));
  if (!near) return Response.json({ error: 'Position invalide' }, { status: 400 });

  try {
    // Hors métropole (ou position par défaut), on donne le temps à Lille.
    const weather = await currentWeather(isNearLille(near) ? near : GRAND_PLACE);
    const body: WeatherResponse = { weather, suggestion: weatherSuggestion(weather, parisHour()) };
    return Response.json(body);
  } catch (error) {
    const status = error instanceof PlacesError ? error.status : 500;
    return Response.json({ error: 'Météo indisponible' }, { status });
  }
}
