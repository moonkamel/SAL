import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/src/components/PressableScale';
import { EventCard } from '@/src/features/agenda/EventCard';
import { openEvent } from '@/src/features/agenda/openEvent';
import { useLiveData } from '@/src/features/lille/useLiveData';
import { OfferCard } from '@/src/features/offers/OfferCard';
import { useI18n, useT } from '@/src/i18n';
import { getAgenda, getOffers } from '@/src/lib/api';
import { font, fonts, radius, spacing } from '@/src/theme';
import { useTone, themedStyles } from '@/src/theme/tone';
import type { AgendaEvent, AgendaResponse, AgendaWhen, LatLng, OffersResponse } from '@/shared/types';

/** On ne recharge qu'après un déplacement de ~200 m ; les distances restent exactes. */
export function refreshKey(p: LatLng): number[] {
  return [Math.round(p.lat * 500), Math.round(p.lng * 500)];
}

function Rail({ title, onSeeAll, children }: { title: string; onSeeAll: () => void; children: ReactNode }) {
  const styles = useStyles();
  const { c } = useTone();
  const t = useT();
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        <Pressable onPress={onSeeAll} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('{title} : tout voir', { title })}>
          <Text style={styles.seeAll}>{t('Tout voir')}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {children}
      </ScrollView>
    </View>
  );
}

/** Aperçu de l'agenda : « à la une » d'abord, puis les sorties les plus proches. */
function nearestFirst(events: AgendaEvent[]): AgendaEvent[] {
  return [...events]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.distanceMeters - b.distanceMeters)
    .slice(0, 8);
}

/**
 * « Aujourd'hui à Lille » : aperçu des sorties les plus proches. S'il n'y a plus rien
 * aujourd'hui, celles de la semaine ; sinon, un simple accès à l'agenda.
 */
export function TonightRail({ near }: { near: LatLng }) {
  const { t, lang } = useI18n();
  const today = useLiveData<AgendaResponse>(
    (signal) => getAgenda(near, 'today', signal),
    10 * 60_000,
    [...refreshKey(near), lang],
  );
  // Plus rien aujourd'hui (ou agenda du jour indisponible) : la semaine.
  const useWeek = (!!today.data && today.data.events.length === 0) || today.error;
  const week = useLiveData<AgendaResponse>(
    useWeek ? (signal) => getAgenda(near, 'week', signal) : null,
    10 * 60_000,
    [...refreshKey(near), lang, useWeek],
  );

  if (!today.data && !today.error) return null; // chargement discret
  if (useWeek && !week.data && !week.error) return null;
  const events = useWeek ? (week.data?.events ?? []) : today.data!.events;
  if (!events.length) return <AgendaLink />;
  const when: AgendaWhen = useWeek ? 'week' : 'today';
  return (
    <>
      <Rail
        title={useWeek ? t('Cette semaine à Lille') : t('Aujourd’hui à Lille')}
        onSeeAll={() => router.push({ pathname: '/agenda', params: { when } })}
      >
        {nearestFirst(events).map((e) => (
          <EventCard key={e.id} event={e} compact onPress={() => openEvent(e)} />
        ))}
      </Rail>
      {/* Toujours visible : l'aperçu ne montre qu'une journée, l'agenda complet couvre la semaine. */}
      <AgendaLink tight />
    </>
  );
}

/** Bons plans du jour autour de soi, masqués s'il n'y en a pas. */
export function OffersRail({ near }: { near: LatLng }) {
  const { t, lang } = useI18n();
  const { data } = useLiveData<OffersResponse>(
    (signal) => getOffers(near, signal),
    5 * 60_000,
    [...refreshKey(near), lang],
  );
  if (!data?.offers.length) return null;
  return (
    <Rail title={t('Bons plans')} onSeeAll={() => router.push('/offers')}>
      {data.offers.slice(0, 8).map((o) => (
        <OfferCard
          key={o.id}
          offer={o}
          showPlace
          compact
          onPress={() => router.push({ pathname: '/place/[id]', params: { id: o.placeId } })}
        />
      ))}
    </Rail>
  );
}

/** Accès à l'agenda quand rien n'est prévu aujourd'hui (demain, la semaine…). */
function AgendaLink({ tight }: { tight?: boolean } = {}) {
  const styles = useStyles();
  const { c } = useTone();
  const t = useT();
  return (
    <View style={[styles.linkWrap, tight && { marginTop: spacing.md }]}>
      <PressableScale
        onPress={() => router.push('/agenda')}
        style={[styles.link, { backgroundColor: c.surface, borderColor: c.border }]}
        accessibilityRole="button"
        accessibilityLabel={t('Agenda des sorties')}
      >
        <View style={[styles.linkIcon, { backgroundColor: c.goldTint }]}>
          <Ionicons name="calendar" size={22} color={c.gold} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.linkTitle, { color: c.text }]}>{t('Agenda des sorties')}</Text>
          <Text style={[styles.linkText, { color: c.textMuted }]}>
            {t('Concerts, expos, spectacles : cette semaine et ce week-end')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.textFaint} />
      </PressableScale>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  linkWrap: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  linkIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  linkTitle: { fontFamily: fonts.displayMedium, fontSize: font.body + 1 },
  linkText: { fontSize: font.small },
  section: { marginTop: spacing.xl, gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  title: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.title - 2 },
  seeAll: { color: colors.accent, fontSize: font.small, fontWeight: '700' },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md },
}));
