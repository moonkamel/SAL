import { findPreset } from './presets.js';

// Logique métier du générateur de tableau des allergènes.
// Aucun accès au DOM ici : ce module est partagé par l'outil du chef,
// la carte publique (QR code) et les tests unitaires.

/**
 * Les 14 allergènes de l'annexe II du règlement (UE) n° 1169/2011, dans l'ordre
 * officiel. L'ordre sert aussi d'index de bit dans les liens de carte publique :
 * ne jamais le modifier.
 */
export const ALLERGENS = [
  { id: 'gluten', icon: '🌾', off: ['en:gluten'] },
  { id: 'crustaces', icon: '🦐', off: ['en:crustaceans'] },
  { id: 'oeufs', icon: '🥚', off: ['en:eggs'] },
  { id: 'poissons', icon: '🐟', off: ['en:fish'] },
  { id: 'arachides', icon: '🥜', off: ['en:peanuts'] },
  { id: 'soja', icon: '🌱', off: ['en:soybeans'] },
  { id: 'lait', icon: '🥛', off: ['en:milk'] },
  { id: 'fruits_coque', icon: '🌰', off: ['en:nuts'] },
  { id: 'celeri', icon: '🥬', off: ['en:celery'] },
  { id: 'moutarde', icon: '🌭', off: ['en:mustard'] },
  { id: 'sesame', icon: '🥯', off: ['en:sesame-seeds'] },
  { id: 'sulfites', icon: '🍷', off: ['en:sulphur-dioxide-and-sulphites'] },
  { id: 'lupin', icon: '🌼', off: ['en:lupin'] },
  { id: 'mollusques', icon: '🦪', off: ['en:molluscs'] },
];

export const ALLERGEN_IDS = ALLERGENS.map((a) => a.id);

/** Libellés courts (tableau, pastilles) et longs (légende réglementaire). */
export const LABELS = {
  fr: {
    gluten: ['Gluten', 'Céréales contenant du gluten (blé, seigle, orge, avoine, épeautre, kamut)'],
    crustaces: ['Crustacés', 'Crustacés et produits à base de crustacés'],
    oeufs: ['Œufs', 'Œufs et produits à base d’œufs'],
    poissons: ['Poissons', 'Poissons et produits à base de poissons'],
    arachides: ['Arachides', 'Arachides (cacahuètes) et produits à base d’arachides'],
    soja: ['Soja', 'Soja et produits à base de soja'],
    lait: ['Lait', 'Lait et produits à base de lait (y compris le lactose)'],
    fruits_coque: ['Fruits à coque', 'Fruits à coque (amandes, noisettes, noix, cajou, pécan, pistaches, macadamia, noix du Brésil)'],
    celeri: ['Céleri', 'Céleri et produits à base de céleri'],
    moutarde: ['Moutarde', 'Moutarde et produits à base de moutarde'],
    sesame: ['Sésame', 'Graines de sésame et produits à base de graines de sésame'],
    sulfites: ['Sulfites', 'Anhydride sulfureux et sulfites (> 10 mg/kg ou 10 mg/l)'],
    lupin: ['Lupin', 'Lupin et produits à base de lupin'],
    mollusques: ['Mollusques', 'Mollusques et produits à base de mollusques'],
  },
  en: {
    gluten: ['Gluten', 'Cereals containing gluten'],
    crustaces: ['Crustaceans', 'Crustaceans'],
    oeufs: ['Eggs', 'Eggs'],
    poissons: ['Fish', 'Fish'],
    arachides: ['Peanuts', 'Peanuts'],
    soja: ['Soy', 'Soybeans'],
    lait: ['Milk', 'Milk (including lactose)'],
    fruits_coque: ['Tree nuts', 'Tree nuts'],
    celeri: ['Celery', 'Celery'],
    moutarde: ['Mustard', 'Mustard'],
    sesame: ['Sesame', 'Sesame seeds'],
    sulfites: ['Sulphites', 'Sulphur dioxide and sulphites'],
    lupin: ['Lupin', 'Lupin'],
    mollusques: ['Molluscs', 'Molluscs'],
  },
  nl: {
    gluten: ['Gluten', 'Glutenbevattende granen'],
    crustaces: ['Schaaldieren', 'Schaaldieren'],
    oeufs: ['Eieren', 'Eieren'],
    poissons: ['Vis', 'Vis'],
    arachides: ['Pinda’s', 'Pinda’s (aardnoten)'],
    soja: ['Soja', 'Soja'],
    lait: ['Melk', 'Melk (inclusief lactose)'],
    fruits_coque: ['Noten', 'Noten'],
    celeri: ['Selderij', 'Selderij'],
    moutarde: ['Mosterd', 'Mosterd'],
    sesame: ['Sesam', 'Sesamzaad'],
    sulfites: ['Sulfiet', 'Zwaveldioxide en sulfieten'],
    lupin: ['Lupine', 'Lupine'],
    mollusques: ['Weekdieren', 'Weekdieren'],
  },
};

export function allergenLabel(id, lang = 'fr', long = false) {
  const entry = (LABELS[lang] ?? LABELS.fr)[id];
  return entry ? entry[long ? 1 : 0] : id;
}

/** Minuscules, sans accents, ligatures dépliées, apostrophes unifiées. */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Dictionnaire français des ingrédients qui apportent un allergène.
// `exclude` retire d'abord les expressions trompeuses (« lait de coco »,
// « noix de Saint-Jacques »…) avant de chercher les mots de `include`.
// Les motifs portent sur du texte normalisé (sans accents, minuscules).
const RULES = {
  gluten: {
    include: [
      /\bbles?\b/, /froment/, /seigle/, /\borges?\b/, /avoine/, /epeautre/, /kamut/, /triticale/,
      /\bfarines?\b/, /\bpains?\b/, /chapelure/, /panko/, /\bpates?\b/, /semoule/, /boulgour/,
      /couscous/, /biscuit/, /brioche/, /croissant/, /viennoiserie/, /\bgaufres?\b/, /\bcrepes?\b/,
      /speculoos/, /pain d'epices?/, /croutons?/, /gnocchi/, /ravioli/, /lasagne/, /nouilles/,
      /spaghetti/, /tagliatelle/, /penne/, /macaroni/, /seitan/, /\bmalt/, /\bbieres?\b/,
      /sauce soja/, /shoyu/, /\bgluten\b/, /tarte/, /quiche/, /feuillete/, /pizza/, /\bblinis?\b/,
      /\bwraps?\b/, /tortilla de ble/, /cramique/, /craquelin/, /merveilleux/, /gaufrette/,
    ],
    exclude: [
      /farines? de (riz|mais|sarrasin|chataigne|pois chiches?|lentilles?|coco|amande|noisette|teff|manioc|quinoa|lupin)/,
      /semoule de mais/, /nouilles de riz/, /pates? (d'amandes?|de fruits?|a tartiner|de curry|d'arachide)/, /sans gluten/,
      /ble noir/, /pain de (mie )?sans gluten/,
    ],
  },
  crustaces: {
    include: [
      /crevettes?/, /gambas/, /homards?/, /langoustes?/, /langoustines?/, /crabes?/, /ecrevisses?/,
      /tourteaux?/, /araignee de mer/, /etrilles?/, /bisque/, /crustaces?/, /scampi/, /krill/,
    ],
    exclude: [],
  },
  oeufs: {
    include: [
      /\boeufs?\b/, /mayonnaise/, /aioli/, /meringue/, /brioche/, /hollandaise/, /bearnaise/,
      /creme anglaise/, /creme patissiere/, /\bflan\b/, /quiche/, /\bcrepes?\b/, /\bgaufres?\b/,
      /omelette/, /albumine/, /lysozyme/, /nouilles aux oeufs/, /pates? fraiches?/, /macarons?/,
      /tiramisu/, /merveilleux/, /cramique/, /\bblinis?\b/, /surimi/, /mousse au chocolat/,
    ],
    exclude: [/oeufs? de (poisson|lump|saumon|truite|cabillaud)/, /sans oeufs?/],
  },
  poissons: {
    include: [
      /poissons?/, /saumon/, /\bthon/, /cabillaud/, /morue/, /merlu/, /colin/, /lieu (noir|jaune)/,
      /\bbar\b/, /\bloup\b/, /daurade/, /dorade/, /\bsoles?\b/, /turbot/, /maquereau/, /sardine/,
      /hareng/, /anchois/, /truite/, /eglefin/, /haddock/, /\braies?\b/, /lotte/, /rouget/,
      /fletan/, /espadon/, /surimi/, /worcestershire/, /nuoc[- ]?mam/, /sauce poisson/, /caviar/,
      /oeufs? de (poisson|lump|saumon|truite|cabillaud)/, /tarama/, /bouillabaisse/, /fumet/,
      /sprat/, /merlan/, /carrelet/, /plie/, /sandre/, /brochet/, /tilapia/, /pangasius/, /gelatine de poisson/,
    ],
    exclude: [],
  },
  arachides: {
    include: [/arachides?/, /cacahuetes?/, /cacahouetes?/, /beurre de cacahuetes?/, /peanut/],
    exclude: [],
  },
  soja: {
    include: [/\bsoja\b/, /\bsoya\b/, /tofu/, /tempeh/, /edamame/, /\bmiso\b/, /tamari/, /shoyu/, /natto/],
    exclude: [/germes? de soja/, /pousses? de soja/],
  },
  lait: {
    include: [
      /\blaits?\b/, /\bbeurre/, /\bcremes?\b/, /fromages?/, /yaourts?/, /yogourts?/, /mozzarella/,
      /parmesan/, /comte\b/, /emmental/, /gruyere/, /cheddar/, /maroilles/, /mimolette/,
      /chevre/, /\bfeta\b/, /ricotta/, /mascarpone/, /burrata/, /camembert/, /\bbrie\b/,
      /roquefort/, /raclette/, /reblochon/, /beaufort/, /bechamel/, /lactose/, /lactoserum/,
      /caseine/, /\bghee\b/, /babeurre/, /chantilly/, /kefir/, /skyr/, /gorgonzola/, /bleu d'auvergne/,
      /vieux[- ]lille/, /\bwelsh\b/, /panna cotta/, /\bglaces?\b/, /tiramisu/, /merveilleux/,
      /chocolat au lait/, /chocolat blanc/, /brioche/, /croissant/, /halloumi/, /petit[- ]suisse/,
    ],
    exclude: [
      /laits? (de|d') ?(coco|amande|soja|avoine|riz|noisette|cajou|chanvre|epeautre)/,
      /cremes? (de|d') ?(coco|marrons?|soja|avoine|riz|amande|cassis|balsamique)/,
      /beurre (de|d') ?(cacahuetes?|cacao|karite|arachide|amande|cajou)/,
      /sans lactose/, /fromage vegan/, /glace pilee/, /glacons?/, /sucre glace/, /glace de viande/,
      /demi[- ]glace/,
    ],
  },
  fruits_coque: {
    include: [
      /amandes?/, /noisettes?/, /\bnoix\b/, /cajou/, /pecan/, /pistaches?/, /macadamia/,
      /noix du bresil/, /praline/, /pralin\b/, /frangipane/, /nougat/, /gianduja/, /nutella/,
      /massepain/, /pesto/, /orgeat/, /financier/, /macarons?/, /merveilleux/,
    ],
    exclude: [
      /noix de (coco|muscade|saint[- ]jacques|st[- ]jacques|veau|entrecote|beurre)/,
      /beurre noisette/, /pommes? noisettes?/, /noisette de (beurre|veau|agneau)/,
    ],
  },
  celeri: {
    include: [/celeri/, /sel de celeri/],
    exclude: [],
  },
  moutarde: {
    include: [/moutarde/, /mayonnaise/, /vinaigrette/, /\bwelsh\b/, /remoulade/, /carbonnade/],
    exclude: [],
  },
  sesame: {
    include: [/sesame/, /tahin/, /tahini/, /houmous/, /hummus/, /gomasio/, /halva/, /za'?atar/],
    exclude: [],
  },
  sulfites: {
    include: [
      /\bvins?\b/, /vinaigre/, /\bporto\b/, /madere/, /xeres/, /marsala/, /champagne/, /cidre/,
      /raisins? secs?/, /abricots? secs?/, /figues? seches?/, /fruits? secs?/, /sulfites?/,
      /bisulfite/, /metabisulfite/, /anhydride sulfureux/, /\be ?22[0-8]\b/, /vinaigrette/,
      /cornichons?/, /cognac/, /calvados/,
    ],
    exclude: [],
  },
  lupin: {
    include: [/lupin/],
    exclude: [],
  },
  mollusques: {
    include: [
      /\bmoules?\b/, /huitres?/, /saint[- ]jacques/, /st[- ]jacques/, /calamars?/, /encornets?/,
      /seiches?/, /poulpes?/, /pieuvres?/, /bulots?/, /bigorneaux?/, /palourdes?/, /\bcoques?\b/,
      /escargots?/, /ormeaux?/, /praires?/, /tellines?/, /couteaux de mer/, /sauce (d')?huitre/,
      /mollusques?/, /\bsupions?\b/, /chipirons?/, /vongole/,
    ],
    exclude: [/fruits? a coques?/, /a la coque/],
  },
};

// Une mention « peut contenir des traces de… » ne veut pas dire « contient ».
const TRACES_SPLIT = /(peut contenir|traces? (eventuelles? )?(de|d')|fabrique dans un atelier|produit dans un atelier|may contain)/;

function matchRules(normalizedText) {
  const found = new Set();
  if (!normalizedText) return found;
  for (const id of ALLERGEN_IDS) {
    const rule = RULES[id];
    let text = normalizedText;
    for (const ex of rule.exclude) text = text.replace(new RegExp(ex.source, 'g'), ' ');
    if (rule.include.some((re) => re.test(text))) found.add(id);
  }
  return found;
}

/**
 * Devine les allergènes d'un nom d'ingrédient ou d'une liste d'ingrédients.
 * Le chef valide toujours le résultat : c'est une suggestion, pas une vérité.
 * @returns {{ contains: string[], traces: string[] }}
 */
export function detectAllergens(text) {
  const normalized = normalize(text);
  const cut = normalized.search(TRACES_SPLIT);
  const main = cut >= 0 ? normalized.slice(0, cut) : normalized;
  const tail = cut >= 0 ? normalized.slice(cut) : '';
  const contains = matchRules(main);
  const traces = matchRules(tail);
  for (const id of contains) traces.delete(id);
  return { contains: sortIds(contains), traces: sortIds(traces) };
}

/** Trie des identifiants d'allergènes dans l'ordre réglementaire, sans doublon. */
export function sortIds(ids) {
  const set = new Set(ids);
  return ALLERGEN_IDS.filter((id) => set.has(id));
}

function idsFromOffTags(tags) {
  const set = new Set(Array.isArray(tags) ? tags : []);
  return ALLERGENS.filter((a) => a.off.some((t) => set.has(t))).map((a) => a.id);
}

/** Vérifie la clé de contrôle d'un code EAN-8, EAN-13, UPC-A (12) ou GTIN-14. */
export function isValidBarcode(code) {
  const digits = String(code ?? '').trim();
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits)) return false;
  const nums = digits.split('').map(Number);
  const check = nums.pop();
  let sum = 0;
  nums.reverse().forEach((n, i) => {
    sum += n * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

export const OFF_FIELDS = [
  'code', 'product_name', 'product_name_fr', 'generic_name_fr', 'brands', 'allergens_tags',
  'traces_tags', 'ingredients_text_fr', 'ingredients_text', 'image_front_small_url',
];

export function offProductUrl(barcode) {
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS.join(',')}`;
}

/**
 * Transforme une fiche Open Food Facts en ingrédient de la bibliothèque.
 * Combine les allergènes déclarés sur Open Food Facts et ceux détectés dans
 * la liste d'ingrédients (la base est contributive et parfois incomplète).
 */
export function ingredientFromOffProduct(product, barcode) {
  const p = product ?? {};
  const name = (p.product_name_fr || p.product_name || p.generic_name_fr || '').trim();
  const ingredientsText = (p.ingredients_text_fr || p.ingredients_text || '').trim();
  const fromText = detectAllergens(ingredientsText);
  const contains = sortIds([...idsFromOffTags(p.allergens_tags), ...fromText.contains]);
  const traces = sortIds([...idsFromOffTags(p.traces_tags), ...fromText.traces]).filter(
    (id) => !contains.includes(id),
  );
  return {
    name: name || `Produit ${barcode}`,
    brand: (p.brands || '').split(',')[0].trim(),
    barcode: String(barcode),
    allergens: contains,
    traces,
    ingredientsText,
    image: p.image_front_small_url || '',
    source: 'openfoodfacts',
  };
}

/** Allergènes d'un plat : union de ses ingrédients et des ajouts manuels. */
export function dishAllergens(dish, ingredientsById) {
  const contains = new Set(dish.extraAllergens ?? []);
  const traces = new Set(dish.extraTraces ?? []);
  for (const ingId of dish.ingredientIds ?? []) {
    const ing = ingredientsById.get(ingId);
    if (!ing) continue;
    for (const id of ing.allergens ?? []) contains.add(id);
    for (const id of ing.traces ?? []) traces.add(id);
  }
  for (const id of contains) traces.delete(id);
  return { contains: sortIds(contains), traces: sortIds(traces) };
}

export function toMask(ids) {
  let mask = 0;
  for (const id of ids) {
    const i = ALLERGEN_IDS.indexOf(id);
    if (i >= 0) mask |= 1 << i;
  }
  return mask;
}

export function fromMask(mask) {
  return ALLERGEN_IDS.filter((_, i) => (mask >> i) & 1);
}

// ---------------------------------------------------------------------------
// Carte publique : tout le menu tient dans le lien du QR code (après le #),
// donc aucun serveur n'est nécessaire et rien n'est envoyé à un tiers.

/** Version compacte du menu, prête à être encodée dans un lien. */
export function buildPublicMenu(state, today = new Date()) {
  const ingredientsById = new Map(state.ingredients.map((i) => [i.id, i]));
  const categories = [];
  const dishes = state.dishes.map((dish) => {
    const cat = (dish.category || '').trim() || 'Autres';
    if (!categories.includes(cat)) categories.push(cat);
    const { contains, traces } = dishAllergens(dish, ingredientsById);
    return [dish.name, categories.indexOf(cat), toMask(contains), toMask(traces)];
  });
  return {
    v: 1,
    n: state.restaurant?.name ?? '',
    i: state.restaurant?.info ?? '',
    u: today.toISOString().slice(0, 10),
    c: categories,
    d: dishes,
  };
}

/** Relit un menu compact et le développe en objets lisibles. */
export function expandPublicMenu(menu) {
  if (!menu || menu.v !== 1 || !Array.isArray(menu.d)) throw new Error('Carte illisible');
  const categories = Array.isArray(menu.c) ? menu.c.map(String) : [];
  return {
    name: String(menu.n ?? ''),
    info: String(menu.i ?? ''),
    updated: String(menu.u ?? ''),
    categories,
    dishes: menu.d.map(([name, cat, mask, traceMask]) => ({
      name: String(name),
      category: categories[cat] ?? 'Autres',
      contains: fromMask(Number(mask) || 0),
      traces: fromMask(Number(traceMask) || 0),
    })),
  };
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipeThrough(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/**
 * Encode le menu pour un lien : « z » + deflate + base64url, ou « j » + JSON
 * en base64url si le navigateur ne sait pas compresser.
 */
export async function encodeMenu(menu) {
  const bytes = new TextEncoder().encode(JSON.stringify(menu));
  if (typeof CompressionStream === 'function') {
    return 'z' + bytesToBase64Url(await pipeThrough(bytes, new CompressionStream('deflate-raw')));
  }
  return 'j' + bytesToBase64Url(bytes);
}

export async function decodeMenu(encoded) {
  const text = String(encoded ?? '').replace(/^#/, '');
  const kind = text[0];
  let bytes = base64UrlToBytes(text.slice(1));
  if (kind === 'z') bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('Carte illisible');
  return expandPublicMenu(JSON.parse(new TextDecoder().decode(bytes)));
}

// ---------------------------------------------------------------------------
// Données du chef

export function emptyState() {
  return {
    version: 1,
    restaurant: { name: '', info: '' },
    ingredients: [],
    dishes: [],
    settings: { publicBase: '' },
  };
}

/** Valide et complète des données importées (sauvegarde JSON, localStorage). */
export function sanitizeState(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const ids = (list) => sortIds(Array.isArray(list) ? list : []);
  return {
    version: 1,
    restaurant: {
      name: String(raw.restaurant?.name ?? ''),
      info: String(raw.restaurant?.info ?? ''),
    },
    ingredients: (Array.isArray(raw.ingredients) ? raw.ingredients : [])
      .filter((i) => i && i.id && i.name)
      .map((i) => ({
        id: String(i.id),
        name: String(i.name),
        brand: String(i.brand ?? ''),
        barcode: String(i.barcode ?? ''),
        allergens: ids(i.allergens),
        traces: ids(i.traces),
        ingredientsText: String(i.ingredientsText ?? ''),
        image: String(i.image ?? ''),
        source: String(i.source ?? 'manuel'),
      })),
    dishes: (Array.isArray(raw.dishes) ? raw.dishes : [])
      .filter((d) => d && d.id && d.name)
      .map((d) => ({
        id: String(d.id),
        name: String(d.name),
        category: String(d.category ?? ''),
        ingredientIds: (Array.isArray(d.ingredientIds) ? d.ingredientIds : []).map(String),
        extraAllergens: ids(d.extraAllergens),
        extraTraces: ids(d.extraTraces),
        checked: d.checked === true,
      })),
    settings: { publicBase: String(raw.settings?.publicBase ?? '') },
  };
}

// ---------------------------------------------------------------------------
// Saisie rapide : une ligne de texte ou une carte entière collée d'un coup

const CATEGORY_LINE =
  /^(les |nos )?(entrees?|plats?( principaux| du jour)?|desserts?|boissons?|fromages?|menus?( enfants?)?|accompagnements?|pizzas?|burgers?|salades?|starters?|mains?|aperitifs?|vins?|bieres?|planches?|a partager|suggestions?|formules?|grillades?|poissons?|viandes?|pates?|sandwichs?|tapas|desserts? maison|douceurs|specialites( du nord| regionales)?)\s*:?$/;
const PRICE = /\s*[-–—:|]?\s*(\d+([.,]\d{1,2})?\s*(€|eur|euros?)|€\s*\d+([.,]\d{1,2})?)\s*$/i;

function capitalize(text) {
  const t = text.trim();
  return t ? t[0].toLocaleUpperCase('fr') + t.slice(1) : t;
}

/** Découpe « crème, lardons et œufs » en ingrédients, sans couper les parenthèses. */
export function splitIngredients(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of String(text ?? '')) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ',' || ch === ';' || ch === '+' || ch === '/')) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts
    .flatMap((p) => (/\(/.test(p) ? [p] : p.split(/\s+et\s+|\s+&\s+/i)))
    .map((p) => capitalize(p.replace(/^[\s.·•\-–]+|[\s.]+$/g, '')))
    .filter((p) => p.length > 1);
}

/**
 * Lit une carte collée (une ligne par plat). Formats acceptés :
 *   « Entrées » (titre de catégorie), « Welsh - 14 € », « Carbonnade : bœuf, bière »,
 *   « Tarte au sucre (farine, cassonade, crème) ». Sans ingrédients, la recette type
 *   du plat est proposée quand elle existe.
 * @returns {{ name: string, category: string, ingredients: string[], preset: boolean }[]}
 */
export function parseMenuText(text, defaultCategory = 'Plats') {
  const dishes = [];
  let category = null;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    let line = raw.replace(/^[\s•*·\-–—>]+/, '').replace(/\t+/g, ' ').trim();
    line = line.replace(PRICE, '').trim();
    if (!line || /^[\d\s.,€]+$/.test(line)) continue;
    const n = normalize(line).replace(/[!.]+$/, '');
    const isHeading =
      CATEGORY_LINE.test(n) || (/:$/.test(line) && !line.slice(0, -1).includes(',')) || (line === line.toUpperCase() && /[A-Z]/.test(line) && line.length <= 30 && !line.includes(','));
    if (isHeading) {
      category = capitalize(line.replace(/:$/, '').toLocaleLowerCase('fr'));
      continue;
    }
    let name = line;
    let ingredientsText = '';
    const paren = line.match(/^([^(]+)\((.+)\)\s*$/);
    const sep = line.match(/^(.+?)\s*(?:\s:\s?|:\s|\s[-–—]\s|\s\|\s)(.+)$/);
    if (paren) [, name, ingredientsText] = paren;
    else if (sep) [, name, ingredientsText] = sep;
    name = capitalize(name.replace(/[:\-–—\s]+$/, ''));
    let ingredients = splitIngredients(ingredientsText);
    const preset = findPreset(name);
    const usePreset = !ingredients.length && !!preset;
    if (usePreset) ingredients = preset.ingredients;
    dishes.push({
      name,
      category: category ?? preset?.category ?? defaultCategory,
      ingredients,
      preset: usePreset,
    });
  }
  return dishes;
}

/** Retrouve un ingrédient par son nom, ou le crée avec ses allergènes devinés. */
export function findOrCreateIngredient(state, name) {
  const key = normalize(name);
  const existing = state.ingredients.find((i) => normalize(i.name) === key);
  if (existing) return existing;
  const { contains, traces } = detectAllergens(name);
  const item = {
    id: uid(),
    name: capitalize(name),
    brand: '',
    barcode: '',
    allergens: contains,
    traces,
    ingredientsText: '',
    image: '',
    source: 'auto',
  };
  state.ingredients.push(item);
  return item;
}

/** Ajoute un plat et ses ingrédients (créés au besoin) à la carte. */
export function addDish(state, { name, category = 'Plats', ingredients = [] }) {
  const ingredientIds = [];
  for (const ingName of ingredients) {
    const id = findOrCreateIngredient(state, ingName).id;
    if (!ingredientIds.includes(id)) ingredientIds.push(id);
  }
  const dish = {
    id: uid(),
    name: capitalize(name),
    category: category || 'Plats',
    ingredientIds,
    extraAllergens: [],
    extraTraces: [],
    checked: false,
  };
  state.dishes.push(dish);
  return dish;
}

export { findPreset };

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Exemple prêt à montrer à un restaurateur : une brasserie lilloise. */
export function demoState() {
  const state = emptyState();
  state.restaurant = { name: 'Brasserie du Beffroi', info: '12 place du Théâtre, Lille' };
  const ing = (name, allergens = null, traces = []) => {
    const detected = detectAllergens(name);
    const item = {
      id: uid(),
      name,
      brand: '',
      barcode: '',
      allergens: allergens ?? detected.contains,
      traces,
      ingredientsText: '',
      image: '',
      source: allergens ? 'manuel' : 'auto',
    };
    state.ingredients.push(item);
    return item.id;
  };
  const pain = ing('Pain de campagne');
  const cheddar = ing('Cheddar');
  const biere = ing('Bière blonde');
  const moutarde = ing('Moutarde de Dijon', ['moutarde', 'sulfites']);
  const jambon = ing('Jambon blanc', []);
  const oeuf = ing('Œuf');
  const boeuf = ing('Joues de bœuf', []);
  const paindepices = ing("Pain d'épices", ['gluten'], ['lait', 'fruits_coque']);
  const cassonade = ing('Cassonade', []);
  const oignon = ing('Oignons', []);
  const moules = ing('Moules de bouchot');
  const vin = ing('Vin blanc');
  const celeri = ing('Céleri branche');
  const creme = ing('Crème fraîche');
  const frites = ing('Frites', []);
  const mayo = ing('Mayonnaise');
  const volaille = ing('Poulet, lapin, porc, veau', []);
  const gelee = ing('Gelée au vinaigre', ['sulfites']);
  const farine = ing('Farine de blé');
  const beurre = ing('Beurre');
  const meringue = ing('Meringue');
  const chocolat = ing('Copeaux de chocolat noir', ['soja'], ['lait', 'fruits_coque']);
  const maroilles = ing('Maroilles');
  const salade = ing('Salade verte', []);
  const vinaigrette = ing('Vinaigrette maison', ['moutarde', 'sulfites']);
  const dish = (name, category, ingredientIds) =>
    state.dishes.push({ id: uid(), name, category, ingredientIds, extraAllergens: [], extraTraces: [], checked: false });
  dish('Salade au Maroilles chaud', 'Entrées', [salade, maroilles, vinaigrette, pain]);
  dish('Welsh traditionnel', 'Plats', [pain, cheddar, biere, moutarde, jambon, oeuf, frites]);
  dish('Carbonnade flamande', 'Plats', [boeuf, biere, paindepices, cassonade, moutarde, oignon, frites]);
  dish('Moules marinières', 'Plats', [moules, vin, celeri, oignon, creme, frites, mayo]);
  dish("Potjevleesch", 'Plats', [volaille, gelee, frites, mayo]);
  dish('Tarte au sucre', 'Desserts', [farine, beurre, oeuf, cassonade, creme]);
  dish('Merveilleux', 'Desserts', [meringue, creme, chocolat]);
  return state;
}
