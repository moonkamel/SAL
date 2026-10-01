// Outil du chef : carte, ingrédients, tableau imprimable et QR code.

import {
  ALLERGENS,
  allergenLabel,
  buildPublicMenu,
  demoState,
  detectAllergens,
  dishAllergens,
  emptyState,
  encodeMenu,
  ingredientFromOffProduct,
  isValidBarcode,
  normalize,
  offProductUrl,
  sanitizeState,
  sortIds,
  uid,
} from './core.js';
import { startScanner } from './scanner.js';
import qrcode from '../vendor/qrcode.mjs';

const STORAGE_KEY = 'allergenes:v1';
const TAB_KEY = 'allergenes:tab';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeState(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast('Impossible d’enregistrer sur cet appareil : exportez vos données.');
  }
  render();
}

function toast(message) {
  $('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

const ingredientsById = () => new Map(state.ingredients.map((i) => [i.id, i]));
const label = (id) => allergenLabel(id, 'fr');
const iconOf = (id) => ALLERGENS.find((a) => a.id === id)?.icon ?? '';

function chipsHtml({ contains, traces }, { emptyText = 'Aucun allergène' } = {}) {
  if (!contains.length && !traces.length) return `<span class="chip none">✓ ${esc(emptyText)}</span>`;
  return (
    contains.map((id) => `<span class="chip contains">${iconOf(id)} ${esc(label(id))}</span>`).join('') +
    traces.map((id) => `<span class="chip traces" title="Peut contenir">${iconOf(id)} ${esc(label(id))} ?</span>`).join('')
  );
}

/** Regroupe les plats par catégorie, dans l'ordre de la carte. */
function groupedDishes() {
  const groups = new Map();
  for (const dish of state.dishes) {
    const cat = dish.category.trim() || 'Autres';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(dish);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Sélecteur d'allergènes à trois états : rien → contient → peut contenir

function allergenPicker(container, onChange) {
  const states = new Map();
  container.innerHTML = ALLERGENS.map(
    (a) => `<button type="button" data-id="${a.id}" data-state="none"><span>${a.icon}</span>${esc(label(a.id))}<small></small></button>`,
  ).join('');
  const paint = () => {
    for (const btn of $$('button', container)) {
      const s = states.get(btn.dataset.id) ?? 'none';
      btn.dataset.state = s;
      btn.setAttribute('aria-pressed', s === 'none' ? 'false' : 'true');
      $('small', btn).textContent = s === 'contains' ? 'contient' : s === 'traces' ? 'traces' : '';
    }
  };
  container.onclick = (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    const next = { none: 'contains', contains: 'traces', traces: 'none' }[states.get(btn.dataset.id) ?? 'none'];
    states.set(btn.dataset.id, next);
    paint();
    onChange?.();
  };
  return {
    set(contains = [], traces = []) {
      states.clear();
      traces.forEach((id) => states.set(id, 'traces'));
      contains.forEach((id) => states.set(id, 'contains'));
      paint();
    },
    get() {
      const pick = (s) => sortIds([...states].filter(([, v]) => v === s).map(([k]) => k));
      return { contains: pick('contains'), traces: pick('traces') };
    },
  };
}

// ---------------------------------------------------------------------------
// Onglets

function showTab(name) {
  for (const tab of $$('.tab')) tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
  for (const panel of $$('.panel')) panel.hidden = panel.id !== `panel-${name}`;
  try {
    localStorage.setItem(TAB_KEY, name);
  } catch {
    // Préférence non essentielle.
  }
  if (name === 'qr') renderQr();
}

for (const tab of $$('.tab')) tab.addEventListener('click', () => showTab(tab.dataset.tab));

// ---------------------------------------------------------------------------
// Rendu

function render() {
  $('#restaurant-title').textContent = state.restaurant.name ? `· ${state.restaurant.name}` : '';
  renderDishes();
  renderIngredients();
  renderSheet();
  if (!$('#panel-qr').hidden) renderQr();
}

function renderDishes() {
  const list = $('#dish-list');
  if (!state.dishes.length) {
    list.innerHTML = `<div class="empty"><p>Aucun plat pour l’instant.</p><p>Ajoutez vos plats avec leurs ingrédients, ou chargez l’exemple de brasserie lilloise en bas de page.</p></div>`;
    return;
  }
  const byId = ingredientsById();
  let html = '';
  for (const [cat, dishes] of groupedDishes()) {
    html += `<h3 class="category-title">${esc(cat)}</h3><ul class="list">`;
    for (const dish of dishes) {
      const names = dish.ingredientIds.map((id) => byId.get(id)?.name).filter(Boolean);
      html += `<li>
        <div class="grow">
          <div class="title">${esc(dish.name)}</div>
          <small>${names.length ? esc(names.join(', ')) : 'Aucun ingrédient renseigné'}</small>
          <div class="chips" style="margin-top:6px">${chipsHtml(dishAllergens(dish, byId))}</div>
        </div>
        <button class="btn small" data-edit-dish="${esc(dish.id)}">Modifier</button>
      </li>`;
    }
    html += '</ul>';
  }
  list.innerHTML = html;
}

function renderIngredients() {
  const list = $('#ingredient-list');
  const query = normalize($('#ingredient-search').value);
  const items = state.ingredients
    .filter((i) => !query || normalize(`${i.name} ${i.brand} ${i.barcode}`).includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (!items.length) {
    list.innerHTML = `<div class="empty">${state.ingredients.length ? 'Aucun résultat.' : 'Aucun ingrédient. Scannez un produit ou ajoutez-en un.'}</div>`;
    return;
  }
  const usage = new Map();
  for (const d of state.dishes) for (const id of d.ingredientIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  list.innerHTML = `<ul class="list">${items
    .map((i) => {
      const used = usage.get(i.id) ?? 0;
      const thumb = i.image
        ? `<img class="thumb" src="${esc(i.image)}" alt="" loading="lazy">`
        : `<span class="thumb placeholder">${i.barcode ? '🥫' : '🥕'}</span>`;
      return `<li>
        ${thumb}
        <div class="grow">
          <div class="title">${esc(i.name)}${i.brand ? ` <small>· ${esc(i.brand)}</small>` : ''}</div>
          <small>${used ? `Dans ${used} plat${used > 1 ? 's' : ''}` : 'Utilisé dans aucun plat'}${i.source === 'openfoodfacts' ? ' · Open Food Facts' : ''}</small>
          <div class="chips" style="margin-top:6px">${chipsHtml({ contains: i.allergens, traces: i.traces })}</div>
        </div>
        <button class="btn small" data-edit-ingredient="${esc(i.id)}">Modifier</button>
      </li>`;
    })
    .join('')}</ul>`;
}

function formatDate(d = new Date()) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderSheet() {
  const sheet = $('#allergen-sheet');
  const showTraces = $('#show-traces').checked;
  if (!state.dishes.length) {
    sheet.innerHTML = `<div class="empty">Ajoutez des plats dans « Ma carte » pour générer le tableau.</div>`;
    return;
  }
  const byId = ingredientsById();
  const head = ALLERGENS.map(
    (a) => `<th scope="col" title="${esc(allergenLabel(a.id, 'fr', true))}"><div class="vlabel">${esc(label(a.id))}</div><span class="icon">${a.icon}</span></th>`,
  ).join('');
  let body = '';
  for (const [cat, dishes] of groupedDishes()) {
    body += `<tr class="cat"><td colspan="${ALLERGENS.length + 1}">${esc(cat)}</td></tr>`;
    for (const dish of dishes) {
      const { contains, traces } = dishAllergens(dish, byId);
      body += `<tr><td class="dish">${esc(dish.name)}</td>${ALLERGENS.map((a) => {
        if (contains.includes(a.id)) return `<td class="yes" aria-label="contient">●</td>`;
        if (showTraces && traces.includes(a.id)) return `<td class="maybe" aria-label="peut contenir">○</td>`;
        return '<td></td>';
      }).join('')}</tr>`;
    }
  }
  sheet.innerHTML = `
    <div class="sheet-head">
      <div>
        <small>Information allergènes</small>
        <h2>${esc(state.restaurant.name || 'Notre carte')}</h2>
        ${state.restaurant.info ? `<small>${esc(state.restaurant.info)}</small>` : ''}
      </div>
      <small>Mis à jour le ${formatDate()}</small>
    </div>
    <div class="table-scroll">
      <table class="allergen-table">
        <thead><tr><th scope="col" class="dish">Plat</th>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div class="legend">
      <span><strong style="color:var(--contains)">●</strong> Contient</span>
      ${showTraces ? '<span><strong style="color:var(--traces)">○</strong> Peut contenir (traces, contamination croisée)</span>' : ''}
    </div>
    <p class="legal">
      Liste des 14 allergènes à déclaration obligatoire — règlement (UE) n° 1169/2011, annexe II ;
      décret n° 2015-447 du 17 avril 2015. Notre personnel se tient à votre disposition pour toute
      information complémentaire. Malgré nos précautions, des contaminations croisées restent possibles en cuisine.
    </p>`;
}

// ---------------------------------------------------------------------------
// QR code

function publicBase() {
  const custom = state.settings.publicBase.trim();
  try {
    return new URL('.', custom || location.href).href;
  } catch {
    return new URL('.', location.href).href;
  }
}

function qrSvg(text, cellSize = 4) {
  for (const level of ['M', 'L']) {
    try {
      const qr = qrcode(0, level);
      qr.addData(text);
      qr.make();
      return qr.createSvgTag({ cellSize, margin: cellSize * 4, scalable: true, alt: 'QR code de la carte des allergènes' });
    } catch {
      // Trop long pour ce niveau de correction : on essaie le suivant.
    }
  }
  return null;
}

let qrToken = 0;
async function renderQr() {
  const token = ++qrToken;
  const warning = $('#qr-warning');
  const box = $('#qr-code');
  if (!state.dishes.length) {
    box.innerHTML = '';
    warning.innerHTML = `<div class="notice">Ajoutez d’abord des plats dans « Ma carte ».</div>`;
    $('#link-out').textContent = '';
    $('#qr-tents').innerHTML = '';
    return;
  }
  const url = `${publicBase()}carte.html#${await encodeMenu(buildPublicMenu(state))}`;
  if (token !== qrToken) return;

  const local = !state.settings.publicBase && (location.protocol === 'file:' || /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(location.hostname));
  warning.innerHTML = local
    ? `<div class="notice">L’outil tourne sur cet ordinateur (${esc(location.host || 'fichier local')}) : les téléphones des clients ne pourront pas ouvrir ce lien. Mettez l’outil en ligne (voir le README) ou indiquez son adresse publique ci-dessous.</div>`
    : '';

  const svg = qrSvg(url);
  box.innerHTML = svg ?? `<p class="status error">Carte trop longue pour un QR code. Raccourcissez les noms de plats.</p>`;
  $('#link-out').textContent = url;
  $('#open-link').href = url;
  $('#copy-link').onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Lien copié');
    } catch {
      toast('Copie impossible : sélectionnez le lien à la main.');
    }
  };
  const name = esc(state.restaurant.name || '');
  const tent = svg
    ? `<div class="tent">
        <strong>${name}</strong>
        <div style="font-size:1.4rem;margin-top:6px">🌾 Allergènes</div>
        <div class="langs">Allergens · Allergenen</div>
        <div class="qr-small">${qrSvg(url, 6)}</div>
        <div>Scannez pour voir les allergènes de nos plats</div>
        <div class="langs">Scan to check allergens · Scan voor allergenen</div>
        <div class="langs" style="margin-top:6px">Tableau complet disponible sur demande — ${formatDate()}</div>
      </div>`
    : '';
  $('#qr-tents').innerHTML = `<div class="tents">${tent.repeat(4)}</div>`;
}

// ---------------------------------------------------------------------------
// Fenêtre ingrédient

const ingredientDialog = $('#ingredient-dialog');
const ingredientForm = $('#ingredient-form');
let ingredientDraft = null;
let ingredientOnSaved = null;
let pickerTouched = false;
const ingredientPicker = allergenPicker($('#ingredient-allergens'), () => {
  pickerTouched = true;
});

function openIngredient(draft, onSaved = null) {
  ingredientDraft = draft;
  ingredientOnSaved = onSaved;
  const isNew = !state.ingredients.some((i) => i.id === draft.id);
  pickerTouched = !isNew || draft.source === 'openfoodfacts';
  $('#ingredient-dialog-title').textContent = isNew ? 'Nouvel ingrédient' : 'Modifier l’ingrédient';
  ingredientForm.name.value = draft.name ?? '';
  ingredientForm.brand.value = draft.brand ?? '';
  ingredientForm.barcode.value = draft.barcode ?? '';
  ingredientPicker.set(draft.allergens ?? [], draft.traces ?? []);
  $('#ingredient-delete').hidden = isNew;

  const preview = $('#ingredient-preview');
  preview.hidden = !draft.image && !draft.notice;
  preview.innerHTML = `${draft.image ? `<img src="${esc(draft.image)}" alt="">` : ''}<div class="status ${draft.notice ? 'error' : 'ok'}">${esc(
    draft.notice || (isNew ? 'Trouvé sur Open Food Facts : vérifiez les allergènes avec l’étiquette.' : ''),
  )}</div>`;
  const text = $('#ingredient-text');
  text.hidden = !draft.ingredientsText;
  $('p', text).textContent = draft.ingredientsText ?? '';
  ingredientDialog.showModal();
  if (!draft.name) ingredientForm.name.focus();
}

ingredientForm.name.addEventListener('input', () => {
  if (pickerTouched) return;
  const { contains, traces } = detectAllergens(ingredientForm.name.value);
  ingredientPicker.set(contains, traces);
});

ingredientForm.addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'save') return;
  const name = ingredientForm.name.value.trim();
  if (!name) return;
  const { contains, traces } = ingredientPicker.get();
  const existing = state.ingredients.find((i) => i.id === ingredientDraft.id);
  const item = {
    id: ingredientDraft.id ?? uid(),
    name,
    brand: ingredientForm.brand.value.trim(),
    barcode: ingredientForm.barcode.value.trim(),
    allergens: contains,
    traces,
    ingredientsText: ingredientDraft.ingredientsText ?? '',
    image: ingredientDraft.image ?? '',
    source: ingredientDraft.source ?? 'manuel',
  };
  if (existing) Object.assign(existing, item);
  else state.ingredients.push(item);
  save();
  ingredientOnSaved?.(item);
  toast(`« ${name} » enregistré`);
});

$('#ingredient-delete').addEventListener('click', () => {
  const ing = state.ingredients.find((i) => i.id === ingredientDraft?.id);
  if (!ing) return;
  const used = state.dishes.filter((d) => d.ingredientIds.includes(ing.id));
  const msg = used.length
    ? `Supprimer « ${ing.name} » ? Il sera retiré de ${used.length} plat(s) : ${used.map((d) => d.name).join(', ')}.`
    : `Supprimer « ${ing.name} » ?`;
  if (!confirm(msg)) return;
  state.ingredients = state.ingredients.filter((i) => i.id !== ing.id);
  for (const d of used) d.ingredientIds = d.ingredientIds.filter((id) => id !== ing.id);
  ingredientDialog.close();
  save();
});

// ---------------------------------------------------------------------------
// Scanner + Open Food Facts

const scanDialog = $('#scan-dialog');
const scanStatus = $('#scan-status');
let stopScan = null;
let scanOnSaved = null;
let scanBusy = false;

function setScanStatus(text, kind = '') {
  scanStatus.textContent = text;
  scanStatus.className = `status ${kind}`;
}

async function openScanner(onSaved = null) {
  scanOnSaved = onSaved;
  scanBusy = false;
  $('#scan-manual').code.value = '';
  setScanStatus('Ouverture de la caméra…');
  scanDialog.showModal();
  try {
    stopScan = await startScanner($('#scan-video'), {
      onCode: handleBarcode,
      onStatus: (t) => setScanStatus(t),
    });
    if (!scanDialog.open) stopScan();
  } catch (err) {
    const denied = err?.name === 'NotAllowedError';
    setScanStatus(
      denied ? 'Accès à la caméra refusé : autorisez-le dans le navigateur, ou tapez le code ci-dessous.' : err?.message || 'Caméra indisponible : tapez le code ci-dessous.',
      'error',
    );
  }
}

function closeScanner() {
  stopScan?.();
  stopScan = null;
  if (scanDialog.open) scanDialog.close();
}

scanDialog.addEventListener('close', () => {
  stopScan?.();
  stopScan = null;
});
$('#scan-close').addEventListener('click', closeScanner);

async function fetchOffProduct(code) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(offProductUrl(code), { signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Open Food Facts a répondu ${res.status}`);
    const data = await res.json();
    return data.status === 1 && data.product ? data.product : null;
  } finally {
    clearTimeout(timer);
  }
}

async function handleBarcode(code) {
  if (scanBusy) return;
  scanBusy = true;
  stopScan?.();
  const onSaved = scanOnSaved;
  const known = state.ingredients.find((i) => i.barcode === code);
  if (known) {
    closeScanner();
    toast(`Déjà dans vos ingrédients : ${known.name}`);
    openIngredient({ ...known }, onSaved);
    return;
  }
  setScanStatus(`Code ${code} — recherche sur Open Food Facts…`);
  let draft;
  try {
    const product = await fetchOffProduct(code);
    draft = product
      ? { id: uid(), ...ingredientFromOffProduct(product, code) }
      : { id: uid(), name: '', barcode: code, allergens: [], traces: [], source: 'manuel', notice: `Produit ${code} inconnu d’Open Food Facts : saisissez son nom et ses allergènes depuis l’étiquette.` };
  } catch {
    draft = { id: uid(), name: '', barcode: code, allergens: [], traces: [], source: 'manuel', notice: 'Open Food Facts injoignable (connexion ?) : saisissez le produit depuis l’étiquette.' };
  }
  closeScanner();
  openIngredient(draft, onSaved);
}

$('#scan-manual').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = e.target.code.value.replace(/\s/g, '');
  if (!isValidBarcode(code)) {
    setScanStatus('Code invalide : vérifiez les chiffres sous le code-barres.', 'error');
    return;
  }
  scanBusy = false;
  handleBarcode(code);
});

// ---------------------------------------------------------------------------
// Fenêtre plat

const dishDialog = $('#dish-dialog');
const dishForm = $('#dish-form');
let dishDraft = null;
const dishExtra = allergenPicker($('#dish-extra'), () => renderDishComputed());

function openDish(dish = null) {
  const isNew = !dish;
  dishDraft = {
    id: dish?.id ?? null,
    selected: new Set(dish?.ingredientIds ?? []),
  };
  $('#dish-dialog-title').textContent = isNew ? 'Nouveau plat' : 'Modifier le plat';
  dishForm.name.value = dish?.name ?? '';
  const lastCategory = state.dishes.at(-1)?.category;
  dishForm.category.value = dish?.category ?? lastCategory ?? 'Plats';
  dishExtra.set(dish?.extraAllergens ?? [], dish?.extraTraces ?? []);
  $('#dish-delete').hidden = isNew;
  $('#dish-ingredient-search').value = '';
  const cats = new Set(['Entrées', 'Plats', 'Desserts', 'Boissons', ...state.dishes.map((d) => d.category).filter(Boolean)]);
  $('#category-options').innerHTML = [...cats].map((c) => `<option value="${esc(c)}">`).join('');
  renderDishPicker();
  dishDialog.showModal();
  if (isNew) dishForm.name.focus();
}

function renderDishPicker() {
  const raw = $('#dish-ingredient-search').value.trim();
  const query = normalize(raw);
  const sorted = [...state.ingredients].sort((a, b) => {
    const sa = dishDraft.selected.has(a.id) ? 0 : 1;
    const sb = dishDraft.selected.has(b.id) ? 0 : 1;
    return sa - sb || a.name.localeCompare(b.name, 'fr');
  });
  const items = sorted.filter((i) => !query || normalize(`${i.name} ${i.brand}`).includes(query));
  const exact = state.ingredients.some((i) => normalize(i.name) === query);
  let html = '';
  if (raw && !exact) {
    const guess = detectAllergens(raw);
    html += `<label data-create="1"><span>➕</span><span class="grow">Créer « ${esc(raw)} »</span><span class="chips">${chipsHtml(guess)}</span></label>`;
  }
  html += items
    .map(
      (i) => `<label><input type="checkbox" data-ing="${esc(i.id)}" ${dishDraft.selected.has(i.id) ? 'checked' : ''}>
        <span class="grow">${esc(i.name)}${i.brand ? ` <small>· ${esc(i.brand)}</small>` : ''}</span>
        <small>${i.allergens.map(iconOf).join(' ')}</small></label>`,
    )
    .join('');
  if (!html) html = `<div class="empty" style="padding:14px">Tapez un ingrédient (ex. « crème fraîche ») pour le créer.</div>`;
  $('#dish-ingredient-picker').innerHTML = html;
  renderDishComputed();
}

function renderDishComputed() {
  const extra = dishExtra.get();
  const result = dishAllergens(
    { ingredientIds: [...dishDraft.selected], extraAllergens: extra.contains, extraTraces: extra.traces },
    ingredientsById(),
  );
  $('#dish-computed').innerHTML = chipsHtml(result, { emptyText: 'Aucun allergène détecté' });
}

function createIngredientFromText(raw) {
  const { contains, traces } = detectAllergens(raw);
  const item = {
    id: uid(), name: raw, brand: '', barcode: '', allergens: contains, traces, ingredientsText: '', image: '', source: 'auto',
  };
  state.ingredients.push(item);
  save();
  return item;
}

$('#dish-ingredient-search').addEventListener('input', renderDishPicker);
$('#dish-ingredient-search').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const raw = e.target.value.trim();
  if (!raw) return;
  const match = state.ingredients.find((i) => normalize(i.name) === normalize(raw));
  const item = match ?? createIngredientFromText(raw);
  dishDraft.selected.add(item.id);
  e.target.value = '';
  renderDishPicker();
});

$('#dish-ingredient-picker').addEventListener('click', (e) => {
  const create = e.target.closest('[data-create]');
  if (create) {
    e.preventDefault();
    const raw = $('#dish-ingredient-search').value.trim();
    const item = createIngredientFromText(raw);
    dishDraft.selected.add(item.id);
    $('#dish-ingredient-search').value = '';
    renderDishPicker();
    toast(`« ${item.name} » ajouté — allergènes modifiables dans « Ingrédients »`);
  }
});

$('#dish-ingredient-picker').addEventListener('change', (e) => {
  const id = e.target.dataset.ing;
  if (!id) return;
  if (e.target.checked) dishDraft.selected.add(id);
  else dishDraft.selected.delete(id);
  renderDishComputed();
});

$('#dish-scan').addEventListener('click', () =>
  openScanner((item) => {
    if (!dishDialog.open || !dishDraft) return;
    dishDraft.selected.add(item.id);
    renderDishPicker();
  }),
);

dishForm.addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'save') return;
  const name = dishForm.name.value.trim();
  if (!name) return;
  const extra = dishExtra.get();
  const dish = {
    id: dishDraft.id ?? uid(),
    name,
    category: dishForm.category.value.trim(),
    // On garde l'ordre de la bibliothèque, sans ingrédient supprimé entre-temps.
    ingredientIds: state.ingredients.filter((i) => dishDraft.selected.has(i.id)).map((i) => i.id),
    extraAllergens: extra.contains,
    extraTraces: extra.traces,
  };
  const existing = state.dishes.find((d) => d.id === dish.id);
  if (existing) Object.assign(existing, dish);
  else state.dishes.push(dish);
  save();
});

$('#dish-delete').addEventListener('click', () => {
  const dish = state.dishes.find((d) => d.id === dishDraft?.id);
  if (!dish || !confirm(`Supprimer « ${dish.name} » de la carte ?`)) return;
  state.dishes = state.dishes.filter((d) => d.id !== dish.id);
  dishDialog.close();
  save();
});

// Les boutons « Annuler » ferment sans exiger les champs obligatoires.
for (const btn of $$('button[value="cancel"]')) btn.formNoValidate = true;

// ---------------------------------------------------------------------------
// Actions générales

$('#add-dish').addEventListener('click', () => openDish());
$('#add-ingredient').addEventListener('click', () =>
  openIngredient({ id: uid(), name: '', allergens: [], traces: [], source: 'manuel' }),
);
$('#scan-ingredient').addEventListener('click', () => openScanner());
$('#ingredient-search').addEventListener('input', renderIngredients);

document.addEventListener('click', (e) => {
  const dishBtn = e.target.closest('[data-edit-dish]');
  if (dishBtn) openDish(state.dishes.find((d) => d.id === dishBtn.dataset.editDish));
  const ingBtn = e.target.closest('[data-edit-ingredient]');
  if (ingBtn) {
    const ing = state.ingredients.find((i) => i.id === ingBtn.dataset.editIngredient);
    if (ing) openIngredient({ ...ing });
  }
});

function fillInputs() {
  $('#restaurant-name').value = state.restaurant.name;
  $('#restaurant-info').value = state.restaurant.info;
  $('#public-base').value = state.settings.publicBase;
}

$('#restaurant-name').addEventListener('input', (e) => {
  state.restaurant.name = e.target.value;
  save();
});
$('#restaurant-info').addEventListener('input', (e) => {
  state.restaurant.info = e.target.value;
  save();
});
$('#public-base').addEventListener('change', (e) => {
  state.settings.publicBase = e.target.value.trim();
  save();
});
$('#show-traces').addEventListener('change', renderSheet);

function printSection(name) {
  document.body.dataset.print = name;
  const done = () => {
    delete document.body.dataset.print;
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

$('#print-table').addEventListener('click', () => {
  renderSheet();
  printSection('tableau');
});
$('#print-qr').addEventListener('click', async () => {
  await renderQr();
  printSection('qr');
});

$('#export-json').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const slug = normalize(state.restaurant.name || 'carte').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  a.href = URL.createObjectURL(blob);
  a.download = `allergenes-${slug || 'carte'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#import-json').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const next = sanitizeState(JSON.parse(await file.text()));
    if (!confirm(`Remplacer la carte actuelle par « ${next.restaurant.name || file.name} » (${next.dishes.length} plats) ?`)) return;
    state = next;
    fillInputs();
    save();
    toast('Sauvegarde importée');
  } catch {
    toast('Fichier illisible');
  }
});

$('#load-demo').addEventListener('click', () => {
  if (state.dishes.length && !confirm('Remplacer votre carte par l’exemple ? Pensez à exporter vos données avant.')) return;
  state = demoState();
  fillInputs();
  save();
  toast('Exemple chargé : Brasserie du Beffroi');
});

$('#reset-all').addEventListener('click', () => {
  if (!confirm('Effacer toute la carte et tous les ingrédients de cet appareil ?')) return;
  state = emptyState();
  fillInputs();
  save();
});

// ---------------------------------------------------------------------------

fillInputs();
render();
let initialTab = 'carte';
try {
  initialTab = localStorage.getItem(TAB_KEY) || 'carte';
} catch {
  // Préférence non essentielle.
}
showTab($(`.tab[data-tab="${initialTab}"]`) ? initialTab : 'carte');
