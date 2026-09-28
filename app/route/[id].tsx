import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { TransitCard } from '@/src/features/lille/TransitCard';
import { VlilleCard } from '@/src/features/lille/VlilleCard';
import { PlacesMap } from '@/src/components/PlacesMap';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { ApiRequestError, getRoutes } from '@/src/lib/api';
import { colors, font, fonts, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { formatArrival, formatDistance, formatDuration } from '@/shared/format';
import { decodePolyline } from '@/shared/polyline';
import type { LatLng, RouteOption, TravelMode } from '@/shared/types';

const MODES: {
  mode: TravelMode;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { mode: 'walk', label: 'À pied', icon: 'walk' },
  { mode: 'bicycle', label: 'Vélo', icon: 'bicycle' },
  { mode: 'drive', label: 'Voiture', icon: 'car' },
  { mode: 'transit', label: 'Transports', icon: 'subway' },
];

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; options: RouteOption[]; from: LatLng };

export default function RoutePreviewScreen() {
  const params = useLocalSearchParams<{ id: string; name: string; lat: string; lng: string }>();
  const destination = useMemo<LatLng>(
    () => ({ lat: Number(params.lat), lng: Number(params.lng) }),
    [params.lat, params.lng],
  );
  const insets = useSafeAreaInsets();
  const { refresh, isFallback, status } = useUserLocation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Marche par défaut : on est en centre-ville.
  const [mode, setMode] = useState<TravelMode>('walk');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState({ kind: 'loading' });
      try {
        const from = await refresh();
        const res = await getRoutes(from, destination, signal);
        if (signal?.aborted) return;
        setState({ kind: 'done', options: res.options, from });
        const walk = res.options.find((o) => o.mode === 'walk');
        if (!walk?.available) {
          const first = res.options.find((o) => o.available);
          if (first) setMode(first.mode);
        }
      } catch (error) {
        if (signal?.aborted) return;
        setState({
          kind: 'error',
          message:
            error instanceof ApiRequestError ? error.message : 'Impossible de calculer l’itinéraire.',
        });
      }
    },
    [refresh, destination],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const selected = state.kind === 'done' ? state.options.find((o) => o.mode === mode) : undefined;
  const route = useMemo(
    () => (selected?.available && selected.polyline ? decodePolyline(selected.polyline) : undefined),
    [selected],
  );
  const pins = useMemo(
    () => [{ id: params.id, position: destination, title: params.name ?? 'Destination' }],
    [params.id, params.name, destination],
  );

  const onStart = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/navigate/[id]',
      params: { id: params.id, name: params.name, lat: params.lat, lng: params.lng, mode },
    });
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: params.name ?? 'Itinéraire' }} />

      <View style={styles.mapWrap}>
        {state.kind === 'done' ? (
          <PlacesMap
            center={destination}
            pins={pins}
            route={route}
            showUserLocation={status === 'granted'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={styles.center}>
            {state.kind === 'loading' ? (
              <>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.muted}>Calcul de l’itinéraire…</Text>
              </>
            ) : (
              <>
                <Ionicons name="alert-circle-outline" size={44} color={colors.textFaint} />
                <Text style={styles.message}>{state.message}</Text>
                <Pressable style={styles.retry} onPress={() => void load()}>
                  <Text style={styles.retryText}>Réessayer</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      {state.kind === 'done' && (
        <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
          {isFallback && (
            <View style={styles.warning}>
              <Ionicons name="location-outline" size={18} color={colors.star} />
              <Text style={styles.warningText}>
                Position inconnue : itinéraire calculé depuis la Grand-Place.
              </Text>
            </View>
          )}

          <View style={styles.modes}>
            {MODES.map(({ mode: m, label, icon }) => {
              const option = state.options.find((o) => o.mode === m);
              const active = m === mode;
              const disabled = !option?.available;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setMode(m);
                  }}
                  disabled={disabled}
                  style={[styles.mode, active && styles.modeActive, disabled && { opacity: 0.4 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled }}
                  accessibilityLabel={`${label}${
                    option?.durationSeconds ? `, ${formatDuration(option.durationSeconds)}` : ''
                  }`}
                >
                  <Ionicons name={icon} size={24} color={active ? colors.accentText : colors.text} />
                  <Text style={[styles.modeTime, active && { color: colors.accentText }]}>
                    {option?.durationSeconds ? formatDuration(option.durationSeconds) : '—'}
                  </Text>
                  <Text style={[styles.modeLabel, active && { color: colors.accentText }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selected?.available && selected.durationSeconds !== undefined && (
            <View style={styles.summary}>
              <Text style={styles.duration}>{formatDuration(selected.durationSeconds)}</Text>
              <Text style={styles.muted}>
                {formatDistance(selected.distanceMeters ?? 0)} · arrivée vers{' '}
                {formatArrival(selected.durationSeconds)}
              </Text>
            </View>
          )}

          {mode === 'transit' && selected?.transitLines && selected.transitLines.length > 0 && (
            <View style={styles.lines}>
              {selected.transitLines.map((line) => (
                <View key={line} style={styles.line}>
                  <Text style={styles.lineText}>{line}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Temps réel lillois : V'Lille à vélo, prochains passages en transports. */}
          {mode === 'bicycle' && <VlilleCard from={state.from} to={destination} />}
          {mode === 'transit' && <TransitCard near={state.from} title="Départs près de vous" />}

          {mode === 'transit' ? (
            <GradientButton
              title="Horaires et trajet détaillé"
              icon="subway"
              onPress={() =>
                router.push({
                  pathname: '/transit/[id]',
                  params: { id: params.id, name: params.name, lat: params.lat, lng: params.lng },
                })
              }
              disabled={!selected?.available}
              accessibilityLabel="Voir les horaires et le trajet détaillé en transports"
            />
          ) : (
            <GradientButton
              title="Démarrer"
              icon="navigate"
              onPress={onStart}
              disabled={!selected?.available}
              accessibilityLabel="Démarrer le guidage"
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  message: { color: colors.text, fontSize: font.body, textAlign: 'center' },
  muted: { color: colors.textMuted, fontSize: font.body },
  retry: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  retryText: { color: colors.accentText, fontSize: font.body, fontWeight: '700' },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  warning: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  warningText: { flex: 1, color: colors.textMuted, fontSize: font.small },
  modes: { flexDirection: 'row', gap: spacing.sm },
  mode: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 84,
    justifyContent: 'center',
  },
  modeActive: { backgroundColor: colors.accent },
  modeTime: { color: colors.text, fontSize: font.small + 1, fontWeight: '700' },
  modeLabel: { color: colors.textMuted, fontSize: font.tiny },
  summary: { gap: 2 },
  duration: { color: colors.text, fontFamily: fonts.display, fontSize: font.hero - 2 },
  lines: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  line: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  lineText: { color: colors.text, fontSize: font.small, fontWeight: '700' },
});
