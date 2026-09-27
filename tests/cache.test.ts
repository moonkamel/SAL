import { describe, expect, it } from 'vitest';

import { TtlCache } from '@/server/cache';

describe('TtlCache', () => {
  it('expire les entrées après le TTL', () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, 10, () => now);
    cache.set('a', 'x');
    now = 999;
    expect(cache.get('a')).toBe('x');
    now = 1000;
    expect(cache.get('a')).toBeUndefined();
  });

  it('évince la plus ancienne entrée au-delà de la taille maximale', () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });
});
