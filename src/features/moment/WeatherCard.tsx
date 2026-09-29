import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/src/components/PressableScale';
import { useT } from '@/src/i18n';
import { colors, font, fonts, radius, shadows, spacing } from '@/src/theme';
import { useTone } from '@/src/theme/tone';
import type { Suggestion, WeatherResponse } from '@/shared/types';

import { WEATHER_LABELS, weatherIcon } from './weatherIcons';

interface Props {
  data: WeatherResponse;
  onPress: (suggestion: Suggestion) => void;
}

/** Idée de sortie selon le temps qu'il fait (Open-Meteo). */
export function WeatherCard({ data, onPress }: Props) {
  const { weather, suggestion } = data;
  const { c } = useTone();
  const t = useT();
  return (
    <PressableScale
      onPress={() => onPress(suggestion)}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, boxShadow: c.cardShadow }]}
      accessibilityRole="button"
      accessibilityLabel={`${t('{n} degrés', { n: Math.round(weather.temperature) })}, ${t(WEATHER_LABELS[weather.condition])}. ${suggestion.title}. ${suggestion.subtitle} ${t('Rechercher : {q}', { q: t(suggestion.query) })}`}
    >
      <View style={styles.weather}>
        <Ionicons name={weatherIcon(weather)} size={28} color={c.gold} />
        <Text style={[styles.temp, { color: c.text }]}>{Math.round(weather.temperature)}°</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.title, { color: c.text }]}>{suggestion.title}</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>{suggestion.subtitle}</Text>
        <Text style={[styles.cta, { color: c.gold }]}>
          {suggestion.ambiance?.includes('terrace')
            ? t('Voir : {q} en terrasse', { q: t(suggestion.query) })
            : t('Voir : {q}', { q: t(suggestion.query) })}{' '}
          →
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    boxShadow: shadows.card,
  },
  weather: { alignItems: 'center', minWidth: 52 },
  temp: { color: colors.text, fontFamily: fonts.display, fontSize: font.title },
  title: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.body + 1 },
  subtitle: { color: colors.textMuted, fontSize: font.small },
  cta: { color: colors.gold, fontSize: font.small, fontWeight: '700', marginTop: spacing.xs },
});
