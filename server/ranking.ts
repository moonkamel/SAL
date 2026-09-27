// Classement des résultats. Tous les réglages sont ici pour pouvoir les ajuster
// sans toucher au reste du backend.

export interface RankingWeights {
  /** Note Google corrigée par le nombre d'avis (moyenne bayésienne). */
  rating: number;
  /** Popularité : nombre d'avis (échelle logarithmique). */
  popularity: number;
  /** Proximité : décroît avec la distance. */
  distance: number;
  /** Pertinence : ordre renvoyé par Google pour la requête. */
  relevance: number;
}

export const RANKING = {
  weights: { rating: 0.4, popularity: 0.1, distance: 0.3, relevance: 0.2 } as RankingWeights,
  /** Note « a priori » d'un lieu sans avis, et poids de cet a priori (en nombre d'avis). */
  priorRating: 3.8,
  priorWeight: 30,
  /** Distance (m) à laquelle le score de proximité tombe à ~37 %. */
  distanceScaleMeters: 1500,
  /** Nombre d'avis considéré comme « très populaire » (score de popularité = 1). */
  popularityCap: 2000,
};

export interface RankingInput {
  rating?: number;
  userRatingCount?: number;
  distanceMeters: number;
  /** Position dans la réponse Google (0 = plus pertinent). */
  relevanceIndex: number;
  /** Nombre total de résultats Google. */
  resultCount: number;
}

export function bayesianRating(rating: number | undefined, count: number | undefined): number {
  const { priorRating, priorWeight } = RANKING;
  const n = count ?? 0;
  const r = rating ?? priorRating;
  return (n * r + priorWeight * priorRating) / (n + priorWeight);
}

/** Score entre 0 et 1 : plus c'est haut, plus le lieu remonte. */
export function scorePlace(input: RankingInput, weights: RankingWeights = RANKING.weights): number {
  const rating = bayesianRating(input.rating, input.userRatingCount) / 5;
  const popularity = Math.min(
    1,
    Math.log10((input.userRatingCount ?? 0) + 1) / Math.log10(RANKING.popularityCap + 1),
  );
  const distance = Math.exp(-input.distanceMeters / RANKING.distanceScaleMeters);
  const relevance =
    input.resultCount <= 1 ? 1 : 1 - input.relevanceIndex / (input.resultCount - 1);

  const total = weights.rating + weights.popularity + weights.distance + weights.relevance;
  return (
    (weights.rating * rating +
      weights.popularity * popularity +
      weights.distance * distance +
      weights.relevance * relevance) /
    total
  );
}
