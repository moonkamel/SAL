import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

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
  clear: 'ciel dégagé',
  cloudy: 'nuageux',
  fog: 'brouillard',
  rain: 'pluie',
  snow: 'neige',
  storm: 'orage',
};
