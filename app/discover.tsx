import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { PressableScale } from '@/src/components/PressableScale';
import { StopRow } from '@/src/features/discover/StopRow';
import { useFavorites } from '@/src/features/favorites/FavoritesProvider';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { googleMapsTour } from '@/src/features/navigation/googleMaps';
import { useNotifications } from '@/src/features/notifications/NotificationsProvider';
import { useI18n } from '@/src/i18n';
import { track } from '@/src/lib/analytics';
import { getPlace } from '@/src/lib/api';
import { font, fonts, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { themedStyles, useColors } from '@/src/theme/tone';
import { MUST_SEE, orderByProximity, SEASONAL, TOURS } from '@/shared/discover';
import type { LatLng, PlaceDetails } from '@/shared/types';

/** « Découvrir Lille » : rendez-vous du moment, parcours prêts, incontournables, mon week-end. */
export default function DiscoverScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const seasonal = SEASONAL.filter((s) => s.active(new Date()));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
      {seasonal.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading}>{t('En ce moment')}</Text>
          {seasonal.map((s) => (
            <StopRow key={s.id} stop={s} highlight extra={t(s.when)} />
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.heading}>{t('Parcours prêts')}</Text>
        <Text style={styles.muted}>{t('Des itinéraires à pied pour tout voir, étape par étape.')}</Text>
        {TOURS.map((tour) => (
          <TourCard key={tour.id} id={tour.id} />
        ))}
      </View>

      <MyWeekend />

      <View style={styles.section}>
        <Text style={styles.heading}>{t('Les incontournables')}</Text>
        {MUST_SEE.map((s) => (
          <StopRow key={s.id} stop={s} />
        ))}
        {SEASONAL.filter((s) => !seasonal.includes(s)).map((s) => (
          <StopRow key={s.id} stop={s} extra={t(s.when)} />
        ))}
      </View>
    </ScrollView>
  );
}

function TourCard({ id }: { id: string }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useI18n();
  const tour = TOURS.find((x) => x.id === id)!;
  const stops = tour.days.reduce((n, d) => n + d.stops.length, 0);
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/tour/[id]', params: { id: tour.id } })}
      style={styles.tour}
      accessibilityRole="button"
      accessibilityLabel={t(tour.title)}
    >
      <View style={styles.tourIcon}>
        <Ionicons name={tour.icon} size={24} color={colors.gold} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.tourTitle}>{t(tour.title)}</Text>
        <Text style={styles.muted}>{t(tour.subtitle)}</Text>
        <Text style={styles.faint}>
          {t('{n} étapes', { n: stops })} · {t(tour.distance)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
    </PressableScale>
  );
}

/** « Mon programme du week-end » : favoris et rappels, en un parcours à pied. */
function MyWeekend() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useI18n();
  const { ids } = useFavorites();
  const { reminders } = useNotifications();
  const { coords } = useUserLocation();
  const [places, setPlaces] = useState<PlaceDetails[] | null>(ids.length ? null : []);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ids.length) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    void Promise.allSettled(ids.slice(0, 12).map((id) => getPlace(id, 'summary', controller.signal))).then((r) => {
      if (!controller.signal.aborted) {
        setPlaces(r.flatMap((x) => (x.status === 'fulfilled' ? [x.value] : [])));
      }
    });
    return () => controller.abort();
  }, [ids]);

  // Événements avec rappel dans les 7 prochains jours.
  const events = reminders.filter((e) => new Date(e.start).getTime() - Date.now() < 7 * 86_400_000);
  const items = useMemo(
    () => [
      ...events.map((e) => ({ key: e.id, name: e.title, detail: `${e.dateLabel} · ${e.venueName}`, location: e.location, event: true })),
      ...(places ?? []).map((p) => ({ key: p.id, name: p.name, detail: p.address, location: p.location, event: false })),
    ],
    [events, places],
  );
  const chosen = items.filter((i) => !skipped.has(i.key));

  const toggle = (key: string) => {
    void Haptics.selectionAsync();
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const go = () => {
    const ordered = orderByProximity<{ location: LatLng }>(coords, chosen);
    track('directions', { mode: 'programme', stops: ordered.length });
    void Linking.openURL(googleMapsTour(ordered.map((i) => i.location)));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('Mon programme du week-end')}</Text>
      {places === null ? (
        <ActivityIndicator color={colors.accent} style={{ alignSelf: 'flex-start' }} />
      ) : items.length === 0 ? (
        <Text style={styles.muted}>
          {t('Ajoutez des lieux en favoris (♥) et des rappels d’événements : ils apparaîtront ici pour créer votre parcours.')}
        </Text>
      ) : (
        <>
          <Text style={styles.muted}>{t('Vos favoris et vos rappels. Décochez ce que vous ne voulez pas visiter.')}</Text>
          <View style={styles.card}>
            {items.map((i) => {
              const on = !skipped.has(i.key);
              return (
                <Pressable
                  key={i.key}
                  onPress={() => toggle(i.key)}
                  style={styles.check}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.accent : colors.textFaint} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopName} numberOfLines={1}>
                      {i.event ? '🎟 ' : ''}
                      {i.name}
                    </Text>
                    <Text style={styles.faint} numberOfLines={1}>
                      {i.detail}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <GradientButton
            title={t('Mon parcours dans Google Maps')}
            icon="walk"
            onPress={go}
            disabled={chosen.length === 0}
            accessibilityLabel={t('Ouvrir mon parcours à pied dans Google Maps')}
          />
          <Text style={styles.faint}>{t('Étapes dans l’ordre le plus court depuis votre position (9 au plus).')}</Text>
        </>
      )}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.md },
  heading: { color: colors.text, fontFamily: fonts.display, fontSize: font.title },
  muted: { color: colors.textMuted, fontSize: font.small, lineHeight: 20 },
  faint: { color: colors.textFaint, fontSize: font.tiny + 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  tour: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    boxShadow: colors.cardShadow,
  },
  tourIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldTint,
  },
  tourTitle: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.body + 2 },
  stopName: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET },
}));
