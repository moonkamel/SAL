// « Découvrir Lille » : parcours prêts et incontournables, pour les visiteurs de
// passage. Contenu éditorial fixe (textes traduits par shared/i18n).

import { tx } from './i18n';
import type { LatLng } from './types';

export type DiscoverIcon =
  | 'business-outline'
  | 'library-outline'
  | 'color-palette-outline'
  | 'cafe-outline'
  | 'beer-outline'
  | 'leaf-outline'
  | 'eye-outline'
  | 'basket-outline'
  | 'home-outline'
  | 'musical-notes-outline'
  | 'sparkles-outline'
  | 'storefront-outline'
  | 'water-outline'
  | 'restaurant-outline'
  | 'calendar-outline';

/** Étape d'un parcours ou incontournable : un lieu précis, ou une recherche (« estaminet »). */
export interface Stop {
  id: string;
  name: string;
  text: string;
  icon: DiscoverIcon;
  location?: LatLng;
  /** Recherche à lancer plutôt qu'un lieu unique (plusieurs adresses possibles). */
  query?: string;
  /** Durée conseillée, ex. « 1 h 30 ». */
  duration?: string;
}

export interface Tour {
  id: string;
  title: string;
  subtitle: string;
  icon: DiscoverIcon;
  /** Distance totale à pied, indicative. */
  distance: string;
  days: { title?: string; stops: Stop[] }[];
}

// --- Lieux ---

const GRAND_PLACE: Stop = {
  id: 'grand-place',
  name: tx('Grand-Place et Vieille Bourse'),
  text: tx('Le cœur de Lille : façades flamandes, colonne de la Déesse et bouquinistes dans la cour de la Vieille Bourse.'),
  icon: 'business-outline',
  location: { lat: 50.6368, lng: 3.0635 },
  duration: tx('45 min'),
};

const VIEUX_LILLE: Stop = {
  id: 'vieux-lille',
  name: tx('Le Vieux-Lille'),
  text: tx('Ruelles pavées, maisons en brique et pierre, boutiques : flânez rue de la Monnaie et place aux Oignons.'),
  icon: 'home-outline',
  location: { lat: 50.6405, lng: 3.0635 },
  duration: tx('1 h'),
};

const HOSPICE: Stop = {
  id: 'hospice-comtesse',
  name: tx('Musée de l’Hospice Comtesse'),
  text: tx('Un ancien hôpital du XIIIe siècle et sa salle des malades, au cœur du Vieux-Lille.'),
  icon: 'library-outline',
  location: { lat: 50.641, lng: 3.0629 },
  duration: tx('1 h'),
};

const TREILLE: Stop = {
  id: 'treille',
  name: tx('Cathédrale Notre-Dame-de-la-Treille'),
  text: tx('Une cathédrale néogothique à la façade contemporaine étonnante, entrée libre.'),
  icon: 'sparkles-outline',
  location: { lat: 50.6401, lng: 3.0618 },
  duration: tx('30 min'),
};

const MEERT: Stop = {
  id: 'meert',
  name: tx('Pause gaufre chez Méert'),
  text: tx('La célèbre gaufre fourrée à la vanille de Madagascar, dans un salon de thé historique.'),
  icon: 'cafe-outline',
  location: { lat: 50.638, lng: 3.0617 },
  duration: tx('30 min'),
};

const PBA: Stop = {
  id: 'palais-beaux-arts',
  name: tx('Palais des Beaux-Arts'),
  text: tx('L’un des plus grands musées de France : Rubens, Goya, Delacroix et les plans-reliefs des villes du Nord.'),
  icon: 'color-palette-outline',
  location: { lat: 50.6305, lng: 3.0627 },
  duration: tx('2 h'),
};

const BEFFROI: Stop = {
  id: 'beffroi',
  name: tx('Beffroi de l’Hôtel de Ville'),
  text: tx('Classé à l’Unesco : montez au sommet (104 m) pour la plus belle vue sur Lille.'),
  icon: 'eye-outline',
  location: { lat: 50.6329, lng: 3.0703 },
  duration: tx('1 h'),
};

const ESTAMINET: Stop = {
  id: 'estaminet',
  name: tx('Dîner dans un estaminet'),
  text: tx('Carbonade flamande, welsh ou potjevleesch dans une taverne typique du Nord.'),
  icon: 'restaurant-outline',
  query: tx('estaminet'),
  duration: tx('1 h 30'),
};

const BIERES: Stop = {
  id: 'bieres',
  name: tx('Bières du Nord'),
  text: tx('Finissez la soirée dans un bar à bières : brasseries locales et belges à la pression.'),
  icon: 'beer-outline',
  query: tx('bar à bières'),
};

const OPERA: Stop = {
  id: 'opera',
  name: tx('Opéra de Lille'),
  text: tx('Sa façade Belle Époque illuminée le soir, face à la Chambre de commerce et son beffroi.'),
  icon: 'musical-notes-outline',
  location: { lat: 50.6374, lng: 3.0647 },
  duration: tx('15 min'),
};

const WAZEMMES: Stop = {
  id: 'wazemmes',
  name: tx('Marché de Wazemmes'),
  text: tx('Le grand marché populaire du dimanche matin, avec ses halles et ses étals du monde entier.'),
  icon: 'basket-outline',
  location: { lat: 50.6265, lng: 3.05 },
  duration: tx('1 h 30'),
};

const CITADELLE: Stop = {
  id: 'citadelle',
  name: tx('Citadelle et bois de Boulogne'),
  text: tx('La « reine des citadelles » de Vauban et sa promenade au bord de l’eau, idéale pour souffler.'),
  icon: 'leaf-outline',
  location: { lat: 50.6407, lng: 3.0455 },
  duration: tx('1 h 30'),
};

const DE_GAULLE: Stop = {
  id: 'de-gaulle',
  name: tx('Maison natale Charles de Gaulle'),
  text: tx('La maison où est né le Général en 1890, dans un intérieur bourgeois de la Belle Époque.'),
  icon: 'home-outline',
  location: { lat: 50.646, lng: 3.0588 },
  duration: tx('1 h'),
};

const PISCINE: Stop = {
  id: 'piscine',
  name: tx('La Piscine de Roubaix'),
  text: tx('Un musée d’art dans une piscine Art déco : un lieu unique, à 25 min en métro.'),
  icon: 'water-outline',
  location: { lat: 50.6897, lng: 3.1658 },
  duration: tx('2 h'),
};

const LAM: Stop = {
  id: 'lam',
  name: tx('LaM, musée d’art moderne'),
  text: tx('Picasso, Modigliani et art brut dans un parc de sculptures, à Villeneuve-d’Ascq.'),
  icon: 'color-palette-outline',
  location: { lat: 50.6378, lng: 3.1546 },
  duration: tx('2 h'),
};

const SAINT_SAUVEUR: Stop = {
  id: 'saint-sauveur',
  name: tx('Gare Saint Sauveur'),
  text: tx('Une ancienne gare de marchandises devenue lieu culturel : expos, cinéma, guinguette et bistrot.'),
  icon: 'storefront-outline',
  location: { lat: 50.6273, lng: 3.0698 },
  duration: tx('1 h'),
};

// --- Parcours ---

export const TOURS: Tour[] = [
  {
    id: 'un-jour',
    title: tx('Lille en 1 jour'),
    subtitle: tx('L’essentiel à pied : Grand-Place, Vieux-Lille, musée et beffroi'),
    icon: 'sparkles-outline',
    distance: tx('environ 5 km à pied'),
    days: [{ stops: [GRAND_PLACE, VIEUX_LILLE, TREILLE, MEERT, PBA, BEFFROI, ESTAMINET] }],
  },
  {
    id: 'week-end',
    title: tx('Un week-end à Lille'),
    subtitle: tx('Deux jours pour tout voir, du Vieux-Lille au marché de Wazemmes'),
    icon: 'calendar-outline',
    distance: tx('environ 5 km à pied par jour'),
    days: [
      { title: tx('Samedi'), stops: [GRAND_PLACE, VIEUX_LILLE, HOSPICE, MEERT, PBA, ESTAMINET] },
      { title: tx('Dimanche'), stops: [WAZEMMES, CITADELLE, DE_GAULLE, TREILLE, BEFFROI, BIERES] },
    ],
  },
  {
    id: 'soiree',
    title: tx('Soirée flamande'),
    subtitle: tx('Le Vieux-Lille illuminé, un estaminet puis les bières du Nord'),
    icon: 'beer-outline',
    distance: tx('environ 2 km à pied'),
    days: [{ stops: [OPERA, GRAND_PLACE, VIEUX_LILLE, ESTAMINET, BIERES] }],
  },
  {
    id: 'musees',
    title: tx('Musées et art'),
    subtitle: tx('Beaux-Arts, Hospice Comtesse, et les deux musées de la métropole'),
    icon: 'color-palette-outline',
    distance: tx('métro et tram entre les musées'),
    days: [{ stops: [PBA, HOSPICE, SAINT_SAUVEUR, PISCINE, LAM] }],
  },
];

// --- Incontournables ---

export const MUST_SEE: Stop[] = [GRAND_PLACE, VIEUX_LILLE, BEFFROI, PBA, TREILLE, CITADELLE, HOSPICE, WAZEMMES, PISCINE, LAM];

/** Rendez-vous de saison, mis en avant quand ils approchent. */
export interface Seasonal extends Stop {
  /** Vrai si le rendez-vous est à mettre en avant à cette date. */
  active: (d: Date) => boolean;
  when: string;
}

/** Premier samedi de septembre (la Braderie a lieu ce week-end-là). */
export function braderieSaturday(year: number): Date {
  const d = new Date(year, 8, 1);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return d;
}

export const SEASONAL: Seasonal[] = [
  {
    id: 'braderie',
    name: tx('La Braderie de Lille'),
    text: tx('Le plus grand marché aux puces d’Europe envahit toute la ville, avec moules-frites à volonté.'),
    when: tx('premier week-end de septembre'),
    icon: 'storefront-outline',
    location: { lat: 50.6368, lng: 3.0635 },
    // Annoncée trois semaines avant, jusqu'au dimanche soir.
    active: (d) => {
      const sat = braderieSaturday(d.getFullYear());
      const from = new Date(sat.getTime() - 21 * 86_400_000);
      const to = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 1, 23, 59);
      return d >= from && d <= to;
    },
  },
  {
    id: 'noel',
    name: tx('Marché de Noël et grande roue'),
    text: tx('Chalets place Rihour, vin chaud et grande roue illuminée sur la Grand-Place.'),
    when: tx('de fin novembre à fin décembre'),
    icon: 'sparkles-outline',
    location: { lat: 50.6362, lng: 3.061 },
    // Du 15 novembre au 31 décembre.
    active: (d) => (d.getMonth() === 10 && d.getDate() >= 15) || d.getMonth() === 11,
  },
];

/** Points du parcours ayant une adresse précise (pour la carte et Google Maps). */
export function tourPoints(stops: Stop[]): (Stop & { location: LatLng })[] {
  return stops.filter((s): s is Stop & { location: LatLng } => !!s.location);
}

/**
 * Ordre de visite au plus court (voisin le plus proche) : depuis `start`,
 * toujours l'étape la plus proche parmi celles qui restent.
 */
export function orderByProximity<T extends { location: LatLng }>(start: LatLng, items: T[]): T[] {
  const rest = [...items];
  const out: T[] = [];
  let here = start;
  while (rest.length) {
    let best = 0;
    for (let i = 1; i < rest.length; i++) {
      if (dist2(here, rest[i]!.location) < dist2(here, rest[best]!.location)) best = i;
    }
    const [next] = rest.splice(best, 1);
    out.push(next!);
    here = next!.location;
  }
  return out;
}

// Distance au carré (équirectangulaire) : suffit pour comparer à l'échelle d'une ville.
function dist2(a: LatLng, b: LatLng): number {
  const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const y = b.lat - a.lat;
  return x * x + y * y;
}

export function findTour(id: string): Tour | undefined {
  return TOURS.find((t) => t.id === id);
}
