import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { Chip } from '@/src/components/Chip';
import { OpenNowToggle } from '@/src/components/OpenNowToggle';
import { countActiveFilters, FilterSheet } from '@/src/components/FilterSheet';
import { GoogleAttribution } from '@/src/components/GoogleAttribution';
import { LocationBanner } from '@/src/components/LocationBanner';
import { PlaceCard } from '@/src/components/PlaceCard';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { ResultsMap } from '@/src/components/ResultsMap';
import { useAds } from '@/src/features/ads/AdsProvider';
import { NativeAdCard } from '@/src/features/ads/NativeAdCard';
import { withAdSlots } from '@/src/features/ads/policy';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { tx, useT } from '@/src/i18n';
import { ApiRequestError, searchPlaces } from '@/src/lib/api';
import { font, fonts, motion, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { type PlaceSort, sortPlaces } from '@/shared/sortPlaces';
import { AMBIANCE_LABELS, type Ambiance, type PlaceSummary, type SearchFilters } from '@/shared/types';
import { themedStyles, useColors } from '@/src/theme/tone';
import { cleanQuery, track } from '@/src/lib/analytics';

function parseAmbianceParam(value?: string): Ambiance[] {
  return (value ?? '').split(',').filter((a): a is Ambiance => a in AMBIANCE_LABELS);
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; places: PlaceSummary[] };

const SORTS: { key: PlaceSort; label: string }[] = [
  { key: 'recommended', label: tx('Recommandés') },
  { key: 'nearest', label: tx('Plus proches') },
  { key: 'topRated', label: tx('Mieux notés') },
];

export default function ResultsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { q, ambiance } = useLocalSearchParams<{ q: string; ambiance?: string }>();
  const query = (q ?? '').trim();
  const { refresh } = useUserLocation();
  const { canRequestAds } = useAds();
  const t = useT();

  // Filtres initiaux passés par l'accueil (ex. suggestion météo « en terrasse »).
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const initial = parseAmbianceParam(ambiance);
    return initial.length ? { ambiance: initial } : {};
  });
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [sort, setSort] = useState<PlaceSort>('recommended');

  const openPlace = (id: string) => router.push({ pathname: '/place/[id]', params: { id } });
  const abortRef = useRef<AbortController | null>(null);
  const trackedRef = useRef<string | null>(null);

  const run = useCallback(async () => {
    if (!query) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const location = await refresh();
      const res = await searchPlaces({ query, location, filters }, controller.signal);
      if (!controller.signal.aborted) {
        setState({ kind: 'done', places: res.places });
        // Une fois par recherche (pas à chaque actualisation) : ce que les gens cherchent.
        const key = `${query}|${JSON.stringify(filters)}`;
        if (trackedRef.current !== key) {
          trackedRef.current = key;
          track('search', { q: cleanQuery(query), n: res.places.length, ...(filters.openNow ? { openNow: true } : {}) });
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        kind: 'error',
        message:
          error instanceof ApiRequestError ? error.message : t('Une erreur est survenue. Réessayez.'),
      });
    }
  }, [query, filters, refresh, t]);

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
  const places = useMemo(
    () => (state.kind === 'done' ? sortPlaces(state.places, sort) : []),
    [state, sort],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: query ? t(query) : t('Résultats') }} />

      <View style={styles.toolbar}>
        <Chip
          label={activeCount ? t('Filtres ({n})', { n: activeCount }) : t('Filtres')}
          selected={activeCount > 0}
          onPress={() => setFiltersVisible(true)}
        />
        <Pressable
          onPress={() => setView(view === 'list' ? 'map' : 'list')}
          style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel={view === 'list' ? t('Afficher la carte') : t('Afficher la liste')}
        >
          <Ionicons name={view === 'list' ? 'map-outline' : 'list-outline'} size={20} color={colors.gold} />
        </Pressable>
        <View style={styles.spacer} />
        {/* Élément à part, à droite : le filtre le plus utilisé, activable d'un geste. */}
        <OpenNowToggle
          value={filters.openNow ?? false}
          onChange={(on) => {
            track('open_now', { on });
            setFilters({ ...filters, openNow: on ? true : undefined });
          }}
        />
      </View>

      {state.kind === 'loading' && (
        <View style={styles.list} accessibilityLabel={t('Recherche des meilleurs lieux')}>
          <SkeletonCard />
          <View style={{ height: spacing.lg }} />
          <SkeletonCard />
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
            <Text style={styles.retryText}>{t('Réessayer')}</Text>
          </Pressable>
        </View>
      )}

      {state.kind === 'done' && view === 'map' && (
        <ResultsMap places={state.places} onOpen={openPlace} />
      )}

      {state.kind === 'done' && view === 'list' && (
        <FlatList
          data={withAdSlots(places, canRequestAds)}
          keyExtractor={(item) => (item.type === 'ad' ? item.key : item.place.id)}
          contentContainerStyle={styles.list}
          // Photos facturées à l'affichage : seules les cartes proches de l'écran sont rendues.
          initialNumToRender={4}
          maxToRenderPerBatch={3}
          windowSize={5}
          ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
          renderItem={({ item, index }) => (
            // Apparition en cascade des premières cartes, puis instantanée au défilement.
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 6) * motion.stagger).duration(motion.slow)}
              layout={LinearTransition.duration(motion.base)}
            >
              {item.type === 'ad' ? (
                <NativeAdCard />
              ) : (
                <PlaceCard place={item.place} onPress={() => openPlace(item.place.id)} />
              )}
            </Animated.View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.lg, gap: spacing.md }}>
              <LocationBanner />
              {state.places.length > 0 && (
                <Text style={styles.count}>
                  {state.places.length > 1
                    ? t('{n} adresses autour de vous', { n: state.places.length })
                    : t('1 adresse autour de vous')}
                </Text>
              )}
              {state.places.length > 1 && (
                <View style={styles.sorts} accessibilityRole="radiogroup" accessibilityLabel={t('Trier')}>
                  {SORTS.map((o) => (
                    <Pressable
                      key={o.key}
                      onPress={() => {
                        track('sort', { sort: o.key });
                        setSort(o.key);
                      }}
                      style={[styles.sort, sort === o.key && styles.sortActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: sort === o.key }}
                    >
                      <Text style={[styles.sortText, sort === o.key && styles.sortTextActive]} numberOfLines={1}>
                        {t(o.label)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={48} color={colors.textFaint} />
              <Text style={styles.message}>
                {t('Aucun lieu trouvé.')}
                {activeCount ? ` ${t('Essayez d’assouplir les filtres.')}` : ''}
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

const useStyles = themedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  list: { padding: spacing.lg, paddingTop: 0 },
  count: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.title - 2 },
  spacer: { flex: 1, minWidth: spacing.xs },
  // Sélecteur à trois segments, sur une seule ligne même sur un petit écran.
  sorts: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sort: { flex: 1, minHeight: TOUCH_TARGET - 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.xs },
  sortActive: { backgroundColor: colors.accent },
  sortText: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  sortTextActive: { color: colors.accentText },
  toggle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: TOUCH_TARGET - 4,
    height: TOUCH_TARGET - 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  message: { color: colors.text, fontSize: font.body, textAlign: 'center' },
  retry: {
    minHeight: TOUCH_TARGET + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  retryText: { color: colors.accentText, fontSize: font.body, fontWeight: '700' },
}));
