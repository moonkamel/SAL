import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Chip } from '@/src/components/Chip';
import { EventCard } from '@/src/features/agenda/EventCard';
import { openEvent } from '@/src/features/agenda/openEvent';
import { useLiveData } from '@/src/features/lille/useLiveData';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { refreshKey } from '@/src/features/moment/HomeRails';
import { getAgenda } from '@/src/lib/api';
import { colors, font, motion, spacing } from '@/src/theme';
import {
  type AgendaEvent,
  type AgendaResponse,
  type AgendaWhen,
  type EventCategory,
  GENRE_LABELS,
  type MusicGenre,
} from '@/shared/types';

const WHEN: { key: AgendaWhen; label: string }[] = [
  { key: 'today', label: 'Ce soir' },
  { key: 'tomorrow', label: 'Demain' },
  { key: 'weekend', label: 'Ce week-end' },
];

const CATEGORY_ORDER: EventCategory[] = ['concert', 'expo', 'spectacle', 'soiree', 'marche', 'sport', 'autre'];
const CATEGORY_PLURAL: Record<EventCategory, string> = {
  concert: 'Concerts',
  expo: 'Expos',
  spectacle: 'Spectacles',
  soiree: 'Soirées',
  marche: 'Marchés',
  sport: 'Sport',
  autre: 'Autres',
};
const NEAR_METERS = 2000;

interface Filters {
  category: EventCategory | null;
  genre: MusicGenre | null;
  free: boolean;
  near: boolean;
}

const NO_FILTER: Filters = { category: null, genre: null, free: false, near: false };

/** Applique les filtres (fonction pure, réutilisée pour les compteurs). */
function apply(events: AgendaEvent[], f: Filters): AgendaEvent[] {
  return events.filter(
    (e) =>
      (!f.category || e.category === f.category) &&
      (!f.genre || e.genres?.includes(f.genre)) &&
      (!f.free || e.free) &&
      (!f.near || e.distanceMeters <= NEAR_METERS),
  );
}

/** Agenda des sorties : concerts, expos, spectacles… avec filtres. */
export default function AgendaScreen() {
  const params = useLocalSearchParams<{ when?: AgendaWhen }>();
  const [when, setWhen] = useState<AgendaWhen>(params.when ?? 'today');
  const [filters, setFilters] = useState<Filters>(NO_FILTER);
  const { coords } = useUserLocation();
  const { data, error } = useLiveData<AgendaResponse>(
    (signal) => getAgenda(coords, when, signal),
    10 * 60_000,
    [...refreshKey(coords), when],
  );

  const events = data?.events ?? [];
  const shown = useMemo(() => apply(events, filters), [events, filters]);

  // Compteurs : combien d'événements si l'on choisit ce filtre (avec les autres actifs).
  const categoryCounts = useMemo(() => {
    const base = apply(events, { ...filters, category: null, genre: null });
    const counts = new Map<EventCategory, number>();
    for (const e of base) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return counts;
  }, [events, filters]);

  const genreCounts = useMemo(() => {
    const base = apply(events, { ...filters, genre: null });
    const counts = new Map<MusicGenre, number>();
    for (const e of base) for (const g of e.genres ?? []) counts.set(g, (counts.get(g) ?? 0) + 1);
    return counts;
  }, [events, filters]);

  const set = (patch: Partial<Filters>) => {
    void Haptics.selectionAsync();
    setFilters((f) => ({ ...f, ...patch }));
  };
  const active = filters.category || filters.genre || filters.free || filters.near;
  const showGenres =
    genreCounts.size > 0 && (filters.category === 'concert' || filters.category === 'soiree' || !!filters.genre);

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <View style={styles.row}>
          {WHEN.map((w) => (
            <Chip key={w.key} label={w.label} selected={when === w.key} onPress={() => setWhen(w.key)} />
          ))}
        </View>

        {events.length > 0 && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
              <Chip label="Tout" selected={!filters.category} onPress={() => set({ category: null, genre: null })} />
              {CATEGORY_ORDER.filter((c) => categoryCounts.get(c)).map((c) => (
                <Chip
                  key={c}
                  label={`${CATEGORY_PLURAL[c]} · ${categoryCounts.get(c)}`}
                  selected={filters.category === c}
                  onPress={() => set({ category: filters.category === c ? null : c, genre: null })}
                />
              ))}
            </ScrollView>

            {showGenres && (
              <Animated.View entering={FadeIn.duration(motion.base)}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
                  <Ionicons name="musical-notes" size={16} color={colors.gold} style={{ alignSelf: 'center' }} />
                  {(Object.keys(GENRE_LABELS) as MusicGenre[])
                    .filter((g) => genreCounts.get(g))
                    .map((g) => (
                      <Chip
                        key={g}
                        label={`${GENRE_LABELS[g]} · ${genreCounts.get(g)}`}
                        selected={filters.genre === g}
                        onPress={() => set({ genre: filters.genre === g ? null : g })}
                      />
                    ))}
                </ScrollView>
              </Animated.View>
            )}

            <View style={styles.row}>
              <Chip label="Gratuit" selected={filters.free} onPress={() => set({ free: !filters.free })} />
              <Chip label="À moins de 2 km" selected={filters.near} onPress={() => set({ near: !filters.near })} />
              {active && (
                <Pressable onPress={() => set(NO_FILTER)} hitSlop={10} style={styles.reset} accessibilityRole="button">
                  <Text style={styles.resetText}>Effacer</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </View>

      {!data ? (
        <View style={styles.center}>
          {error ? (
            <Text style={styles.muted}>Agenda momentanément indisponible.</Text>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={shown}
          keyExtractor={(e) => e.id}
          initialNumToRender={6}
          windowSize={7}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListHeaderComponent={
            events.length > 0 ? (
              <Text style={styles.count}>
                {shown.length} sortie{shown.length > 1 ? 's' : ''}
                {active ? ' correspondent' : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.muted}>
              {events.length
                ? 'Aucune sortie avec ces filtres. Essayez d’en retirer un.'
                : 'Rien de prévu dans l’agenda pour le moment.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Animated.View layout={LinearTransition.duration(motion.base)} entering={FadeIn.duration(motion.base)}>
              <EventCard event={item} onPress={() => openEvent(item)} />
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  filters: { gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  scrollRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  reset: { marginLeft: 'auto', paddingHorizontal: spacing.sm },
  resetText: { color: colors.accent, fontSize: font.small, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  count: { color: colors.textMuted, fontSize: font.small, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: font.body, textAlign: 'center', marginTop: spacing.xl },
});
