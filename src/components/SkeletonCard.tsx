import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '@/src/i18n';
import { colors, radius, spacing } from '@/src/theme';

/** Carte fantôme pendant le chargement : la mise en page apparaît avant les données. */
export function SkeletonCard() {
  const t = useT();
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.9, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View style={[styles.card, animated]} accessibilityLabel={t('Chargement')}>
      <View style={styles.photo} />
      <View style={styles.body}>
        <View style={[styles.line, { width: '60%', height: 18 }]} />
        <View style={[styles.line, { width: '85%' }]} />
        <View style={[styles.line, { width: '40%' }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  photo: { height: 180, backgroundColor: colors.surfaceRaised },
  body: { padding: spacing.lg, gap: spacing.sm },
  line: { height: 12, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
});
