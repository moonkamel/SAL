import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useI18n, useT } from '@/src/i18n';
import { font, fonts, radius, spacing } from '@/src/theme';
import { formatDistance } from '@/shared/format';
import { formatClock } from '@/shared/trip';
import type { TransitItinerary, TripSegment } from '@/shared/types';

import { LineBadge } from './LineBadge';
import { useStopRealtime } from './useStopRealtime';
import { themedStyles, useColors } from '@/src/theme/tone';

interface Props {
  itinerary: TransitItinerary;
  destinationName: string;
}

const minutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;

/** Étapes du trajet, façon feuille de route. */
export function TripTimeline({ itinerary, destinationName }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const { t, lang } = useI18n();
  return (
    <View style={styles.list}>
      {itinerary.segments.map((seg, i) => {
        return (
          <View key={i} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.bar,
                  seg.kind === 'ride'
                    ? { backgroundColor: seg.line.color, width: 6 }
                    : { borderColor: colors.textFaint, borderStyle: 'dashed', borderLeftWidth: 3 },
                ]}
              />
            </View>
            <View style={styles.body}>
              {seg.kind === 'walk' ? (
                <>
                  <View style={styles.head}>
                    <Ionicons name="walk" size={18} color={colors.text} />
                    <Text style={styles.title}>
                      {t('Marcher {duration}', { duration: minutes(seg.durationSeconds) })}
                      <Text style={styles.muted}> · {formatDistance(seg.distanceMeters, lang)}</Text>
                    </Text>
                  </View>
                  <Text style={styles.muted}>{t('jusqu’à {place}', { place: seg.toName })}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.stop}>
                    {formatClock(seg.departureTime)} · {seg.departureStop.name}
                  </Text>
                  <View style={styles.head}>
                    <LineBadge line={seg.line} />
                    <Text style={styles.title} numberOfLines={2}>
                      {t('Direction {headsign}', { headsign: seg.headsign })}
                    </Text>
                  </View>
                  <Realtime ride={seg} />
                  <Text style={styles.muted}>
                    {seg.stopCount > 1 ? t('{n} arrêts', { n: seg.stopCount }) : t('1 arrêt')} ·{' '}
                    {minutes(seg.durationSeconds)}
                  </Text>
                  <Text style={styles.stop}>
                    {formatClock(seg.arrivalTime)} · {t('Descendre à {stop}', { stop: seg.arrivalStop.name })}
                  </Text>
                </>
              )}
            </View>
          </View>
        );
      })}
      <View style={styles.row}>
        <View style={styles.rail}>
          <Ionicons name="flag" size={18} color={colors.accent} />
        </View>
        <View style={styles.body}>
          <Text style={styles.stop}>
            {formatClock(itinerary.arrivalTime)} · {destinationName}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Temps réel Ilévia à l'arrêt de montée (masqué s'il n'est pas disponible). */
function Realtime({ ride }: { ride: Extract<TripSegment, { kind: 'ride' }> }) {
  const styles = useStyles();
  const mins = useStopRealtime(ride.departureStop.name, ride.line.short, ride.headsign);
  const t = useT();
  if (!mins?.length) return null;
  return (
    <View style={styles.live} accessible accessibilityLabel={t('Temps réel : dans {list} minutes', { list: mins.join(', ') })}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>
        {t('Temps réel : {list}', {
          list: mins.map((m) => (m <= 0 ? t('à quai') : `${m} min`)).join(' · '),
        })}
      </Text>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  live: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.open },
  liveText: { color: colors.open, fontSize: font.small, fontWeight: '800' },
  list: { gap: 2 },
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 22, alignItems: 'center' },
  bar: { flex: 1, minHeight: 40, borderRadius: 3 },
  body: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: 4, borderRadius: radius.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, color: colors.text, fontSize: font.body, fontWeight: '700' },
  stop: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.body },
  muted: { color: colors.textMuted, fontSize: font.small, fontWeight: '400' },
}));
