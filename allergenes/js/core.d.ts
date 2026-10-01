// Types de allergenes/js/core.js (module JavaScript sans build, servi tel quel au navigateur).

export type AllergenId =
  | 'gluten' | 'crustaces' | 'oeufs' | 'poissons' | 'arachides' | 'soja' | 'lait'
  | 'fruits_coque' | 'celeri' | 'moutarde' | 'sesame' | 'sulfites' | 'lupin' | 'mollusques';

export interface Allergen { id: AllergenId; icon: string; off: string[] }
export type Lang = 'fr' | 'en' | 'nl';

export interface Ingredient {
  id: string;
  name: string;
  brand: string;
  barcode: string;
  allergens: AllergenId[];
  traces: AllergenId[];
  ingredientsText: string;
  image: string;
  source: string;
}

export interface Dish {
  id: string;
  name: string;
  category: string;
  ingredientIds: string[];
  extraAllergens: AllergenId[];
  extraTraces: AllergenId[];
  checked: boolean;
}

export interface State {
  version: 1;
  restaurant: { name: string; info: string };
  ingredients: Ingredient[];
  dishes: Dish[];
  settings: { publicBase: string };
}

export interface Detection { contains: AllergenId[]; traces: AllergenId[] }

export interface CompactMenu {
  v: 1;
  n: string;
  i: string;
  u: string;
  c: string[];
  d: [string, number, number, number][];
}

export interface PublicMenu {
  name: string;
  info: string;
  updated: string;
  categories: string[];
  dishes: { name: string; category: string; contains: AllergenId[]; traces: AllergenId[] }[];
}

export const ALLERGENS: Allergen[];
export const ALLERGEN_IDS: AllergenId[];
export const LABELS: Record<Lang, Record<AllergenId, [string, string]>>;
export const OFF_FIELDS: string[];
export function allergenLabel(id: AllergenId, lang?: Lang, long?: boolean): string;
export function normalize(text: unknown): string;
export function detectAllergens(text: string): Detection;
export function sortIds(ids: Iterable<string>): AllergenId[];
export function isValidBarcode(code: unknown): boolean;
export function offProductUrl(barcode: string): string;
export function ingredientFromOffProduct(
  product: Record<string, unknown> | null | undefined,
  barcode: string,
): Omit<Ingredient, 'id'>;
export function dishAllergens(dish: Partial<Dish>, ingredientsById: Map<string, Ingredient>): Detection;
export function toMask(ids: Iterable<string>): number;
export function fromMask(mask: number): AllergenId[];
export function buildPublicMenu(state: State, today?: Date): CompactMenu;
export function expandPublicMenu(menu: unknown): PublicMenu;
export function encodeMenu(menu: CompactMenu): Promise<string>;
export function decodeMenu(encoded: string): Promise<PublicMenu>;
export function emptyState(): State;
export function sanitizeState(raw: unknown): State;
export function uid(): string;
export function demoState(): State;

export interface ParsedDish { name: string; category: string; ingredients: string[]; preset: boolean }
export interface Preset { key: string; category: string; ingredients: string[] }
export function splitIngredients(text: string): string[];
export function parseMenuText(text: string, defaultCategory?: string): ParsedDish[];
export function findPreset(dishName: string): Preset | null;
export function findOrCreateIngredient(state: State, name: string): Ingredient;
export function addDish(state: State, dish: { name: string; category?: string; ingredients?: string[] }): Dish;
