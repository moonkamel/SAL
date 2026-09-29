import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/src/components/PressableScale';
import { tx, useI18n } from '@/src/i18n';
import { colors, font, fonts, palette, radius, spacing } from '@/src/theme';
import { useTone } from '@/src/theme/tone';
import { formatDistance } from '@/shared/format';
import { type AgendaEvent, type EventCategory, GENRE_LABELS } from '@/shared/types';

export const CATEGORY_INFO: Record<
  EventCategory,
  { label: string; icon: ComponentProps<typeof Ionicons>['name'] }
> = {
  concert: { label: tx('Concert'), icon: 'musical-notes' },
  soiree: { label: tx('Soirée'), icon: 'sparkles' },
  expo: { label: tx('Expo'), icon: 'color-palette' },
  spectacle: { label: tx('Spectacle'), icon: 'film' },
  marche: { label: tx('Marché'), icon: 'basket' },
  sport: { label: tx('Sport'), icon: 'football' },
  autre: { label: tx('Sortie'), icon: 'calendar' },
};

interface Props {
  event: AgendaEvent;
  onPress: () => void;
  /** Carte étroite pour le carrousel de l'accueil. */
  compact?: boolean;
}

export function EventCard({ event, onPress, compact }: Props) {
  const cat = CATEGORY_INFO[event.category];
  const { tone, c } = useTone();
  const day = tone === 'day';
  const { t, lang } = useI18n();
  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.card,
        compact ? styles.compact : styles.full,
        day && { backgroundColor: c.surface, boxShadow: c.cardShadow },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${event.featured ? `${t('À la une')}. ` : ''}${t(cat.label)} : ${event.title}, ${event.timeLabel}, ${event.venueName}`}
    >
      {event.imageUrl ? (
        <Image
          source={{ uri: event.imageUrl }}
          style={compact ? styles.imageCompact : styles.image}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View
          style={[
            compact ? styles.imageCompact : styles.image,
            styles.placeholder,
            day && { backgroundColor: c.goldTint },
          ]}
        >
          <Ionicons name={cat.icon} size={compact ? 26 : 30} color={c.gold} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={[styles.time, { color: c.gold }]}>{event.timeLabel}</Text>
          {event.featured && (
            <View style={styles.featured}>
              <Text style={styles.featuredText}>{t('À la une')}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={[styles.venue, { color: c.text }]} numberOfLines={1}>
          {event.venueName} · {formatDistance(event.distanceMeters, lang)}
        </Text>
        {!compact && (
          <Text style={[styles.muted, { color: c.textMuted }]} numberOfLines={1}>
            {[t(cat.label), ...(event.genres ?? []).map((g) => t(GENRE_LABELS[g]))].join(' · ')}
            {event.free ? <Text style={styles.free}> · {t('Gratuit')}</Text> : null}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  compact: { width: 220 },
  full: { flexDirection: 'row' },
  image: { width: 104, minHeight: 112 },
  imageCompact: { width: 220, height: 110 },
  placeholder: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, padding: spacing.md, gap: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { color: colors.gold, fontSize: font.small, fontWeight: '800', flexShrink: 1 },
  featured: { backgroundColor: palette.brick, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  featuredText: { color: colors.accentText, fontSize: font.tiny, fontWeight: '800' },
  title: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.body },
  venue: { color: colors.text, fontSize: font.small },
  muted: { color: colors.textMuted, fontSize: font.small },
  free: { color: colors.open, fontWeight: '800' },
});
