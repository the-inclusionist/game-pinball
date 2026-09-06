// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PLAYER'S OWN SETTINGS, AND WHAT HAPPENS WHEN THE BROWSER REFUSES TO KEEP THEM.
//
// The Dev asked for the CB-Safe palette to be adjustable from a menu. This is the half of that with no
// DOM in it: which choices exist, which one is in force, and where it is remembered. The dialog is the
// other half and is built on top of this — the same split `drawDemoInto` uses, and for the same
// reason: this repository has no browser test project, so a decision buried in an event handler is a
// decision nothing can check.
import { describe, test, expect } from 'vitest';
import {
  PALETTE_CHOICES, PALETTE_LABEL, DEFAULT_PALETTE, PALETTE_STORAGE_KEY,
  readPalette, writePalette, nextPalette, isCbSafe, type Store,
} from '../app/js/shell/options.js';
import { dictionaryOf, BASE_LOCALE } from '../app/js/i18n/index.js';

/** A working browser store. */
function fakeStore(initial: Record<string, string> = {}): Store & { readonly written: Record<string, string> } {
  const written = { ...initial };
  return {
    written,
    getItem: (key) => written[key] ?? null,
    setItem: (key, value) => { written[key] = value; },
  };
}

/** The store a private window gives you: present, and throws the moment it is touched. */
const hostileStore: Store = {
  getItem: () => { throw new DOMException('The operation is insecure.'); },
  setItem: () => { throw new DOMException('The operation is insecure.'); },
};

describe('which palette is in force', () => {
  test('with nothing remembered, it is the normal one', () => {
    expect(readPalette(fakeStore())).toBe(DEFAULT_PALETTE);
    expect(DEFAULT_PALETTE, 'nobody is opted into an alternative they did not ask for').toBe('normal');
  });

  test('and what the player chose last time comes back', () => {
    const store = fakeStore();

    writePalette(store, 'cbSafe');

    expect(readPalette(store)).toBe('cbSafe');
    expect(store.written[PALETTE_STORAGE_KEY], 'stored under a key that says whose it is')
      .toBe('cbSafe');
  });

  test('⚠️ a stored value that means nothing is IGNORED, not passed on', () => {
    // The key is a string in someone else's storage: an older build, a different game on the same
    // origin, a person editing it by hand. Handing an unknown string to `paletteFor` gets the neutral
    // ground on every table and no error anywhere.
    expect(readPalette(fakeStore({ [PALETTE_STORAGE_KEY]: 'chartreuse' }))).toBe(DEFAULT_PALETTE);
    expect(readPalette(fakeStore({ [PALETTE_STORAGE_KEY]: '' }))).toBe(DEFAULT_PALETTE);
  });

  test('⚠️ and a browser that REFUSES to store still opens the game', () => {
    // `localStorage` is not optional-if-absent: in a private window, and wherever the user has blocked
    // site data, the property EXISTS and throws on access. An unguarded read at boot is a blank page,
    // and the one setting lost is worth less than the game.
    expect(() => readPalette(hostileStore)).not.toThrow();
    expect(readPalette(hostileStore)).toBe(DEFAULT_PALETTE);
    expect(() => writePalette(hostileStore, 'cbSafe')).not.toThrow();
  });
});

describe('moving between them', () => {
  test('the switch goes round, so one key can reach every choice', () => {
    let choice = DEFAULT_PALETTE;
    const seen = new Set([choice]);

    for (let i = 0; i < PALETTE_CHOICES.length; i++) {
      choice = nextPalette(choice);
      seen.add(choice);
    }

    expect([...seen].sort(), 'every choice is reachable').toEqual([...PALETTE_CHOICES].sort());
    expect(choice, 'and it comes back to where it started').toBe(DEFAULT_PALETTE);
  });

  test('and an unknown value lands somewhere real rather than nowhere', () => {
    expect(PALETTE_CHOICES).toContain(nextPalette('chartreuse' as never));
  });

  test('only one choice draws the alternative, and it is the named one', () => {
    expect(isCbSafe('cbSafe')).toBe(true);
    expect(isCbSafe('normal')).toBe(false);
  });
});

describe('what the player is told each choice is', () => {
  test('⚠️ every choice has a written label, in the base locale', () => {
    // A menu is a list of words. A choice whose label is missing shows the key — `pinball.palette.cbSafe`
    // — to the player who most needs to find it, and `tests/i18n-keys-exist` only sees keys written as
    // literals in `app/js`, which these are.
    const base = dictionaryOf(BASE_LOCALE);

    for (const choice of PALETTE_CHOICES) {
      const key = PALETTE_LABEL[choice];
      expect(key, `${choice} has a label key`).toBeDefined();
      expect(base[key], `${key} is written`).toBeDefined();
    }
  });

  test('and no two choices share a label, which would be a menu you cannot read', () => {
    const labels = PALETTE_CHOICES.map((c) => PALETTE_LABEL[c]);

    expect(new Set(labels).size).toBe(labels.length);
  });
});
