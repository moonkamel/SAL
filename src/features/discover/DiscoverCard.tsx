import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { PressableScale } from '@/src/components/PressableScale';
import { useT } from '@/src/i18n';
import { font, fonts, gradients, radius, shadows, spacing } from '@/src/theme';
import { themedStyles, useColors } from '@/src/theme/tone';
import { SEASONAL } from '@/shared/discover';

/** Accueil : « Découvrir Lille », parcours prêts et incontournables pour les visiteurs. */
export function DiscoverCard() {
  const colors = useColors();
  const styles = useStyles();
  const t = useT();
  // En saison, le rendez-vous du moment (Braderie, marché de Noël) est annoncé sur la carte.
  const season = SEASONAL.find((s) => s.active(new Date()));

  return (
    <PressableScale
      onPress={() => router.push('/discover')}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={t('Découvrir Lille : parcours, incontournables et mon week-end')}
    >
      <LinearGradient colors={gradients.brick} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="map" size={24} color={colors.accentText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('Découvrir Lille')}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {season ? t('En ce moment : {name}', { name: t(season.name) }) : t('Lille en 1 jour, en un week-end, les incontournables')}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={22} color={colors.accentText} />
      </LinearGradient>
    </PressableScale>
  );
}

const useStyles = themedStyles((colors) => ({
  wrap: { borderRadius: radius.lg, borderCurve: 'continuous', boxShadow: shadows.glow },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 76,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.accentText, fontFamily: fonts.display, fontSize: font.title - 2 },
  subtitle: { color: 'rgba(255, 255, 255, 0.85)', fontSize: font.small, marginTop: 2 },
}));
