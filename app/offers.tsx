import { router } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { useLiveData } from '@/src/features/lille/useLiveData';
import { refreshKey } from '@/src/features/moment/HomeRails';
import { useUserLocation } from '@/src/features/location/LocationProvider';
import { OfferCard } from '@/src/features/offers/OfferCard';
import { useI18n } from '@/src/i18n';
import { getOffers } from '@/src/lib/api';
import { colors, font, spacing } from '@/src/theme';
import type { OffersResponse } from '@/shared/types';

/** Tous les bons plans du jour autour de soi. */
export default function OffersScreen() {
  const { coords } = useUserLocation();
  const { t, lang } = useI18n();
  const { data, error } = useLiveData<OffersResponse>(
    (signal) => getOffers(coords, signal),
    5 * 60_000,
    [...refreshKey(coords), lang],
  );

  if (!data) {
    return (
      <View style={[styles.screen, styles.center]}>
        {error ? (
          <Text style={styles.muted}>{t('Bons plans momentanément indisponibles.')}</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={data.offers}
      keyExtractor={(o) => o.id}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListHeaderComponent={
        <Text style={styles.intro}>{t('Offres des établissements partenaires, valables aujourd’hui.')}</Text>
      }
      ListEmptyComponent={
        <Text style={styles.muted}>{t('Pas de bon plan autour de vous aujourd’hui. Revenez ce soir !')}</Text>
      }
      renderItem={({ item }) => (
        <OfferCard
          offer={item}
          showPlace
          onPress={() => router.push({ pathname: '/place/[id]', params: { id: item.placeId } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { color: colors.textMuted, fontSize: font.small, marginBottom: spacing.md },
  muted: { color: colors.textMuted, fontSize: font.body, textAlign: 'center' },
});
