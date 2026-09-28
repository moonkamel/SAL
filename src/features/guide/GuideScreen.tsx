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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDaytime } from '@/src/features/moment/useDaytime';
import { googleMapsDirections } from '@/src/features/navigation/googleMaps';
import { getGuideRoute, type GuideMode, MAPBOX_TOKEN, MapboxRouteError } from '@/src/lib/mapbox';
import { colors, font, fonts, palette, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { formatArrival, formatDuration } from '@/shared/format';
import {
  dueAnnouncements,
  formatGuideDistance,
  type GuideRoute,
  isOffRoute,
  type Progress,
  progressOn,
} from '@/shared/guide';
import type { LatLng } from '@/shared/types';

import { maneuverIcon } from './maneuverIcon';

if (MAPBOX_TOKEN) void Mapbox.setAccessToken(MAPBOX_TOKEN);

interface Props {
  placeId: string;
  name: string;
  destination: LatLng;
  mode: GuideMode;
  /** Revenir à l'écran précédent à l'arrivée (ex. jusqu'à un arrêt de métro). */
  returnOnArrival?: boolean;
}

type State =
  | { kind: 'loading'; label: string }
  | { kind: 'error'; message: string; settings?: boolean }
  | { kind: 'guiding' };

const REROUTE_MIN_MS = 10_000;

/** Guidage pas à pas façon Citymapper, sur carte Mapbox (3D, ambiance jour/nuit). */
export function GuideScreen({ placeId, name, destination, mode, returnOnArrival }: Props) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const day = useDaytime();

  const [state, setState] = useState<State>({ kind: 'loading', label: 'Recherche de votre position…' });
  const [route, setRoute] = useState<GuideRoute | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [muted, setMuted] = useState(false);
  const [following, setFollowing] = useState(true);

  const routeRef = useRef<GuideRoute | null>(null);
  const alongRef = useRef(0);
  const spoken = useRef(new Set<string>());
  const offCount = useRef(0);
  const lastReroute = useRef(0);
  const finished = useRef(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const say = useCallback((text: string) => {
    if (mutedRef.current) return;
    Speech.stop();
    Speech.speak(text, { language: 'fr-FR', rate: 1.0 });
  }, []);

  const loadRoute = useCallback(
    async (from: LatLng, reroute = false) => {
      try {
        const r = await getGuideRoute(from, destination, mode);
        routeRef.current = r;
        alongRef.current = 0;
        spoken.current = new Set();
        offCount.current = 0;
        setRoute(r);
        setState({ kind: 'guiding' });
        if (reroute) say('Nouvel itinéraire.');
      } catch (error) {
        if (reroute) return; // on garde l'ancien tracé
        setState({
          kind: 'error',
          message: error instanceof MapboxRouteError ? error.message : 'Itinéraire indisponible.',
        });
      }
    },
    [destination, mode, say],
  );

  const arrive = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    say(`Vous êtes arrivé : ${name}.`);
    if (returnOnArrival) router.back();
    else router.replace({ pathname: '/arrived/[id]', params: { id: placeId, name } });
  }, [name, placeId, returnOnArrival, say]);

  // Position : permission, premier point, itinéraire, puis suivi continu.
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setState({ kind: 'error', message: 'Jeton Mapbox manquant : ajoutez EXPO_PUBLIC_MAPBOX_TOKEN (voir README).' });
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setState({ kind: 'error', message: 'Autorisez la localisation pour être guidé.', settings: true });
        return;
      }
      // Dernière position connue tout de suite, pour calculer l'itinéraire sans attendre le GPS.
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (last && !cancelled) {
        setState({ kind: 'loading', label: 'Calcul de l’itinéraire…' });
        await loadRoute({ lat: last.coords.latitude, lng: last.coords.longitude });
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
        (loc) => {
          const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          const r = routeRef.current;
          if (!r) {
            setState({ kind: 'loading', label: 'Calcul de l’itinéraire…' });
            void loadRoute(pos);
            return;
          }
          const p = progressOn(r, pos, alongRef.current);
          alongRef.current = p.along;
          setProgress(p);
          if (p.arrived) {
            arrive();
            return;
          }
          for (const text of dueAnnouncements(r, p, spoken.current)) say(text);
          // Écart confirmé sur deux positions : on recalcule (au plus toutes les 10 s).
          offCount.current = isOffRoute(p, loc.coords.accuracy ?? 10) ? offCount.current + 1 : 0;
          if (offCount.current >= 2 && Date.now() - lastReroute.current > REROUTE_MIN_MS) {
            lastReroute.current = Date.now();
            offCount.current = 0;
            void loadRoute(pos, true);
          }
        },
      );
      if (cancelled) sub.remove();
    })().catch(() => setState({ kind: 'error', message: 'La localisation n’a pas pu démarrer.' }));
    return () => {
      cancelled = true;
      sub?.remove();
      Speech.stop();
    };
  }, [loadRoute, say, arrive]);

  const stop = useCallback(() => {
    if (state.kind !== 'guiding') {
      router.back();
      return;
    }
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
  }, [state.kind]);

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

  const step = route && progress ? route.steps[progress.step] : route?.steps[0];
  const nextStep = route && progress ? route.steps[progress.step + 1] : route?.steps[1];
  const toManeuver = progress?.toManeuver ?? step?.distance ?? 0;

  return (
    <View style={styles.screen}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL="mapbox://styles/mapbox/standard"
        scaleBarEnabled={false}
        logoPosition={{ bottom: 150 + insets.bottom, left: 12 }}
        attributionPosition={{ bottom: 150 + insets.bottom, right: 12 }}
        onTouchStart={() => setFollowing(false)}
      >
        <StyleImport
          id="basemap"
          existing
          config={{
            lightPreset: day ? 'day' : 'night',
            show3dObjects: true,
            showPointOfInterestLabels: false,
          }}
        />
        <Camera
          followUserLocation={following}
          followUserMode={UserTrackingMode.FollowWithHeading}
          followZoomLevel={17.5}
          followPitch={55}
          followPadding={{ paddingTop: 180 + insets.top, paddingBottom: 140 + insets.bottom }}
          defaultSettings={{ centerCoordinate: [destination.lng, destination.lat], zoomLevel: 15 }}
        />
        <LocationPuck puckBearing="heading" puckBearingEnabled pulsing={{ isEnabled: true, color: palette.brick }} />
        {line && (
          <ShapeSource id="route" shape={line}>
            <LineLayer
              id="route-casing"
              style={{ lineColor: '#7E2A17', lineWidth: 12, lineCap: 'round', lineJoin: 'round', lineEmissiveStrength: 1 }}
            />
            <LineLayer
              id="route-line"
              aboveLayerID="route-casing"
              style={{ lineColor: palette.brickGlow, lineWidth: 7, lineCap: 'round', lineJoin: 'round', lineEmissiveStrength: 1 }}
            />
          </ShapeSource>
        )}
        <MarkerView coordinate={[destination.lng, destination.lat]} allowOverlap>
          <View style={styles.destPin}>
            <Ionicons name="flag" size={18} color={colors.accentText} />
          </View>
        </MarkerView>
      </MapView>

      {/* Instruction à venir, en grand. */}
      {state.kind === 'guiding' && step && (
        <View style={[styles.banner, { top: insets.top + spacing.sm }]} accessibilityLiveRegion="polite">
          <View style={styles.bannerMain}>
            <MaterialCommunityIcons name={maneuverIcon(step.maneuver)} size={52} color={colors.accentText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerDistance}>{formatGuideDistance(toManeuver)}</Text>
              <Text style={styles.bannerText} numberOfLines={2}>
                {step.banner}
              </Text>
            </View>
          </View>
          {nextStep && nextStep.maneuver.type !== 'arrive' && (
            <View style={styles.bannerNext}>
              <Text style={styles.bannerNextLabel}>Puis</Text>
              <MaterialCommunityIcons name={maneuverIcon(nextStep.maneuver)} size={18} color={colors.text} />
              <Text style={styles.bannerNextText} numberOfLines={1}>
                {nextStep.banner}
              </Text>
            </View>
          )}
        </View>
      )}

      {state.kind !== 'guiding' && (
        <View style={styles.overlay}>
          {state.kind === 'loading' ? (
            <>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.overlayText}>{state.label}</Text>
            </>
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={52} color={colors.closed} />
              <Text style={styles.overlayText}>{state.message}</Text>
              {state.settings ? (
                <Pressable style={styles.primary} onPress={() => void Linking.openSettings()}>
                  <Text style={styles.primaryText}>Ouvrir les réglages</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.primary}
                  onPress={() => void Linking.openURL(googleMapsDirections(destination, mode))}
                >
                  <Text style={styles.primaryText}>Ouvrir dans Google Maps</Text>
                </Pressable>
              )}
              <Pressable style={styles.secondary} onPress={() => router.back()}>
                <Text style={styles.secondaryText}>Retour</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Recentrer après un geste sur la carte. */}
      {state.kind === 'guiding' && !following && (
        <Pressable
          onPress={() => setFollowing(true)}
          style={[styles.recenter, { bottom: 150 + insets.bottom }]}
          accessibilityRole="button"
          accessibilityLabel="Recentrer"
        >
          <Ionicons name="navigate" size={18} color={colors.text} />
          <Text style={styles.recenterText}>Recentrer</Text>
        </Pressable>
      )}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flex: 1 }}>
          {progress ? (
            <>
              <Text style={styles.eta}>{formatArrival(progress.remainingSeconds)}</Text>
              <Text style={styles.meta}>
                {formatDuration(progress.remainingSeconds)} · {formatGuideDistance(progress.remainingMeters)}
              </Text>
            </>
          ) : (
            <Text style={styles.meta} numberOfLines={1}>
              {name}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => setMuted((m) => !m)}
          style={styles.round}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Activer la voix' : 'Couper la voix'}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={stop} style={styles.stop} accessibilityRole="button" accessibilityLabel="Arrêter le guidage">
          <Text style={styles.stopText}>Arrêter</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  banner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: palette.brick,
    boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
  },
  bannerMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  bannerDistance: { color: colors.accentText, fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  bannerText: { color: colors.accentText, fontSize: font.body + 1, fontWeight: '700' },
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
  destPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  eta: { color: colors.text, fontFamily: fonts.display, fontSize: font.title + 4 },
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
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.closed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopText: { color: '#FFFFFF', fontWeight: '800', fontSize: font.body },
});
