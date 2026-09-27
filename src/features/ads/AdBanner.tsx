import { Platform, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { useGuidanceActive } from '@/src/features/navigation/guidanceState';
import { colors } from '@/src/theme';

import { adUnit } from './adUnits';
import { useAds } from './AdsProvider';

/** Bannière en bas de l'accueil. Jamais pendant un guidage, jamais sans consentement. */
export function AdBanner() {
  const { canRequestAds } = useAds();
  const guiding = useGuidanceActive();
  if (!canRequestAds || guiding) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnit('banner', Platform.OS === 'ios' ? 'ios' : 'android')}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: colors.background },
});
