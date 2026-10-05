// Statistiques d'usage anonymes : les événements sont regroupés puis envoyés au
// serveur (/api/track) toutes les 15 s et quand l'app passe en arrière-plan.
// Pas d'identifiant d'appareil : un numéro de session tiré au hasard à chaque lancement.

import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { currentLang } from '@/src/i18n';

import { apiOrigin } from './api';

type Props = Record<string, string | number | boolean>;
type Name = 'app_open' | 'screen' | 'search' | 'sort' | 'open_now' | 'directions' | 'ticket' | 'share';

const session = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
let queue: { name: Name; props?: Props; t: number }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const events = queue.slice(0, 50);
  queue = queue.slice(50);
  void fetch(`${apiOrigin()}/api/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session,
      lang: currentLang(),
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
      version: Constants.expoConfig?.version,
      events,
    }),
  }).catch(() => {
    // Hors connexion : tant pis, une statistique perdue ne gêne personne.
  });
  if (queue.length) flush();
}

/** Note un événement (envoyé plus tard, par lots). */
export function track(name: Name, props?: Props): void {
  queue.push({ name, props, t: Date.now() });
  if (queue.length >= 20) flush();
  else timer ??= setTimeout(flush, 15_000);
}

AppState.addEventListener('change', (state) => {
  if (state !== 'active') flush();
});

/** Nettoie une recherche avant de l'envoyer (courte, en minuscules). */
export const cleanQuery = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
