// Identifiants des blocs d'annonces. En développement (ou tant que les vrais IDs ne sont
// pas configurés), on utilise TOUJOURS les IDs de test Google : cliquer sur ses propres
// annonces réelles peut faire suspendre le compte AdMob.

export type AdKind = 'banner' | 'native' | 'interstitial';
type Platform = 'ios' | 'android';

// Copie des IDs de test publics de Google (TestIds de react-native-google-mobile-ads).
export const GOOGLE_TEST_UNITS: Record<Platform, Record<AdKind, string>> = {
  android: {
    banner: 'ca-app-pub-3940256099942544/9214589741',
    native: 'ca-app-pub-3940256099942544/2247696110',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2435281174',
    native: 'ca-app-pub-3940256099942544/3986624511',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
  },
};

const ENV_NAMES: Record<Platform, Record<AdKind, string>> = {
  android: {
    banner: 'EXPO_PUBLIC_ADMOB_ANDROID_BANNER',
    native: 'EXPO_PUBLIC_ADMOB_ANDROID_NATIVE',
    interstitial: 'EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL',
  },
  ios: {
    banner: 'EXPO_PUBLIC_ADMOB_IOS_BANNER',
    native: 'EXPO_PUBLIC_ADMOB_IOS_NATIVE',
    interstitial: 'EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL',
  },
};

export function resolveAdUnit(
  kind: AdKind,
  platform: Platform,
  isDev: boolean,
  env: Record<string, string | undefined>,
): string {
  const real = env[ENV_NAMES[platform][kind]];
  if (isDev || !real) return GOOGLE_TEST_UNITS[platform][kind];
  return real;
}

// Les variables EXPO_PUBLIC_ doivent être lues littéralement pour être intégrées au bundle.
const PUBLIC_ENV: Record<string, string | undefined> = {
  EXPO_PUBLIC_ADMOB_ANDROID_BANNER: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER,
  EXPO_PUBLIC_ADMOB_ANDROID_NATIVE: process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE,
  EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL,
  EXPO_PUBLIC_ADMOB_IOS_BANNER: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER,
  EXPO_PUBLIC_ADMOB_IOS_NATIVE: process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE,
  EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL,
};

export function adUnit(kind: AdKind, platform: Platform): string {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  return resolveAdUnit(kind, platform, isDev, PUBLIC_ENV);
}
