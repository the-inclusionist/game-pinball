// SPDX-License-Identifier: AGPL-3.0-or-later
// A KEY THE CODE ASKS FOR AND NO DICTIONARY ANSWERS.
//
// `i18n/index` returns the identifier itself when it does not know a key — deliberately, because a
// missing string should be visible rather than blank. What makes that a trap is that it is visible ON
// THE PLAYER'S SCREEN and nowhere else: nothing throws, nothing logs, and every test in this
// repository goes on passing while the menu says `pinball.scene.mars`.
//
// The existing gates check the dictionaries against EACH OTHER — that the three languages define the
// same keys with the same parameters — and against `RESOURCE_KEYS`, the 1995 archive's own text ids.
// Neither can see a key that this port invented, which is all of them outside the archive. Five such
// keys were added the day this test was written and would have shipped unwritten.
//
// ⚠️ `pinball.` WITH A DOT IS THE TEXT NAMESPACE, and nothing else may use it. The first key this test
// ever caught was `'pinball.palette'` — a `localStorage` key, not a string, with nothing to write
// behind it. Rather than exempt it, the storage key moved to `pinball:palette`: an exemption list is a
// thing that grows, and two namespaces that look identical would go on producing this every time. A
// dot means a word the player reads; a colon means a value the browser keeps.
//
// ⚠️ IT READS THE SOURCE, WHICH IS THE WEAK PART AND IS THE POINT. A key built by concatenation is
// invisible here, so this cannot promise that every key resolves — only that every key written down as
// a literal is answered. That covers how this project actually writes them, and the alternative was
// covering none of them.
import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionaryOf, BASE_LOCALE } from '../app/js/i18n/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sourcesUnder(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) out.push(...sourcesUnder(path));
    else if (entry.endsWith('.ts')) out.push(path);
  }
  return out;
}

/** Every `'pinball.…'` literal the code names, with the file that names it. */
function keysReferenced(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of sourcesUnder(join(ROOT, 'app', 'js'))) {
    // The dictionaries themselves DEFINE keys rather than asking for them.
    if (file.includes(join('app', 'js', 'i18n'))) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/['"`](pinball\.[A-Za-z0-9_.]+)['"`]/g)) {
      const key = match[1]!;
      found.set(key, [...(found.get(key) ?? []), file.slice(ROOT.length + 1)]);
    }
  }
  return found;
}

describe('every string the code asks for', () => {
  test('⚠️ is written in the base locale, or the player reads the key instead of the word', () => {
    const base = dictionaryOf(BASE_LOCALE);
    const referenced = keysReferenced();

    const unwritten = [...referenced].filter(([key]) => base[key] === undefined);

    expect(unwritten.map(([key, files]) => `${key} — asked for by ${files.join(', ')}`)).toEqual([]);
    // ⚠️ AND THE SCAN ACTUALLY FOUND SOMETHING. An expression that matched nothing would satisfy the
    // assertion above for ever, which is the shape a green test with no subject always takes.
    expect(referenced.size, 'the scan found keys to check').toBeGreaterThan(10);
  });
});
