import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { type ComponentProps, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { CATEGORY_INFO } from '@/src/features/agenda/EventCard';
import { tx, useI18n } from '@/src/i18n';
import { getKnownEvent } from '@/src/lib/api';
import { font, fonts, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { themedStyles, useColors } from '@/src/theme/tone';
import { track } from '@/src/lib/analytics';
import { formatDistance } from '@/shared/format';
import {
  type AgendaEvent,
  type EventAccessibility,
  type EventPractical,
  GENRE_LABELS,
} from '@/shared/types';

type Tab = 'about' | 'practical';
type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { key: Tab; label: string }[] = [
  { key: 'about', label: tx('Présentation') },
  { key: 'practical', label: tx('Infos pratiques') },
];

const ACCESSIBILITY: Record<EventAccessibility, { label: string; icon: IconName }> = {
  pmr: { label: tx('Accessible en fauteuil roulant'), icon: 'accessibility-outline' },
  auditif: { label: tx('Adapté au handicap auditif'), icon: 'ear-outline' },
  visuel: { label: tx('Adapté au handicap visuel'), icon: 'eye-outline' },
  mental: { label: tx('Adapté au handicap mental'), icon: 'heart-outline' },
  psychique: { label: tx('Adapté au handicap psychique'), icon: 'heart-outline' },
};

const STATUS: Record<NonNullable<EventPractical['status']>, string> = {
  complet: tx('Complet'),
  reporte: tx('Reporté'),
  reprogramme: tx('Date modifiée'),
  'en-ligne': tx('En ligne'),
};

const LINKS: Record<NonNullable<EventPractical['links']>[number]['kind'], { label: string; icon: IconName }> = {
  site: { label: tx('Site de l’artiste'), icon: 'globe-outline' },
  spotify: { label: 'Spotify', icon: 'musical-notes-outline' },
  deezer: { label: 'Deezer', icon: 'musical-notes-outline' },
  youtube: { label: 'YouTube', icon: 'logo-youtube' },
  instagram: { label: 'Instagram', icon: 'logo-instagram' },
  facebook: { label: 'Facebook', icon: 'logo-facebook' },
};

const open = (url: string) => void WebBrowser.openBrowserAsync(url);

/** Fiche d'un événement : présentation et infos pratiques. */
export default function EventScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const event = getKnownEvent(id);
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('about');

  if (!event) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ title: t('Événement') }} />
        <Text style={styles.muted}>{t('Cet événement n’est plus disponible.')}</Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t('Retour')}</Text>
        </Pressable>
      </View>
    );
  }

  const cat = CATEGORY_INFO[event.category];
  const status = event.practical?.status;
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
          <LinearGradient colors={colors.heroFade} style={StyleSheet.absoluteFill} />
          {event.imageCredit && (
            <Text style={styles.credit} numberOfLines={1}>
              {event.imageCredit.startsWith('©') ? event.imageCredit : `© ${event.imageCredit}`}
            </Text>
          )}
        </View>

        <View style={styles.body}>
          {status && (
            <View style={styles.status}>
              <Ionicons name="alert-circle" size={18} color={colors.accentText} />
              <Text style={styles.statusText}>{t(STATUS[status])}</Text>
            </View>
          )}
          <View style={styles.tags}>
            {event.featured && <Tag label={t('À la une')} color={colors.accent} strong />}
            <Tag label={t(cat.label)} icon={cat.icon} />
            {event.genres?.map((g) => <Tag key={g} label={t(GENRE_LABELS[g])} />)}
            {event.free && <Tag label={t('Gratuit')} color={colors.open} />}
          </View>

          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.subtitle}>
            {event.dateLabel}
            {'\n'}
            {event.venueName}
          </Text>

          <View style={styles.tabs} accessibilityRole="tablist">
            {TABS.map((x) => (
              <Pressable
                key={x.key}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTab(x.key);
                }}
                style={[styles.tab, tab === x.key && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === x.key }}
              >
                <Text style={[styles.tabText, tab === x.key && styles.tabTextActive]}>{t(x.label)}</Text>
              </Pressable>
            ))}
          </View>

          {tab === 'about' && <About event={event} />}
          {tab === 'practical' && <Practical event={event} />}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <GradientButton title={t('Y aller')} icon="navigate" onPress={goThere} />
      </View>
    </View>
  );
}

function About({ event }: { event: AgendaEvent }) {
  const styles = useStyles();
  const { t } = useI18n();
  const share = () => {
    track('share', { source: event.source });
    void Share.share({
      message: [event.title, event.dateLabel, event.venueName, event.url, '', t('Trouvé avec Sortir à Lille')]
        .filter((l) => l !== undefined)
        .join('\n'),
    }).catch(() => {});
  };
  const text = event.longDescription ?? event.description;
  return (
    <View style={styles.section}>
      {text ? (
        <Text style={styles.description}>{text}</Text>
      ) : (
        <Text style={styles.muted}>{t('Pas de présentation pour cet événement.')}</Text>
      )}

      {!!event.practical?.links?.length && (
        <View style={styles.links}>
          {event.practical.links.map((l) => (
            <LinkButton key={l.url} icon={LINKS[l.kind].icon} label={t(LINKS[l.kind].label)} onPress={() => open(l.url)} />
          ))}
        </View>
      )}

      <View style={styles.links}>
        {event.ticketUrl && (
          <LinkButton icon="ticket-outline" label={t('Billets / réservation')} onPress={() => {
              track('ticket', { source: event.source });
              open(event.ticketUrl!);
            }} />
        )}
        <LinkButton icon="share-social-outline" label={t('Partager')} onPress={share} />
        {event.url && event.source === 'openagenda' && (
          <LinkButton icon="open-outline" label={t('Voir sur OpenAgenda')} onPress={() => open(event.url!)} />
        )}
      </View>
      {event.source === 'openagenda' && (
        <Text style={styles.source}>{t('Source : agenda de la Ville de Lille (OpenAgenda).')}</Text>
      )}
      {event.source === 'ticketmaster' && <Text style={styles.source}>{t('Source : Ticketmaster.')}</Text>}
    </View>
  );
}

function Practical({ event }: { event: AgendaEvent }) {
  const styles = useStyles();
  const { t, lang, locale } = useI18n();
  const p = event.practical ?? {};
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
  const age =
    p.ageMin && p.ageMax
      ? t('De {min} à {max} ans', { min: p.ageMin, max: p.ageMax })
      : p.ageMin
        ? t('À partir de {min} ans', { min: p.ageMin })
        : p.ageMax
          ? t('Jusqu’à {max} ans', { max: p.ageMax })
          : undefined;
  const price = p.priceDetail ?? event.price;

  return (
    <View style={styles.section}>
      <View style={styles.infoCard}>
        <Info icon="calendar-outline" title={t('Quand')} text={event.dateLabel} />
        {!!p.nextDates?.length && (
          <Info
            icon="repeat-outline"
            title={t('Autres dates')}
            text={p.nextDates.map((d) => dateFmt.format(new Date(d))).join('\n')}
          />
        )}
        <Info
          icon="location-outline"
          title={t('Où')}
          text={`${event.venueName}${event.address ? `\n${event.address}` : ''}`}
          extra={formatDistance(event.distanceMeters, lang)}
        />
        {p.access && <Info icon="bus-outline" title={t('Venir')} text={p.access} />}
        {(price || event.free) && (
          <Info icon="pricetag-outline" title={t('Tarifs')} text={price ?? t('Gratuit')} />
        )}
        {age && <Info icon="people-outline" title={t('Âge')} text={age} />}
        {!!p.accessibility?.length && (
          <Info
            icon="accessibility-outline"
            title={t('Accessibilité')}
            text={p.accessibility.map((a) => t(ACCESSIBILITY[a].label)).join('\n')}
          />
        )}
        {p.organizer && <Info icon="business-outline" title={t('Organisateur')} text={p.organizer} />}
      </View>

      {!!p.notes?.length && (
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>{t('À savoir')}</Text>
          {p.notes.map((n) => (
            <Text key={n} style={styles.note}>
              {n}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.links}>
        {p.phone && (
          <LinkButton
            icon="call-outline"
            label={p.phone}
            onPress={() => void Linking.openURL(`tel:${p.phone!.replace(/[^\d+]/g, '')}`)}
          />
        )}
        {p.email && <LinkButton icon="mail-outline" label={p.email} onPress={() => void Linking.openURL(`mailto:${p.email}`)} />}
        {p.website && <LinkButton icon="globe-outline" label={t('Site du lieu')} onPress={() => open(p.website!)} />}
        {p.seatmapUrl && <LinkButton icon="grid-outline" label={t('Plan de la salle')} onPress={() => open(p.seatmapUrl!)} />}
        {event.placeId && (
          <LinkButton
            icon="storefront-outline"
            label={t('Fiche du lieu')}
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: event.placeId! } })}
          />
        )}
      </View>
    </View>
  );
}

function Tag({ label, icon, color, strong }: { label: string; icon?: IconName; color?: string; strong?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.tag, strong && { backgroundColor: color }]}>
      {icon && <Ionicons name={icon} size={13} color={colors.gold} />}
      <Text style={[styles.tagText, color && !strong ? { color } : null, strong && { color: colors.accentText }]}>
        {label}
      </Text>
    </View>
  );
}

function Info({ icon, title, text, extra }: { icon: IconName; title: string; text: string; extra?: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={20} color={colors.gold} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoText}>{text}</Text>
      </View>
      {extra && <Text style={styles.muted}>{extra}</Text>}
    </View>
  );
}

function LinkButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Ionicons name={icon} size={18} color={colors.text} />
      <Text style={styles.linkText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = themedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  hero: { height: 300, backgroundColor: colors.surfaceRaised },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  credit: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xl + spacing.sm,
    maxWidth: '70%',
    color: colors.textMuted,
    fontSize: font.tiny - 1,
  },
  body: { padding: spacing.xl, gap: spacing.md, marginTop: -spacing.xl },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.closed,
  },
  statusText: { color: colors.accentText, fontSize: font.small, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.goldTint,
  },
  tagText: { color: colors.gold, fontSize: font.tiny + 1, fontWeight: '800' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: font.hero - 6, lineHeight: (font.hero - 6) * 1.15 },
  subtitle: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.accent },
  tabText: { color: colors.textMuted, fontSize: font.small + 1, fontWeight: '700', textAlign: 'center' },
  tabTextActive: { color: colors.text },
  section: { gap: spacing.lg, paddingTop: spacing.md },
  infoCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.lg },
  cardTitle: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  note: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  infoTitle: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  infoText: { color: colors.text, fontSize: font.body, lineHeight: 22 },
  description: { color: colors.textMuted, fontSize: font.body, lineHeight: 24 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    minHeight: TOUCH_TARGET - 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  linkText: { flexShrink: 1, color: colors.text, fontSize: font.small, fontWeight: '700' },
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
}));
