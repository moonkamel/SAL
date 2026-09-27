import {
  MapColorScheme,
  MapView,
  type MapViewController,
} from '@googlemaps/react-native-navigation-sdk';
import { useCallback, useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

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
  /** N'activer que si la permission de localisation est accordée (sinon plantage Android). */
  showUserLocation?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Zoom qui laisse voir toutes les épingles autour du centre (approximation suffisante en ville). */
export function zoomToFit(center: LatLng, pins: MapPin[]): number {
  const farthest = Math.max(200, ...pins.map((p) => haversineMeters(center, p.position)));
  return Math.min(16, Math.max(11, 15.5 - Math.log2(farthest / 300)));
}

/**
 * Carte Google fournie par le Navigation SDK. On n'utilise pas react-native-maps :
 * les deux embarquent le Maps SDK et ne peuvent pas cohabiter dans la même app.
 */
export function PlacesMap({
  center,
  pins,
  onPinPress,
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
    controller.moveCamera({ target: center, zoom: zoomToFit(center, pins) });
  }, [controller, ready, pins, center]);

  const onMarkerClick = useCallback(
    (marker: { id: string }) => onPinPress?.(marker.id),
    [onPinPress],
  );

  return (
    <MapView
      style={style}
      initialCameraPosition={{ target: center, zoom: zoomToFit(center, pins) }}
      mapColorScheme={MapColorScheme.DARK}
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
