import type { ExpoConfig } from 'expo/config';

// Identifiants natifs : à adapter avant la première publication sur les stores.
const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? 'fr.sortiralille.app';
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE ?? 'fr.sortiralille.app';

// Origine du backend (routes API Expo Router) en production.
// En développement, l'app interroge directement le serveur Metro.
const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL;

// Clés Maps / Navigation SDK embarquées dans l'app, restreintes au bundle ID / package.
// À définir dans les variables d'environnement EAS (voir README).
const GOOGLE_MAPS_IOS_API_KEY = process.env.GOOGLE_MAPS_IOS_API_KEY;
const GOOGLE_MAPS_ANDROID_API_KEY = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

// AdMob : IDs d'application (pas des blocs d'annonces). Par défaut, les IDs de test Google.
const ADMOB_ANDROID_APP_ID =
  process.env.ADMOB_ANDROID_APP_ID ?? 'ca-app-pub-3940256099942544~3347511713';
const ADMOB_IOS_APP_ID = process.env.ADMOB_IOS_APP_ID ?? 'ca-app-pub-3940256099942544~1458002511';

const TRACKING_USAGE =
  'Votre identifiant publicitaire permet d’afficher des annonces plus pertinentes et de financer l’application. Vous pouvez refuser sans perdre aucune fonctionnalité.';

const LOCATION_WHEN_IN_USE =
  'Sortir à Lille utilise votre position pour vous proposer les lieux les plus proches et calculer le trajet pour y aller.';
const LOCATION_ALWAYS =
  'Pendant le guidage, Sortir à Lille continue d’utiliser votre position quand l’écran est verrouillé pour vous indiquer le chemin. La localisation s’arrête à l’arrivée.';

const config: ExpoConfig = {
  name: 'Sortir à Lille',
  slug: 'sortir-a-lille',
  owner: 'farouk12',
  scheme: 'sortiralille',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B0B12',
  ios: {
    bundleIdentifier: IOS_BUNDLE_ID,
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: LOCATION_WHEN_IN_USE,
      NSLocationAlwaysAndWhenInUseUsageDescription: LOCATION_ALWAYS,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      backgroundColor: '#0B0B12',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Le guidage tourne dans un service de premier plan (notification « Guidage en cours ») :
    // pas besoin de ACCESS_BACKGROUND_LOCATION, soumis à un examen strict sur Google Play.
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS',
    ],
    // Ajoutées par défaut par Expo, inutiles ici.
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'server',
    favicon: './assets/favicon.png',
  },
  plugins: [
    ['expo-router', API_ORIGIN ? { origin: API_ORIGIN } : {}],
    [
      'expo-location',
      {
        locationWhenInUsePermission: LOCATION_WHEN_IN_USE,
        locationAlwaysAndWhenInUsePermission: LOCATION_ALWAYS,
        // iOS : mode d'arrière-plan « location » pour poursuivre le guidage écran verrouillé
        // (l'autorisation « Lorsque l'app est active » suffit, avec l'indicateur bleu).
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    'expo-system-ui',
    'expo-web-browser',
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: ADMOB_ANDROID_APP_ID,
        iosAppId: ADMOB_IOS_APP_ID,
        // Aucune collecte avant le consentement RGPD (UMP).
        delayAppMeasurementInit: true,
        userTrackingUsageDescription: TRACKING_USAGE,
        // Attribution publicitaire iOS (identifiant SKAdNetwork de Google).
        skAdNetworkItems: ['cstr6suwn9.skadnetwork'],
      },
    ],
    ['expo-tracking-transparency', { userTrackingPermission: TRACKING_USAGE }],
    [
      './plugins/withGoogleNavigation',
      { iosApiKey: GOOGLE_MAPS_IOS_API_KEY, androidApiKey: GOOGLE_MAPS_ANDROID_API_KEY },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#0B0B12',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '224dbc02-f270-4412-8998-fcd116ac8320',
    },
  },
};

export default config;
