import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleAttribution } from '@/src/components/GoogleAttribution';
import { PhotoCarousel } from '@/src/components/PhotoCarousel';
import { PlacesMap } from '@/src/components/PlacesMap';
import { ReviewItem } from '@/src/components/ReviewItem';
import { useFavorites } from '@/src/features/favorites/FavoritesProvider';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { ApiRequestError, getPlace } from '@/src/lib/api';
import { colors, font, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import {
  formatDistance,
  formatOpening,
  formatPrice,
  formatRating,
  formatRatingCount,
  formatWalk,
} from '@/shared/format';
import { estimateWalkMinutes, haversineMeters } from '@/shared/geo';
import type { PlaceDetails } from '@/shared/types';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; place: PlaceDetails };

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { coords, status } = useUserLocation();
  const { isFavorite, toggle } = useFavorites();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [hoursOpen, setHoursOpen] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setState({ kind: 'loading' });
      getPlace(id, 'full', signal)
        .then((place) => setState({ kind: 'done', place }))
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setState({
            kind: 'error',
            message: error instanceof ApiRequestError ? error.message : 'Impossible de charger ce lieu.',
          });
        });
    },
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const favorite = isFavorite(id);
  const onToggleFavorite = () => {
    void Haptics.selectionAsync();
    toggle(id);
  };

  const place = state.kind === 'done' ? state.place : null;
  const pins = useMemo(
    () => (place ? [{ id: place.id, position: place.location, title: place.name }] : []),
    [place],
  );

  const header = (
    <Stack.Screen
      options={{
        title: '',
        headerTransparent: true,
        headerRight: () => (
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={12}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={26}
              color={favorite ? colors.accent : colors.text}
            />
          </Pressable>
        ),
      }}
    />
  );

  if (state.kind !== 'done') {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        {state.kind === 'loading' ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : (
          <>
            <Text style={styles.message}>{state.message}</Text>
            <Pressable style={styles.secondaryButton} onPress={() => load()}>
              <Text style={styles.secondaryText}>Réessayer</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  const p = state.place;
  const distance = Math.round(haversineMeters(coords, p.location));

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <PhotoCarousel photos={p.photos} />

        <View style={styles.body}>
          <Text style={styles.name}>{p.name}</Text>

          <View style={styles.row}>
            {p.rating !== undefined && (
              <>
                <Ionicons name="star" size={18} color={colors.star} />
                <Text style={styles.rating}>{formatRating(p.rating)}</Text>
                {p.userRatingCount !== undefined && (
                  <Text style={styles.muted}>({formatRatingCount(p.userRatingCount)} Google)</Text>
                )}
              </>
            )}
            {p.priceLevel !== undefined && (
              <Text style={styles.muted}> · {formatPrice(p.priceLevel)}</Text>
            )}
          </View>

          {p.opening && (
            <Pressable
              onPress={() => setHoursOpen((v) => !v)}
              disabled={!p.weekdayHours?.length}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel="Afficher les horaires"
            >
              <Text
                style={[styles.opening, { color: p.opening.openNow ? colors.open : colors.closed }]}
              >
                {formatOpening(p.opening)}
              </Text>
              {!!p.weekdayHours?.length && (
                <Ionicons
                  name={hoursOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              )}
            </Pressable>
          )}
          {hoursOpen && (
            <View style={styles.hours}>
              {p.weekdayHours?.map((line) => (
                <Text key={line} style={styles.hoursLine}>
                  {line}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.infoCard}>
            <InfoRow icon="walk" text={`${formatDistance(distance)} · ${formatWalk(estimateWalkMinutes(distance))}`} />
            <InfoRow icon="location-outline" text={p.address} />
            {p.phone && (
              <InfoRow
                icon="call-outline"
                text={p.phone}
                onPress={() => void Linking.openURL(`tel:${p.phone!.replace(/\s/g, '')}`)}
              />
            )}
            {p.website && (
              <InfoRow
                icon="globe-outline"
                text={p.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                onPress={() => void WebBrowser.openBrowserAsync(p.website!)}
              />
            )}
          </View>

          <PlacesMap
            center={p.location}
            pins={pins}
            interactive={false}
            showUserLocation={status === 'granted'}
            style={styles.map}
          />

          {p.reviews.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Avis récents</Text>
              {p.reviews.map((r) => (
                <ReviewItem key={`${r.authorName}-${r.publishTime}`} review={r} />
              ))}
            </View>
          )}

          <GoogleAttribution />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          style={({ pressed }) => [styles.goButton, pressed && { opacity: 0.85 }]}
          onPress={() =>
            router.push({
              pathname: '/route/[id]',
              params: {
                id: p.id,
                name: p.name,
                lat: String(p.location.lat),
                lng: String(p.location.lng),
              },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`Y aller : ${p.name}`}
        >
          <Ionicons name="navigate" size={24} color={colors.accentText} />
          <Text style={styles.goText}>Y aller</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  text,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.infoRow, pressed && { opacity: 0.7 }]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <Text style={[styles.infoText, onPress && { color: colors.text }]} numberOfLines={2}>
        {text}
      </Text>
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  message: { color: colors.text, fontSize: font.body, textAlign: 'center' },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(11,11,18,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.xl, gap: spacing.md },
  name: { color: colors.text, fontSize: font.title + 4, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rating: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: font.body },
  opening: { fontSize: font.body, fontWeight: '600' },
  hours: { gap: 2, paddingLeft: spacing.xs },
  hoursLine: { color: colors.textMuted, fontSize: font.small },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET + 4,
  },
  infoText: { flex: 1, color: colors.textMuted, fontSize: font.body },
  map: { height: 180, borderRadius: radius.md, overflow: 'hidden', marginTop: spacing.sm },
  sectionTitle: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  goButton: {
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  goText: { color: colors.accentText, fontSize: font.title, fontWeight: '800' },
  secondaryButton: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
  },
  secondaryText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
});
