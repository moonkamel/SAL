import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { type MapDot, type MapLine, PlacesMap } from '@/src/components/PlacesMap';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { googleMapsDirections } from '@/src/features/navigation/googleMaps';
import { ItineraryCard } from '@/src/features/transit/ItineraryCard';
import { TripTimeline } from '@/src/features/transit/TripTimeline';
import { ApiRequestError, getItineraries } from '@/src/lib/api';
import { colors, font, fonts, radius, spacing } from '@/src/theme';
import { segmentPoints } from '@/shared/trip';
import type { LatLng, TransitItinerary } from '@/shared/types';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; itineraries: TransitItinerary[] };

const WALK_COLOR = '#B9B4C6';

/** Trajets en transports (métro, tram, bus) avec horaires ; le guidage se fait dans Google Maps. */
export default function TransitTripScreen() {
  const params = useLocalSearchParams<{ id: string; name: string; lat: string; lng: string }>();
  const name = params.name ?? 'Destination';
  const destination = useMemo<LatLng>(
    () => ({ lat: Number(params.lat), lng: Number(params.lng) }),
    [params.lat, params.lng],
  );
  const insets = useSafeAreaInsets();
  const { refresh, status } = useUserLocation();

  const [state, setState] = useState<State>({ kind: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(
    async (signal?: AbortSignal, quiet = false) => {
      if (!quiet) setState({ kind: 'loading' });
      try {
        const from = await refresh();
        const res = await getItineraries(from, destination, name, signal);
        if (signal?.aborted) return;
        setState({ kind: 'done', itineraries: res.itineraries });
        setSelectedId((id) =>
          res.itineraries.some((i) => i.id === id) ? id : (res.itineraries[0]?.id ?? null),
        );
      } catch (error) {
        if (signal?.aborted || quiet) return;
        setState({
          kind: 'error',
          message:
            error instanceof ApiRequestError ? error.message : 'Impossible de calculer les trajets.',
        });
      }
    },
    [refresh, destination, name],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Horloge (comptes à rebours) et horaires rafraîchis chaque minute.
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => void load(undefined, true), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const itineraries = state.kind === 'done' ? state.itineraries : [];
  const shown = itineraries.find((i) => i.id === selectedId) ?? null;

  const { lines, dots } = useMemo(() => {
    if (!shown) return { lines: [] as MapLine[], dots: [] as MapDot[] };
    const l: MapLine[] = shown.segments.map((s, i) => ({
      id: `seg-${i}`,
      points: segmentPoints(s),
      color: s.kind === 'ride' ? s.line.color : WALK_COLOR,
      width: s.kind === 'ride' ? 12 : 7,
    }));
    const d: MapDot[] = shown.segments.flatMap((s, i) =>
      s.kind === 'ride'
        ? [
            { id: `dep-${i}`, center: s.departureStop.location, color: s.line.color },
            { id: `arr-${i}`, center: s.arrivalStop.location, color: s.line.color },
          ]
        : [],
    );
    return { lines: l, dots: d };
  }, [shown]);

  const pins = useMemo(
    () => [{ id: params.id, position: destination, title: name }],
    [params.id, destination, name],
  );

  const openGoogleMaps = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void Linking.openURL(googleMapsDirections(destination, 'transit', { id: params.id, name }));
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'En transports' }} />
      <View style={styles.mapWrap}>
        {shown ? (
          <PlacesMap
            center={destination}
            pins={pins}
            lines={lines}
            dots={dots}
            showUserLocation={status === 'granted'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={styles.center}>
            {state.kind === 'loading' ? (
              <>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.muted}>Recherche des trajets…</Text>
              </>
            ) : state.kind === 'error' ? (
              <>
                <Ionicons name="alert-circle-outline" size={44} color={colors.textFaint} />
                <Text style={styles.message}>{state.message}</Text>
                <Pressable style={styles.retry} onPress={() => void load()}>
                  <Text style={styles.retryText}>Réessayer</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.message}>
                Aucun trajet en transports pour le moment. C’est peut-être plus rapide à pied !
              </Text>
            )}
          </View>
        )}
      </View>

      {itineraries.length > 0 && (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={[styles.panelContent, { paddingBottom: insets.bottom + spacing.lg }]}
        >
          {itineraries.map((it) => (
            <ItineraryCard
              key={it.id}
              itinerary={it}
              now={now}
              selected={it.id === selectedId}
              onPress={() => setSelectedId(it.id)}
            />
          ))}
          {shown && (
            <>
              <Text style={styles.section}>Étapes</Text>
              <TripTimeline itinerary={shown} destinationName={name} />
              {shown.fare && (
                <Text style={styles.fare}>
                  Tarif : {shown.fare} (ticket Ilévia, selon Google). Horaires prévus, susceptibles
                  de changer.
                </Text>
              )}
              <GradientButton
                title="Y aller avec Google Maps"
                icon="navigate"
                onPress={openGoogleMaps}
                accessibilityLabel="Ouvrir le trajet en transports dans Google Maps"
              />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  mapWrap: { height: '42%', backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: font.small },
  message: { color: colors.text, fontSize: font.body, textAlign: 'center' },
  retry: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  retryText: { color: colors.accentText, fontWeight: '700', fontSize: font.body },
  panel: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    marginTop: -radius.lg,
  },
  panelContent: { padding: spacing.lg, gap: spacing.md },
  section: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.title - 2, marginTop: spacing.sm },
  fare: { color: colors.textMuted, fontSize: font.small },
});
