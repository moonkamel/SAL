import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Mapbox, {
  Camera,
  LineLayer,
  LocationPuck,
  MapView,
  MarkerView,
  ShapeSource,
  StyleImport,
  UserTrackingMode,
} from '@rnmapbox/maps';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FIRST_PERSON } from '@/src/features/guide/camera';
import { maneuverIcon } from '@/src/features/guide/maneuverIcon';
import { useDaytime } from '@/src/features/moment/useDaytime';
import { googleMapsDirections } from '@/src/features/navigation/googleMaps';
import { LineBadge } from '@/src/features/transit/LineBadge';
import { useStopRealtime } from '@/src/features/transit/useStopRealtime';
import { getGuideRoute, MAPBOX_TOKEN, MapboxRouteError } from '@/src/lib/mapbox';
import { colors, font, fonts, palette, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { formatDuration } from '@/shared/format';
import { dueAnnouncements, formatGuideDistance, type GuideRoute, isOffRoute, type Progress, progressOn } from '@/shared/guide';
import {
  type Journey,
  type JourneyLeg,
  legDone,
  legEnd,
  legIntro,
  legOutro,
  remainingAfter,
  type RideLeg,
  rideStatus,
} from '@/shared/journey';
import { formatClock } from '@/shared/trip';
import type { LatLng } from '@/shared/types';

if (MAPBOX_TOKEN) void Mapbox.setAccessToken(MAPBOX_TOKEN);

const REROUTE_MIN_MS = 10_000;

interface Props {
  journey: Journey;
  /** Revenir à l'écran précédent à l'arrivée au lieu d'afficher « Vous êtes arrivé ». */
  returnOnArrival?: boolean;
}

/**
 * Voyage guidé de bout en bout, sur carte Mapbox en vue première personne : marche,
 * vélo et transports s'enchaînent automatiquement, avec la voix à chaque étape.
 */
export function JourneyScreen({ journey, returnOnArrival }: Props) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const day = useDaytime();
  const { legs } = journey;

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<{ message: string; settings?: boolean } | null>(null);
  const [index, setIndex] = useState(0);
  const [route, setRoute] = useState<GuideRoute | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [muted, setMuted] = useState(false);
  const [following, setFollowing] = useState(true);
  const [now, setNow] = useState(() => new Date());

  const indexRef = useRef(0);
  const routeRef = useRef<GuideRoute | null>(null);
  const alongRef = useRef(0);
  const spoken = useRef(new Set<string>());
  const offCount = useRef(0);
  const lastReroute = useRef(0);
  const finished = useRef(false);
  const mutedRef = useRef(false);
  const posRef = useRef<LatLng | null>(null);
  mutedRef.current = muted;

  const leg = legs[index];
  const ride: RideLeg | undefined =
    leg?.kind === 'ride' ? leg : legs[index + 1]?.kind === 'ride' ? (legs[index + 1] as RideLeg) : undefined;
  const realtime = useStopRealtime(ride?.from.name, ride?.line.short, ride?.headsign);
  const realtimeRef = useRef<number | undefined>(undefined);
  realtimeRef.current = realtime?.[0];

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  const say = useCallback((text: string) => {
    if (!text || mutedRef.current) return;
    Speech.stop();
    Speech.speak(text, { language: 'fr-FR' });
  }, []);

  /** Itinéraire Mapbox de l'étape (marche ou vélo) depuis la position actuelle. */
  const loadRoute = useCallback(
    async (l: JourneyLeg, from: LatLng, reroute = false) => {
      if (l.kind === 'ride') return;
      try {
        const r = await getGuideRoute(from, l.to, l.kind === 'bike' ? 'bicycle' : 'walk');
        if (legs[indexRef.current] !== l) return; // étape déjà passée
        routeRef.current = r;
        alongRef.current = 0;
        offCount.current = 0;
        setRoute(r);
        if (reroute) say('Nouvel itinéraire.');
      } catch (e) {
        if (reroute || indexRef.current > 0) return;
        setError({ message: e instanceof MapboxRouteError ? e.message : 'Itinéraire indisponible.' });
      }
    },
    [legs, say],
  );

  const arrive = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    say(`Vous êtes arrivé : ${journey.destinationName}.`);
    if (returnOnArrival) router.back();
    else router.replace({ pathname: '/arrived/[id]', params: { id: journey.placeId, name: journey.destinationName } });
  }, [journey, returnOnArrival, say]);

  /** Passe à l'étape `i` : annonce vocale, nouvel itinéraire. */
  const startLeg = useCallback(
    (i: number, from: LatLng | null, announce = true) => {
      if (i >= legs.length) {
        arrive();
        return;
      }
      const previous = legs[i - 1];
      const l = legs[i]!;
      indexRef.current = i;
      routeRef.current = null;
      spoken.current = new Set();
      setIndex(i);
      setRoute(null);
      setProgress(null);
      setFollowing(true);
      if (i > 0) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (announce) {
        const intro = legIntro(l, new Date(), l.kind === 'ride' ? realtimeRef.current : undefined);
        say([previous ? legOutro(previous, l) : '', intro].filter(Boolean).join(' '));
      }
      if (from) void loadRoute(l, from);
    },
    [legs, arrive, say, loadRoute],
  );

  // Localisation : premier point, première étape, puis suivi continu.
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setError({ message: 'Jeton Mapbox manquant : ajoutez EXPO_PUBLIC_MAPBOX_TOKEN (voir README).' });
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setError({ message: 'Autorisez la localisation pour être guidé.', settings: true });
        return;
      }
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      const first = last ? { lat: last.coords.latitude, lng: last.coords.longitude } : null;
      if (cancelled) return;
      posRef.current = first;
      setPosition(first);
      setReady(true);
      startLeg(0, first);

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
        (loc) => {
          const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          posRef.current = pos;
          setPosition(pos);
          const i = indexRef.current;
          const l = legs[i];
          if (!l || finished.current) return;

          // Bout de l'étape atteint : on enchaîne.
          if (legDone(l, pos)) {
            startLeg(i + 1, pos);
            return;
          }
          if (l.kind === 'ride') return;

          const r = routeRef.current;
          if (!r) {
            void loadRoute(l, pos);
            return;
          }
          const p = progressOn(r, pos, alongRef.current);
          alongRef.current = p.along;
          setProgress(p);
          if (p.arrived) {
            startLeg(i + 1, pos);
            return;
          }
          for (const text of dueAnnouncements(r, p, spoken.current)) {
            // L'annonce Mapbox « vous êtes arrivé » est remplacée par nos annonces d'étape.
            if (!/arriv/i.test(text) || i === legs.length - 1) say(text);
          }
          offCount.current = isOffRoute(p, loc.coords.accuracy ?? 10) ? offCount.current + 1 : 0;
          if (offCount.current >= 2 && Date.now() - lastReroute.current > REROUTE_MIN_MS) {
            lastReroute.current = Date.now();
            offCount.current = 0;
            void loadRoute(l, pos, true);
          }
        },
      );
      if (cancelled) sub.remove();
    })().catch(() => setError({ message: 'La localisation n’a pas pu démarrer.' }));
    return () => {
      cancelled = true;
      sub?.remove();
      Speech.stop();
    };
    // Une seule session par écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si le premier point GPS arrive après le démarrage, on calcule l'itinéraire à ce moment-là.
  useEffect(() => {
    if (ready && position && !route && leg && leg.kind !== 'ride') void loadRoute(leg, position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, position === null]);

  // Étape en véhicule : « préparez-vous à descendre », une seule fois.
  const status = leg?.kind === 'ride' ? rideStatus(leg, position, now, realtime?.[0]) : null;
  useEffect(() => {
    if (status?.phase !== 'getoff' || leg?.kind !== 'ride') return;
    const key = `getoff-${index}`;
    if (spoken.current.has(key)) return;
    spoken.current.add(key);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    say(`Préparez-vous à descendre à ${leg.to.name}, au prochain arrêt.`);
  }, [status?.phase, index, leg, say]);

  const stop = useCallback(() => {
    Alert.alert('Arrêter le guidage ?', undefined, [
      { text: 'Continuer', style: 'cancel' },
      {
        text: 'Arrêter',
        style: 'destructive',
        onPress: () => {
          finished.current = true;
          Speech.stop();
          router.back();
        },
      },
    ]);
  }, []);

  useEffect(() => {
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      stop();
      return true;
    });
    return () => s.remove();
  }, [stop]);

  const line = useMemo(
    () =>
      route
        ? {
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates: route.coords.map((c) => [c.lng, c.lat]) },
          }
        : null,
    [route],
  );

  // Heure d'arrivée : étape en cours + étapes suivantes.
  const currentRemaining = !leg
    ? 0
    : leg.kind === 'ride'
      ? Math.max(0, (Date.parse(leg.arrivalTime) - now.getTime()) / 1000)
      : (progress?.remainingSeconds ?? route?.duration ?? leg.estimateSeconds ?? 0);
  const totalRemaining = Math.round(currentRemaining + remainingAfter(legs, index, now));
  const eta = formatClock(new Date(now.getTime() + totalRemaining * 1000));

  const step = route && progress ? route.steps[progress.step] : route?.steps[0];
  const nextStep = route && progress ? route.steps[progress.step + 1] : route?.steps[1];
  const end = leg ? legEnd(leg) : null;

  return (
    <View style={styles.screen}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL="mapbox://styles/mapbox/standard"
        scaleBarEnabled={false}
        compassEnabled={false}
        logoPosition={{ bottom: 170 + insets.bottom, left: 12 }}
        attributionPosition={{ bottom: 170 + insets.bottom, right: 12 }}
        onTouchStart={() => setFollowing(false)}
      >
        <StyleImport
          id="basemap"
          existing
          config={{ lightPreset: day ? 'day' : 'night', show3dObjects: true, showPointOfInterestLabels: false }}
        />
        <Camera
          followUserLocation={following}
          followUserMode={UserTrackingMode.FollowWithHeading}
          followZoomLevel={FIRST_PERSON.zoom}
          followPitch={FIRST_PERSON.pitch}
          followPadding={{ paddingTop: 200 + insets.top, paddingBottom: 170 + insets.bottom }}
        />
        <LocationPuck puckBearing="heading" puckBearingEnabled pulsing={{ isEnabled: true, color: palette.brick }} />
        {line && (
          <ShapeSource id="leg" shape={line}>
            <LineLayer
              id="leg-casing"
              style={{ lineColor: '#7E2A17', lineWidth: 12, lineCap: 'round', lineJoin: 'round', lineEmissiveStrength: 1 }}
            />
            <LineLayer
              id="leg-line"
              aboveLayerID="leg-casing"
              style={{
                lineColor: leg?.kind === 'bike' ? '#F2C230' : palette.brickGlow,
                lineWidth: 7,
                lineCap: 'round',
                lineJoin: 'round',
                lineEmissiveStrength: 1,
              }}
            />
          </ShapeSource>
        )}
        {end && leg?.kind !== 'ride' && (
          <MarkerView coordinate={[end.lng, end.lat]} allowOverlap>
            <View style={styles.pin}>
              <Ionicons
                name={index === legs.length - 1 ? 'flag' : leg?.kind === 'walk' && legs[index + 1]?.kind === 'bike' ? 'bicycle' : 'bus'}
                size={16}
                color={colors.accentText}
              />
            </View>
          </MarkerView>
        )}
      </MapView>

      {/* Bandeau de l'étape en cours. */}
      {leg && !error && (
        <View style={[styles.bannerWrap, { top: insets.top + spacing.sm }]} accessibilityLiveRegion="polite">
          {leg.kind === 'ride' ? (
            status && (
            <View style={[styles.banner, { backgroundColor: status.phase === 'getoff' ? palette.brick : leg.line.color }]}>
              <View style={styles.bannerMain}>
                <LineBadge line={leg.line} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerTitle, { color: status.phase === 'getoff' ? '#FFF' : leg.line.textColor }]}>
                    {status.title}
                  </Text>
                  <Text style={[styles.bannerSub, { color: status.phase === 'getoff' ? '#FFF' : leg.line.textColor }]}>
                    {status.subtitle}
                  </Text>
                </View>
              </View>
            </View>
            )
          ) : (
            <View style={[styles.banner, { backgroundColor: leg.kind === 'bike' ? '#1E7F5C' : palette.brick }]}>
              <View style={styles.bannerMain}>
                <MaterialCommunityIcons
                  name={step ? maneuverIcon(step.maneuver) : leg.kind === 'bike' ? 'bike' : 'walk'}
                  size={50}
                  color="#FFF"
                />
                <View style={{ flex: 1 }}>
                  {step ? (
                    <>
                      <Text style={styles.bannerDistance}>{formatGuideDistance(progress?.toManeuver ?? step.distance)}</Text>
                      <Text style={styles.bannerTitle} numberOfLines={2}>
                        {step.banner}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.bannerTitle}>
                      {leg.kind === 'bike' ? 'Pédalez' : 'Marchez'} jusqu’à {leg.toName}
                    </Text>
                  )}
                </View>
              </View>
              {(leg.note || (nextStep && nextStep.maneuver.type !== 'arrive')) && (
                <View style={styles.bannerNext}>
                  {leg.note ? (
                    <>
                      <Ionicons name={leg.kind === 'bike' ? 'lock-open-outline' : 'bicycle'} size={16} color={colors.gold} />
                      <Text style={styles.bannerNextText}>
                        {leg.toName} · {leg.note}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.bannerNextLabel}>Puis</Text>
                      <MaterialCommunityIcons name={maneuverIcon(nextStep!.maneuver)} size={18} color={colors.text} />
                      <Text style={styles.bannerNextText} numberOfLines={1}>
                        {nextStep!.banner}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {(!ready || error) && (
        <View style={styles.overlay}>
          {error ? (
            <>
              <Ionicons name="alert-circle-outline" size={52} color={colors.closed} />
              <Text style={styles.overlayText}>{error.message}</Text>
              {error.settings ? (
                <Pressable style={styles.primary} onPress={() => void Linking.openSettings()}>
                  <Text style={styles.primaryText}>Ouvrir les réglages</Text>
                </Pressable>
              ) : end ? (
                <Pressable
                  style={styles.primary}
                  onPress={() => void Linking.openURL(googleMapsDirections(end, leg?.kind === 'bike' ? 'bicycle' : 'walk'))}
                >
                  <Text style={styles.primaryText}>Ouvrir dans Google Maps</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.secondary} onPress={() => router.back()}>
                <Text style={styles.secondaryText}>Retour</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.overlayText}>Recherche de votre position…</Text>
            </>
          )}
        </View>
      )}

      {!following && (
        <Pressable
          onPress={() => setFollowing(true)}
          style={[styles.recenter, { bottom: 180 + insets.bottom }]}
          accessibilityRole="button"
        >
          <Ionicons name="navigate" size={18} color={colors.text} />
          <Text style={styles.recenterText}>Recentrer</Text>
        </Pressable>
      )}

      {/* Toutes les étapes, l'étape en cours en évidence ; heure d'arrivée. */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        {legs.length > 1 && (
          <View style={styles.legs}>
            {legs.map((l, i) => (
              <Fragment key={i}>
                {i > 0 && <Ionicons name="chevron-forward" size={12} color={colors.textFaint} />}
                <View style={[styles.legChip, i === index && styles.legChipNow, i < index && { opacity: 0.35 }]}>
                  {l.kind === 'ride' ? (
                    <LineBadge line={l.line} size="sm" />
                  ) : (
                    <Ionicons name={l.kind === 'bike' ? 'bicycle' : 'walk'} size={16} color={colors.text} />
                  )}
                </View>
              </Fragment>
            ))}
          </View>
        )}
        <View style={styles.bottomRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eta}>Arrivée {eta}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatDuration(totalRemaining)}
              {progress ? ` · ${formatGuideDistance(progress.remainingMeters)} pour cette étape` : ''}
            </Text>
          </View>
          {index < legs.length - 1 && (
            <Pressable
              onPress={() => startLeg(index + 1, posRef.current)}
              style={styles.round}
              accessibilityRole="button"
              accessibilityLabel="Étape suivante"
            >
              <Ionicons name="play-skip-forward" size={20} color={colors.text} />
            </Pressable>
          )}
          <Pressable
            onPress={() => setMuted((m) => !m)}
            style={styles.round}
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Activer la voix' : 'Couper la voix'}
          >
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={stop} style={styles.stop} accessibilityRole="button" accessibilityLabel="Arrêter le guidage">
            <Text style={styles.stopText}>Arrêter</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bannerWrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  banner: { borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', boxShadow: '0 10px 28px rgba(0,0,0,0.35)' },
  bannerMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  bannerDistance: { color: '#FFF', fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  bannerTitle: { color: '#FFF', fontSize: font.body + 1, fontWeight: '800' },
  bannerSub: { fontSize: font.small, fontWeight: '600', marginTop: 2 },
  bannerNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  bannerNextLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  bannerNextText: { flex: 1, color: colors.text, fontSize: font.small },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.brick,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 13, 28, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  overlayText: { color: colors.text, fontSize: font.body, textAlign: 'center' },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  primaryText: { color: colors.accentText, fontWeight: '700', fontSize: font.body },
  secondary: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: font.body },
  recenter: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  recenterText: { color: colors.text, fontWeight: '700', fontSize: font.small },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  legs: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  legChip: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1.5, borderColor: 'transparent' },
  legChipNow: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eta: { color: colors.text, fontFamily: fonts.display, fontSize: font.title + 2 },
  meta: { color: colors.textMuted, fontSize: font.small },
  round: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stop: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.closed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopText: { color: '#FFFFFF', fontWeight: '800', fontSize: font.body },
});
