import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useT } from '@/src/i18n';
import { font, motion, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { themedStyles, useColors } from '@/src/theme/tone';

const TRACK_W = 42;
const TRACK_H = 24;
const THUMB = 18;
const TRAVEL = TRACK_W - THUMB - (TRACK_H - THUMB);

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Interrupteur « Ouvert maintenant », en vert, séparé des autres filtres. */
export function OpenNowToggle({ value, onChange }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const t = useT();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: motion.fast + 50 });
  }, [value, progress]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.open]),
  }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * TRAVEL }] }));

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!value);
      }}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, value && styles.pillOn, pressed && { opacity: 0.8 }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={t('Ouvert maintenant')}
    >
      <Text style={[styles.label, value && { color: colors.open }]} numberOfLines={1}>
        {t('Ouvert maintenant')}
      </Text>
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.thumb, thumb]} />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = themedStyles((colors) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
    minHeight: TOUCH_TARGET - 4,
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillOn: { borderColor: colors.open, backgroundColor: `${colors.open}1F` },
  label: { flexShrink: 1, color: colors.text, fontSize: font.small, fontWeight: '700' },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: (TRACK_H - THUMB) / 2,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
  },
}));
