import { describe, expect, it } from 'vitest';

import { insideLilleOutline, isInLille } from '@/shared/lille';

describe('Lille intramuros', () => {
  it('reconnaît les codes postaux de Lille', () => {
    const near = { lat: 50.6366, lng: 3.0635 };
    expect(isInLille({ location: near, address: '12 Rue de Pas, 59000 Lille, France' })).toBe(true);
    expect(isInLille({ location: near, address: '158 Rue du Molinel, 59800 Lille' })).toBe(true);
    expect(isInLille({ location: near, address: 'Av. Willy Brandt 59777 Euralille' })).toBe(true);
    expect(isInLille({ location: near, address: '2 Rue de Lille, 59100 Roubaix, France' })).toBe(false);
    expect(isInLille({ location: near, address: 'Rue Pierre Mauroy, 59160 Lomme' })).toBe(false);
    expect(isInLille({ location: near, postalCode: '59110', address: 'La Madeleine' })).toBe(false);
  });

  it('utilise la ville, sinon le contour de la commune', () => {
    expect(isInLille({ location: { lat: 0, lng: 0 }, city: 'LILLE' })).toBe(true);
    expect(isInLille({ location: { lat: 0, lng: 0 }, city: 'Villeneuve-d’Ascq' })).toBe(false);
    // Sans code postal ni ville : la position.
    expect(isInLille({ location: { lat: 50.6366, lng: 3.0635 }, address: 'Grand-Place' })).toBe(true);
  });

  it('contour : Lille dedans, les villes voisines dehors', () => {
    const inside = [
      [50.6366, 3.0635], // Grand-Place
      [50.6373, 3.0744], // Euralille
      [50.6327, 3.0784], // Zénith
      [50.6407, 3.0455], // Citadelle
      [50.6265, 3.05], // Wazemmes
      [50.6338, 3.0942], // Fives
    ];
    const outside = [
      [50.6566, 3.0716], // La Madeleine
      [50.6436, 3.0125], // Lomme
      [50.6265, 3.108], // Hellemmes
      [50.6378, 3.1546], // Villeneuve-d'Ascq (LaM)
      [50.6897, 3.1658], // Roubaix
      [50.592, 3.067], // Faches-Thumesnil
    ];
    for (const [lat, lng] of inside) expect(insideLilleOutline({ lat: lat!, lng: lng! })).toBe(true);
    for (const [lat, lng] of outside) expect(insideLilleOutline({ lat: lat!, lng: lng! })).toBe(false);
  });
});
