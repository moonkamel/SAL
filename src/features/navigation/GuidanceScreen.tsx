import { Ionicons } from '@expo/vector-icons';
import {
  AudioGuidance,
  NavigationNightMode,
  NavigationSessionStatus,
  NavigationView,
  RouteStatus,
  type TimeAndDistance,
  TravelMode as SdkTravelMode,
  useNavigation,
} from '@googlemaps/react-native-navigation-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { formatArrival, formatDistance, formatDuration } from '@/shared/format';
import type { LatLng, TravelMode } from '@/shared/types';

import { setGuidanceActive } from './guidanceState';
import { routeErrorMessage, sessionErrorMessage } from './messages';

const SDK_MODE: Record<Exclude<TravelMode, 'transit'>, SdkTravelMode> = {
  walk: SdkTravelMode.WALKING,
  bicycle: SdkTravelMode.CYCLING,
  drive: SdkTravelMode.DRIVING,
};

const INTRO_KEY = 'guidance-intro-seen:v1';
// Au-delà, on lance quand même le calcul : le SDK attend la position de son côté.
const LOCATION_TIMEOUT_MS = 8_000;
const BOTTOM_BAR_HEIGHT = 96;

type Phase =
  | { kind: 'intro' }
  | { kind: 'starting'; label: string }
  | { kind: 'guiding' }
  | { kind: 'error'; message: string; openSettings?: boolean };

interface Props {
  placeId: string;
  name: string;
  destination: LatLng;
  mode: Exclude<TravelMode, 'transit'>;
  /** Revenir à l'écran précédent à l'arrivée (ex. guidage jusqu'à un arrêt de bus). */
  returnOnArrival?: boolean;
}

/** Guidage plein écran via le Google Navigation SDK. Aucune publicité ici. */
export function GuidanceScreen({ placeId, name, destination, mode, returnOnArrival }: Props) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const {
    navigationController,
    setOnArrival,
    setOnLocationChanged,
    setOnRemainingTimeOrDistanceChanged,
    removeAllListeners,
  } = useNavigation();

  const [phase, setPhase] = useState<Phase>({ kind: 'starting', label: 'Préparation…' });
  const [viewVisible, setViewVisible] = useState(false);
  const [remaining, setRemaining] = useState<TimeAndDistance | null>(null);
  const introResolver = useRef<(() => void) | null>(null);
  const finishedRef = useRef(false);

  const stopGuidance = useCallback(async () => {
    setGuidanceActive(false);
    try {
      await navigationController.stopGuidance();
      await navigationController.clearDestinations();
    } catch {
      // Le guidage n'avait peut-être pas démarré : rien à arrêter.
    }
  }, [navigationController]);

  // Démarrage : permission → explication (1re fois) → CGU Google → session → itinéraire → guidage.
  useEffect(() => {
    let cancelled = false;
    const fail = (message: string, openSettings = false) => {
      if (!cancelled) setPhase({ kind: 'error', message, openSettings });
    };

    const waitForFirstLocation = () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          setOnLocationChanged(null);
          resolve();
        }, LOCATION_TIMEOUT_MS);
        setOnLocationChanged(() => {
          clearTimeout(timer);
          setOnLocationChanged(null);
          resolve();
        });
      });

    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        const asked = perm.canAskAgain ? await Location.requestForegroundPermissionsAsync() : perm;
        if (!asked.granted) {
          fail('Autorisez la localisation pour être guidé jusqu’au lieu.', true);
          return;
        }
      }

      // Android 13+ : autorisation d'afficher la notification « guidage en cours ».
      // Facultative : le guidage fonctionne aussi sans.
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(
          () => null,
        );
      }

      const introSeen = await AsyncStorage.getItem(INTRO_KEY).catch(() => null);
      if (!introSeen) {
        setPhase({ kind: 'intro' });
        await new Promise<void>((resolve) => (introResolver.current = resolve));
        if (cancelled) return;
        await AsyncStorage.setItem(INTRO_KEY, '1').catch(() => {});
      }

      setPhase({ kind: 'starting', label: 'Conditions d’utilisation…' });
      const accepted =
        (await navigationController.areTermsAccepted()) ||
        (await navigationController.showTermsAndConditionsDialog());
      if (!accepted) {
        fail(sessionErrorMessage(NavigationSessionStatus.TERMS_NOT_ACCEPTED));
        return;
      }
      if (cancelled) return;

      setPhase({ kind: 'starting', label: 'Démarrage du guidage…' });
      const status = await navigationController.init();
      if (status !== NavigationSessionStatus.OK) {
        fail(
          sessionErrorMessage(status),
          status === NavigationSessionStatus.LOCATION_PERMISSION_MISSING,
        );
        return;
      }
      if (cancelled) return;
      setViewVisible(true);

      setPhase({ kind: 'starting', label: 'Recherche de votre position…' });
      // Sans cet appel, le SDK n'envoie aucune position : on attendait toujours le délai maximal.
      const firstLocation = waitForFirstLocation();
      await navigationController.startUpdatingLocation();
      await firstLocation;
      if (cancelled) return;

      setPhase({ kind: 'starting', label: 'Calcul de l’itinéraire…' });
      // Chaque appel à setDestinations est facturé par Google : un seul par guidage.
      const route = await navigationController.setDestinations(
        [{ title: name, position: destination }],
        {
          routingOptions: { travelMode: SDK_MODE[mode] },
          displayOptions: { showDestinationMarkers: true },
        },
      );
      if (route !== RouteStatus.OK) {
        fail(routeErrorMessage(route));
        return;
      }
      if (cancelled) return;

      navigationController.setAudioGuidanceType(
        AudioGuidance.VOICE_ALERTS_AND_GUIDANCE | AudioGuidance.BLUETOOTH_AUDIO,
      );
      await navigationController.startGuidance();
      setGuidanceActive(true);
      if (!cancelled) setPhase({ kind: 'guiding' });
    })().catch((error: unknown) => {
      console.error('[guidance]', error);
      fail('Le guidage n’a pas pu démarrer. Réessayez.');
    });

    return () => {
      cancelled = true;
      introResolver.current?.();
      removeAllListeners();
      void stopGuidance().then(() => {
        try {
          navigationController.stopUpdatingLocation();
        } catch {
          // Session déjà fermée.
        }
        return navigationController.cleanup().catch(() => {});
      });
    };
    // Une seule session par écran : volontairement exécuté une seule fois au montage.
  }, []);

  // Temps et distance restants, et arrivée.
  useEffect(() => {
    setOnRemainingTimeOrDistanceChanged(setRemaining);
    setOnArrival((event) => {
      if (event.isFinalDestination === false || finishedRef.current) return;
      finishedRef.current = true;
      void stopGuidance();
      if (returnOnArrival) router.back();
      else router.replace({ pathname: '/arrived/[id]', params: { id: placeId, name } });
    });
  }, [setOnRemainingTimeOrDistanceChanged, setOnArrival, stopGuidance, placeId, name, returnOnArrival]);

  const confirmStop = useCallback(() => {
    if (phase.kind !== 'guiding') {
      router.back();
      return;
    }
    Alert.alert('Arrêter le guidage ?', undefined, [
      { text: 'Continuer', style: 'cancel' },
      {
        text: 'Arrêter',
        style: 'destructive',
        onPress: () => {
          finishedRef.current = true;
          void stopGuidance();
          router.back();
        },
      },
    ]);
  }, [phase.kind, stopGuidance]);

  // Bouton retour Android : même confirmation que « Arrêter ».
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmStop();
      return true;
    });
    return () => sub.remove();
  }, [confirmStop]);

  return (
    <View style={styles.screen}>
      {viewVisible && (
        <NavigationView
          style={StyleSheet.absoluteFill}
          navigationNightMode={NavigationNightMode.FORCE_NIGHT}
          headerEnabled
          footerEnabled={false}
          tripProgressBarEnabled={false}
          reportIncidentButtonEnabled={false}
          speedometerEnabled={mode === 'drive'}
          recenterButtonEnabled
          mapPadding={{ bottom: BOTTOM_BAR_HEIGHT + insets.bottom }}
        />
      )}

      {phase.kind === 'intro' && (
        <View style={styles.overlay}>
          <Ionicons name="navigate-circle" size={64} color={colors.accent} />
          <Text style={styles.title}>Guidage vers {name}</Text>
          <Text style={styles.body}>
            Pendant le guidage, Sortir à Lille utilise votre position en continu, même écran
            verrouillé, et vous indique le chemin à voix haute. La localisation s’arrête dès que
            vous arrivez ou que vous touchez « Arrêter ».
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => introResolver.current?.()}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>C’est parti</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <Text style={styles.link}>Annuler</Text>
          </Pressable>
        </View>
      )}

      {phase.kind === 'starting' && (
        <View style={[styles.overlay, viewVisible && styles.overlayTranslucent]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.body}>{phase.label}</Text>
        </View>
      )}

      {phase.kind === 'error' && (
        <View style={styles.overlay}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.closed} />
          <Text style={styles.body}>{phase.message}</Text>
          {phase.openSettings && (
            <Pressable style={styles.primary} onPress={() => void Linking.openSettings()}>
              <Text style={styles.primaryText}>Ouvrir les réglages</Text>
            </Pressable>
          )}
          <Pressable style={styles.secondary} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Retour</Text>
          </Pressable>
        </View>
      )}

      {phase.kind === 'guiding' && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={{ flex: 1 }}>
            {remaining ? (
              <>
                <Text style={styles.barTime}>{formatDuration(remaining.seconds)}</Text>
                <Text style={styles.barMeta}>
                  {formatDistance(remaining.meters)} · arrivée {formatArrival(remaining.seconds)}
                </Text>
              </>
            ) : (
              <Text style={styles.barMeta} numberOfLines={1}>
                {name}
              </Text>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [styles.stop, pressed && { opacity: 0.85 }]}
            onPress={confirmStop}
            accessibilityRole="button"
            accessibilityLabel="Arrêter le guidage"
          >
            <Ionicons name="close" size={24} color={colors.accentText} />
            <Text style={styles.stopText}>Arrêter</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  overlayTranslucent: { backgroundColor: 'rgba(11,11,18,0.75)' },
  title: { color: colors.text, fontSize: font.title + 2, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.text, fontSize: font.body, textAlign: 'center', lineHeight: 23 },
  link: { color: colors.textMuted, fontSize: font.body, fontWeight: '600' },
  primary: {
    minHeight: 60,
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: colors.accentText, fontSize: font.title - 2, fontWeight: '800' },
  secondary: {
    minHeight: TOUCH_TARGET + 4,
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: BOTTOM_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  barTime: { color: colors.open, fontSize: font.title + 4, fontWeight: '800' },
  barMeta: { color: colors.textMuted, fontSize: font.small + 1 },
  stop: {
    minHeight: 60,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.closed,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stopText: { color: colors.accentText, fontSize: font.body + 2, fontWeight: '800' },
});
