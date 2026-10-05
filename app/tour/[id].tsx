import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { PlacesMap } from '@/src/components/PlacesMap';
import { StopRow } from '@/src/features/discover/StopRow';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { googleMapsTour } from '@/src/features/navigation/googleMaps';
import { useI18n } from '@/src/i18n';
import { track } from '@/src/lib/analytics';
import { font, fonts, spacing } from '@/src/theme';
import { themedStyles } from '@/src/theme/tone';
import { findTour, tourPoints } from '@/shared/discover';

/** Parcours prêt : carte des étapes, étapes numérotées, itinéraire à pied dans Google Maps. */
export default function TourScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { status } = useUserLocation();
  const tour = findTour(id);

  if (!tour) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>{t('Ce parcours n’existe plus.')}</Text>
      </View>
    );
  }

  const all = tour.days.flatMap((d) => d.stops);
  const points = tourPoints(all);
  const pins = points.map((s, i) => ({ id: `${i}-${s.id}`, position: s.location, title: `${i + 1}. ${t(s.name)}` }));
  const openDay = (dayIndex: number) => {
    const stops = tourPoints(tour.days[dayIndex]!.stops);
    track('directions', { mode: 'parcours', tour: tour.id });
    void Linking.openURL(googleMapsTour(stops.map((s) => s.location)));
  };
  const single = tour.days.length === 1;
  let n = 0;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t(tour.title) }} />
      <ScrollView contentContainerStyle={{ paddingBottom: (single ? 110 : spacing.xxl) + insets.bottom }}>
        <View style={styles.map}>
          <PlacesMap
            center={points[0]?.location ?? { lat: 50.6368, lng: 3.0635 }}
            pins={pins}
            showUserLocation={status === 'granted'}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{t(tour.title)}</Text>
          <Text style={styles.muted}>{t(tour.subtitle)}</Text>
          <Text style={styles.faint}>{t(tour.distance)}</Text>

          {tour.days.map((day, d) => (
            <View key={d} style={styles.day}>
              {day.title && <Text style={styles.dayTitle}>{t(day.title)}</Text>}
              {day.stops.map((s) => (
                <StopRow key={`${d}-${s.id}`} stop={s} index={++n} />
              ))}
              {!single && (
                <GradientButton
                  title={t('Itinéraire : {day}', { day: t(day.title ?? '') })}
                  icon="walk"
                  onPress={() => openDay(d)}
                />
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {single && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <GradientButton
            title={t('Faire le parcours')}
            icon="walk"
            onPress={() => openDay(0)}
            accessibilityLabel={t('Ouvrir le parcours à pied dans Google Maps')}
          />
        </View>
      )}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  map: { height: 260, backgroundColor: colors.surface },
  body: { padding: spacing.lg, gap: spacing.sm },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: font.hero - 8 },
  muted: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
  faint: { color: colors.textFaint, fontSize: font.small },
  day: { gap: spacing.md, marginTop: spacing.lg },
  dayTitle: { color: colors.gold, fontFamily: fonts.displayMedium, fontSize: font.title - 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
}));
