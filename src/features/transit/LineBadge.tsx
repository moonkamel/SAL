import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { font, radius, spacing } from '@/src/theme';
import type { TransitLineInfo } from '@/shared/types';

const ICONS: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  Métro: 'subway',
  Tram: 'train',
  Train: 'train',
  Bus: 'bus',
};

/** Pastille de ligne aux couleurs officielles (« M1 » jaune, « M2 » rouge…). */
export function LineBadge({ line, size = 'md' }: { line: TransitLineInfo; size?: 'sm' | 'md' }) {
  const small = size === 'sm';
  return (
    <View
      style={[styles.badge, { backgroundColor: line.color }, small && styles.small]}
      accessible
      accessibilityLabel={`${line.vehicle} ${line.short}`}
    >
      <Ionicons name={ICONS[line.vehicle] ?? 'bus'} size={small ? 12 : 14} color={line.textColor} />
      <Text style={[styles.text, { color: line.textColor }, small && { fontSize: font.tiny }]}>
        {line.short}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm - 4,
  },
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: font.small, fontWeight: '900' },
});
