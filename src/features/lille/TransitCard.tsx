import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { getTransit } from '@/src/lib/api';
import { colors, font, fonts, radius, spacing } from '@/src/theme';
import { formatDistance } from '@/shared/format';
import type { LatLng, TransitResponse } from '@/shared/types';

import { formatWait, lineColor } from './pickers';
import { useLiveData } from './useLiveData';

interface Props {
  near: LatLng;
  title: string;
}

/** Prochains passages métro / tram / bus aux arrêts Ilévia les plus proches (temps réel). */
export function TransitCard({ near, title }: Props) {
  const { data, error } = useLiveData<TransitResponse>(
    (signal) => getTransit(near, signal),
    30_000,
    [near.lat, near.lng],
  );

  if (!data) {
    if (!error) return null; // chargement discret
    return (
      <View style={styles.card}>
        <Header title={title} />
        <Text style={styles.muted}>Horaires Ilévia momentanément indisponibles.</Text>
      </View>
    );
  }
  if (data.stops.length === 0) return null;

  return (
    <View style={styles.card}>
      <Header title={title} />
      {data.stops.map((stop) => (
        <View key={stop.name} style={styles.stop}>
          <Text style={styles.stopName}>
            {stop.name}
            <Text style={styles.stopDistance}> · {formatDistance(stop.distanceMeters)}</Text>
          </Text>
          {stop.departures.slice(0, 4).map((d) => (
            <View
              key={`${d.line}-${d.direction}`}
              style={styles.departure}
              accessible
              accessibilityLabel={`Ligne ${d.line} vers ${d.direction} : ${d.minutes
                .map(formatWait)
                .join(', ')}`}
            >
              <View style={[styles.line, { backgroundColor: lineColor(d.line) }]}>
                <Text style={styles.lineText}>{d.line}</Text>
              </View>
              <Text style={styles.direction} numberOfLines={1}>
                {d.direction}
              </Text>
              <Text style={styles.times}>{d.minutes.map(formatWait).join(' · ')}</Text>
            </View>
          ))}
        </View>
      ))}
      <Text style={styles.source}>Temps réel Ilévia</Text>
    </View>
  );
}

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Ionicons name="subway" size={18} color={colors.gold} />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.body + 1 },
  stop: { gap: spacing.sm },
  stopName: { color: colors.text, fontSize: font.small + 1, fontWeight: '700' },
  stopDistance: { color: colors.textMuted, fontWeight: '400' },
  departure: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: {
    minWidth: 34,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  lineText: { color: '#FFFFFF', fontSize: font.tiny, fontWeight: '900' },
  direction: { flex: 1, color: colors.textMuted, fontSize: font.small },
  times: { color: colors.open, fontSize: font.small, fontWeight: '800' },
  source: { color: colors.textFaint, fontSize: font.tiny - 1 },
  muted: { color: colors.textMuted, fontSize: font.small },
});
