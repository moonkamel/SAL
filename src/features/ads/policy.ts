// Règles d'affichage, isolées pour être testées sans le SDK publicitaire.

/** Une pub native tous les 5 lieux dans la liste des résultats. */
export const NATIVE_AD_EVERY = 5;

export type ListItem<T> = { type: 'place'; place: T } | { type: 'ad'; key: string };

/** Insère un emplacement publicitaire après chaque groupe de NATIVE_AD_EVERY lieux. */
export function withAdSlots<T>(places: T[], enabled: boolean): ListItem<T>[] {
  const items: ListItem<T>[] = [];
  places.forEach((place, i) => {
    items.push({ type: 'place', place });
    const isGroupEnd = (i + 1) % NATIVE_AD_EVERY === 0;
    if (enabled && isGroupEnd && i < places.length - 1) {
      items.push({ type: 'ad', key: `ad-${i + 1}` });
    }
  });
  return items;
}

export interface InterstitialState {
  /** Un interstitiel a déjà été montré pendant cette session. */
  shownThisSession: boolean;
  /** Nombre de recherches lancées depuis l'ouverture de l'app. */
  searchesThisSession: number;
  guidanceActive: boolean;
  canRequestAds: boolean;
}

/**
 * Interstitiel : au plus une fois par session, jamais au lancement (pas avant la
 * 2e recherche), jamais pendant un guidage, et seulement si le consentement le permet.
 */
export function shouldShowInterstitial(s: InterstitialState): boolean {
  return s.canRequestAds && !s.guidanceActive && !s.shownThisSession && s.searchesThisSession >= 2;
}
