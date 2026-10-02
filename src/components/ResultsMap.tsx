import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useUserLocation } from '@/src/features/location/LocationProvider';
import { useI18n } from '@/src/i18n';
import { spacing } from '@/src/theme';
import { formatDistance, formatRating } from '@/shared/format';
import type { PlaceSummary } from '@/shared/types';

import { PlaceCard } from './PlaceCard';
import { type MapPin, PlacesMap } from './PlacesMap';

interface Props {
  places: PlaceSummary[];
  onOpen: (id: string) => void;
}

/** Vue carte des résultats : une épingle par lieu, la fiche du lieu touché en bas. */
export function ResultsMap({ places, onOpen }: Props) {
  const { coords, status } = useUserLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { t, lang } = useI18n();

  const pins = useMemo<MapPin[]>(
    () =>
      places.map((p) => ({
        id: p.id,
        position: p.location,
        title: p.sponsored ? `${p.name} · ${t('Sponsorisé')}` : p.name,
        snippet: [
          p.rating !== undefined ? `★ ${formatRating(p.rating, lang)}` : null,
          formatDistance(p.distanceMeters, lang),
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    [places, t, lang],
  );
  // Centre figé au moment de l'affichage pour ne pas recentrer la carte à chaque mouvement.
  const [center] = useState(coords);

  const selected = places.find((p) => p.id === selectedId);

  return (
    <View style={styles.container}>
      <PlacesMap
        center={center}
        pins={pins}
        onPinPress={setSelectedId}
        showUserLocation={status === 'granted'}
        style={StyleSheet.absoluteFill}
      />
      {selected && (
        <View style={styles.card}>
          <PlaceCard place={selected} compact onPress={() => onOpen(selected.id)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xl },
});
