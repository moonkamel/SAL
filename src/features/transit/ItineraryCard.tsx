import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/src/components/PressableScale';
import { useT } from '@/src/i18n';
import { font, fonts, radius, spacing } from '@/src/theme';
import { formatDuration } from '@/shared/format';
import { formatClock, minutesUntil } from '@/shared/trip';
import type { TransitItinerary } from '@/shared/types';

import { LineBadge } from './LineBadge';
import { themedStyles, useColors } from '@/src/theme/tone';

interface Props {
  itinerary: TransitItinerary;
  selected: boolean;
  onPress: () => void;
  now: Date;
}

/** Une proposition de trajet : horaires, durée, lignes, marche et prix. */
export function ItineraryCard({ itinerary, selected, onPress, now }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const firstRide = itinerary.segments.find((s) => s.kind === 'ride');
  const leaveIn = minutesUntil(itinerary.departureTime, now);
  const t = useT();
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.card, selected && styles.selected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={t('Départ {dep}, arrivée {arr}, {duration}', {
        dep: formatClock(itinerary.departureTime),
        arr: formatClock(itinerary.arrivalTime),
        duration: formatDuration(itinerary.durationSeconds),
      })}
    >
      <View style={styles.top}>
        <Text style={styles.times}>
          {formatClock(itinerary.departureTime)} → {formatClock(itinerary.arrivalTime)}
        </Text>
        <Text style={styles.duration}>{formatDuration(itinerary.durationSeconds)}</Text>
      </View>

      <View style={styles.chain}>
        {itinerary.segments.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && <Ionicons name="chevron-forward" size={12} color={colors.textFaint} />}
            {s.kind === 'ride' ? (
              <LineBadge line={s.line} size="sm" />
            ) : (
              <View style={styles.walk}>
                <Ionicons name="walk" size={13} color={colors.textMuted} />
                <Text style={styles.walkText}>{Math.max(1, Math.round(s.durationSeconds / 60))}</Text>
              </View>
            )}
          </Fragment>
        ))}
      </View>

      <Text style={styles.meta}>
        {leaveIn <= 0 ? t('Partez maintenant') : t('Partez dans {n} min', { n: leaveIn })}
        {firstRide?.kind === 'ride'
          ? ` · ${t('depuis {stop}', { stop: firstRide.departureStop.name })}`
          : ''}
        {itinerary.fare ? ` · ${itinerary.fare}` : ''}
      </Text>
      {itinerary.nextDepartures?.length ? (
        <Text style={styles.next}>
          {t('Départs suivants : {times}', {
            times: itinerary.nextDepartures.map((d) => formatClock(d)).join(' · '),
          })}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const useStyles = themedStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: spacing.md,
    gap: spacing.sm,
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  times: { color: colors.text, fontFamily: fonts.display, fontSize: font.title - 2 },
  duration: { color: colors.gold, fontSize: font.body, fontWeight: '800' },
  chain: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  walk: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  walkText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: font.small },
  next: { color: colors.gold, fontSize: font.small, fontWeight: '700' },
}));
