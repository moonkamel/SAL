import { Ionicons } from '@expo/vector-icons';
import Mapbox, {
  Camera,
  LineLayer,
  LocationPuck,
  MapView,
  MarkerView,
  ShapeSource,
  StyleImport,
  UserTrackingMode,
} from '@rnmapbox/maps';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useDaytime } from '@/src/features/moment/useDaytime';
import { getGuideRoute, MAPBOX_TOKEN } from '@/src/lib/mapbox';
import { colors, palette } from '@/src/theme';
import { type GuideRoute, progressOn } from '@/shared/guide';
import type { LatLng } from '@/shared/types';

import { FIRST_PERSON } from './camera';

if (MAPBOX_TOKEN) void Mapbox.setAccessToken(MAPBOX_TOKEN);

interface Props {
  /** Position actuelle (GPS de l'app). */
  position: LatLng | null;
  /** Où marcher (arrêt de départ, arrêt suivant ou destination) ; null pendant un trajet en véhicule. */
  target: LatLng | null;
  style?: StyleProp<ViewStyle>;
  /** Place laissée en bas de la carte (panneau par-dessus). */
  bottomPadding?: number;
}

const REFETCH_MS = 15_000;

/**
 * Carte Mapbox en vue « première personne » qui suit l'utilisateur, avec le chemin à
 * pied (Mapbox) jusqu'à la prochaine étape. Aucune donnée Google n'y est dessinée.
 */
export function FollowMap({ position, target, style, bottomPadding = 0 }: Props) {
  const day = useDaytime();
  const [route, setRoute] = useState<GuideRoute | null>(null);
  const lastFetch = useRef<{ at: number; key: string }>({ at: 0, key: '' });

  const targetKey = target ? `${target.lat.toFixed(5)},${target.lng.toFixed(5)}` : '';

  // Chemin à pied : recalculé quand la cible change, ou si l'on s'écarte du tracé.
  useEffect(() => {
    if (!target || !position) {
      if (!target) setRoute(null);
      return;
    }
    const now = Date.now();
    const sameTarget = lastFetch.current.key === targetKey;
    const offRoute = route ? progressOn(route, position).offset > 40 : true;
    if (sameTarget && (!offRoute || now - lastFetch.current.at < REFETCH_MS)) return;
    lastFetch.current = { at: now, key: targetKey };
    const controller = new AbortController();
    getGuideRoute(position, target, 'walk', controller.signal)
      .then(setRoute)
      .catch(() => {});
    return () => controller.abort();
    // `route` volontairement absent : on ne relance pas à chaque nouveau tracé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, position?.lat, position?.lng]);

  const line = useMemo(
    () =>
      route
        ? {
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates: route.coords.map((c) => [c.lng, c.lat]) },
          }
        : null,
    [route],
  );

  return (
    <MapView style={style} styleURL="mapbox://styles/mapbox/standard" scaleBarEnabled={false} compassEnabled={false}>
      <StyleImport
        id="basemap"
        existing
        config={{ lightPreset: day ? 'day' : 'night', show3dObjects: true, showPointOfInterestLabels: false }}
      />
      <Camera
        followUserLocation
        followUserMode={UserTrackingMode.FollowWithHeading}
        followZoomLevel={FIRST_PERSON.zoom}
        followPitch={FIRST_PERSON.pitch}
        followPadding={{ paddingBottom: bottomPadding }}
        defaultSettings={
          position ? { centerCoordinate: [position.lng, position.lat], zoomLevel: FIRST_PERSON.zoom } : undefined
        }
      />
      <LocationPuck puckBearing="heading" puckBearingEnabled pulsing={{ isEnabled: true, color: palette.brick }} />
      {line && (
        <ShapeSource id="walk" shape={line}>
          <LineLayer
            id="walk-casing"
            style={{ lineColor: '#7E2A17', lineWidth: 11, lineCap: 'round', lineJoin: 'round', lineEmissiveStrength: 1 }}
          />
          <LineLayer
            id="walk-line"
            aboveLayerID="walk-casing"
            style={{ lineColor: palette.brickGlow, lineWidth: 6, lineCap: 'round', lineJoin: 'round', lineEmissiveStrength: 1 }}
          />
        </ShapeSource>
      )}
      {route && (
        <MarkerView coordinate={[route.coords[route.coords.length - 1]!.lng, route.coords[route.coords.length - 1]!.lat]} allowOverlap>
          <View style={styles.pin}>
            <Ionicons name="flag" size={16} color={colors.accentText} />
          </View>
        </MarkerView>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.brick,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
