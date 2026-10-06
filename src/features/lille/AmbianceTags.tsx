import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { useT } from '@/src/i18n';
import { font, radius, spacing } from '@/src/theme';
import { AMBIANCE_LABELS, type Ambiance } from '@/shared/types';

import { AMBIANCE_ICONS } from './pickers';
import { themedStyles, useColors } from '@/src/theme/tone';

/** Pastilles « Terrasse », « Musique live »… confirmées par Google. */
export function AmbianceTags({ ambiance }: { ambiance?: Ambiance[] }) {
  const colors = useColors();
  const styles = useStyles();
  const t = useT();
  if (!ambiance?.length) return null;
  return (
    <View style={styles.row}>
      {ambiance.map((a) => (
        <View key={a} style={styles.tag}>
          <Ionicons
            name={AMBIANCE_ICONS[a] as ComponentProps<typeof Ionicons>['name']}
            size={13}
            color={colors.gold}
          />
          <Text style={styles.text}>{t(AMBIANCE_LABELS[a])}</Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.goldTint,
  },
  text: { color: colors.gold, fontSize: font.tiny, fontWeight: '700' },
}));
