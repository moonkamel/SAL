import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EventCard } from '@/src/features/agenda/EventCard';
import { openEvent } from '@/src/features/agenda/openEvent';
import { useLiveData } from '@/src/features/lille/useLiveData';
import { OfferCard } from '@/src/features/offers/OfferCard';
import { useI18n, useT } from '@/src/i18n';
import { getAgenda, getOffers } from '@/src/lib/api';
import { colors, font, fonts, spacing } from '@/src/theme';
import { useTone } from '@/src/theme/tone';
import type { AgendaResponse, LatLng, OffersResponse } from '@/shared/types';

/** On ne recharge qu'après un déplacement de ~200 m ; les distances restent exactes. */
export function refreshKey(p: LatLng): number[] {
  return [Math.round(p.lat * 500), Math.round(p.lng * 500)];
}

function Rail({ title, onSeeAll, children }: { title: string; onSeeAll: () => void; children: ReactNode }) {
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

/** « Ce soir à Lille » (agenda), masqué s'il n'y a rien. */
export function TonightRail({ near }: { near: LatLng }) {
  const { t, lang } = useI18n();
  const { data } = useLiveData<AgendaResponse>(
    (signal) => getAgenda(near, 'today', signal),
    10 * 60_000,
    [...refreshKey(near), lang],
  );
  if (!data?.events.length) return null;
  return (
    <Rail title={t('Ce soir à Lille')} onSeeAll={() => router.push('/agenda')}>
      {data.events.slice(0, 8).map((e) => (
        <EventCard key={e.id} event={e} compact onPress={() => openEvent(e)} />
      ))}
    </Rail>
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

const styles = StyleSheet.create({
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
});
