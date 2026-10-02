import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useUserLocation } from '@/src/features/location/LocationProvider';
import { colors, font, radius, spacing } from '@/src/theme';
import { useT } from '@/src/i18n';
import { useTone } from '@/src/theme/tone';

/** Affiché quand on n'a pas la position : les résultats sont centrés sur la Grand-Place. */
export function LocationBanner() {
  const { status, isFallback, requestPermission } = useUserLocation();
  const { c } = useTone();
  const t = useT();
  if (status === 'pending' || !isFallback) return null;

  const message =
    status === 'denied'
      ? t('Localisation désactivée : résultats autour de la Grand-Place. Touchez pour l’activer.')
      : t('Position introuvable : résultats autour de la Grand-Place.');

  return (
    <Pressable
      onPress={status === 'denied' ? requestPermission : undefined}
      style={[styles.banner, { backgroundColor: c.surfaceRaised }]}
      accessibilityRole={status === 'denied' ? 'button' : 'text'}
    >
      <Ionicons name="location-outline" size={20} color={colors.star} />
      <Text style={[styles.text, { color: c.textMuted }]}>{message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  text: { flex: 1, color: colors.textMuted, fontSize: font.small },
});
