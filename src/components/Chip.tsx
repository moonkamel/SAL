import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, font, radius, spacing, TOUCH_TARGET } from '@/src/theme';

interface Props {
  label: string;
  onPress: () => void;
  selected?: boolean;
  accessibilityHint?: string;
}

export function Chip({ label, onPress, selected, accessibilityHint }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TOUCH_TARGET - 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { color: colors.text, fontSize: font.small + 1, fontWeight: '600' },
  selectedLabel: { color: colors.accentText },
});
