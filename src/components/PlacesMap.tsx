import {
  MapColorScheme,
  MapView,
  type MapViewController,
} from '@googlemaps/react-native-navigation-sdk';
import { useCallback, useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/src/theme';
import { lilleNightMapStyle } from '@/src/theme/mapStyle';
import { haversineMeters } from '@/shared/geo';
import type { LatLng } from '@/shared/types';

export interface MapPin {
  id: string;
  position: LatLng;
  title: string;
  snippet?: string;
}

export interface PlacesMapProps {
  center: LatLng;
  pins: MapPin[];
  onPinPress?: (id: string) => void;
  /** Tracé d'itinéraire à dessiner ; la caméra le cadre entièrement. */
  route?: LatLng[];
  /** N'activer que si la permission de localisation est accordée (sinon plantage Android). */
  showUserLocation?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Zoom qui laisse voir tous les points autour du centre (approximation suffisante en ville). */
export function zoomToFit(center: LatLng, points: LatLng[]): number {
  const farthest = Math.max(200, ...points.map((p) => haversineMeters(center, p)));
  return Math.min(16, Math.max(11, 15.5 - Math.log2(farthest / 300)));
}

/** Centre du rectangle englobant un tracé. */
export function boundsCenter(points: LatLng[]): LatLng {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
}

function camera(center: LatLng, pins: MapPin[], route?: LatLng[]) {
  if (route && route.length > 1) {
    const target = boundsCenter(route);
    // Un demi-cran de marge pour que le tracé ne touche pas les bords.
    return { target, zoom: zoomToFit(target, route) - 0.5 };
  }
  return { target: center, zoom: zoomToFit(center, pins.map((p) => p.position)) };
}

/**
 * Carte Google fournie par le Navigation SDK. On n'utilise pas react-native-maps :
 * les deux embarquent le Maps SDK et ne peuvent pas cohabiter dans la même app.
 */
export function PlacesMap({
  center,
  pins,
  onPinPress,
  route,
  showUserLocation = false,
  interactive = true,
  style,
}: PlacesMapProps) {
  const [controller, setController] = useState<MapViewController | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!controller || !ready) return;
    controller.clearMapView();
    for (const pin of pins) {
      void controller.addMarker({
        id: pin.id,
        position: pin.position,
        title: pin.title,
        snippet: pin.snippet,
      });
    }
    if (route && route.length > 1) {
      void controller.addPolyline({
        id: 'route',
        points: route,
        color: colors.accent,
        width: 12,
      });
    }
    controller.moveCamera(camera(center, pins, route));
  }, [controller, ready, pins, center, route]);

  const onMarkerClick = useCallback(
    (marker: { id: string }) => onPinPress?.(marker.id),
    [onPinPress],
  );

  return (
    <MapView
      style={style}
      initialCameraPosition={camera(center, pins, route)}
      mapColorScheme={MapColorScheme.DARK}
      mapStyle={lilleNightMapStyle}
      myLocationEnabled={showUserLocation}
      myLocationButtonEnabled={showUserLocation && interactive}
      mapToolbarEnabled={false}
      compassEnabled={interactive}
      scrollGesturesEnabled={interactive}
      zoomGesturesEnabled={interactive}
      rotateGesturesEnabled={interactive}
      tiltGesturesEnabled={interactive}
      onMapViewControllerCreated={setController}
      onMapReady={() => setReady(true)}
      onMarkerClick={onMarkerClick}
    />
  );
}
