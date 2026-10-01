import { describe, expect, it } from 'vitest';

import {
  ALLERGEN_IDS,
  buildPublicMenu,
  decodeMenu,
  demoState,
  detectAllergens,
  dishAllergens,
  encodeMenu,
  fromMask,
  ingredientFromOffProduct,
  isValidBarcode,
  sanitizeState,
  toMask,
  type AllergenId,
  type Ingredient,
} from '../allergenes/js/core.js';

const contains = (text: string) => detectAllergens(text).contains;

describe('les 14 allergènes', () => {
  it('suivent l’ordre de l’annexe II, base des liens publics', () => {
    expect(ALLERGEN_IDS).toEqual([
      'gluten', 'crustaces', 'oeufs', 'poissons', 'arachides', 'soja', 'lait',
      'fruits_coque', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques',
    ]);
  });
});

describe('detectAllergens', () => {
  it('reconnaît les ingrédients courants, avec ou sans accents', () => {
    expect(contains('Farine de blé T55')).toEqual(['gluten']);
    expect(contains('Crème fraîche épaisse')).toEqual(['lait']);
    expect(contains('Œufs plein air')).toEqual(['oeufs']);
    expect(contains('Crevettes grises')).toEqual(['crustaces']);
    expect(contains('Moules de bouchot')).toEqual(['mollusques']);
    expect(contains('Céleri-rave')).toEqual(['celeri']);
    expect(contains('Vin blanc sec')).toEqual(['sulfites']);
    expect(contains('Tahini')).toEqual(['sesame']);
    expect(contains('Maroilles AOP')).toEqual(['lait']);
    expect(contains('Mayonnaise')).toEqual(['oeufs', 'moutarde']);
  });

  it('évite les faux amis', () => {
    expect(contains('Lait de coco')).toEqual([]);
    expect(contains('Noix de coco râpée')).toEqual([]);
    expect(contains('Noix de Saint-Jacques')).toEqual(['mollusques']);
    expect(contains('Farine de riz')).toEqual([]);
    expect(contains('Beurre de cacahuète')).toEqual(['arachides']);
    expect(contains('Sucre glace')).toEqual([]);
    expect(contains('Galette de blé noir')).toEqual([]);
    expect(contains('Germes de soja')).toEqual([]);
    expect(contains('Œuf à la coque')).toEqual(['oeufs']);
  });

  it('sépare « contient » et « peut contenir des traces »', () => {
    const result = detectAllergens(
      'Sucre, beurre de cacao, LAIT entier en poudre. Peut contenir des traces de noisettes et de soja.',
    );
    expect(result.contains).toEqual(['lait']);
    expect(result.traces).toEqual(['soja', 'fruits_coque']);
  });
});

describe('isValidBarcode', () => {
  it('vérifie la clé de contrôle EAN', () => {
    expect(isValidBarcode('3017620422003')).toBe(true); // EAN-13
    expect(isValidBarcode('3017620422004')).toBe(false);
    expect(isValidBarcode('96385074')).toBe(true); // EAN-8
    expect(isValidBarcode('036000291452')).toBe(true); // UPC-A
    expect(isValidBarcode('abc')).toBe(false);
  });
});

describe('ingredientFromOffProduct', () => {
  it('combine les étiquettes Open Food Facts et la liste d’ingrédients', () => {
    const ing = ingredientFromOffProduct(
      {
        product_name_fr: 'Pâte à tartiner',
        brands: 'Marque, Autre',
        allergens_tags: ['en:milk', 'en:nuts'],
        traces_tags: ['en:gluten', 'en:milk'],
        ingredients_text_fr: 'sucre, huile de palme, noisettes 13 %, lait écrémé en poudre, lécithine de soja',
      },
      '3017620422003',
    );
    expect(ing.name).toBe('Pâte à tartiner');
    expect(ing.brand).toBe('Marque');
    expect(ing.allergens).toEqual(['soja', 'lait', 'fruits_coque']);
    expect(ing.traces).toEqual(['gluten']);
    expect(ing.source).toBe('openfoodfacts');
  });
});

describe('plats et carte publique', () => {
  it('additionne les allergènes des ingrédients sans doublon contient/traces', () => {
    const ing = (id: string, allergens: AllergenId[], traces: AllergenId[]): [string, Ingredient] => [
      id,
      { id, name: id, brand: '', barcode: '', allergens, traces, ingredientsText: '', image: '', source: 'manuel' },
    ];
    const ingredients = new Map([ing('a', ['gluten'], ['sesame']), ing('b', ['sesame'], [])]);
    const result = dishAllergens({ ingredientIds: ['a', 'b'], extraAllergens: ['lait'], extraTraces: [] }, ingredients);
    expect(result).toEqual({ contains: ['gluten', 'lait', 'sesame'], traces: [] });
  });

  it('convertit masques et identifiants', () => {
    expect(fromMask(toMask(['mollusques', 'gluten', 'lait']))).toEqual(['gluten', 'lait', 'mollusques']);
  });

  it('encode toute la carte dans un lien court et la relit à l’identique', async () => {
    const state = demoState();
    const menu = buildPublicMenu(state, new Date('2026-10-01T12:00:00Z'));
    const encoded = await encodeMenu(menu);
    expect(encoded).toMatch(/^z[A-Za-z0-9_-]+$/);
    expect(encoded.length).toBeLessThan(1200);

    const decoded = await decodeMenu('#' + encoded);
    expect(decoded.name).toBe('Brasserie du Beffroi');
    expect(decoded.updated).toBe('2026-10-01');
    const welsh = decoded.dishes.find((d) => d.name === 'Welsh traditionnel');
    expect(welsh?.category).toBe('Plats');
    expect(welsh?.contains).toEqual(['gluten', 'oeufs', 'lait', 'moutarde', 'sulfites']);
    const moules = decoded.dishes.find((d) => d.name === 'Moules marinières');
    expect(moules?.contains).toEqual(['oeufs', 'lait', 'celeri', 'moutarde', 'sulfites', 'mollusques']);
  });

  it('rejette un lien abîmé', async () => {
    await expect(decodeMenu('xabc')).rejects.toThrow();
  });
});

describe('sanitizeState', () => {
  it('nettoie une sauvegarde importée', () => {
    const state = sanitizeState({
      restaurant: { name: 'Chez Momo' },
      ingredients: [{ id: '1', name: 'Pain', allergens: ['gluten', 'inconnu', 'gluten'] }, { name: 'sans id' }],
      dishes: [{ id: 'd', name: 'Tartine', ingredientIds: ['1'] }],
    });
    expect(state.restaurant).toEqual({ name: 'Chez Momo', info: '' });
    expect(state.ingredients).toHaveLength(1);
    expect(state.ingredients[0]?.allergens).toEqual(['gluten']);
    expect(state.dishes[0]?.extraAllergens).toEqual([]);
    expect(sanitizeState(null).dishes).toEqual([]);
  });
});
