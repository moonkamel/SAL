import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/src/components/PressableScale';
import { colors, font, fonts, radius, spacing } from '@/src/theme';
import { formatDistance } from '@/shared/format';
import type { Offer } from '@/shared/types';

interface Props {
  offer: Offer;
  /** Affiche le nom du lieu (liste) ou non (fiche du lieu). */
  showPlace?: boolean;
  onPress?: () => void;
  compact?: boolean;
}

/** Bon plan d'un établissement partenaire (« 1 verre offert avant 20 h »). */
export function OfferCard({ offer, showPlace, onPress, compact }: Props) {
  const body = (
    <>
      <View style={styles.top}>
        <View style={styles.badge}>
          <Ionicons name="pricetag" size={12} color={colors.background} />
          <Text style={styles.badgeText}>Bon plan</Text>
        </View>
        <Text style={[styles.schedule, { color: offer.live ? colors.open : colors.textMuted }]}>
          {offer.live ? 'En ce moment' : offer.schedule}
        </Text>
      </View>
      <Text style={styles.title} numberOfLines={compact ? 2 : undefined}>
        {offer.title}
      </Text>
      {showPlace && (
        <Text style={styles.place} numberOfLines={1}>
          {offer.placeName}
          {offer.distanceMeters !== undefined && (
            <Text style={styles.muted}> · {formatDistance(offer.distanceMeters)}</Text>
          )}
        </Text>
      )}
      {!compact && offer.description && <Text style={styles.muted}>{offer.description}</Text>}
      {!compact && (
        <Text style={styles.muted}>
          {offer.live ? offer.schedule : ''}
          {offer.live && offer.conditions ? ' · ' : ''}
          {offer.conditions ?? ''}
        </Text>
      )}
    </>
  );
  if (!onPress) return <View style={[styles.card, compact && styles.compact]}>{body}</View>;
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.card, compact && styles.compact]}
      accessibilityRole="button"
      accessibilityLabel={`Bon plan chez ${offer.placeName} : ${offer.title}. ${offer.schedule}`}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(230, 180, 90, 0.45)',
    padding: spacing.lg,
    gap: spacing.xs + 2,
  },
  compact: { width: 240, minHeight: 130 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { color: colors.background, fontSize: font.tiny, fontWeight: '800' },
  schedule: { fontSize: font.tiny, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  title: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.body + 1 },
  place: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: font.small, fontWeight: '400' },
});
