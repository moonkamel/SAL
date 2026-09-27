import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import type { AgendaEvent } from '@/shared/types';

/** Fiche du lieu si on le connaît, sinon la page de l'événement, sinon une recherche. */
export function openEvent(event: AgendaEvent) {
  if (event.placeId) {
    router.push({ pathname: '/place/[id]', params: { id: event.placeId } });
  } else if (event.url) {
    void WebBrowser.openBrowserAsync(event.url);
  } else {
    router.push({ pathname: '/results', params: { q: event.venueName } });
  }
}
