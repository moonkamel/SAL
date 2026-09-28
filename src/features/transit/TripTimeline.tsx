import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, fonts, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { formatDistance } from '@/shared/format';
import { formatClock } from '@/shared/trip';
import type { TransitItinerary, TripSegment } from '@/shared/types';

import { LineBadge } from './LineBadge';

interface Props {
  itinerary: TransitItinerary;
  destinationName: string;
  /** Tronçon en cours (pendant le trajet). */
  current?: number;
  /** Guidage vocal à pied jusqu'au bout d'un tronçon. */
  onGuideWalk?: (segment: Extract<TripSegment, { kind: 'walk' }>) => void;
}

const minutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;

/** Étapes du trajet, façon feuille de route. */
export function TripTimeline({ itinerary, destinationName, current, onGuideWalk }: Props) {
  return (
    <View style={styles.list}>
      {itinerary.segments.map((seg, i) => {
        const state = current === undefined ? 'todo' : i < current ? 'done' : i === current ? 'now' : 'todo';
        return (
          <View key={i} style={[styles.row, state === 'done' && { opacity: 0.45 }]}>
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
            <View style={[styles.body, state === 'now' && styles.now]}>
              {seg.kind === 'walk' ? (
                <>
                  <View style={styles.head}>
                    <Ionicons name="walk" size={18} color={colors.text} />
                    <Text style={styles.title}>
                      Marcher {minutes(seg.durationSeconds)}
                      <Text style={styles.muted}> · {formatDistance(seg.distanceMeters)}</Text>
                    </Text>
                  </View>
                  <Text style={styles.muted}>jusqu’à {seg.toName}</Text>
                  {onGuideWalk && state !== 'done' && (
                    <Pressable
                      onPress={() => onGuideWalk(seg)}
                      style={({ pressed }) => [styles.guide, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                    >
                      <Ionicons name="navigate" size={15} color={colors.accent} />
                      <Text style={styles.guideText}>Guidage vocal à pied</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.stop}>
                    {formatClock(seg.departureTime)} · {seg.departureStop.name}
                  </Text>
                  <View style={styles.head}>
                    <LineBadge line={seg.line} />
                    <Text style={styles.title} numberOfLines={2}>
                      Direction {seg.headsign}
                    </Text>
                  </View>
                  <Text style={styles.muted}>
                    {seg.stopCount} arrêt{seg.stopCount > 1 ? 's' : ''} · {minutes(seg.durationSeconds)}
                  </Text>
                  <Text style={styles.stop}>
                    {formatClock(seg.arrivalTime)} · Descendre à {seg.arrivalStop.name}
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

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 22, alignItems: 'center' },
  bar: { flex: 1, minHeight: 40, borderRadius: 3 },
  body: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: 4, borderRadius: radius.sm },
  now: { backgroundColor: 'rgba(217, 80, 47, 0.14)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, color: colors.text, fontSize: font.body, fontWeight: '700' },
  stop: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.body },
  muted: { color: colors.textMuted, fontSize: font.small, fontWeight: '400' },
  guide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: TOUCH_TARGET - 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: spacing.xs,
  },
  guideText: { color: colors.accent, fontSize: font.small, fontWeight: '700' },
});
