import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { GoogleAttribution } from '@/src/components/GoogleAttribution';
import { PlaceCard } from '@/src/components/PlaceCard';
import { useFavorites } from '@/src/features/favorites/FavoritesProvider';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { getPlace } from '@/src/lib/api';
import { colors, font, spacing } from '@/src/theme';
import { estimateWalkMinutes, haversineMeters } from '@/shared/geo';
import type { LatLng, PlaceDetails, PlaceSummary } from '@/shared/types';

function toSummary(p: PlaceDetails, from: LatLng): PlaceSummary {
  const distanceMeters = Math.round(haversineMeters(from, p.location));
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    location: p.location,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    priceLevel: p.priceLevel,
    opening: p.opening,
    photo: p.photos[0],
    distanceMeters,
    walkMinutes: estimateWalkMinutes(distanceMeters),
    sponsored: false,
    score: 0,
  };
}

export default function FavoritesScreen() {
  const { ids } = useFavorites();
  const { coords } = useUserLocation();
  const [details, setDetails] = useState<Record<string, PlaceDetails>>({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(0);

  // Seuls les place_id sont stockés : les infos sont rechargées depuis Google.
  useEffect(() => {
    const missing = ids.filter((id) => !details[id]);
    if (missing.length === 0) return;
    const controller = new AbortController();
    setLoading(true);
    Promise.allSettled(missing.map((id) => getPlace(id, 'summary', controller.signal))).then(
      (results) => {
        if (controller.signal.aborted) return;
        const loaded: Record<string, PlaceDetails> = {};
        let errors = 0;
        results.forEach((r) => {
          if (r.status === 'fulfilled') loaded[r.value.id] = r.value;
          else errors += 1;
        });
        setDetails((prev) => ({ ...prev, ...loaded }));
        setFailed(errors);
        setLoading(false);
      },
    );
    return () => controller.abort();
    // `details` est volontairement absent : on ne recharge que quand la liste d'ids change.
  }, [ids]);

  const places = ids
    .map((id) => details[id])
    .filter((p): p is PlaceDetails => p !== undefined)
    .map((p) => toSummary(p, coords));

  if (ids.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="heart-outline" size={48} color={colors.textFaint} />
        <Text style={styles.message}>Aucun favori pour l’instant.</Text>
        <Text style={styles.hint}>Touchez le cœur sur la fiche d’un lieu pour le retrouver ici.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={places}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
      renderItem={({ item }) => (
        <PlaceCard
          place={item}
          onPress={() => router.push({ pathname: '/place/[id]', params: { id: item.id } })}
        />
      )}
      ListHeaderComponent={
        loading ? <ActivityIndicator color={colors.accent} style={{ margin: spacing.lg }} /> : null
      }
      ListFooterComponent={
        <>
          {failed > 0 && (
            <Text style={styles.hint}>
              {failed === 1
                ? '1 favori n’a pas pu être chargé.'
                : `${failed} favoris n’ont pas pu être chargés.`}
            </Text>
          )}
          {places.length > 0 && <GoogleAttribution />}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  message: { color: colors.text, fontSize: font.body + 2, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: font.small, textAlign: 'center' },
});
