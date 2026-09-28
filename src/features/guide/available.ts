import { NativeModules, Platform } from 'react-native';

import { MAPBOX_TOKEN } from '@/src/lib/mapbox';

/**
 * Vrai si l'app installée contient Mapbox (build récent) et qu'un jeton est configuré.
 * Sinon on garde le guidage Google : une ancienne app ne plante pas.
 */
export const mapboxGuideAvailable =
  Platform.OS !== 'web' && NativeModules.RNMBXModule != null && MAPBOX_TOKEN.length > 0;
