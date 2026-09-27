import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Chip } from '@/src/components/Chip';
import { countActiveFilters, FilterSheet } from '@/src/components/FilterSheet';
import { GoogleAttribution } from '@/src/components/GoogleAttribution';
import { LocationBanner } from '@/src/components/LocationBanner';
import { PlaceCard } from '@/src/components/PlaceCard';
import { ResultsMap } from '@/src/components/ResultsMap';
import { useAds } from '@/src/features/ads/AdsProvider';
import { NativeAdCard } from '@/src/features/ads/NativeAdCard';
import { withAdSlots } from '@/src/features/ads/policy';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { ApiRequestError, searchPlaces } from '@/src/lib/api';
import { colors, font, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import type { PlaceSummary, SearchFilters } from '@/shared/types';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; places: PlaceSummary[] };

export default function ResultsScreen() {
  const { q } = useLocalSearchParams<{ q: string }>();
  const query = (q ?? '').trim();
  const { refresh } = useUserLocation();
  const { canRequestAds } = useAds();

  const [filters, setFilters] = useState<SearchFilters>({});
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');

  const openPlace = (id: string) => router.push({ pathname: '/place/[id]', params: { id } });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (!query) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const location = await refresh();
      const res = await searchPlaces({ query, location, filters }, controller.signal);
      if (!controller.signal.aborted) setState({ kind: 'done', places: res.places });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        kind: 'error',
        message:
          error instanceof ApiRequestError ? error.message : 'Une erreur est survenue. Réessayez.',
      });
    }
  }, [query, filters, refresh]);

  useEffect(() => {
    setState({ kind: 'loading' });
    void run();
    return () => abortRef.current?.abort();
  }, [run]);

  const onRefresh = async () => {
    setRefreshing(true);
    await run();
    setRefreshing(false);
  };

  const activeCount = countActiveFilters(filters);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: query || 'Résultats' }} />

      <View style={styles.toolbar}>
        <Chip
          label="Ouvert maintenant"
          selected={filters.openNow ?? false}
          onPress={() => setFilters({ ...filters, openNow: filters.openNow ? undefined : true })}
        />
        <Chip
          label={activeCount ? `Filtres (${activeCount})` : 'Filtres'}
          selected={activeCount > 0}
          onPress={() => setFiltersVisible(true)}
        />
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => setView(view === 'list' ? 'map' : 'list')}
          style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel={view === 'list' ? 'Afficher la carte' : 'Afficher la liste'}
        >
          <Ionicons
            name={view === 'list' ? 'map-outline' : 'list-outline'}
            size={20}
            color={colors.text}
          />
          <Text style={styles.toggleText}>{view === 'list' ? 'Carte' : 'Liste'}</Text>
        </Pressable>
      </View>

      {state.kind === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.muted}>Recherche des meilleurs lieux…</Text>
        </View>
      )}

      {state.kind === 'error' && (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textFaint} />
          <Text style={styles.message}>{state.message}</Text>
          <Pressable
            style={styles.retry}
            onPress={() => {
              setState({ kind: 'loading' });
              void run();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      )}

      {state.kind === 'done' && view === 'map' && (
        <ResultsMap places={state.places} onOpen={openPlace} />
      )}

      {state.kind === 'done' && view === 'list' && (
        <FlatList
          data={withAdSlots(state.places, canRequestAds)}
          keyExtractor={(item) => (item.type === 'ad' ? item.key : item.place.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
          renderItem={({ item }) =>
            item.type === 'ad' ? (
              <NativeAdCard />
            ) : (
              <PlaceCard place={item.place} onPress={() => openPlace(item.place.id)} />
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.lg }}>
              <LocationBanner />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={48} color={colors.textFaint} />
              <Text style={styles.message}>
                Aucun lieu trouvé.{activeCount ? ' Essayez d’assouplir les filtres.' : ''}
              </Text>
            </View>
          }
          ListFooterComponent={state.places.length > 0 ? <GoogleAttribution /> : null}
        />
      )}

      <FilterSheet
        visible={filtersVisible}
        filters={filters}
        onClose={() => setFiltersVisible(false)}
        onApply={(f) => {
          setFiltersVisible(false);
          setFilters(f);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  list: { padding: spacing.lg, paddingTop: 0 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH_TARGET - 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  toggleText: { color: colors.text, fontSize: font.small + 1, fontWeight: '600' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  muted: { color: colors.textMuted, fontSize: font.body },
  message: { color: colors.text, fontSize: font.body, textAlign: 'center' },
  retry: {
    minHeight: TOUCH_TARGET + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  retryText: { color: colors.accentText, fontSize: font.body, fontWeight: '700' },
});
