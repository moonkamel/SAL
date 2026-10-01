// Outil du chef : saisie rapide de la carte, vérification plat par plat,
// tableau imprimable et QR code.

import {
  ALLERGENS,
  addDish,
  allergenLabel,
  buildPublicMenu,
  demoState,
  detectAllergens,
  emptyState,
  encodeMenu,
  findOrCreateIngredient,
  ingredientFromOffProduct,
  isValidBarcode,
  normalize,
  offProductUrl,
  parseMenuText,
  sanitizeState,
  sortIds,
  splitIngredients,
  uid,
} from './core.js';
import { startScanner } from './scanner.js';
import qrcode from '../vendor/qrcode.mjs';

const STORAGE_KEY = 'allergenes:v1';
const TAB_KEY = 'allergenes:tab';
const CATEGORY_ORDER = ['Entrées', 'Plats', 'Desserts', 'Boissons'];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const label = (id) => allergenLabel(id, 'fr');
const iconOf = (id) => ALLERGENS.find((a) => a.id === id)?.icon ?? '';
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

let state = loadState();
let manualMode = false;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeState(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

/** Range les plats par catégorie (Entrées, Plats, Desserts…) puis enregistre. */
function persist() {
  const firstSeen = new Map();
  state.dishes.forEach((d, i) => {
    const cat = d.category || 'Plats';
    if (!firstSeen.has(cat)) firstSeen.set(cat, i);
  });
  const rank = (cat) => {
    const i = CATEGORY_ORDER.indexOf(cat || 'Plats');
    return i >= 0 ? i : 100 + firstSeen.get(cat || 'Plats');
  };
  state.dishes = state.dishes
    .map((d, i) => [d, i])
    .sort(([a, i], [b, j]) => rank(a.category) - rank(b.category) || i - j)
    .map(([d]) => d);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast('Impossible d’enregistrer sur cet appareil : exportez vos données (menu ⋯).');
  }
}

function toast(message, { action, onAction, duration = 3800 } = {}) {
  $('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  if (action) {
    $('button', el).onclick = () => {
      el.remove();
      onAction();
    };
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), action ? 6000 : duration);
}

const ingredientsById = () => new Map(state.ingredients.map((i) => [i.id, i]));

function groupedDishes() {
  const groups = new Map();
  for (const dish of state.dishes) {
    const cat = dish.category.trim() || 'Plats';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(dish);
  }
  return groups;
}

function categories() {
  return [...new Set([...CATEGORY_ORDER, ...state.dishes.map((d) => d.category).filter(Boolean)])];
}

/** Détail des allergènes d'un plat : d'où vient chacun (ingrédient ou ajout manuel). */
function dishDetail(dish, byId = ingredientsById()) {
  const ingContains = new Map();
  const ingTraces = new Map();
  for (const ingId of dish.ingredientIds) {
    const ing = byId.get(ingId);
    if (!ing) continue;
    for (const id of ing.allergens) ingContains.set(id, [...(ingContains.get(id) ?? []), ing.name]);
    for (const id of ing.traces) ingTraces.set(id, [...(ingTraces.get(id) ?? []), ing.name]);
  }
  const cells = {};
  for (const { id } of ALLERGENS) {
    const contains = ingContains.has(id) || dish.extraAllergens.includes(id);
    const traces = !contains && (ingTraces.has(id) || dish.extraTraces.includes(id));
    cells[id] = {
      state: contains ? 'contains' : traces ? 'traces' : 'none',
      locked: ingContains.has(id),
      from: ingContains.get(id) ?? ingTraces.get(id) ?? [],
      extra: (contains && !ingContains.has(id)) || (traces && !ingTraces.has(id)),
    };
  }
  return {
    cells,
    contains: sortIds(ALLERGENS.filter((a) => cells[a.id].state === 'contains').map((a) => a.id)),
    traces: sortIds(ALLERGENS.filter((a) => cells[a.id].state === 'traces').map((a) => a.id)),
  };
}

function stripHtml(cells) {
  return ALLERGENS.map((a) => {
    const c = cells[a.id];
    const what = c.state === 'contains' ? 'contient' : c.state === 'traces' ? 'peut contenir' : 'absent';
    const from = c.from.length ? ` (${c.from.join(', ')})` : '';
    return `<button type="button" class="al" data-al="${a.id}" data-state="${c.state}" data-extra="${c.extra ? 1 : 0}"
      title="${esc(label(a.id))} : ${what}${esc(from)}" aria-label="${esc(label(a.id))} : ${what}"><span>${a.icon}</span></button>`;
  }).join('');
}

function summaryHtml(contains, traces) {
  if (!contains.length && !traces.length) return '<span class="none">✓ Aucun des 14 allergènes</span>';
  const parts = [];
  if (contains.length) parts.push(`Contient <b>${contains.map((id) => esc(label(id))).join(', ')}</b>`);
  if (traces.length) parts.push(`peut contenir <i>${traces.map((id) => esc(label(id))).join(', ')}</i>`);
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Onglets

function showTab(name) {
  for (const tab of $$('.step')) tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
  for (const panel of $$('.panel')) panel.hidden = panel.id !== `panel-${name}`;
  try {
    localStorage.setItem(TAB_KEY, name);
  } catch {
    // Préférence non essentielle.
  }
  if (name === 'ingredients') renderIngredients();
  if (name === 'imprimer') renderOutputs();
  window.scrollTo({ top: 0 });
}
for (const tab of $$('.step')) tab.addEventListener('click', () => showTab(tab.dataset.tab));
const currentTab = () => $('.step[aria-selected="true"]')?.dataset.tab;

// ---------------------------------------------------------------------------
// Rendu général

function render() {
  $('#restaurant-title').textContent = state.restaurant.name ? `· ${state.restaurant.name}` : '';
  renderProgress();
  const empty = !state.dishes.length && !manualMode;
  $('#onboarding').hidden = !empty;
  $('#editor').hidden = empty;
  if (!empty) renderDishes();
  if (currentTab() === 'ingredients') renderIngredients();
  if (currentTab() === 'imprimer') renderOutputs();
  $('#ing-options').innerHTML = state.ingredients.map((i) => `<option value="${esc(i.name)}">`).join('');
}

function renderProgress() {
  const total = state.dishes.length;
  const done = state.dishes.filter((d) => d.checked).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $('#progress-pill').hidden = !total;
  $('#progress-ring').style.setProperty('--p', pct);
  $('#progress-text').textContent = `${done}/${total}`;
  const banner = $('#progress-banner');
  banner.hidden = !total;
  banner.classList.toggle('done', total > 0 && done === total);
  $('#progress-bar').style.width = `${pct}%`;
  $('#progress-banner-text').textContent =
    done === total ? '🎉 Tous les plats sont vérifiés' : `${done} plat${done > 1 ? 's' : ''} vérifié${done > 1 ? 's' : ''} sur ${total}`;
  $('#next-unchecked').textContent = done === total ? 'Imprimer →' : 'Vérifier le suivant →';
}

// ---------------------------------------------------------------------------
// 1. Ma carte

function dishCardHtml(dish, byId) {
  const { cells, contains, traces } = dishDetail(dish, byId);
  const ings = dish.ingredientIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map(
      (i) => `<span class="ing"><span class="nm" data-goto-ing="${esc(i.id)}" title="Modifier cet ingrédient">${esc(i.name)}</span>${
        i.allergens.length ? `<span class="ic">${i.allergens.map(iconOf).join('')}</span>` : ''
      }<button type="button" data-remove-ing="${esc(i.id)}" aria-label="Retirer ${esc(i.name)}">×</button></span>`,
    )
    .join('');
  const options = categories()
    .map((c) => `<option ${c === (dish.category || 'Plats') ? 'selected' : ''}>${esc(c)}</option>`)
    .join('');
  return `<article class="dcard ${dish.checked ? 'checked' : ''}" data-dish="${esc(dish.id)}">
    <div class="dcard-head">
      <input class="dcard-name" value="${esc(dish.name)}" aria-label="Nom du plat" data-field="name">
      <select class="cat-select" data-field="category" aria-label="Catégorie">${options}<option value="__new">+ Nouvelle…</option></select>
      <button type="button" class="check-btn" data-check aria-pressed="${dish.checked}"><span class="box">✓</span><span class="lbl">${dish.checked ? 'Vérifié' : 'Vérifier'}</span></button>
      <button type="button" class="btn ghost icon small" data-delete aria-label="Supprimer le plat" title="Supprimer">🗑️</button>
    </div>
    <div class="ings">
      ${ings}
      <span class="ing-add">
        <input data-add-ing placeholder="${dish.ingredientIds.length ? '+ ingrédient' : 'Ingrédients : crème, lardons, œufs…'}" list="ing-options" aria-label="Ajouter un ingrédient" enterkeyhint="done">
        <button type="button" class="btn small" data-scan-dish title="Scanner un produit pour ce plat" aria-label="Scanner un produit">📷</button>
      </span>
    </div>
    <div class="astrip">${stripHtml(cells)}</div>
    <div class="al-summary">${summaryHtml(contains, traces)}</div>
  </article>`;
}

function renderDishes() {
  const byId = ingredientsById();
  let html = '';
  for (const [cat, dishes] of groupedDishes()) {
    html += `<div class="section-title"><h2>${esc(cat)}</h2><small class="muted">${plural(dishes.length, 'plat')}</small></div>`;
    html += dishes.map((d) => dishCardHtml(d, byId)).join('');
  }
  $('#dish-list').innerHTML =
    html || `<div class="empty">Tapez le nom d’un plat ci-dessus, ou collez votre carte entière.</div>`;
}

/** Re-dessine une seule carte de plat, en gardant le curseur où il était. */
function refreshDish(dishId, { focusAdd = false } = {}) {
  const card = $(`.dcard[data-dish="${CSS.escape(dishId)}"]`);
  const dish = state.dishes.find((d) => d.id === dishId);
  if (!card || !dish) return render();
  const hadFocus = focusAdd || document.activeElement?.matches?.('[data-add-ing]') && card.contains(document.activeElement);
  const tpl = document.createElement('template');
  tpl.innerHTML = dishCardHtml(dish, ingredientsById());
  const next = tpl.content.firstElementChild;
  card.replaceWith(next);
  if (hadFocus) $('[data-add-ing]', next).focus();
  renderProgress();
  $('#ing-options').innerHTML = state.ingredients.map((i) => `<option value="${esc(i.name)}">`).join('');
}

const dishOf = (el) => state.dishes.find((d) => d.id === el.closest('.dcard')?.dataset.dish);

function addIngredientsToDish(dish, text) {
  const names = splitIngredients(text);
  for (const name of names) {
    const ing = findOrCreateIngredient(state, name);
    if (!dish.ingredientIds.includes(ing.id)) dish.ingredientIds.push(ing.id);
  }
  if (names.length) dish.checked = false;
  return names.length;
}

$('#dish-list').addEventListener('click', (e) => {
  const dish = dishOf(e.target);
  if (!dish) return;

  const al = e.target.closest('[data-al]');
  if (al) {
    const id = al.dataset.al;
    const cell = dishDetail(dish).cells[id];
    if (cell.locked) {
      toast(`${label(id)} vient de : ${cell.from.join(', ')}. Retirez l’ingrédient ou corrigez-le dans « Ingrédients ».`);
      return;
    }
    // Ajout manuel : rien → contient → peut contenir → rien
    if (dish.extraAllergens.includes(id)) {
      dish.extraAllergens = dish.extraAllergens.filter((x) => x !== id);
      if (!cell.from.length) dish.extraTraces = sortIds([...dish.extraTraces, id]);
    } else if (dish.extraTraces.includes(id)) {
      dish.extraTraces = dish.extraTraces.filter((x) => x !== id);
    } else {
      dish.extraAllergens = sortIds([...dish.extraAllergens, id]);
    }
    dish.checked = false;
    persist();
    refreshDish(dish.id);
    return;
  }

  if (e.target.closest('[data-check]')) {
    dish.checked = !dish.checked;
    persist();
    refreshDish(dish.id);
    if (dish.checked && state.dishes.every((d) => d.checked)) {
      toast('🎉 Carte vérifiée ! Il ne reste plus qu’à imprimer.', { action: 'Imprimer', onAction: () => showTab('imprimer') });
    }
    return;
  }

  const remove = e.target.closest('[data-remove-ing]');
  if (remove) {
    dish.ingredientIds = dish.ingredientIds.filter((id) => id !== remove.dataset.removeIng);
    dish.checked = false;
    persist();
    refreshDish(dish.id, { focusAdd: true });
    return;
  }

  const goto = e.target.closest('[data-goto-ing]');
  if (goto) {
    const ing = state.ingredients.find((i) => i.id === goto.dataset.gotoIng);
    showTab('ingredients');
    $('#ingredient-search').value = ing?.name ?? '';
    renderIngredients();
    return;
  }

  if (e.target.closest('[data-scan-dish]')) {
    openScanner({ dishId: dish.id });
    return;
  }

  if (e.target.closest('[data-delete]')) {
    const index = state.dishes.indexOf(dish);
    state.dishes.splice(index, 1);
    persist();
    render();
    toast(`« ${dish.name} » supprimé`, {
      action: 'Annuler',
      onAction: () => {
        state.dishes.splice(index, 0, dish);
        persist();
        render();
      },
    });
  }
});

$('#dish-list').addEventListener('keydown', (e) => {
  if (e.target.matches('[data-add-ing]') && (e.key === 'Enter' || e.key === ',')) {
    e.preventDefault();
    const dish = dishOf(e.target);
    if (dish && addIngredientsToDish(dish, e.target.value)) {
      persist();
      refreshDish(dish.id, { focusAdd: true });
    }
  } else if (e.target.matches('[data-add-ing]') && e.key === 'Backspace' && !e.target.value) {
    // Retour arrière dans un champ vide : retire le dernier ingrédient.
    const dish = dishOf(e.target);
    if (dish?.ingredientIds.length) {
      dish.ingredientIds.pop();
      dish.checked = false;
      persist();
      refreshDish(dish.id, { focusAdd: true });
    }
  } else if (e.target.matches('.dcard-name') && e.key === 'Enter') {
    e.target.blur();
  }
});

$('#dish-list').addEventListener('change', (e) => {
  const dish = dishOf(e.target);
  if (!dish) return;
  if (e.target.matches('[data-add-ing]')) {
    // Choix dans la liste de suggestions (sans touche Entrée).
    if (state.ingredients.some((i) => i.name === e.target.value) && addIngredientsToDish(dish, e.target.value)) {
      persist();
      refreshDish(dish.id, { focusAdd: true });
    }
    return;
  }
  if (e.target.dataset.field === 'name') {
    const name = e.target.value.trim();
    if (name) dish.name = name;
    else e.target.value = dish.name;
    persist();
  } else if (e.target.dataset.field === 'category') {
    let cat = e.target.value;
    if (cat === '__new') cat = (prompt('Nom de la nouvelle catégorie (ex. Formules, Boissons) :') || '').trim();
    if (cat) dish.category = cat;
    persist();
    render();
    $(`.dcard[data-dish="${CSS.escape(dish.id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
});

// Saisie rapide d'un plat
const composer = $('#composer-name');
composer.addEventListener('input', () => {
  const text = composer.value.trim();
  const hint = $('#composer-hint');
  if (!text) {
    hint.innerHTML = 'Astuce : tapez le nom d’un plat connu, ses ingrédients se remplissent tout seuls. Ou « Nom : ingrédient, ingrédient ».';
    return;
  }
  const [parsed] = parseMenuText(text, lastCategory());
  if (!parsed) return;
  const icons = sortIds(parsed.ingredients.flatMap((i) => detectAllergens(i).contains)).map(iconOf).join(' ');
  if (parsed.preset) {
    hint.innerHTML = `<span class="found">✓ Recette type reconnue</span> · ${plural(parsed.ingredients.length, 'ingrédient')} ${icons} · Entrée pour ajouter`;
  } else if (parsed.ingredients.length) {
    hint.innerHTML = `${plural(parsed.ingredients.length, 'ingrédient')} ${icons} · Entrée pour ajouter`;
  } else {
    hint.textContent = 'Plat inconnu : vous ajouterez ses ingrédients juste après. Entrée pour ajouter.';
  }
});

function lastCategory() {
  return state.dishes.at(-1)?.category || 'Plats';
}

$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const [parsed] = parseMenuText(composer.value, lastCategory());
  if (!parsed) {
    composer.focus();
    return;
  }
  const dish = addDish(state, parsed);
  persist();
  composer.value = '';
  composer.dispatchEvent(new Event('input'));
  render();
  const card = $(`.dcard[data-dish="${CSS.escape(dish.id)}"]`);
  card?.classList.add('flash');
  if (!dish.ingredientIds.length) {
    card?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('[data-add-ing]', card)?.focus({ preventScroll: true });
  } else {
    composer.focus();
    toast(`« ${dish.name} » ajouté avec ${plural(dish.ingredientIds.length, 'ingrédient')}`, {
      action: 'Voir',
      onAction: () => card?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    });
  }
});

$('#next-unchecked').addEventListener('click', () => {
  const next = state.dishes.find((d) => !d.checked);
  if (!next) return showTab('imprimer');
  const card = $(`.dcard[data-dish="${CSS.escape(next.id)}"]`);
  card?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  card?.classList.remove('flash');
  void card?.offsetWidth;
  card?.classList.add('flash');
});
$('#progress-pill').addEventListener('click', () => {
  showTab('carte');
  $('#next-unchecked').click();
});

// Accueil
$('#onboarding-name').addEventListener('input', (e) => {
  state.restaurant.name = e.target.value;
  persist();
  $('#restaurant-title').textContent = state.restaurant.name ? `· ${state.restaurant.name}` : '';
});

document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'paste') openPaste();
  if (action === 'scan') openScanner();
  if (action === 'demo') loadDemo();
  if (action === 'manual') {
    manualMode = true;
    render();
    composer.focus();
  }
});

// ---------------------------------------------------------------------------
// Coller une carte entière

const pasteDialog = $('#paste-dialog');
const pasteText = $('#paste-text');
let pasted = [];

function openPaste() {
  pasteText.value = '';
  updatePastePreview();
  pasteDialog.showModal();
  pasteText.focus();
}

function updatePastePreview() {
  pasted = parseMenuText(pasteText.value, 'Plats');
  const cats = new Set(pasted.map((d) => d.category));
  const presets = pasted.filter((d) => d.preset).length;
  const withIngredients = pasted.filter((d) => d.ingredients.length).length;
  $('#paste-save').disabled = !pasted.length;
  $('#paste-save').textContent = pasted.length ? `Ajouter ${plural(pasted.length, 'plat')}` : 'Ajouter les plats';
  $('#paste-summary').className = `status ${pasted.length ? 'ok' : ''}`;
  $('#paste-summary').textContent = pasted.length
    ? `${plural(pasted.length, 'plat')} · ${plural(cats.size, 'catégorie')} · ${withIngredients} avec ingrédients${presets ? ` (dont ${presets} recette${presets > 1 ? 's' : ''} type)` : ''}`
    : '';
  const preview = $('#paste-preview');
  preview.hidden = !pasted.length;
  let html = '';
  let cat = null;
  for (const d of pasted) {
    if (d.category !== cat) {
      cat = d.category;
      html += `<div class="cat">${esc(cat)}</div>`;
    }
    const icons = sortIds(d.ingredients.flatMap((i) => detectAllergens(i).contains)).map(iconOf).join(' ');
    html += `<div class="pp"><span>${esc(d.name)}</span><span>${icons || (d.ingredients.length ? '✓' : '<small class="muted">à compléter</small>')}</span></div>`;
  }
  preview.innerHTML = html;
}
pasteText.addEventListener('input', updatePastePreview);

$('#paste-form').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'save' || !pasted.length) return;
  for (const d of pasted) addDish(state, d);
  persist();
  manualMode = true;
  showTab('carte');
  render();
  const missing = pasted.filter((d) => !d.ingredients.length).length;
  toast(
    `${plural(pasted.length, 'plat')} ajouté${pasted.length > 1 ? 's' : ''}.${missing ? ` ${missing} à compléter.` : ''} Vérifiez-les un par un.`,
  );
});

// ---------------------------------------------------------------------------
// 2. Ingrédients

function renderIngredients() {
  const list = $('#ingredient-list');
  const query = normalize($('#ingredient-search').value);
  const usage = new Map();
  for (const d of state.dishes) for (const id of d.ingredientIds) usage.set(id, [...(usage.get(id) ?? []), d.name]);
  const items = state.ingredients
    .filter((i) => !query || normalize(`${i.name} ${i.brand} ${i.barcode}`).includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (!items.length) {
    list.innerHTML = `<div class="empty">${state.ingredients.length ? 'Aucun résultat.' : 'Les ingrédients de vos plats apparaîtront ici.'}</div>`;
    return;
  }
  list.innerHTML = items
    .map((i) => {
      const cells = Object.fromEntries(
        ALLERGENS.map((a) => [
          a.id,
          { state: i.allergens.includes(a.id) ? 'contains' : i.traces.includes(a.id) ? 'traces' : 'none', from: [], extra: false },
        ]),
      );
      const used = usage.get(i.id) ?? [];
      const thumb = i.image ? `<img class="thumb" src="${esc(i.image)}" alt="" loading="lazy">` : `<span class="thumb">${i.barcode ? '🥫' : '🥕'}</span>`;
      const tag = i.source === 'openfoodfacts' ? '<span class="tag off">Open Food Facts</span>' : i.source === 'auto' ? '<span class="tag auto">deviné</span>' : '';
      return `<div class="lib-row" data-ing="${esc(i.id)}">
        ${thumb}
        <div style="min-width:0">
          <input class="lib-name" value="${esc(i.name)}" aria-label="Nom de l’ingrédient">
          <div class="row" style="gap:6px;margin-top:2px">${tag}<small title="${esc(used.join(', '))}">${used.length ? `dans ${plural(used.length, 'plat')}` : 'inutilisé'}${i.brand ? ` · ${esc(i.brand)}` : ''}</small></div>
        </div>
        <button class="btn ghost icon small" data-delete-ing aria-label="Supprimer l’ingrédient" title="Supprimer">🗑️</button>
        <div class="astrip">${stripHtml(cells)}</div>
      </div>`;
    })
    .join('');
}

$('#ingredient-search').addEventListener('input', renderIngredients);
const ingOf = (el) => state.ingredients.find((i) => i.id === el.closest('.lib-row')?.dataset.ing);

/** Un ingrédient change : les plats qui l'utilisent sont à revérifier. */
function uncheckDishesUsing(ingId) {
  let n = 0;
  for (const d of state.dishes) {
    if (d.ingredientIds.includes(ingId) && d.checked) {
      d.checked = false;
      n += 1;
    }
  }
  return n;
}

$('#ingredient-list').addEventListener('click', (e) => {
  const ing = ingOf(e.target);
  if (!ing) return;
  const al = e.target.closest('[data-al]');
  if (al) {
    const id = al.dataset.al;
    if (ing.allergens.includes(id)) {
      ing.allergens = ing.allergens.filter((x) => x !== id);
      ing.traces = sortIds([...ing.traces, id]);
    } else if (ing.traces.includes(id)) {
      ing.traces = ing.traces.filter((x) => x !== id);
    } else {
      ing.allergens = sortIds([...ing.allergens, id]);
    }
    if (ing.source === 'auto') ing.source = 'manuel';
    const n = uncheckDishesUsing(ing.id);
    persist();
    renderIngredients();
    renderProgress();
    if (n) toast(`${plural(n, 'plat')} à revérifier`);
    return;
  }
  if (e.target.closest('[data-delete-ing]')) {
    const used = state.dishes.filter((d) => d.ingredientIds.includes(ing.id));
    const snapshot = used.map((d) => [d, [...d.ingredientIds]]);
    const index = state.ingredients.indexOf(ing);
    state.ingredients.splice(index, 1);
    for (const d of used) d.ingredientIds = d.ingredientIds.filter((id) => id !== ing.id);
    persist();
    render();
    renderIngredients();
    toast(`« ${ing.name} » supprimé${used.length ? ` de ${plural(used.length, 'plat')}` : ''}`, {
      action: 'Annuler',
      onAction: () => {
        state.ingredients.splice(index, 0, ing);
        for (const [d, ids] of snapshot) d.ingredientIds = ids;
        persist();
        render();
        renderIngredients();
      },
    });
  }
});

$('#ingredient-list').addEventListener('change', (e) => {
  const ing = ingOf(e.target);
  if (!ing || !e.target.matches('.lib-name')) return;
  const name = e.target.value.trim();
  if (!name) {
    e.target.value = ing.name;
    return;
  }
  ing.name = name;
  persist();
  render();
});

// ---------------------------------------------------------------------------
// Scanner + Open Food Facts

const scanDialog = $('#scan-dialog');
const scanStatus = $('#scan-status');
let stopScan = null;
let scanContext = {};
let scanBusy = false;

function setScanStatus(text, kind = '') {
  scanStatus.textContent = text;
  scanStatus.className = `status ${kind}`;
}

async function openScanner(context = {}) {
  scanContext = context;
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
    setScanStatus(
      err?.name === 'NotAllowedError'
        ? 'Accès à la caméra refusé : autorisez-le dans le navigateur, ou tapez le code ci-dessous.'
        : err?.message || 'Caméra indisponible : tapez le code ci-dessous.',
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

function attachToDish(ing, dishId) {
  const dish = state.dishes.find((d) => d.id === dishId);
  if (!dish) return false;
  if (!dish.ingredientIds.includes(ing.id)) dish.ingredientIds.push(ing.id);
  dish.checked = false;
  return true;
}

async function handleBarcode(code) {
  if (scanBusy) return;
  scanBusy = true;
  stopScan?.();
  const context = scanContext;
  const known = state.ingredients.find((i) => i.barcode === code);
  if (known) {
    closeScanner();
    if (context.dishId && attachToDish(known, context.dishId)) {
      persist();
      refreshDish(context.dishId);
      toast(`« ${known.name} » ajouté au plat`);
    } else {
      toast(`Déjà dans vos ingrédients : ${known.name}`);
      showTab('ingredients');
      $('#ingredient-search').value = known.name;
      renderIngredients();
    }
    return;
  }
  setScanStatus(`Code ${code} — recherche sur Open Food Facts…`);
  let draft;
  try {
    const product = await fetchOffProduct(code);
    draft = product
      ? ingredientFromOffProduct(product, code)
      : { name: '', barcode: code, allergens: [], traces: [], source: 'manuel', notice: 'Produit inconnu d’Open Food Facts : tapez son nom et touchez ses allergènes (voir l’étiquette).' };
  } catch {
    draft = { name: '', barcode: code, allergens: [], traces: [], source: 'manuel', notice: 'Open Food Facts injoignable : tapez le nom et les allergènes depuis l’étiquette.' };
  }
  closeScanner();
  openProduct(draft, context);
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

// Fiche du produit scanné
const productDialog = $('#product-dialog');
const productForm = $('#product-form');
let productDraft = null;
let productContext = {};

function renderProductStrip() {
  const cells = Object.fromEntries(
    ALLERGENS.map((a) => [
      a.id,
      { state: productDraft.allergens.includes(a.id) ? 'contains' : productDraft.traces.includes(a.id) ? 'traces' : 'none', from: [], extra: false },
    ]),
  );
  $('#product-strip').innerHTML = stripHtml(cells);
  $('#product-summary').innerHTML = summaryHtml(productDraft.allergens, productDraft.traces);
}

function openProduct(draft, context) {
  productDraft = { ...draft, allergens: [...draft.allergens], traces: [...draft.traces] };
  productContext = context;
  const dish = state.dishes.find((d) => d.id === context.dishId);
  $('#product-title').textContent = draft.source === 'openfoodfacts' ? 'Produit trouvé' : 'Nouveau produit';
  $('#product-head').innerHTML = `${draft.image ? `<img src="${esc(draft.image)}" alt="">` : '<span class="thumb">🥫</span>'}
    <div><strong>${esc(draft.name || `Code ${draft.barcode}`)}</strong>${draft.brand ? `<br><small>${esc(draft.brand)}</small>` : ''}
    <div class="status ${draft.notice ? 'error' : 'ok'}" style="margin:4px 0 0">${esc(draft.notice || 'Allergènes repris d’Open Food Facts : vérifiez avec l’étiquette.')}</div></div>`;
  productForm.name.value = draft.name;
  $('#product-save').textContent = dish ? `Ajouter à « ${dish.name} »` : 'Ajouter à mes ingrédients';
  const text = $('#product-text');
  text.hidden = !draft.ingredientsText;
  $('p', text).textContent = draft.ingredientsText ?? '';
  renderProductStrip();
  productDialog.showModal();
  if (!draft.name) productForm.name.focus();
}

$('#product-strip').addEventListener('click', (e) => {
  const id = e.target.closest('[data-al]')?.dataset.al;
  if (!id) return;
  if (productDraft.allergens.includes(id)) {
    productDraft.allergens = productDraft.allergens.filter((x) => x !== id);
    productDraft.traces = sortIds([...productDraft.traces, id]);
  } else if (productDraft.traces.includes(id)) {
    productDraft.traces = productDraft.traces.filter((x) => x !== id);
  } else {
    productDraft.allergens = sortIds([...productDraft.allergens, id]);
  }
  renderProductStrip();
});

productForm.addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'save') return;
  const name = productForm.name.value.trim();
  if (!name) return;
  const ing = {
    id: uid(),
    name,
    brand: productDraft.brand ?? '',
    barcode: productDraft.barcode ?? '',
    allergens: productDraft.allergens,
    traces: productDraft.traces,
    ingredientsText: productDraft.ingredientsText ?? '',
    image: productDraft.image ?? '',
    source: productDraft.source === 'openfoodfacts' ? 'openfoodfacts' : 'manuel',
  };
  state.ingredients.push(ing);
  const attached = productContext.dishId && attachToDish(ing, productContext.dishId);
  persist();
  if (attached) refreshDish(productContext.dishId);
  else render();
  if (currentTab() === 'ingredients') renderIngredients();
  toast(attached ? `« ${name} » ajouté au plat` : `« ${name} » ajouté à vos ingrédients`);
});

// ---------------------------------------------------------------------------
// 3. Imprimer & QR

function formatDate(d = new Date()) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderOutputs() {
  renderChecklist();
  renderSheet();
  renderMiniSheet();
  renderQr();
}

function renderChecklist() {
  const total = state.dishes.length;
  const unchecked = state.dishes.filter((d) => !d.checked).length;
  const emptyDishes = state.dishes.filter((d) => !d.ingredientIds.length && !d.extraAllergens.length).length;
  const items = [
    [!!state.restaurant.name.trim(), state.restaurant.name.trim() ? `Restaurant : ${esc(state.restaurant.name)}` : 'Nom du restaurant manquant', '<button class="link" data-open-menu>Ajouter</button>'],
    [total > 0, total ? `${plural(total, 'plat')} sur la carte` : 'Aucun plat', '<button class="link" data-goto="carte">Ajouter des plats</button>'],
    [total > 0 && !unchecked, unchecked ? `${plural(unchecked, 'plat')} à vérifier` : 'Tous les plats sont vérifiés', '<button class="link" data-goto="verify">Vérifier</button>'],
  ];
  if (emptyDishes) items.push([false, `${plural(emptyDishes, 'plat')} sans ingrédient`, '<button class="link" data-goto="verify">Compléter</button>']);
  $('#checklist').innerHTML = items
    .map(([ok, text, action]) => `<li class="${ok ? 'ok' : 'todo'}"><span class="dot">${ok ? '✓' : '!'}</span><span>${text}</span>${ok ? '' : action}</li>`)
    .join('');
}

$('#checklist').addEventListener('click', (e) => {
  if (e.target.closest('[data-open-menu]')) openMenu();
  const goto = e.target.closest('[data-goto]')?.dataset.goto;
  if (goto === 'carte') {
    showTab('carte');
    composer.focus();
  }
  if (goto === 'verify') {
    showTab('carte');
    $('#next-unchecked').click();
  }
});

function renderSheet() {
  const sheet = $('#sheet');
  const showTraces = $('#show-traces').checked;
  if (!state.dishes.length) {
    sheet.innerHTML = `<div class="empty">Le tableau apparaîtra ici dès que vous aurez ajouté des plats.</div>`;
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
      const { contains, traces } = dishDetail(dish, byId);
      body += `<tr><td class="dish">${esc(dish.name)}</td>${ALLERGENS.map((a) => {
        if (contains.includes(a.id)) return `<td class="yes" aria-label="contient"></td>`;
        if (showTraces && traces.includes(a.id)) return `<td class="maybe" aria-label="peut contenir"></td>`;
        return '<td></td>';
      }).join('')}</tr>`;
    }
  }
  sheet.innerHTML = `
    <div class="sheet-head">
      <div>
        <div class="kicker">Information allergènes</div>
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
      <span><span class="d"></span>Contient</span>
      ${showTraces ? '<span><span class="o"></span>Peut contenir (traces, contamination croisée)</span>' : ''}
    </div>
    <p class="legal">
      Liste des 14 allergènes à déclaration obligatoire — règlement (UE) n° 1169/2011, annexe II ;
      décret n° 2015-447 du 17 avril 2015. Notre personnel se tient à votre disposition pour toute
      information complémentaire. Malgré nos précautions, des contaminations croisées restent possibles en cuisine.
    </p>`;
}

function renderMiniSheet() {
  const byId = ingredientsById();
  const rows = state.dishes.slice(0, 9).map((d) => {
    const { contains } = dishDetail(d, byId);
    return `<i style="background:#e9e9e9"></i>${ALLERGENS.map((a) => `<i class="${contains.includes(a.id) ? 'y' : ''}"></i>`).join('')}`;
  });
  $('#mini-sheet').innerHTML = `<div class="mini-sheet"><div class="l" style="width:45%;height:7px;background:#ddd"></div><div class="l" style="width:25%"></div><div class="g" style="margin-top:6px">${rows.join('') || '<i></i>'.repeat(15)}</div></div>`;
}

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
let currentLink = '';
async function renderQr() {
  const token = ++qrToken;
  const box = $('#qr-code');
  if (!state.dishes.length) {
    box.innerHTML = '<div class="empty" style="padding:30px 0">Ajoutez des plats</div>';
    $('#link-out').textContent = '';
    $('#qr-warning').innerHTML = '';
    $('#qr-tents').innerHTML = '';
    currentLink = '';
    return;
  }
  const url = `${publicBase()}carte.html#${await encodeMenu(buildPublicMenu(state))}`;
  if (token !== qrToken) return;
  currentLink = url;

  const local = !state.settings.publicBase && (location.protocol === 'file:' || /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(location.hostname));
  $('#qr-warning').innerHTML = local
    ? `<div class="notice">⚠️ L’outil tourne sur cet ordinateur : les téléphones de vos clients ne pourront pas ouvrir ce QR code. Mettez l’outil en ligne (voir le guide), puis réimprimez.</div>`
    : '';
  const svg = qrSvg(url);
  box.innerHTML = svg ?? '<p class="status error">Carte trop longue pour un QR code : raccourcissez les noms de plats.</p>';
  $('#link-out').textContent = url;
  $('#open-link').href = url;
  const name = esc(state.restaurant.name || '');
  const tent = svg
    ? `<div class="tent">
        <div class="mark">🌾</div>
        <strong>${name}</strong>
        <div class="title">Allergènes</div>
        <div class="langs">Allergens · Allergenen</div>
        <div class="qr-small">${qrSvg(url, 6)}</div>
        <div style="font-weight:600">Scannez pour voir les allergènes de nos plats</div>
        <div class="langs">Scan to check allergens · Scan voor allergenen</div>
        <div class="langs" style="margin-top:3mm">Tableau complet disponible sur demande · ${formatDate()}</div>
      </div>`
    : '';
  $('#qr-tents').innerHTML = `<div class="tents">${tent.repeat(4)}</div>`;
}

$('#copy-link').addEventListener('click', async () => {
  if (!currentLink) return;
  try {
    await navigator.clipboard.writeText(currentLink);
    toast('Lien copié');
  } catch {
    toast('Copie impossible : sélectionnez le lien à la main.');
  }
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

// ---------------------------------------------------------------------------
// Options et sauvegarde

const menuDialog = $('#menu-dialog');
function openMenu() {
  $('#restaurant-name').value = state.restaurant.name;
  $('#restaurant-info').value = state.restaurant.info;
  $('#public-base').value = state.settings.publicBase;
  menuDialog.showModal();
}
$('#open-menu').addEventListener('click', openMenu);
$('[data-close]', menuDialog).addEventListener('click', () => menuDialog.close());
menuDialog.addEventListener('close', () => render());

$('#restaurant-name').addEventListener('input', (e) => {
  state.restaurant.name = e.target.value;
  $('#onboarding-name').value = e.target.value;
  persist();
});
$('#restaurant-info').addEventListener('input', (e) => {
  state.restaurant.info = e.target.value;
  persist();
});
$('#public-base').addEventListener('change', (e) => {
  state.settings.publicBase = e.target.value.trim();
  persist();
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
    if (state.dishes.length && !confirm(`Remplacer la carte actuelle par « ${next.restaurant.name || file.name} » (${plural(next.dishes.length, 'plat')}) ?`)) return;
    state = next;
    persist();
    menuDialog.close();
    render();
    toast('Sauvegarde importée');
  } catch {
    toast('Fichier illisible');
  }
});

function loadDemo() {
  if (state.dishes.length && !confirm('Remplacer votre carte par l’exemple ? Pensez à exporter vos données avant.')) return;
  state = demoState();
  persist();
  if (menuDialog.open) menuDialog.close();
  showTab('carte');
  render();
  toast('Exemple chargé : Brasserie du Beffroi');
}
$('#load-demo').addEventListener('click', loadDemo);

$('#reset-all').addEventListener('click', () => {
  if (!confirm('Effacer toute la carte et tous les ingrédients de cet appareil ?')) return;
  state = emptyState();
  manualMode = false;
  persist();
  menuDialog.close();
  showTab('carte');
  render();
});

// ---------------------------------------------------------------------------

const datalist = document.createElement('datalist');
datalist.id = 'ing-options';
document.body.appendChild(datalist);

$('#onboarding-name').value = state.restaurant.name;
let initialTab = 'carte';
try {
  initialTab = localStorage.getItem(TAB_KEY) || 'carte';
} catch {
  // Préférence non essentielle.
}
render();
showTab($(`.step[data-tab="${initialTab}"]`) && state.dishes.length ? initialTab : 'carte');
