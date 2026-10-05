import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { Text, type StyleProp, type ViewStyle } from 'react-native';

import { font, gradients, radius, shadows, spacing } from '@/src/theme';

import { PressableScale } from './PressableScale';
import { themedStyles, useColors } from '@/src/theme/tone';

interface Props {
  title: string;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Gros bouton d'action principal, dégradé brique. */
export function GradientButton({ title, onPress, icon, disabled, accessibilityLabel, style }: Props) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.wrap, disabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={gradients.brick}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {icon && <Ionicons name={icon} size={24} color={colors.accentText} />}
        <Text style={styles.title}>{title}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

const useStyles = themedStyles((colors) => ({
  wrap: { borderRadius: radius.lg, borderCurve: 'continuous', boxShadow: shadows.glow },
  disabled: { opacity: 0.4, boxShadow: undefined },
  gradient: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  title: { color: colors.accentText, fontSize: font.title, fontWeight: '800', letterSpacing: 0.3 },
}));
