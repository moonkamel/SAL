import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { PressableScale } from '@/src/components/PressableScale';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { useT } from '@/src/i18n';
import { ApiRequestError, getSurprise } from '@/src/lib/api';
import { font, fonts, gradients, radius, shadows, spacing } from '@/src/theme';
import { themedStyles, useColors } from '@/src/theme/tone';

/** « Surprends-moi » : tire au sort un lieu ouvert, bien noté et proche. */
export function SurpriseCard() {
  const colors = useColors();
  const styles = useStyles();
  const { refresh } = useUserLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const t = useT();

  const onPress = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const location = await refresh();
      const { place, reason } = await getSurprise(location);
      router.push({ pathname: '/place/[id]', params: { id: place.id, surprise: reason } });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : t('Surprise impossible. Réessayez.'));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <PressableScale
        onPress={() => void onPress()}
        disabled={loading}
        style={styles.wrap}
        accessibilityRole="button"
        accessibilityLabel={t('Surprends-moi : un lieu ouvert, bien noté et proche')}
        accessibilityState={{ busy: loading }}
      >
        <LinearGradient
          colors={gradients.brick}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.icon}>
            {loading ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <Ionicons name="dice" size={26} color={colors.accentText} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{loading ? t('On cherche…') : t('Surprends-moi')}</Text>
            <Text style={styles.subtitle}>{t('Un lieu ouvert, bien noté et tout près')}</Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color={colors.accentText} />
        </LinearGradient>
      </PressableScale>
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
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
  error: { color: colors.closed, fontSize: font.small, textAlign: 'center' },
}));
