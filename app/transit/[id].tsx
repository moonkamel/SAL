import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { type MapDot, type MapLine, PlacesMap } from '@/src/components/PlacesMap';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { ItineraryCard } from '@/src/features/transit/ItineraryCard';
import { TripTimeline } from '@/src/features/transit/TripTimeline';
import { ApiRequestError, getItineraries } from '@/src/lib/api';
import { colors, font, fonts, radius, spacing } from '@/src/theme';
import { haversineMeters } from '@/shared/geo';
import { currentSegment, liveInstruction, segmentPoints } from '@/shared/trip';
import type { LatLng, TransitItinerary } from '@/shared/types';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; itineraries: TransitItinerary[] };

const WALK_COLOR = '#B9B4C6';

/** Trajets en transports (métro, tram, bus) avec horaires, puis accompagnement en direct. */
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
  const [trip, setTrip] = useState<TransitItinerary | null>(null);
  const [now, setNow] = useState(() => new Date());
  // Pendant le trajet, la carte cadre l'étape en cours.
  const [liveIndex, setLiveIndex] = useState(0);

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

  // Horloge (comptes à rebours) et horaires rafraîchis chaque minute tant qu'on choisit.
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (trip) return;
    const timer = setInterval(() => void load(undefined, true), 60_000);
    return () => clearInterval(timer);
  }, [trip, load]);

  const itineraries = state.kind === 'done' ? state.itineraries : [];
  const shown = trip ?? itineraries.find((i) => i.id === selectedId) ?? null;

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

  const focus = useMemo(
    () => (trip && lines[liveIndex] ? lines[liveIndex].points : undefined),
    [trip, lines, liveIndex],
  );

  const pins = useMemo(
    () => [{ id: params.id, position: destination, title: name }],
    [params.id, destination, name],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: trip ? 'En route' : 'En transports' }} />
      <View style={styles.mapWrap}>
        {shown ? (
          <PlacesMap
            center={destination}
            pins={pins}
            lines={lines}
            dots={dots}
            focus={focus}
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

      {trip ? (
        <LiveTrip
          trip={trip}
          destinationName={name}
          placeId={params.id}
          onStop={() => {
            setTrip(null);
            setLiveIndex(0);
          }}
          onProgress={setLiveIndex}
          bottomInset={insets.bottom}
        />
      ) : (
        itineraries.length > 0 && (
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
                  title="C’est parti"
                  icon="navigate"
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setTrip(shown);
                  }}
                  accessibilityLabel="Démarrer l’accompagnement en direct"
                />
              </>
            )}
          </ScrollView>
        )
      )}
    </View>
  );
}

/** Accompagnement en direct : position suivie, étape en cours, alerte avant de descendre. */
function LiveTrip({
  trip,
  destinationName,
  placeId,
  onStop,
  onProgress,
  bottomInset,
}: {
  trip: TransitItinerary;
  destinationName: string;
  placeId: string;
  onStop: () => void;
  onProgress: (index: number) => void;
  bottomInset: number;
}) {
  useKeepAwake();
  const [position, setPosition] = useState<LatLng | null>(null);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const alerted = useRef(new Set<string>());

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 8 },
      (loc) => setPosition({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
    )
      .then((s) => {
        if (cancelled) s.remove();
        else sub = s;
      })
      .catch(() => {});
    const tick = setInterval(() => setNow(new Date()), 10_000);
    return () => {
      cancelled = true;
      sub?.remove();
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (position) setIndex((prev) => currentSegment(trip, position, prev));
  }, [position, trip]);

  const instruction = position
    ? liveInstruction(trip, index, position, destinationName, now)
    : { title: 'Recherche de votre position…', subtitle: 'Sortez à l’extérieur si possible.' };

  // Vibration une seule fois par étape : départ imminent, ou descendre au prochain arrêt.
  useEffect(() => {
    if (!instruction.alert) return;
    const key = `${instruction.alert}-${index}`;
    if (alerted.current.has(key)) return;
    alerted.current.add(key);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [instruction.alert, index]);

  const last = trip.segments[trip.segments.length - 1];
  const arrived =
    position !== null &&
    index === trip.segments.length - 1 &&
    last?.kind === 'walk' &&
    haversineMeters(position, last.to) < 60;

  useEffect(() => onProgress(index), [index, onProgress]);

  return (
    <View style={[styles.panel, styles.livePanel]}>
      <View
        style={[
          styles.banner,
          instruction.alert === 'prepare' && { backgroundColor: colors.accent },
          instruction.alert === 'hurry' && { backgroundColor: '#8A5A12' },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.bannerTitle}>{instruction.title}</Text>
        <Text style={styles.bannerSubtitle}>{instruction.subtitle}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.panelContent, { paddingBottom: bottomInset + spacing.lg }]}>
        <TripTimeline
          itinerary={trip}
          destinationName={destinationName}
          current={index}
          onGuideWalk={(seg) =>
            router.push({
              pathname: '/navigate/[id]',
              params: {
                id: placeId,
                name: seg.toName,
                lat: String(seg.to.lat),
                lng: String(seg.to.lng),
                mode: 'walk',
                back: '1',
              },
            })
          }
        />
        <View style={styles.actions}>
          <Pressable style={styles.stop} onPress={onStop} accessibilityRole="button">
            <Text style={styles.stopText}>{arrived ? 'Terminer' : 'Arrêter'}</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  livePanel: { overflow: 'hidden' },
  panelContent: { padding: spacing.lg, gap: spacing.md },
  section: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.title - 2, marginTop: spacing.sm },
  fare: { color: colors.textMuted, fontSize: font.small },
  banner: { backgroundColor: colors.surfaceRaised, padding: spacing.lg, gap: 4 },
  bannerTitle: { color: colors.text, fontFamily: fonts.display, fontSize: font.title },
  bannerSubtitle: { color: colors.text, fontSize: font.body },
  actions: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
  stop: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  stopText: { color: colors.text, fontWeight: '700', fontSize: font.body },
});
