import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  InterstitialAd,
} from 'react-native-google-mobile-ads';

import { isGuidanceActive } from '@/src/features/navigation/guidanceState';

import { adUnit } from './adUnits';
import { shouldShowInterstitial } from './policy';

interface AdsState {
  /** Vrai une fois le consentement recueilli (UMP) et le SDK initialisé. */
  canRequestAds: boolean;
  /** L'utilisateur doit pouvoir modifier ses choix (obligatoire dans l'UE). */
  privacyOptionsRequired: boolean;
  showPrivacyOptions: () => Promise<void>;
  /** À appeler à chaque recherche : peut afficher l'interstitiel (max 1 par session). */
  onSearch: () => void;
}

const AdsContext = createContext<AdsState>({
  canRequestAds: false,
  privacyOptionsRequired: false,
  showPrivacyOptions: async () => {},
  onSearch: () => {},
});

const platform = Platform.OS === 'ios' ? 'ios' : 'android';

export function AdsProvider({ children }: { children: ReactNode }) {
  const [canRequestAds, setCanRequestAds] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);

  const interstitial = useRef<InterstitialAd | null>(null);
  const interstitialLoaded = useRef(false);
  const shownThisSession = useRef(false);
  const searches = useRef(0);

  const loadInterstitial = useCallback(() => {
    if (shownThisSession.current) return;
    const ad = InterstitialAd.createForAdRequest(adUnit('interstitial', platform));
    ad.addAdEventListener(AdEventType.LOADED, () => {
      interstitialLoaded.current = true;
    });
    ad.addAdEventListener(AdEventType.ERROR, () => {
      interstitialLoaded.current = false;
    });
    ad.load();
    interstitial.current = ad;
  }, []);

  // Consentement RGPD (Google UMP) avant toute publicité, puis ATT sur iOS, puis SDK.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await AdsConsent.gatherConsent();
        if (Platform.OS === 'ios') {
          // Après le formulaire UMP, comme recommandé par Google.
          await requestTrackingPermissionsAsync().catch(() => null);
        }
        const info = await AdsConsent.getConsentInfo();
        if (cancelled) return;
        setPrivacyOptionsRequired(
          info.privacyOptionsRequirementStatus ===
            AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
        );
        if (!info.canRequestAds) return;

        await mobileAds().initialize();
        if (cancelled) return;
        setCanRequestAds(true);
        loadInterstitial();
      } catch (error) {
        // Sans consentement ou SDK indisponible : l'app fonctionne simplement sans pub.
        console.warn('[ads] initialisation impossible', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadInterstitial]);

  const onSearch = useCallback(() => {
    searches.current += 1;
    const show = shouldShowInterstitial({
      shownThisSession: shownThisSession.current,
      searchesThisSession: searches.current,
      guidanceActive: isGuidanceActive(),
      canRequestAds,
    });
    if (show && interstitialLoaded.current && interstitial.current) {
      shownThisSession.current = true;
      interstitialLoaded.current = false;
      void interstitial.current.show().catch(() => {});
    }
  }, [canRequestAds]);

  const showPrivacyOptions = useCallback(async () => {
    try {
      await AdsConsent.showPrivacyOptionsForm();
    } catch (error) {
      console.warn('[ads] formulaire de confidentialité indisponible', error);
    }
  }, []);

  return (
    <AdsContext.Provider
      value={{ canRequestAds, privacyOptionsRequired, showPrivacyOptions, onSearch }}
    >
      {children}
    </AdsContext.Provider>
  );
}

export function useAds(): AdsState {
  return useContext(AdsContext);
}
