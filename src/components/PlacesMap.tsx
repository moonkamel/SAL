import {
  MapColorScheme,
  MapView,
  type MapViewController,
} from '@googlemaps/react-native-navigation-sdk';
import { useCallback, useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { lilleNightMapStyle } from '@/src/theme/mapStyle';
import { haversineMeters } from '@/shared/geo';
import type { LatLng } from '@/shared/types';
import { useColors, useTone } from '@/src/theme/tone';

export interface MapPin {
  id: string;
  position: LatLng;
  title: string;
  snippet?: string;
}

/** Tracé coloré supplémentaire (ex. tronçons d'un trajet en transports). */
export interface MapLine {
  id: string;
  points: LatLng[];
  color: string;
  width?: number;
}

/** Point rond (ex. arrêt de bus ou de métro). */
export interface MapDot {
  id: string;
  center: LatLng;
  color: string;
}

export interface PlacesMapProps {
  center: LatLng;
  pins: MapPin[];
  onPinPress?: (id: string) => void;
  /** Tracé d'itinéraire à dessiner ; la caméra le cadre entièrement. */
  route?: LatLng[];
  /** Tracés colorés ; la caméra les cadre tous. */
  lines?: MapLine[];
  dots?: MapDot[];
  /** Change de valeur pour recentrer la caméra (ex. étape suivante). */
  focus?: LatLng[];
  /**
   * Vue « au niveau de la rue » : la caméra suit ce point, inclinée et orientée
   * dans le sens de la marche (cap en degrés). Prioritaire sur le cadrage.
   */
  follow?: { position: LatLng; heading?: number } | null;
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
  lines,
  dots,
  focus,
  follow,
  showUserLocation = false,
  interactive = true,
  style,
}: PlacesMapProps) {
  const colors = useColors();
  const day = useTone().tone === 'day';
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
    for (const line of lines ?? []) {
      if (line.points.length < 2) continue;
      void controller.addPolyline({
        id: line.id,
        points: line.points,
        color: line.color,
        width: line.width ?? 12,
      });
    }
    for (const dot of dots ?? []) {
      void controller.addCircle({
        id: dot.id,
        center: dot.center,
        radius: 14,
        strokeWidth: 4,
        strokeColor: dot.color,
        fillColor: '#FFFFFF',
      });
    }
  }, [controller, ready, pins, route, lines, dots]);

  // Caméra séparée des tracés : suivre la position ne redessine pas toute la carte.
  const followLat = follow?.position.lat;
  const followLng = follow?.position.lng;
  const heading = follow?.heading;
  useEffect(() => {
    if (!controller || !ready) return;
    if (followLat !== undefined && followLng !== undefined) {
      controller.moveCamera({
        target: { lat: followLat, lng: followLng },
        zoom: 18,
        tilt: 55,
        bearing: heading ?? 0,
      });
      return;
    }
    const all = focus?.length ? focus : [...(route ?? []), ...(lines ?? []).flatMap((l) => l.points)];
    controller.moveCamera(camera(center, pins, all.length > 1 ? all : undefined));
  }, [controller, ready, followLat, followLng, heading, focus, route, lines, center, pins]);

  const onMarkerClick = useCallback(
    (marker: { id: string }) => onPinPress?.(marker.id),
    [onPinPress],
  );

  return (
    <MapView
      style={style}
      initialCameraPosition={camera(center, pins, route)}
      // Le jour, la carte Google claire habituelle ; la nuit, le style « Lille la nuit ».
      mapColorScheme={day ? MapColorScheme.LIGHT : MapColorScheme.DARK}
      mapStyle={day ? undefined : lilleNightMapStyle}
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
