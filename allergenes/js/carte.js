// Carte publique ouverte par le QR code : le menu est lu dans le lien (#…).

import { ALLERGENS, allergenLabel, decodeMenu } from './core.js';

const T = {
  fr: {
    kicker: 'Allergènes de la carte',
    sep: ' : ',
    filter: 'Je ne peux pas manger :',
    clear: 'Tout effacer',
    ok: '✓ Sans vos allergènes',
    okS: '✓ OK pour vous',
    noS: '✕ Déconseillé',
    maybeS: '⚠ Traces',
    no: 'Contient',
    maybe: 'Peut contenir (traces)',
    none: 'Aucun des 14 allergènes',
    updated: 'Mis à jour le',
    fits: (n, t) => `${n} plat${n > 1 ? 's' : ''} sur ${t} sans vos allergènes`,
    legal: 'Informations fournies par l’établissement (14 allergènes du règlement UE 1169/2011). En cas d’allergie, signalez-la toujours au personnel avant de commander : des contaminations croisées restent possibles en cuisine.',
    broken: 'Ce lien de carte est incomplet ou abîmé. Demandez le tableau des allergènes au personnel.',
  },
  en: {
    kicker: 'Menu allergens',
    sep: ': ',
    filter: 'I can’t eat:',
    clear: 'Clear',
    ok: '✓ Free from your allergens',
    okS: '✓ OK for you',
    noS: '✕ Not suitable',
    maybeS: '⚠ Traces',
    no: 'Contains',
    maybe: 'May contain (traces)',
    none: 'None of the 14 allergens',
    updated: 'Updated on',
    fits: (n, t) => `${n} of ${t} dishes free from your allergens`,
    legal: 'Information provided by the restaurant (14 allergens, EU regulation 1169/2011). If you have an allergy, always tell the staff before ordering: cross-contamination in the kitchen is possible.',
    broken: 'This menu link is incomplete or damaged. Please ask the staff for the allergen chart.',
  },
  nl: {
    kicker: 'Allergenen op de kaart',
    sep: ': ',
    filter: 'Ik mag niet eten:',
    clear: 'Wissen',
    ok: '✓ Zonder uw allergenen',
    okS: '✓ OK voor u',
    noS: '✕ Afgeraden',
    maybeS: '⚠ Sporen',
    no: 'Bevat',
    maybe: 'Kan sporen bevatten',
    none: 'Geen van de 14 allergenen',
    updated: 'Bijgewerkt op',
    fits: (n, t) => `${n} van ${t} gerechten zonder uw allergenen`,
    legal: 'Informatie verstrekt door het restaurant (14 allergenen, EU-verordening 1169/2011). Meld uw allergie altijd aan het personeel voordat u bestelt: kruisbesmetting in de keuken is mogelijk.',
    broken: 'Deze link is onvolledig of beschadigd. Vraag het personeel naar de allergenenlijst.',
  },
};
const LOCALES = { fr: 'fr-FR', en: 'en-GB', nl: 'nl-BE' };

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (id) => ALLERGENS.find((a) => a.id === id)?.icon ?? '';

function readPref(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Préférence non essentielle.
  }
}

const browserLang = (navigator.language || 'fr').slice(0, 2);
let lang = readPref('carte:lang', T[browserLang] ? browserLang : 'fr');
if (!T[lang]) lang = 'fr';
const avoid = new Set(readPref('carte:avoid', '').split(',').filter((id) => ALLERGENS.some((a) => a.id === id)));
let menu = null;

function render() {
  const t = T[lang];
  document.documentElement.lang = lang;
  $('#kicker').textContent = t.kicker;
  $('#lang').innerHTML = Object.keys(T)
    .map((l) => `<button data-lang="${l}" aria-pressed="${l === lang}">${l.toUpperCase()}</button>`)
    .join('');
  if (!menu) {
    $('#app').innerHTML = `<div class="card"><p>${esc(t.broken)}</p></div>`;
    return;
  }
  document.title = `${menu.name || t.kicker} · ${t.kicker}`;
  $('#name').textContent = menu.name;
  const date = menu.updated ? new Date(`${menu.updated}T12:00:00`) : null;
  $('#info').textContent = [menu.info, date && !isNaN(date) ? `${t.updated} ${date.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric' })}` : '']
    .filter(Boolean)
    .join(' · ');

  const filter = ALLERGENS.map(
    (a) => `<button data-avoid="${a.id}" aria-pressed="${avoid.has(a.id)}">${a.icon} ${esc(allergenLabel(a.id, lang))}</button>`,
  ).join('');

  let fits = 0;
  const groups = new Map();
  for (const dish of menu.dishes) {
    if (!groups.has(dish.category)) groups.set(dish.category, []);
    groups.get(dish.category).push(dish);
  }
  let list = '';
  for (const [cat, dishes] of groups) {
    list += `<div class="cat-h">${esc(cat)}</div>`;
    for (const dish of dishes) {
      const hits = dish.contains.filter((id) => avoid.has(id));
      const maybe = dish.traces.filter((id) => avoid.has(id));
      const fitsDish = !hits.length && !maybe.length;
      if (fitsDish) fits += 1;
      const chips =
        dish.contains.map((id) => `<span class="chip contains">${icon(id)} ${esc(allergenLabel(id, lang))}</span>`).join('') +
        dish.traces.map((id) => `<span class="chip traces" title="${esc(t.maybe)}">${icon(id)} ${esc(allergenLabel(id, lang))} ?</span>`).join('');
      let verdict = '';
      let why = '';
      if (avoid.size) {
        const names = (ids) => ids.map((id) => esc(allergenLabel(id, lang))).join(', ');
        if (hits.length) {
          verdict = `<span class="verdict no">${esc(t.noS)}</span>`;
          why = `<div class="why">${esc(t.no)}${t.sep}${names(hits)}</div>`;
        } else if (maybe.length) {
          verdict = `<span class="verdict maybe">${esc(t.maybeS)}</span>`;
          why = `<div class="why">${esc(t.maybe)}${t.sep}${names(maybe)}</div>`;
        } else verdict = `<span class="verdict ok">${esc(t.okS)}</span>`;
      }
      const cls = !avoid.size ? '' : hits.length ? 'blocked' : fitsDish ? 'fits' : '';
      list += `<div class="dish ${cls}">
        <div class="title"><span>${esc(dish.name)}</span>${verdict}</div>
        ${why}
        <div class="chips">${chips || `<span class="chip none">✓ ${esc(t.none)}</span>`}</div>
      </div>`;
    }
  }

  $('#app').innerHTML = `
    <div class="card filter-card">
      <div class="row spread"><strong>${esc(t.filter)}</strong>${avoid.size ? `<button class="btn small ghost" data-clear>${esc(t.clear)}</button>` : ''}</div>
      <div class="filter">${filter}</div>
      ${avoid.size ? `<p class="result">${esc(t.fits(fits, menu.dishes.length))}</p>` : ''}
    </div>
    ${list}
    <p class="legal">${esc(t.legal)}</p>`;
}

document.addEventListener('click', (e) => {
  const langBtn = e.target.closest('[data-lang]');
  if (langBtn) {
    lang = langBtn.dataset.lang;
    writePref('carte:lang', lang);
  }
  const avoidBtn = e.target.closest('[data-avoid]');
  if (avoidBtn) {
    const id = avoidBtn.dataset.avoid;
    if (avoid.has(id)) avoid.delete(id);
    else avoid.add(id);
  }
  if (e.target.closest('[data-clear]')) avoid.clear();
  if (langBtn || avoidBtn || e.target.closest('[data-clear]')) {
    writePref('carte:avoid', [...avoid].join(','));
    render();
  }
});

async function load() {
  try {
    menu = location.hash.length > 2 ? await decodeMenu(location.hash) : null;
  } catch {
    menu = null;
  }
  render();
}

window.addEventListener('hashchange', load);
load();
