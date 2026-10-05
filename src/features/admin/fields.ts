// Formulaires de l'espace partenaires : description des champs et conversion
// texte saisi ⇄ objet enregistré. Logique pure, testée.

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime'
  | 'list'
  | 'days'
  | 'bool'
  | 'select'
  | 'json';

export interface Field {
  /** Chemin dans l'objet, ex. « location.lat ». */
  key: string;
  label: string;
  type: FieldType;
  optional?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  /** Valeur proposée pour un nouvel élément. */
  initial?: string;
}

export type ContentKind = 'offers' | 'events' | 'sponsored' | 'affiliates';

/** Champs remplis automatiquement par « Chercher le lieu ». */
export interface PlaceBinding {
  placeId?: string;
  name?: string;
  lat: string;
  lng: string;
}

export interface KindConfig {
  title: string;
  singular: string;
  fields: Field[];
  place?: PlaceBinding;
  /** Texte affiché dans la liste. */
  summary: (item: Record<string, unknown>) => string;
}

const ID_HELP = 'Minuscules, chiffres et tirets, ex. « illustration-happy-hour ». Même id = remplacement.';

export const KINDS: Record<ContentKind, KindConfig> = {
  offers: {
    title: 'Bons plans',
    singular: 'bon plan',
    place: { placeId: 'placeId', name: 'placeName', lat: 'location.lat', lng: 'location.lng' },
    summary: (i) => `${i.placeName} — ${i.title} (${i.startDate} → ${i.endDate})`,
    fields: [
      { key: 'id', label: 'Identifiant', type: 'text', help: ID_HELP },
      { key: 'title', label: 'Offre', type: 'text', placeholder: '1 verre offert avant 20 h' },
      { key: 'description', label: 'Détail', type: 'textarea', optional: true },
      { key: 'conditions', label: 'Conditions', type: 'text', optional: true, placeholder: 'Sur présentation de l’app' },
      { key: 'placeId', label: 'place_id Google', type: 'text' },
      { key: 'placeName', label: 'Nom du lieu', type: 'text' },
      { key: 'location.lat', label: 'Latitude', type: 'number' },
      { key: 'location.lng', label: 'Longitude', type: 'number' },
      { key: 'startDate', label: 'Du', type: 'date', placeholder: 'AAAA-MM-JJ' },
      { key: 'endDate', label: 'Au', type: 'date', placeholder: 'AAAA-MM-JJ' },
      { key: 'days', label: 'Jours', type: 'days', optional: true, help: 'Aucun jour coché = tous les jours.' },
      { key: 'startTime', label: 'De', type: 'time', optional: true, placeholder: 'HH:MM' },
      { key: 'endTime', label: 'À', type: 'time', optional: true, placeholder: 'HH:MM' },
      { key: 'active', label: 'Actif', type: 'bool', initial: 'true' },
    ],
  },
  events: {
    title: 'Agenda',
    singular: 'événement',
    place: { placeId: 'placeId', name: 'venueName', lat: 'location.lat', lng: 'location.lng' },
    summary: (i) =>
      `${i.featured ? '★ ' : ''}${i.title} — ${i.venueName} (${new Date(String(i.end ?? i.start)) < new Date() ? 'PASSÉ · ' : ''}${datePreview('datetime', isoToLocalInput(String(i.start)))?.text ?? String(i.start)})`,
    fields: [
      { key: 'id', label: 'Identifiant', type: 'text', help: ID_HELP },
      { key: 'title', label: 'Titre', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', optional: true },
      {
        key: 'category',
        label: 'Catégorie',
        type: 'select',
        initial: 'soiree',
        options: [
          { value: 'concert', label: 'Concert' },
          { value: 'soiree', label: 'Soirée' },
          { value: 'expo', label: 'Expo' },
          { value: 'spectacle', label: 'Spectacle' },
          { value: 'marche', label: 'Marché' },
          { value: 'sport', label: 'Sport' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      { key: 'venueName', label: 'Lieu', type: 'text' },
      { key: 'placeId', label: 'place_id Google', type: 'text', optional: true },
      { key: 'location.lat', label: 'Latitude', type: 'number' },
      { key: 'location.lng', label: 'Longitude', type: 'number' },
      { key: 'address', label: 'Adresse', type: 'text', optional: true },
      { key: 'start', label: 'Début', type: 'datetime', placeholder: 'AAAA-MM-JJ HH:MM' },
      { key: 'end', label: 'Fin', type: 'datetime', optional: true, placeholder: 'AAAA-MM-JJ HH:MM' },
      { key: 'price', label: 'Prix', type: 'text', optional: true, placeholder: 'Gratuit, 12 €…' },
      { key: 'url', label: 'Lien (billetterie, page)', type: 'text', optional: true, placeholder: 'https://…' },
      { key: 'imageUrl', label: 'Image (lien https)', type: 'text', optional: true },
      { key: 'featured', label: 'À la une (sponsorisé)', type: 'bool', initial: 'false' },
      { key: 'active', label: 'Actif', type: 'bool', initial: 'true' },
    ],
  },
  sponsored: {
    title: 'Lieux sponsorisés',
    singular: 'campagne',
    place: { placeId: 'placeId', name: 'label', lat: 'zone.lat', lng: 'zone.lng' },
    summary: (i) => `${i.label} (${i.startDate} → ${i.endDate})`,
    fields: [
      { key: 'id', label: 'Identifiant', type: 'text', help: ID_HELP },
      { key: 'placeId', label: 'place_id Google', type: 'text' },
      { key: 'label', label: 'Nom interne', type: 'text', help: 'Pour vous, jamais affiché.' },
      { key: 'startDate', label: 'Du', type: 'date', placeholder: 'AAAA-MM-JJ' },
      { key: 'endDate', label: 'Au', type: 'date', placeholder: 'AAAA-MM-JJ' },
      { key: 'zone.lat', label: 'Centre de la zone : latitude', type: 'number' },
      { key: 'zone.lng', label: 'Centre de la zone : longitude', type: 'number' },
      { key: 'zone.radiusMeters', label: 'Rayon (mètres)', type: 'number', initial: '3000' },
      { key: 'keywords', label: 'Mots-clés', type: 'list', placeholder: 'brunch, café, coffee', help: 'Séparés par des virgules.' },
    ],
  },
  affiliates: {
    title: 'Liens partenaires',
    singular: 'partenaire',
    summary: (i) => `${i.label} — ${i.partner}${i.active === false ? ' (inactif)' : ''}`,
    fields: [
      { key: 'id', label: 'Identifiant', type: 'text', help: ID_HELP },
      {
        key: 'kind',
        label: 'Type',
        type: 'select',
        initial: 'booking',
        options: [
          { value: 'booking', label: 'Réservation' },
          { value: 'tickets', label: 'Billetterie' },
          { value: 'ride', label: 'VTC' },
          { value: 'delivery', label: 'Livraison' },
        ],
      },
      { key: 'label', label: 'Texte du bouton', type: 'text', placeholder: 'Réserver une table' },
      { key: 'partner', label: 'Nom du partenaire', type: 'text' },
      {
        key: 'urlTemplate',
        label: 'Modèle de lien',
        type: 'text',
        optional: true,
        placeholder: 'https://…?q={name}&aff=VOTRE_ID',
        help: 'Variables : {name} {address} {lat} {lng} {placeId} {city}',
      },
      { key: 'placeTypes', label: 'Types de lieux Google', type: 'list', optional: true, placeholder: 'restaurant, bar' },
      {
        key: 'places',
        label: 'Liens directs par lieu (JSON)',
        type: 'json',
        optional: true,
        placeholder: '{"ChIJ…": "https://…"}',
      },
      { key: 'active', label: 'Actif', type: 'bool', initial: 'true' },
    ],
  },
};

export const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // 0 = dimanche

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    o[k] = (o[k] as Record<string, unknown> | undefined) ?? {};
    o = o[k] as Record<string, unknown>;
  }
  o[keys[keys.length - 1]!] = value;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → « AAAA-MM-JJ HH:MM » à l'heure de l'ordinateur (en France : heure de Lille). */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Date saisie en toutes lettres, pour éviter les inversions jour / mois :
 * « 2026-05-10 » → « dimanche 10 mai 2026 » (et signale une date passée).
 */
export function datePreview(type: FieldType, value: string, now: Date = new Date()): { text: string; past: boolean } | null {
  const v = value.trim();
  if (!v) return null;
  let d: Date | null = null;
  if (type === 'datetime') {
    const iso = localInputToIso(v);
    d = iso ? new Date(iso) : null;
  } else if (type === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59) : null;
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  const text = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = type === 'datetime' ? ` à ${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
  return { text: `${text}${time}`, past: d < now };
}

export function localInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  return new Date(y, mo - 1, d, h, mi).toISOString();
}

export type FormValues = Record<string, string>;

export function emptyValues(fields: Field[]): FormValues {
  return Object.fromEntries(fields.map((f) => [f.key, f.initial ?? '']));
}

export function toValues(fields: Field[], item: Record<string, unknown>): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    const v = getPath(item, f.key);
    if (v === undefined || v === null) values[f.key] = f.initial ?? '';
    else if (f.type === 'list' || f.type === 'days') values[f.key] = (v as unknown[]).join(',');
    else if (f.type === 'json') values[f.key] = JSON.stringify(v);
    else if (f.type === 'datetime') values[f.key] = isoToLocalInput(String(v));
    else values[f.key] = String(v);
  }
  return values;
}

/** Valeurs saisies → objet à envoyer ; `error` explique le premier champ incorrect. */
export function toItem(
  fields: Field[],
  values: FormValues,
): { item: Record<string, unknown>; error?: undefined } | { item?: undefined; error: string } {
  const item: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = (values[f.key] ?? '').trim();
    if (raw === '') {
      if (f.type === 'bool') setPath(item, f.key, false);
      else if (!f.optional) return { error: `« ${f.label} » est obligatoire.` };
      continue;
    }
    let value: unknown = raw;
    switch (f.type) {
      case 'number':
        value = Number(raw.replace(',', '.'));
        if (!Number.isFinite(value)) return { error: `« ${f.label} » doit être un nombre.` };
        break;
      case 'list':
        value = raw.split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case 'days':
        value = raw.split(',').map(Number).filter((n) => n >= 0 && n <= 6).sort();
        if ((value as number[]).length === 0) continue;
        break;
      case 'bool':
        value = raw === 'true';
        break;
      case 'datetime': {
        const iso = localInputToIso(raw);
        if (!iso) return { error: `« ${f.label} » : format AAAA-MM-JJ HH:MM attendu.` };
        value = iso;
        break;
      }
      case 'json':
        try {
          value = JSON.parse(raw);
        } catch {
          return { error: `« ${f.label} » : JSON invalide.` };
        }
        break;
    }
    setPath(item, f.key, value);
  }
  return { item };
}
