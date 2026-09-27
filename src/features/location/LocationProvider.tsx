import * as Location from 'expo-location';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { GRAND_PLACE } from '@/shared/geo';
import type { LatLng } from '@/shared/types';

export type LocationStatus = 'pending' | 'granted' | 'denied';

interface LocationState {
  /** Position de l'utilisateur, ou la Grand-Place si indisponible. */
  coords: LatLng;
  status: LocationStatus;
  /** Vrai si `coords` est la position par défaut (Grand-Place). */
  isFallback: boolean;
  /** Redemande la permission, ou ouvre les réglages si elle a été refusée définitivement. */
  requestPermission: () => Promise<void>;
  /** Rafraîchit la position (avant une recherche). */
  refresh: () => Promise<LatLng>;
}

const LocationContext = createContext<LocationState | null>(null);

async function readPosition(): Promise<LatLng | null> {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    const pos =
      last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [coords, setCoords] = useState<LatLng>(GRAND_PLACE);
  const [status, setStatus] = useState<LocationStatus>('pending');
  const [isFallback, setIsFallback] = useState(true);

  const refresh = useCallback(async (): Promise<LatLng> => {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) {
      setStatus(perm.status === Location.PermissionStatus.UNDETERMINED ? 'pending' : 'denied');
      setIsFallback(true);
      setCoords(GRAND_PLACE);
      return GRAND_PLACE;
    }
    setStatus('granted');
    const pos = await readPosition();
    if (pos) {
      setCoords(pos);
      setIsFallback(false);
      return pos;
    }
    setIsFallback(true);
    return GRAND_PLACE;
  }, []);

  const requestPermission = useCallback(async () => {
    const current = await Location.getForegroundPermissionsAsync();
    if (!current.granted && !current.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    const result = await Location.requestForegroundPermissionsAsync();
    setStatus(result.granted ? 'granted' : 'denied');
    if (result.granted) await refresh();
  }, [refresh]);

  // Au démarrage : demande la permission (le texte d'explication est dans app.config.ts).
  useEffect(() => {
    (async () => {
      const current = await Location.getForegroundPermissionsAsync();
      if (!current.granted && current.canAskAgain) {
        const result = await Location.requestForegroundPermissionsAsync();
        if (!result.granted) {
          setStatus('denied');
          return;
        }
      }
      await refresh();
    })();
  }, [refresh]);

  // Retour depuis les réglages : la permission a peut-être changé.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return (
    <LocationContext.Provider value={{ coords, status, isFallback, requestPermission, refresh }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useUserLocation(): LocationState {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useUserLocation doit être utilisé dans <LocationProvider>');
  return ctx;
}
