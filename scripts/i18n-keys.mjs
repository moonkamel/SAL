// Repère les textes à traduire dans le code : t('…'), tr('…'), tx('…') et translate(lang, '…').
// Le français sert de clé ; voir shared/i18n/index.ts.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIRS = ['app', 'src', 'shared', 'server'];
// L'espace partenaires reste en français (commerçants lillois).
const SKIP = [/[\\/]admin/, /AdminPanel/, /fields\.ts$/, /\.web\.tsx$/];

const CALL = /\b(?:t|tr|tx)\(\s*'((?:[^'\\]|\\.)+)'/g;
const TRANSLATE = /\btranslate\(\s*[\w.]+,\s*'((?:[^'\\]|\\.)+)'/g;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !SKIP.some((re) => re.test(path))) out.push(path);
  }
  return out;
}

/** Textes français à traduire, triés. */
export function collectKeys(root = process.cwd()) {
  const keys = new Set();
  for (const dir of DIRS) {
    for (const file of walk(join(root, dir), [])) {
      const src = readFileSync(file, 'utf8');
      for (const re of [CALL, TRANSLATE]) {
        for (const m of src.matchAll(re)) keys.add(m[1].replace(/\\'/g, "'"));
      }
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Les {variables} d'un texte. */
export function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}
