// Plugin de configuration Expo pour @googlemaps/react-native-navigation-sdk.
// Le package n'en fournit pas : ce plugin applique les étapes d'installation de
// son README (clés API, désugarage Android, Jetifier) à chaque `expo prebuild`.

const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withAppDelegate,
  withGradleProperties,
  withInfoPlist,
} = require('expo/config-plugins');

const INFO_PLIST_KEY = 'GMSApiKey';
const DESUGAR_MARKER = '// @generated withGoogleNavigation desugaring';

function withIosApiKey(config, apiKey) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults[INFO_PLIST_KEY] = apiKey;
    return cfg;
  });

  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withGoogleNavigation : AppDelegate Swift attendu');
    }
    let src = cfg.modResults.contents;
    if (!src.includes('import GoogleMaps')) {
      src = src.replace(/^import React$/m, 'import GoogleMaps\nimport React');
    }
    if (!src.includes('GMSServices.provideAPIKey')) {
      src = src.replace(
        /(didFinishLaunchingWithOptions launchOptions:[^{]*\{\n)/,
        `$1    if let key = Bundle.main.object(forInfoDictionaryKey: "${INFO_PLIST_KEY}") as? String, !key.isEmpty {\n      GMSServices.provideAPIKey(key)\n    }\n`,
      );
    }
    if (!src.includes('GMSServices.provideAPIKey')) {
      throw new Error('withGoogleNavigation : impossible de modifier AppDelegate.swift');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withAndroidApiKey(config, apiKey) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      'com.google.android.geo.API_KEY',
      apiKey,
    );
    return cfg;
  });
}

function withAndroidBuildRequirements(config) {
  config = withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(DESUGAR_MARKER)) {
      // Le Navigation SDK exige le désugarage de la bibliothèque Java, quel que soit minSdk.
      cfg.modResults.contents += `
${DESUGAR_MARKER}
android {
    compileOptions {
        coreLibraryDesugaringEnabled true
    }
}
dependencies {
    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs_nio:2.0.4'
}
`;
    }
    return cfg;
  });

  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter(
      (p) => !(p.type === 'property' && p.key === 'android.enableJetifier'),
    );
    props.push({ type: 'property', key: 'android.enableJetifier', value: 'true' });
    cfg.modResults = props;
    return cfg;
  });
}

/**
 * @param {import('expo/config').ExpoConfig} config
 * @param {{ iosApiKey?: string, androidApiKey?: string }} props
 */
module.exports = function withGoogleNavigation(config, props = {}) {
  const { iosApiKey, androidApiKey } = props;
  if (!iosApiKey || !androidApiKey) {
    console.warn(
      '[withGoogleNavigation] Clé Maps manquante (GOOGLE_MAPS_IOS_API_KEY / GOOGLE_MAPS_ANDROID_API_KEY) : la carte restera vide.',
    );
  }
  config = withIosApiKey(config, iosApiKey ?? '');
  config = withAndroidApiKey(config, androidApiKey ?? '');
  config = withAndroidBuildRequirements(config);
  return config;
};
