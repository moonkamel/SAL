import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/src/components/PressableScale';
import { colors, font, fonts, radius, shadows, spacing } from '@/src/theme';
import type { Suggestion, WeatherResponse } from '@/shared/types';

import { WEATHER_LABELS, weatherIcon } from './weatherIcons';

interface Props {
  data: WeatherResponse;
  onPress: (suggestion: Suggestion) => void;
}

/** Idée de sortie selon le temps qu'il fait (Open-Meteo). */
export function WeatherCard({ data, onPress }: Props) {
  const { weather, suggestion } = data;
  return (
    <PressableScale
      onPress={() => onPress(suggestion)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${Math.round(weather.temperature)} degrés, ${WEATHER_LABELS[weather.condition]}. ${suggestion.title}. ${suggestion.subtitle} Rechercher : ${suggestion.query}`}
    >
      <View style={styles.weather}>
        <Ionicons name={weatherIcon(weather)} size={28} color={colors.gold} />
        <Text style={styles.temp}>{Math.round(weather.temperature)}°</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{suggestion.title}</Text>
        <Text style={styles.subtitle}>{suggestion.subtitle}</Text>
        <Text style={styles.cta}>
          Voir : {suggestion.query}
          {suggestion.ambiance?.includes('terrace') ? ' en terrasse' : ''} →
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
