// SPDX-License-Identifier: AGPL-3.0-or-later
// THE README TELLS SOMEBODY HOW TO RUN THIS, SO IT HAS TO STILL BE TRUE.
//
// A README is the one document read by a person who knows nothing else about the project, and it is
// the document nothing ever checks. Every other claim here is held by something: the ADRs by their
// tests, the licence note by the orphan ledger, the i18n keys by `tests/i18n-keys-exist`. The
// instructions for running the thing were held by nobody, and this repository already knows what that
// costs — the caveat under the demonstration's file picker described a build from two months earlier,
// on screen, for everyone who opened the page.
//
// ⚠️ AND IT IS A LEDGER IN BOTH DIRECTIONS, which is the half that matters more. A key documented that
// does not exist sends a reader pressing nothing; a key that exists and is NOT documented is a feature
// nobody finds, and the accessibility switches are exactly the keys where that is expensive. `C` was
// added this week; without this test, nothing would ever have said it was missing from the page that
// lists the controls.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_BINDINGS, type PinballAction } from '../app/js/shell/controls.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readme = (): string => readFileSync(resolve(ROOT, 'README.md'), 'utf8');
const scripts = (): Record<string, string> =>
  JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).scripts;

/** How each action is written in the README's table of keys. */
const DOCUMENTED_AS: Readonly<Record<PinballAction, string>> = {
  left: '`J` / `7` / `Y`',
  right: '`K` / `8` / `O`',
  plunger: '`U`',
  pause: '`Enter` / `H`',
};

describe('the commands the README gives', () => {
  test('⚠️ every `npm run` it names is a script that exists', () => {
    const named = [...readme().matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]!);
    const available = scripts();

    expect(named.length, 'the README tells somebody how to run this at all').toBeGreaterThan(3);
    expect([...new Set(named)].filter((name) => !(name in available)), 'named but absent').toEqual([]);
  });

  test('and the one that has to pass is the one named as such', () => {
    // `validate` is what CI would run and what a contributor is told to run before opening anything.
    // A README that recommends a subset teaches people to ship red.
    expect(scripts().validate, 'validate covers types, tests and the build')
      .toMatch(/typecheck.*vitest.*build/);
    expect(readme()).toContain('npm run validate');
  });
});

describe('⚠️ the keys it lists, against the keys that exist', () => {
  test('every action the game binds is written down', () => {
    // The direction that catches a NEW key. Adding one to `DEFAULT_BINDINGS` and not to the README
    // ships a control nobody can discover, and for `B`, `S` and `C` that is the whole point of them.
    const page = readme();

    const undocumented = (Object.keys(DEFAULT_BINDINGS) as PinballAction[])
      .filter((action) => !page.includes(DOCUMENTED_AS[action]));

    expect(undocumented, 'actions the README does not mention').toEqual([]);
  });

  /**
   * ⚠️ AND EVERY KEY, NOT JUST EVERY ACTION, which is the direction that just escaped.
   *
   * `KeyH` was added to `pause` because the Dev pressed it and nothing happened — the engine's keyboard
   * has migrated to `action1`..`action4` but carries no `start` yet, so H reached nothing. The whole
   * suite stayed green: the ledger below asks whether each ACTION is documented, and `pause` already
   * was. A second key on an action nobody had to touch went unrecorded, and the README went on
   * offering a player one of the two ways to pause.
   *
   * A ledger that counts rows and not their contents is half a ledger.
   */
  test('⚠️ every KEY the game binds appears in the README, not just every action', () => {
    const text = readme();
    const missing: string[] = [];

    for (const [action, codes] of Object.entries(DEFAULT_BINDINGS)) {
      for (const code of codes) {
        // As a player reads it off the keyboard, which is how the README writes it: `A`, not `KeyA`.
        const label = code.replace(/^(Key|Digit)/, '');
        if (!text.includes(`\`${label}\``)) missing.push(`${action}: ${label}`);
      }
    }

    expect(missing, 'keys bound and not written down').toEqual([]);
  });

  test('and nothing is written down that the game does not bind', () => {
    // The other direction: a key removed from the bindings and left in the README sends a reader
    // pressing something that does nothing, which is worse than not mentioning it.
    const bound = new Set(Object.keys(DEFAULT_BINDINGS));

    expect(Object.keys(DOCUMENTED_AS).filter((action) => !bound.has(action)))
      .toEqual([]);
    // ⚠️ AND THE MAP ABOVE IS COMPLETE, or the first test checks a subset and calls it everything.
    expect(Object.keys(DOCUMENTED_AS).sort()).toEqual(Object.keys(DEFAULT_BINDINGS).sort());
  });
});

describe('the query parameters it documents', () => {
  test('⚠️ are the ones `main.ts` actually reads', () => {
    // Two, and they are the whole surface: there is no menu for choosing a table, so the parameter IS
    // the interface. One that stopped being read would be an instruction that silently does nothing.
    const entry = readFileSync(resolve(ROOT, 'app', 'js', 'main.ts'), 'utf8');
    const documented = [...readme().matchAll(/`\?([a-z]+)=/g)].map((m) => m[1]!);

    expect([...new Set(documented)].sort(), 'the README documents both').toEqual(['demo', 'table']);
    for (const parameter of new Set(documented)) {
      expect(entry, `main.ts reads ${parameter}`).toContain(`.get('${parameter}')`);
    }
  });

  test('and the archive is still described as the player’s to supply', () => {
    // The Dev's constraint, in the one document a stranger reads: never versioned, never in the
    // bundle, never served. A README that implied the game ships with the data would be the first
    // step towards somebody making that true.
    expect(readme()).toMatch(/never fetched, never\s+bundled and never served/);
  });
});
