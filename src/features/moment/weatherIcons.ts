import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { tx } from '@/shared/i18n';
import type { Weather } from '@/shared/types';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function weatherIcon(w: Weather): IconName {
  switch (w.condition) {
    case 'clear':
      return w.isDay ? 'sunny' : 'moon';
    case 'cloudy':
      return w.isDay ? 'partly-sunny' : 'cloudy-night';
    case 'fog':
      return 'cloudy';
    case 'rain':
      return 'rainy';
    case 'snow':
      return 'snow';
    case 'storm':
      return 'thunderstorm';
  }
}

export const WEATHER_LABELS: Record<Weather['condition'], string> = {
  clear: tx('ciel dégagé'),
  cloudy: tx('nuageux'),
  fog: tx('brouillard'),
  rain: tx('pluie'),
  snow: tx('neige'),
  storm: tx('orage'),
};
