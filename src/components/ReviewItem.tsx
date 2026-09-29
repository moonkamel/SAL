import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/src/i18n';
import { colors, font, spacing } from '@/src/theme';
import type { Review } from '@/shared/types';

import { Stars } from './Stars';

const COLLAPSED_LINES = 4;

export function ReviewItem({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const t = useT();

  // Google impose d'afficher l'auteur ; son nom renvoie vers son profil Google Maps.
  const openAuthor = review.authorUri
    ? () => void WebBrowser.openBrowserAsync(review.authorUri!)
    : undefined;

  return (
    <View style={styles.review}>
      <View style={styles.header}>
        {review.authorPhotoUri ? (
          <Image source={{ uri: review.authorPhotoUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{review.authorName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Pressable onPress={openAuthor} disabled={!openAuthor} hitSlop={8}>
            <Text style={styles.author} numberOfLines={1}>
              {review.authorName}
            </Text>
          </Pressable>
          <View style={styles.meta}>
            <Stars rating={review.rating} size={12} />
            <Text style={styles.time}>{review.relativeTime}</Text>
          </View>
        </View>
      </View>

      <Text
        style={styles.text}
        numberOfLines={expanded ? undefined : COLLAPSED_LINES}
        onTextLayout={(e) => {
          if (!expanded && e.nativeEvent.lines.length >= COLLAPSED_LINES) setTruncated(true);
        }}
      >
        {review.text}
      </Text>
      {truncated && (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8} accessibilityRole="button">
          <Text style={styles.more}>{expanded ? t('Réduire') : t('Lire la suite')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  review: { gap: spacing.sm, paddingVertical: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: colors.text, fontWeight: '700' },
  author: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  time: { color: colors.textMuted, fontSize: font.tiny },
  text: { color: colors.text, fontSize: font.small + 1, lineHeight: 21 },
  more: { color: colors.accent, fontSize: font.small, fontWeight: '600' },
});
