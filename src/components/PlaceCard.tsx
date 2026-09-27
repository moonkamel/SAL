import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { photoUrl } from '@/src/lib/api';
import { colors, font, radius, spacing } from '@/src/theme';
import {
  formatDistance,
  formatOpening,
  formatPrice,
  formatRating,
  formatRatingCount,
  formatWalk,
} from '@/shared/format';
import type { PlaceSummary } from '@/shared/types';

interface Props {
  place: PlaceSummary;
  onPress?: () => void;
}

export function PlaceCard({ place, onPress }: Props) {
  const photoAuthor = place.photo?.attributions[0]?.displayName;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={place.name}
    >
      <View style={styles.photoWrap}>
        {place.photo ? (
          <Image
            source={{ uri: photoUrl(place.photo.name, 800) }}
            style={styles.photo}
            contentFit="cover"
            transition={150}
            cachePolicy="memory"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Ionicons name="image-outline" size={32} color={colors.textFaint} />
          </View>
        )}
        {place.sponsored && (
          <View style={styles.sponsoredBadge}>
            <Text style={styles.sponsoredText}>Sponsorisé</Text>
          </View>
        )}
        {photoAuthor && (
          <Text style={styles.photoCredit} numberOfLines={1}>
            Photo : {photoAuthor}
          </Text>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={styles.address} numberOfLines={1}>
          {place.address}
        </Text>

        <View style={styles.row}>
          <Ionicons name="walk" size={16} color={colors.textMuted} />
          <Text style={styles.meta}>
            {formatDistance(place.distanceMeters)} · {formatWalk(place.walkMinutes)}
          </Text>
        </View>

        <View style={styles.row}>
          {place.rating !== undefined && (
            <>
              <Ionicons name="star" size={16} color={colors.star} />
              <Text style={styles.rating}>{formatRating(place.rating)}</Text>
              {place.userRatingCount !== undefined && (
                <Text style={styles.meta}>({formatRatingCount(place.userRatingCount)})</Text>
              )}
            </>
          )}
          {place.priceLevel !== undefined && (
            <Text style={styles.meta}>
              {place.rating !== undefined ? ' · ' : ''}
              {formatPrice(place.priceLevel)}
            </Text>
          )}
        </View>

        {place.opening && (
          <Text
            style={[styles.opening, { color: place.opening.openNow ? colors.open : colors.closed }]}
          >
            {formatOpening(place.opening)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 160, backgroundColor: colors.surfaceRaised },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoCredit: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.xs,
    maxWidth: '70%',
    color: '#FFFFFF',
    fontSize: font.tiny - 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 3,
  },
  sponsoredBadge: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    backgroundColor: colors.sponsored,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sponsoredText: { color: '#000000', fontSize: font.tiny, fontWeight: '700' },
  body: { padding: spacing.lg, gap: spacing.xs },
  name: { color: colors.text, fontSize: font.body + 2, fontWeight: '700' },
  address: { color: colors.textMuted, fontSize: font.small },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: font.small },
  rating: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  opening: { fontSize: font.small, fontWeight: '600', marginTop: 2 },
});
