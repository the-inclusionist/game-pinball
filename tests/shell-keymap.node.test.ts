// SPDX-License-Identifier: AGPL-3.0-or-later
// EDITING THE CONTROLS, WHICH IS THE LAST THING THE DEV ASKED THE PAUSE MENU FOR.
//
// ⚠️ HIS LIST: "um menu com opções de voltar, editar controle, modos de acessibilidade para visão
// etc." Going back was fixed, the vision correction was collected, and this is the third.
//
// ========================= WHY THIS PORT'S OWN TABLE AND NOT THE ENGINE'S =========================
// The engine has a keyboard config with persistence — `kb`, `setKB`, `saveKB`, `loadKB`, `resetKB` in
// `input/keyboard` — and this game cannot use it for the cabinet, for one reason that is a fact
// rather than a preference: ITS VOCABULARY HAS NO START. `shell/controls` records it —
// "`start` WAS NOT IN THE ENGINE'S KEYBOARD VOCABULARY... so pause was a binding of this port's own"
// — and `pause` is one of the four things a cabinet has. Nor does it have `blindMode`, `sweep` or
// `palette`, which are this game's own and are keys on purpose.
//
// ⚠️ AND THE SEAM WAS ALREADY THERE. `bindPinballControls` takes `bindings?`, falling back to
// `DEFAULT_BINDINGS`. This is what fills it.
import { describe, test, expect } from 'vitest';
import {
  EDITABLE_ACTIONS, KEYMAP_STORAGE_KEY, readBindings, writeBindings, rebind, conflictOf,
  type BindingTable,
} from '../app/js/shell/keymap.js';
import { DEFAULT_BINDINGS, type PinballAction } from '../app/js/shell/controls.js';

interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void }
const memory = (): Store & { held: Record<string, string> } => {
  const held: Record<string, string> = {};
  return { held, getItem: (k) => held[k] ?? null, setItem: (k, v) => { held[k] = v; } };
};

describe('what a player may edit', () => {
  test('⚠️ the cabinet, and only the cabinet', () => {
    // The four the Dev's machine has. `blindMode`, `sweep` and `palette` are in the table so that a
    // conflict can be seen, and are not offered: `shell/controls` has argued since it was written
    // that they must be keys rather than menu entries, and a player who moved blind mode somewhere
    // they then could not find would have lost the one switch they cannot ask anybody about.
    expect([...EDITABLE_ACTIONS]).toEqual(['left', 'right', 'plunger', 'pause']);
  });

  test('and every editable action is a real one', () => {
    for (const action of EDITABLE_ACTIONS) {
      expect(DEFAULT_BINDINGS[action], action).toBeDefined();
    }
  });
});

describe('reading what was saved', () => {
  test('nothing saved is the cabinet as it ships', () => {
    expect(readBindings(memory())).toEqual(DEFAULT_BINDINGS);
  });

  test('what was saved comes back, merged over the defaults', () => {
    const store = memory();
    writeBindings(store, rebind(DEFAULT_BINDINGS, 'plunger', 'Space'));

    const back = readBindings(store);

    expect(back.plunger).toEqual(['Space']);
    // ⚠️ MERGED, NOT REPLACED. A table saved by a version of this game with fewer actions must not
    // leave the new one with an action bound to nothing at all — which is a key that silently does
    // nothing, the defect this repository has found most often.
    // ⚠️ `right` RATHER THAN `blindMode`, WHICH IS NO LONGER AN ACTION. The three accessibility
    // switches left the keyboard for the HUD; the claim is unchanged and needs an action that exists.
    expect(back.right).toEqual(DEFAULT_BINDINGS.right);
  });

  test('⚠️ and rubbish in the store is the defaults, not a crash at boot', () => {
    const store = memory();
    store.held[KEYMAP_STORAGE_KEY] = '{not json';

    expect(readBindings(store)).toEqual(DEFAULT_BINDINGS);
  });

  test('⚠️ and a saved action bound to NOTHING falls back rather than shipping a dead key', () => {
    const store = memory();
    store.held[KEYMAP_STORAGE_KEY] = JSON.stringify({ plunger: [] });

    expect(readBindings(store).plunger, 'an empty binding is not a binding').toEqual(DEFAULT_BINDINGS.plunger);
  });

  test('a store that refuses does not stop the game starting', () => {
    const refuses: Store = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
    };

    expect(readBindings(refuses)).toEqual(DEFAULT_BINDINGS);
    expect(() => writeBindings(refuses, DEFAULT_BINDINGS)).not.toThrow();
  });
});

describe('binding a key', () => {
  test('the action takes the key, replacing what it had', () => {
    const next = rebind(DEFAULT_BINDINGS, 'plunger', 'Space');

    expect(next.plunger).toEqual(['Space']);
  });

  test('⚠️ and the key is taken AWAY from whatever else had it', () => {
    // Two actions on one key is a key whose meaning depends on which handler runs first, and this
    // game has three separate readers of the same table. The player asked for the key to mean the new
    // thing; leaving it meaning both is answering a question they did not ask.
    const next = rebind(DEFAULT_BINDINGS, 'plunger', 'KeyJ');

    expect(next.plunger).toEqual(['KeyJ']);
    expect(next.left, 'J was the left flipper and is not any more').not.toContain('KeyJ');
  });

  test('⚠️ but an action is never left with no key at all', () => {
    // `left` ships with A and J. Taking BOTH away, one at a time, must stop rather than produce a
    // cabinet with no left flipper — a state a player cannot get out of without clearing storage.
    let table: BindingTable = rebind(DEFAULT_BINDINGS, 'plunger', 'KeyJ');
    table = rebind(table, 'pause', 'KeyJ');

    expect(table.left.length, 'the left flipper still has a key').toBeGreaterThan(0);
  });

  test('rebinding to a key the action already has changes nothing', () => {
    expect(rebind(DEFAULT_BINDINGS, 'plunger', 'KeyU')).toEqual(DEFAULT_BINDINGS);
  });

  test('the original table is not mutated', () => {
    const before = JSON.stringify(DEFAULT_BINDINGS);
    rebind(DEFAULT_BINDINGS, 'plunger', 'Space');

    expect(JSON.stringify(DEFAULT_BINDINGS)).toBe(before);
  });
});

describe('warning about a key before it is taken', () => {
  test('a free key conflicts with nothing', () => {
    expect(conflictOf(DEFAULT_BINDINGS, 'plunger', 'Space')).toBeNull();
  });

  test('⚠️ a key another action holds names that action, so the menu can say so', () => {
    expect(conflictOf(DEFAULT_BINDINGS, 'plunger', 'KeyJ')).toBe('left');
  });

  test('and a key the action already holds is not a conflict with itself', () => {
    expect(conflictOf(DEFAULT_BINDINGS, 'plunger', 'KeyU')).toBeNull();
  });

  test('⚠️ including the keys that are NOT editable, which is why they are in the table', () => {
    /**
     * ⚠️ THIS USED TO NAME `KeyB` AND BLIND MODE, and the Dev's move retired the example rather than
     * the claim. Blind mode, the sonar and the palette left the keyboard for the HUD, so B, S and C
     * belong to nobody now — but the CLAIM is about a key that is bound to something the editor cannot
     * reach, and the launch key is exactly that: `EDITABLE_ACTIONS` does not include the plunger's
     * neighbours, and a player who binds the left flipper to U has not been told they just lost the
     * launch unless something looks.
     */
    expect(conflictOf(DEFAULT_BINDINGS, 'left', 'KeyU')).toBe('plunger');
  });
});

describe('what the game is then driven by', () => {
  test('⚠️ the table is the same SHAPE as the one the controls module falls back to', () => {
    // `bindPinballControls` derives its action list from the table it is given — "an action added to
    // the type and the table but forgotten here is bound to a key, matched by nothing, and does
    // nothing at all". A saved table missing an action would do exactly that.
    const saved = readBindings(memory());

    expect(Object.keys(saved).sort()).toEqual((Object.keys(DEFAULT_BINDINGS) as PinballAction[]).sort());
  });
});
