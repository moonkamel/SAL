import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useI18n, useT } from '@/src/i18n';
import { getVlille } from '@/src/lib/api';
import { font, fonts, radius, spacing } from '@/src/theme';
import { formatDistance } from '@/shared/format';
import type { LatLng, VlilleResponse, VlilleStation } from '@/shared/types';

import { pickStation } from './pickers';
import { useLiveData } from './useLiveData';
import { themedStyles, useColors } from '@/src/theme/tone';

interface Props {
  from: LatLng;
  to: LatLng;
}

/** Où prendre un V'Lille près de soi, et où le déposer près du lieu (temps réel). */
export function VlilleCard({ from, to }: Props) {
  const styles = useStyles();
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

  const t = useT();
  const pickupStation = start.data ? pickStation(start.data.stations, 'bikes') : undefined;
  const dropoffStation = end.data ? pickStation(end.data.stations, 'docks') : undefined;

  if (start.error && end.error && !start.data && !end.data) {
    return (
      <View style={styles.card}>
        <Header />
        <Text style={styles.muted}>{t('Disponibilités V’Lille momentanément indisponibles.')}</Text>
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
        label={t('Prendre un vélo')}
        station={pickup}
        count={pickup?.bikes}
        unit="bike"
        empty={t('Aucun vélo disponible à proximité')}
      />
      <Row
        icon="flag"
        label={t('Le déposer')}
        station={dropoff}
        count={dropoff?.docks}
        unit="dock"
        empty={t('Aucune place libre près du lieu')}
      />
    </View>
  );
}

function Header() {
  const colors = useColors();
  const styles = useStyles();
  const t = useT();
  return (
    <View style={styles.header}>
      <View style={styles.logo}>
        <Ionicons name="bicycle" size={16} color={colors.background} />
      </View>
      <Text style={styles.title}>{t('V’Lille en direct')}</Text>
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
  unit: 'bike' | 'dock';
  empty: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t, lang } = useI18n();
  if (!station || count === undefined) {
    return <Text style={styles.muted}>{empty}</Text>;
  }
  const tone = count >= 3 ? colors.open : colors.gold;
  const amount =
    unit === 'bike'
      ? count > 1
        ? t('{n} vélos', { n: count })
        : t('{n} vélo', { n: count })
      : count > 1
        ? t('{n} places', { n: count })
        : t('{n} place', { n: count });
  return (
    <View style={styles.row} accessible accessibilityLabel={t('{label} : station {station}, {amount}', { label, station: station.name, amount })}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.station} numberOfLines={1}>
          {station.name} · {formatDistance(station.distanceMeters, lang)}
        </Text>
      </View>
      <View style={[styles.badge, { borderColor: tone }]}>
        <Text style={[styles.badgeText, { color: tone }]}>
          {amount}
        </Text>
      </View>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
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
}));
