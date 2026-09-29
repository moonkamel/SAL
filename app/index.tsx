import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type ComponentProps, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LilleSkyline } from '@/src/components/LilleSkyline';
import { LocationBanner } from '@/src/components/LocationBanner';
import { PressableScale } from '@/src/components/PressableScale';
import { SearchBar } from '@/src/components/SearchBar';
import { AdBanner } from '@/src/features/ads/AdBanner';
import { useAds } from '@/src/features/ads/AdsProvider';
import { useSearchHistory } from '@/src/features/history/useSearchHistory';
import { useLiveData } from '@/src/features/lille/useLiveData';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { OffersRail, TonightRail } from '@/src/features/moment/HomeRails';
import { SurpriseCard } from '@/src/features/moment/SurpriseCard';
import { useDaytime } from '@/src/features/moment/useDaytime';
import { WeatherCard } from '@/src/features/moment/WeatherCard';
import { weatherIcon } from '@/src/features/moment/weatherIcons';
import { tx, useI18n } from '@/src/i18n';
import { LANG_INFO } from '@/shared/i18n';
import { getWeather } from '@/src/lib/api';
import { momentLabel } from '@/src/lib/moment';
import {
  colors,
  font,
  fonts,
  motion,
  palette,
  radius,
  shadows,
  spacing,
  TOUCH_TARGET,
} from '@/src/theme';
import { TONES, ToneProvider } from '@/src/theme/tone';
import type { Suggestion, WeatherResponse } from '@/shared/types';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Suggestions : celles du cahier des charges + l'estaminet, incontournable lillois.
const CATEGORIES: { label: string; query: string; icon: IconName; tint: string }[] = [
  { label: tx('Estaminet'), query: 'estaminet', icon: 'beer', tint: palette.gold },
  { label: tx('Resto japonais'), query: 'Resto japonais', icon: 'restaurant', tint: palette.brick },
  { label: tx('Afterwork'), query: 'Afterwork', icon: 'people', tint: palette.gold },
  { label: tx('Boîte de nuit'), query: 'Boîte de nuit', icon: 'musical-notes', tint: palette.brick },
  { label: tx('Brunch'), query: 'Brunch', icon: 'cafe', tint: palette.gold },
  { label: tx('Bar à cocktails'), query: 'Bar à cocktails', icon: 'wine', tint: palette.brick },
];

const SKY_HEIGHT = 280;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { history, add, clear } = useSearchHistory();
  const { onSearch, privacyOptionsRequired, showPrivacyOptions } = useAds();
  // Le jour (6 h – 19 h) : « aujourd'hui » et tonalité jour ; le soir : la nuit lilloise.
  const day = useDaytime();
  const tone = TONES[day ? 'day' : 'night'];
  const { t: tr, lang } = useI18n();

  // Barre d'état sombre sur le ciel clair ; les autres écrans restent en tonalité nuit.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(day ? 'dark' : 'light');
      return () => setStatusBarStyle('light');
    }, [day]),
  );

  const { coords } = useUserLocation();
  // Arrondi à ~1 km : pas de nouvel appel à chaque petit déplacement.
  const lat = Math.round(coords.lat * 100) / 100;
  const lng = Math.round(coords.lng * 100) / 100;
  const { data: weather } = useLiveData<WeatherResponse>(
    (signal) => getWeather({ lat, lng }, signal),
    10 * 60_000,
    [lat, lng, lang],
  );

  const search = (query: string, ambiance?: Suggestion['ambiance']) => {
    add(query);
    router.push({
      pathname: '/results',
      params: ambiance?.length ? { q: query, ambiance: ambiance.join(',') } : { q: query },
    });
    // Peut afficher l'interstitiel (au plus une fois par session, jamais à la 1re recherche).
    onSearch();
  };

  return (
    <ToneProvider value={day ? 'day' : 'night'}>
      <View style={[styles.screen, { backgroundColor: tone.background }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ paddingBottom: spacing.xxl }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Ciel (bleu le jour, nocturne le soir) et silhouette de Lille. */}
            <LinearGradient
              colors={tone.sky}
              style={[styles.sky, { paddingTop: insets.top + spacing.md }]}
            >
              <LilleSkyline style={styles.skyline} tone={day ? 'day' : 'night'} />

              <Animated.View entering={FadeInDown.duration(motion.slow)} style={styles.topBar}>
                <View style={styles.momentRow}>
                  <Text style={[styles.moment, day && { color: tone.text }]}>{momentLabel(new Date(), lang)}</Text>
                  {weather && (
                    <View
                      style={[styles.weatherChip, { backgroundColor: tone.glass }]}
                      accessible
                      accessibilityLabel={tr('{n} degrés', { n: Math.round(weather.weather.temperature) })}
                    >
                      <Ionicons name={weatherIcon(weather.weather)} size={13} color={tone.gold} />
                      <Text style={[styles.weatherText, { color: tone.text }]}>
                        {Math.round(weather.weather.temperature)}°
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.topActions}>
                <PressableScale
                  onPress={() => router.push('/language')}
                  style={[styles.langButton, { backgroundColor: tone.glass, borderColor: tone.glassBorder }]}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Changer de langue ({name})', { name: LANG_INFO[lang].name })}
                >
                  <Text style={styles.langFlag}>{LANG_INFO[lang].flags[0]}</Text>
                  <Text style={[styles.favText, { color: tone.text }]}>{lang.toUpperCase()}</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => router.push('/favorites')}
                  style={[styles.favButton, { backgroundColor: tone.glass, borderColor: tone.glassBorder }]}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Mes favoris')}
                >
                  <Ionicons name="heart" size={18} color={colors.accent} />
                  <Text style={[styles.favText, { color: tone.text }]}>{tr('Favoris')}</Text>
                </PressableScale>
                </View>
              </Animated.View>

              <Animated.Text
                entering={FadeInDown.delay(motion.stagger).duration(motion.slow)}
                style={[styles.hero, { color: tone.text }, day && styles.heroDay]}
              >
                {day ? tr('On fait quoi aujourd’hui') : tr('On fait quoi ce soir')}{' '}
                <Text style={[styles.heroAccent, { color: tone.highlight }]}>{tr('à Lille')}</Text>
                {/* Espace insécable : le « ? » ne se retrouve jamais seul sur une ligne. */}
                {lang === 'fr' ? '\u00A0?' : '?'}
              </Animated.Text>
            </LinearGradient>

            <Animated.View
              entering={FadeInDown.delay(motion.stagger * 2).duration(motion.slow)}
              style={styles.searchWrap}
            >
              <SearchBar onSubmit={(q) => search(q)} />
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(motion.stagger * 3).duration(motion.slow)}
              style={[styles.padded, styles.moments]}
            >
              <SurpriseCard />
              {weather && (
                <WeatherCard data={weather} onPress={(s) => search(s.query, s.ambiance)} />
              )}
            </Animated.View>

            <TonightRail near={coords} />
            <OffersRail near={coords} />

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: tone.text }]}>{tr('Envie de…')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categories}
              >
                {CATEGORIES.map((c, i) => (
                  <Animated.View
                    key={c.label}
                    entering={FadeInRight.delay(motion.stagger * (3 + i)).duration(motion.slow)}
                  >
                    <PressableScale
                      onPress={() => search(c.query)}
                      style={[
                        styles.category,
                        { backgroundColor: tone.surface, borderColor: tone.border, boxShadow: tone.cardShadow },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={tr('Rechercher : {q}', { q: tr(c.label) })}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: `${c.tint}26` }]}>
                        <Ionicons name={c.icon} size={24} color={c.tint} />
                      </View>
                      <Text style={[styles.categoryLabel, { color: tone.text }]} numberOfLines={2}>
                        {tr(c.label)}
                      </Text>
                    </PressableScale>
                  </Animated.View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.padded}>
              <LocationBanner />
            </View>

            {history.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(motion.stagger * 4).duration(motion.slow)}
                style={[styles.section, styles.padded]}
              >
                <View style={styles.historyHeader}>
                  <Text style={[styles.sectionTitleInline, { color: tone.text }]}>{tr('Recherches récentes')}</Text>
                  <Pressable onPress={clear} hitSlop={12} accessibilityRole="button">
                    <Text style={styles.clear}>{tr('Effacer')}</Text>
                  </Pressable>
                </View>
                <View style={[styles.historyCard, { backgroundColor: tone.surface }]}>
                  {history.map((q, i) => (
                    <Pressable
                      key={q}
                      onPress={() => search(q)}
                      style={({ pressed }) => [
                        styles.historyItem,
                        i > 0 && [styles.historySeparator, { borderTopColor: tone.border }],
                        pressed && { backgroundColor: tone.surfaceRaised },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={tr('Relancer la recherche {q}', { q })}
                    >
                      <Ionicons name="time-outline" size={20} color={tone.textFaint} />
                      <Text style={[styles.historyText, { color: tone.text }]} numberOfLines={1}>
                        {q}
                      </Text>
                      <Ionicons name="arrow-forward" size={18} color={tone.textFaint} />
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            )}
          </ScrollView>

          {privacyOptionsRequired && (
            <Pressable
              onPress={() => void showPrivacyOptions()}
              style={styles.privacy}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.privacyText, { color: tone.textFaint }]}>{tr('Confidentialité et publicité')}</Text>
            </Pressable>
          )}
          <View style={{ paddingBottom: insets.bottom }}>
            <AdBanner />
          </View>
        </KeyboardAvoidingView>
      </View>
    </ToneProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  sky: {
    minHeight: SKY_HEIGHT,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl * 2,
    overflow: 'hidden',
  },
  skyline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  momentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
  },
  weatherText: { color: colors.text, fontSize: font.tiny, fontWeight: '800' },
  moments: { marginTop: spacing.lg, gap: spacing.md },
  moment: { color: colors.gold, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1.6 },
  favButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH_TARGET - 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245, 238, 226, 0.18)',
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH_TARGET - 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  langFlag: { fontSize: 16 },
  favText: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  hero: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: font.hero,
    lineHeight: font.hero * 1.15,
    maxWidth: 340,
  },
  // « aujourd'hui » est plus long que « ce soir » : un cran plus petit pour tenir sur 2 lignes.
  heroDay: { fontSize: font.hero - 4, lineHeight: (font.hero - 4) * 1.15 },
  heroAccent: { color: colors.gold, fontFamily: fonts.displayItalic },
  searchWrap: { marginTop: -spacing.xxl, paddingHorizontal: spacing.lg },
  section: { marginTop: spacing.xl, gap: spacing.md },
  padded: { paddingHorizontal: spacing.lg },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.displayMedium,
    fontSize: font.title - 2,
    paddingHorizontal: spacing.lg,
  },
  sectionTitleInline: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.title - 2 },
  categories: { paddingHorizontal: spacing.lg, gap: spacing.md },
  category: {
    width: 104,
    minHeight: 112,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    boxShadow: shadows.card,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: { color: colors.text, fontSize: font.small, fontWeight: '700', lineHeight: 18 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clear: { color: colors.accent, fontSize: font.small, fontWeight: '700' },
  historyCard: {
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET + 4,
    paddingHorizontal: spacing.lg,
  },
  historySeparator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  historyText: { flex: 1, color: colors.text, fontSize: font.body },
  privacy: { alignItems: 'center', paddingVertical: spacing.sm },
  privacyText: { color: colors.textFaint, fontSize: font.tiny, textDecorationLine: 'underline' },
});
