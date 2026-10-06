import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/src/i18n';
import { font, radius, spacing } from '@/src/theme';
import { themedStyles, useColors } from '@/src/theme/tone';
import type { Stop } from '@/shared/discover';

import { openStop } from './openStop';

/** Étape d'un parcours ou incontournable : numéro (ou icône), texte, « Y aller ». */
export function StopRow({ stop, highlight, extra, index }: { stop: Stop; highlight?: boolean; extra?: string; index?: number }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={() => openStop(stop, t)}
      style={({ pressed }) => [styles.stop, highlight && styles.highlight, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={t(stop.name)}
    >
      {index !== undefined ? (
        <View style={styles.number}>
          <Text style={styles.numberText}>{index}</Text>
        </View>
      ) : (
        <Ionicons name={stop.icon} size={22} color={colors.gold} style={{ marginTop: 2 }} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name}>{t(stop.name)}</Text>
        {extra && <Text style={styles.extra}>{extra}</Text>}
        <Text style={styles.text}>{t(stop.text)}</Text>
        <View style={styles.footer}>
          <Text style={styles.duration}>{stop.duration ? `⏱ ${t(stop.duration)}` : ''}</Text>
          <Text style={styles.action}>{stop.location ? t('Y aller') : t('Voir les adresses')} →</Text>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = themedStyles((colors) => ({
  stop: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface },
  highlight: { borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surfaceRaised },
  name: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  extra: { color: colors.gold, fontSize: font.small, fontWeight: '700' },
  text: { color: colors.textMuted, fontSize: font.small, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  duration: { color: colors.textFaint, fontSize: font.tiny + 1 },
  action: { color: colors.accent, fontSize: font.small, fontWeight: '800' },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  numberText: { color: colors.accentText, fontSize: font.small, fontWeight: '800' },
}));
