import { router } from 'expo-router';

import type { AgendaEvent } from '@/shared/types';

/** Ouvre la fiche de l'événement, dans l'app. */
export function openEvent(event: AgendaEvent) {
  router.push({ pathname: '/event/[id]', params: { id: event.id } });
}
