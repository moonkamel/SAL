import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { AmbianceTags } from '@/src/features/lille/AmbianceTags';
import { useI18n } from '@/src/i18n';
import { photoUrl } from '@/src/lib/api';
import { font, fonts, radius, spacing } from '@/src/theme';
import {
  formatDistance,
  formatOpening,
  formatPrice,
  formatRating,
  formatRatingCount,
  formatWalk,
} from '@/shared/format';
import type { PlaceSummary } from '@/shared/types';

import { PressableScale } from './PressableScale';
import { themedStyles, useColors } from '@/src/theme/tone';

interface Props {
  place: PlaceSummary;
  onPress?: () => void;
  /** Version réduite (photo plus basse), pour la carte. */
  compact?: boolean;
}

export function PlaceCard({ place, onPress, compact }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const photoAuthor = place.photo?.attributions[0]?.displayName;
  const photoHeight = compact ? 110 : 190;
  const { t, lang } = useI18n();

  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      style={styles.card}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={place.name}
    >
      <View style={{ height: photoHeight }}>
        {place.photo ? (
          <Image
            source={{ uri: photoUrl(place.photo.name, 800) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}>
            <Ionicons name="image-outline" size={32} color={colors.textFaint} />
          </View>
        )}
        <LinearGradient colors={colors.photoFade} style={StyleSheet.absoluteFill} />

        <View style={styles.topRow}>
          {place.sponsored ? (
            <View style={styles.sponsoredBadge}>
              <Ionicons name="sparkles" size={12} color={colors.background} />
              <Text style={styles.sponsoredText}>{t('Sponsorisé')}</Text>
            </View>
          ) : (
            <View />
          )}
          {place.rating !== undefined && (
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={13} color={colors.star} />
              <Text style={styles.ratingText}>{formatRating(place.rating, lang)}</Text>
              {place.userRatingCount !== undefined && (
                <Text style={styles.ratingCount}>{formatRatingCount(place.userRatingCount, lang)}</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {place.name}
          </Text>
          {photoAuthor && (
            <Text style={styles.photoCredit} numberOfLines={1}>
              {t('Photo : {author}', { author: photoAuthor })}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.address} numberOfLines={1}>
          {place.address}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Ionicons name="walk" size={15} color={colors.gold} />
            <Text style={styles.metaText}>
              {formatDistance(place.distanceMeters, lang)} · {formatWalk(place.walkMinutes, lang)}
            </Text>
          </View>
          {place.priceLevel !== undefined && (
            <Text style={styles.price}>{formatPrice(place.priceLevel, lang)}</Text>
          )}
        </View>
        <AmbianceTags ambiance={place.ambiance} />
        {place.opening && (
          <View style={styles.meta}>
            <View
              style={[
                styles.dot,
                { backgroundColor: place.opening.openNow ? colors.open : colors.closed },
              ]}
            />
            <Text
              style={[
                styles.opening,
                { color: place.opening.openNow ? colors.open : colors.closed },
              ]}
            >
              {formatOpening(place.opening, lang)}
            </Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const useStyles = themedStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: colors.cardShadow,
  },
  photoPlaceholder: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.sponsored,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  sponsoredText: { color: colors.background, fontSize: font.tiny, fontWeight: '800' },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.glass,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  ratingText: { color: colors.text, fontSize: font.small - 1, fontWeight: '800' },
  ratingCount: { color: colors.textMuted, fontSize: font.tiny },
  titleBlock: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.md },
  name: { color: colors.onPhoto, fontFamily: fonts.display, fontSize: font.title, lineHeight: 28 },
  photoCredit: { color: colors.onPhotoMuted, fontSize: font.tiny - 1, marginTop: 2 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: 6 },
  address: { color: colors.textMuted, fontSize: font.small },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  price: { color: colors.gold, fontSize: font.small, fontWeight: '800', letterSpacing: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  opening: { fontSize: font.small, fontWeight: '700' },
}));
