import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { CATEGORY_INFO } from '@/src/features/agenda/EventCard';
import { getKnownEvent } from '@/src/lib/api';
import { colors, font, fonts, gradients, palette, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { formatDistance } from '@/shared/format';
import { GENRE_LABELS } from '@/shared/types';

/** Fiche d'un événement de l'agenda, sans quitter l'app. */
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const event = getKnownEvent(id);

  if (!event) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ title: 'Événement' }} />
        <Text style={styles.muted}>Cet événement n’est plus disponible.</Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const cat = CATEGORY_INFO[event.category];
  const goThere = () =>
    router.push({
      pathname: '/route/[id]',
      params: {
        id: event.placeId ?? `event-${event.id}`,
        name: event.venueName,
        lat: String(event.location.lat),
        lng: String(event.location.lng),
      },
    });
  const share = () =>
    void Share.share({
      message: [event.title, event.dateLabel, event.venueName, event.url, '', 'Trouvé avec Sortir à Lille']
        .filter((l) => l !== undefined)
        .join('\n'),
    }).catch(() => {});

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: '', headerTransparent: true }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        <View style={styles.hero}>
          {event.imageUrl ? (
            <Image source={{ uri: event.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
              <Ionicons name={cat.icon} size={64} color={colors.gold} />
            </View>
          )}
          <LinearGradient colors={gradients.photo} style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.body}>
          <View style={styles.tags}>
            {event.featured && <Tag label="À la une" color={palette.brick} strong />}
            <Tag label={cat.label} icon={cat.icon} />
            {event.genres?.map((g) => <Tag key={g} label={GENRE_LABELS[g]} />)}
            {event.free && <Tag label="Gratuit" color={colors.open} />}
          </View>

          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.infoCard}>
            <Info icon="calendar-outline" text={event.dateLabel} strong />
            <Info
              icon="location-outline"
              text={`${event.venueName}${event.address ? `\n${event.address}` : ''}`}
              extra={formatDistance(event.distanceMeters)}
            />
            {event.price && <Info icon="pricetag-outline" text={event.price} />}
          </View>

          {(event.longDescription ?? event.description) && (
            <Text style={styles.description}>{event.longDescription ?? event.description}</Text>
          )}

          <View style={styles.links}>
            {event.ticketUrl && (
              <LinkButton icon="ticket-outline" label="Billets / réservation" onPress={() => void WebBrowser.openBrowserAsync(event.ticketUrl!)} />
            )}
            {event.placeId && (
              <LinkButton
                icon="storefront-outline"
                label="Fiche du lieu"
                onPress={() => router.push({ pathname: '/place/[id]', params: { id: event.placeId! } })}
              />
            )}
            <LinkButton icon="share-social-outline" label="Partager" onPress={share} />
            {event.url && (
              <LinkButton icon="open-outline" label="Voir sur OpenAgenda" onPress={() => void WebBrowser.openBrowserAsync(event.url!)} />
            )}
          </View>
          {event.source === 'openagenda' && (
            <Text style={styles.source}>Source : agenda de la Ville de Lille (OpenAgenda).</Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <GradientButton title="Y aller" icon="navigate" onPress={goThere} />
      </View>
    </View>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

function Tag({ label, icon, color, strong }: { label: string; icon?: IconName; color?: string; strong?: boolean }) {
  return (
    <View style={[styles.tag, strong && { backgroundColor: color }]}>
      {icon && <Ionicons name={icon} size={13} color={colors.gold} />}
      <Text style={[styles.tagText, color && !strong ? { color } : null, strong && { color: colors.accentText }]}>
        {label}
      </Text>
    </View>
  );
}

function Info({ icon, text, extra, strong }: { icon: IconName; text: string; extra?: string; strong?: boolean }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={20} color={colors.gold} />
      <Text style={[styles.infoText, strong && { fontWeight: '700' }]}>{text}</Text>
      {extra && <Text style={styles.muted}>{extra}</Text>}
    </View>
  );
}

function LinkButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Ionicons name={icon} size={18} color={colors.text} />
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  hero: { height: 300, backgroundColor: colors.surfaceRaised },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.xl, gap: spacing.lg, marginTop: -spacing.xl },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(230, 180, 90, 0.14)',
  },
  tagText: { color: colors.gold, fontSize: font.tiny + 1, fontWeight: '800' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: font.hero - 6, lineHeight: (font.hero - 6) * 1.15 },
  infoCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  infoText: { flex: 1, color: colors.text, fontSize: font.body, lineHeight: 22 },
  description: { color: colors.textMuted, fontSize: font.body, lineHeight: 24 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TOUCH_TARGET - 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  linkText: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  source: { color: colors.textFaint, fontSize: font.tiny },
  muted: { color: colors.textMuted, fontSize: font.small },
  secondary: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  secondaryText: { color: colors.text, fontWeight: '700' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
