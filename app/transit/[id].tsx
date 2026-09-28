import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { type MapDot, type MapLine, PlacesMap } from '@/src/components/PlacesMap';
import { mapboxGuideAvailable } from '@/src/features/guide/available';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { ItineraryCard } from '@/src/features/transit/ItineraryCard';
import { TripTimeline } from '@/src/features/transit/TripTimeline';
import { ApiRequestError, getItineraries } from '@/src/lib/api';
import { colors, font, fonts, radius, spacing } from '@/src/theme';
import { haversineMeters } from '@/shared/geo';
import {
  currentSegment,
  type Fix,
  lineLabel,
  NOT_BOARDED,
  type RideTracking,
  segmentPoints,
  stopsLeft,
  trackRide,
} from '@/shared/trip';
import type { LatLng, TransitItinerary } from '@/shared/types';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; itineraries: TransitItinerary[] };

const WALK_COLOR = '#B9B4C6';

// Chargée seulement si l'app contient Mapbox : l'importer sans le module natif fait planter.
const FollowMap: ComponentType<ComponentProps<typeof import('@/src/features/guide/FollowMap').FollowMap>> =
  mapboxGuideAvailable
  ? (require('@/src/features/guide/FollowMap') as typeof import('@/src/features/guide/FollowMap')).FollowMap
  : () => null;

/** Trajets en transports (métro, tram, bus) avec horaires, puis suivi des étapes. */
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

  const fix = useFix(!!shown && status === 'granted');
  const position = fix?.position ?? null;

  // Où marcher : pendant le trajet, la fin du tronçon à pied en cours ; avant, l'arrêt de départ.
  const walkTarget = useMemo<LatLng | null>(() => {
    if (!shown) return null;
    const seg = trip ? shown.segments[liveIndex] : shown.segments[0];
    if (!seg) return null;
    if (seg.kind === 'walk') return seg.to;
    return trip ? null : seg.departureStop.location;
  }, [shown, trip, liveIndex]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: trip ? 'En route' : 'En transports' }} />
      <View style={styles.mapWrap}>
        {shown && mapboxGuideAvailable ? (
          // Mapbox, vue « première personne » : on voit la rue comme on la parcourt.
          <FollowMap position={position} target={walkTarget} style={StyleSheet.absoluteFill} bottomPadding={radius.lg} />
        ) : shown ? (
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
        <TripProgress
          trip={trip}
          fix={fix}
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
                  title="Y aller"
                  icon="navigate"
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setTrip(shown);
                  }}
                  accessibilityLabel="Lancer le trajet"
                />
              </>
            )}
          </ScrollView>
        )
      )}
    </View>
  );
}

/** Mesure GPS précise (position, vitesse, heure), suivie tant que l'écran l'utilise. */
function useFix(enabled: boolean): Fix | null {
  const [fix, setFix] = useState<Fix | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;
    // distanceInterval 0 : des mesures arrivent même à l'arrêt, sinon on croirait le GPS perdu.
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 0 },
      (loc) =>
        setFix({
          position: { lat: loc.coords.latitude, lng: loc.coords.longitude },
          speed: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : null,
          at: loc.timestamp || Date.now(),
        }),
    )
      .then((s) => (cancelled ? s.remove() : (sub = s)))
      .catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled]);
  return fix;
}

function say(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'fr-FR' });
}

/**
 * Trajet lancé : la liste des étapes, l'étape en cours surlignée automatiquement.
 * Dans le véhicule, on affiche (et on dit) combien d'arrêts il reste.
 */
function TripProgress({
  trip,
  fix,
  destinationName,
  placeId,
  onStop,
  onProgress,
  bottomInset,
}: {
  trip: TransitItinerary;
  fix: Fix | null;
  destinationName: string;
  placeId: string;
  onStop: () => void;
  onProgress: (index: number) => void;
  bottomInset: number;
}) {
  useKeepAwake();
  const [index, setIndex] = useState(0);
  // Suivi du véhicule, remis à zéro à chaque étape.
  const [tracked, setTracked] = useState<{ index: number; ride: RideTracking }>({ index: 0, ride: NOT_BOARDED });
  const [now, setNow] = useState(() => Date.now());
  const sawAtStop = useRef(new Set<number>());
  const announced = useRef(new Set<string>());

  // Sous terre, plus de GPS : l'horloge fait avancer l'estimation.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => () => void Speech.stop(), []);

  useEffect(() => {
    if (!fix) return;
    setIndex((prev) => currentSegment(trip, fix.position, prev));
  }, [fix, trip]);

  const seg = trip.segments[index];
  const ride = seg?.kind === 'ride' ? seg : undefined;

  useEffect(() => {
    if (ride && fix && haversineMeters(fix.position, ride.departureStop.location) < 100) {
      sawAtStop.current.add(index);
    }
    if (!ride) return;
    setTracked((prev) => ({
      index,
      ride: trackRide(ride, prev.index === index ? prev.ride : NOT_BOARDED, fix, now, sawAtStop.current.has(index)),
    }));
  }, [ride, fix, now, index]);

  const tracking = tracked.index === index ? tracked.ride : NOT_BOARDED;
  const left = ride && tracking.boardedAt !== null ? stopsLeft(ride.stopCount, tracking.fraction) : null;

  // Une seule annonce par étape : montée détectée, puis « descendez au prochain arrêt ».
  useEffect(() => {
    if (!ride || left === null) return;
    const key = left <= 1 ? `off-${index}` : `on-${index}`;
    if (announced.current.has(key)) return;
    announced.current.add(key);
    if (left <= 1) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      say(`Prochain arrêt : ${ride.arrivalStop.name}. Préparez-vous à descendre.`);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      say(`Vous êtes dans le ${lineLabel(ride.line)}. Encore ${left} arrêts avant ${ride.arrivalStop.name}.`);
    }
  }, [ride, left, index]);

  const last = trip.segments[trip.segments.length - 1];
  const arrived =
    fix !== null &&
    index === trip.segments.length - 1 &&
    last?.kind === 'walk' &&
    haversineMeters(fix.position, last.to) < 60;

  useEffect(() => onProgress(index), [index, onProgress]);

  return (
    <ScrollView
      style={styles.panel}
      contentContainerStyle={[styles.panelContent, { paddingBottom: bottomInset + spacing.lg }]}
    >
      <Text style={styles.section}>Étapes</Text>
      <TripTimeline
        itinerary={trip}
        destinationName={destinationName}
        current={index}
        onboard={left !== null ? { stopsLeft: left } : undefined}
        onGuideWalk={
          mapboxGuideAvailable
            ? undefined
            : (w) =>
                router.push({
                  pathname: '/guide/[id]',
                  params: {
                    id: placeId,
                    name: w.toName,
                    lat: String(w.to.lat),
                    lng: String(w.to.lng),
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
  actions: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
  stop: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  stopText: { color: colors.text, fontWeight: '700', fontSize: font.body },
});
