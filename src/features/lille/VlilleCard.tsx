import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getVlille } from '@/src/lib/api';
import { colors, font, fonts, palette, radius, spacing } from '@/src/theme';
import { formatDistance } from '@/shared/format';
import type { LatLng, VlilleResponse, VlilleStation } from '@/shared/types';

import { pickStation } from './pickers';
import { useLiveData } from './useLiveData';

interface Props {
  from: LatLng;
  to: LatLng;
  /** Stations retenues (prise et dépôt), pour lancer le voyage V'Lille guidé. */
  onStations?: (pickup: VlilleStation | undefined, dropoff: VlilleStation | undefined) => void;
}

/** Où prendre un V'Lille près de soi, et où le déposer près du lieu (temps réel). */
export function VlilleCard({ from, to, onStations }: Props) {
  const start = useLiveData<VlilleResponse>(
    (signal) => getVlille(from, 3, signal),
    60_000,
    [from.lat, from.lng],
  );
  const end = useLiveData<VlilleResponse>(
    (signal) => getVlille(to, 3, signal),
    60_000,
    [to.lat, to.lng],
  );

  const pickupStation = start.data ? pickStation(start.data.stations, 'bikes') : undefined;
  const dropoffStation = end.data ? pickStation(end.data.stations, 'docks') : undefined;
  useEffect(() => {
    onStations?.(pickupStation, dropoffStation);
    // Seuls les identifiants et disponibilités comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupStation?.id, pickupStation?.bikes, dropoffStation?.id, dropoffStation?.docks]);

  if (start.error && end.error && !start.data && !end.data) {
    return (
      <View style={styles.card}>
        <Header />
        <Text style={styles.muted}>Disponibilités V’Lille momentanément indisponibles.</Text>
      </View>
    );
  }
  if (!start.data || !end.data) return null; // chargement discret
  if (start.data.stations.length === 0 && end.data.stations.length === 0) return null;

  const pickup = pickStation(start.data.stations, 'bikes');
  const dropoff = pickStation(end.data.stations, 'docks');

  return (
    <View style={styles.card}>
      <Header />
      <Row
        icon="bicycle"
        label="Prendre un vélo"
        station={pickup}
        count={pickup?.bikes}
        unit="vélo"
        empty="Aucun vélo disponible à proximité"
      />
      <Row
        icon="flag"
        label="Le déposer"
        station={dropoff}
        count={dropoff?.docks}
        unit="place"
        empty="Aucune place libre près du lieu"
      />
    </View>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.logo}>
        <Ionicons name="bicycle" size={16} color={colors.background} />
      </View>
      <Text style={styles.title}>V’Lille en direct</Text>
    </View>
  );
}

function Row({
  icon,
  label,
  station,
  count,
  unit,
  empty,
}: {
  icon: 'bicycle' | 'flag';
  label: string;
  station?: VlilleStation;
  count?: number;
  unit: string;
  empty: string;
}) {
  if (!station || count === undefined) {
    return <Text style={styles.muted}>{empty}</Text>;
  }
  const tone = count >= 3 ? colors.open : palette.gold;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label} : station ${station.name}, ${count} ${unit}${count > 1 ? 's' : ''}`}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.station} numberOfLines={1}>
          {station.name} · {formatDistance(station.distanceMeters)}
        </Text>
      </View>
      <View style={[styles.badge, { borderColor: tone }]}>
        <Text style={[styles.badgeText, { color: tone }]}>
          {count} {unit}
          {count > 1 ? 's' : ''}
        </Text>
      </View>
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
  logo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.body + 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowLabel: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '700', letterSpacing: 0.5 },
  station: { color: colors.text, fontSize: font.small + 1, fontWeight: '600' },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  badgeText: { fontSize: font.small, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: font.small },
});
