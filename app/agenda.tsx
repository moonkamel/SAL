import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Chip } from '@/src/components/Chip';
import { EventCard } from '@/src/features/agenda/EventCard';
import { openEvent } from '@/src/features/agenda/openEvent';
import { useLiveData } from '@/src/features/lille/useLiveData';
import { refreshKey } from '@/src/features/moment/HomeRails';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { getAgenda } from '@/src/lib/api';
import { colors, font, spacing } from '@/src/theme';
import type { AgendaResponse, AgendaWhen } from '@/shared/types';

const WHEN: { key: AgendaWhen; label: string }[] = [
  { key: 'today', label: 'Ce soir' },
  { key: 'tomorrow', label: 'Demain' },
  { key: 'weekend', label: 'Ce week-end' },
];

/** Agenda des sorties : concerts, soirées, expos… */
export default function AgendaScreen() {
  const params = useLocalSearchParams<{ when?: AgendaWhen }>();
  const [when, setWhen] = useState<AgendaWhen>(params.when ?? 'today');
  const { coords } = useUserLocation();
  const { data, error } = useLiveData<AgendaResponse>(
    (signal) => getAgenda(coords, when, signal),
    10 * 60_000,
    [...refreshKey(coords), when],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.chips}>
        {WHEN.map((w) => (
          <Chip key={w.key} label={w.label} selected={when === w.key} onPress={() => setWhen(w.key)} />
        ))}
      </View>
      {!data ? (
        <View style={styles.center}>
          {error ? (
            <Text style={styles.muted}>Agenda momentanément indisponible.</Text>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={data.events}
          keyExtractor={(e) => e.id}
          initialNumToRender={6}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <Text style={styles.muted}>Rien de prévu dans l’agenda pour le moment.</Text>
          }
          renderItem={({ item }) => <EventCard event={item} onPress={() => openEvent(item)} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  muted: { color: colors.textMuted, fontSize: font.body, textAlign: 'center', marginTop: spacing.xl },
});
