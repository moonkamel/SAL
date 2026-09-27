import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from 'react-native-google-mobile-ads';

import { useGuidanceActive } from '@/src/features/navigation/guidanceState';
import { colors, font, radius, spacing } from '@/src/theme';

import { adUnit } from './adUnits';
import { useAds } from './AdsProvider';

/** Pub native insérée dans la liste des résultats, clairement marquée « Annonce ». */
export function NativeAdCard() {
  const { canRequestAds } = useAds();
  const guiding = useGuidanceActive();
  const [ad, setAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    if (!canRequestAds) return;
    let loaded: NativeAd | null = null;
    let cancelled = false;
    NativeAd.createForAdRequest(adUnit('native', Platform.OS === 'ios' ? 'ios' : 'android'))
      .then((nativeAd) => {
        if (cancelled) {
          nativeAd.destroy();
          return;
        }
        loaded = nativeAd;
        setAd(nativeAd);
      })
      .catch(() => {
        // Pas d'annonce disponible : l'emplacement reste simplement vide.
      });
    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [canRequestAds]);

  if (!ad || guiding) return null;

  return (
    <NativeAdView nativeAd={ad} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Annonce</Text>
        </View>
        {ad.advertiser && (
          <NativeAsset assetType={NativeAssetType.ADVERTISER}>
            <Text style={styles.advertiser} numberOfLines={1}>
              {ad.advertiser}
            </Text>
          </NativeAsset>
        )}
      </View>
      <NativeMediaView style={styles.media} resizeMode="cover" />
      <View style={styles.body}>
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text style={styles.headline} numberOfLines={2}>
            {ad.headline}
          </Text>
        </NativeAsset>
        {!!ad.body && (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={styles.text} numberOfLines={2}>
              {ad.body}
            </Text>
          </NativeAsset>
        )}
        {!!ad.callToAction && (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.cta}>{ad.callToAction}</Text>
          </NativeAsset>
        )}
      </View>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  badge: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '700' },
  advertiser: { flex: 1, color: colors.textMuted, fontSize: font.small },
  media: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surfaceRaised },
  body: { padding: spacing.lg, gap: spacing.xs },
  headline: { color: colors.text, fontSize: font.body + 1, fontWeight: '700' },
  text: { color: colors.textMuted, fontSize: font.small },
  cta: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    color: colors.accentText,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontWeight: '700',
    fontSize: font.small + 1,
  },
});
