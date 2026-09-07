// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/keymap — the cabinet as the player rearranged it, and the rules that keep it playable.
//
// ========================= WHAT THE DEV ASKED FOR =========================
// ⚠️ "um menu com opções de voltar, editar controle, modos de acessibilidade para visão etc." Going
// back and the vision correction are done; this is the third.
//
// ========================= WHY THIS PORT'S OWN TABLE AND NOT THE ENGINE'S =========================
// The engine HAS a keyboard config with persistence — `kb`, `setKB`, `saveKB`, `loadKB` and `resetKB`
// in `input/keyboard` — and this cabinet cannot live in it, for a reason that is a fact rather than a
// preference: THAT VOCABULARY HAS NO START. `shell/controls` records it where the key was bound —
// "`start` WAS NOT IN THE ENGINE'S KEYBOARD VOCABULARY... so pause was a binding of this port's own
// on the keyboard" — and pause is one of the four things a cabinet has. Nor does the engine name
// `blindMode`, `sweep` or `palette`, which are this game's own and are keys on purpose.
//
// ⚠️ AND IT IS `keymap` RATHER THAN `bindings`, WHICH A GATE INSISTED ON. `control/bindings` already
// exists and is a different thing entirely — "which component each control function reaches for,
// transcribed from `control.cpp`". `tests/no-unsanctioned-orphans` pins the list of modules that
// share a basename precisely so a THIRD one has to be looked at: "two modules with one name is a fact
// about this codebase; three is a question about whether somebody meant to shadow something." It was
// the second name that was wrong, and this is the answer to the question it asked.
//
// ⚠️ AND THE SEAM WAS ALREADY THERE, WAITING. `bindPinballControls` takes `bindings?` and falls back
// to `DEFAULT_BINDINGS`; `shell/pad` derives the cabinet from the same table. This is what fills it,
// and nothing about how a key is read had to change.
//
// ========================= THE TWO RULES THAT ARE NOT NEGOTIABLE =========================
// ⚠️ NO ACTION MAY END UP WITH NO KEY. A cabinet with no left flipper is a state a player cannot get
// out of without clearing storage, and they will not know that is what happened.
//
// ⚠️ AND NO KEY MAY DO TWO THINGS. Three separate readers walk this table — `bindPinballControls`,
// `shell/pad` and the engine's remapper through `actionOf` — and a key in two rows means the meaning
// depends on which of them runs first. So taking a key gives it to the new action AND removes it from
// wherever it was, which is what a player asking for it means.

import { DEFAULT_BINDINGS, type PinballAction } from './controls.js';

export type BindingTable = Readonly<Record<PinballAction, readonly string[]>>;

/**
 * What the pause menu offers to rebind: the cabinet, and only the cabinet.
 *
 * ⚠️ `blindMode`, `sweep` AND `palette` ARE IN THE TABLE AND NOT ON THIS LIST. They are in it so a
 * conflict against them can be SEEN — a player who binds the left flipper to B has otherwise lost
 * blind mode with no warning — and they are not offered because `shell/controls` has argued since it
 * was written that they must be keys rather than menu entries: "a player who needs blind mode is not
 * the player who is going to find it in a settings panel". Somebody who moved that switch and then
 * could not find it has lost the one control they cannot ask anybody else about.
 */
export const EDITABLE_ACTIONS: readonly PinballAction[] = ['left', 'right', 'plunger', 'pause'];

export const KEYMAP_STORAGE_KEY = 'pinball:keymap';

/** The same narrow store the other settings use: two methods, so a test needs no browser. */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const ACTIONS = Object.keys(DEFAULT_BINDINGS) as PinballAction[];

/**
 * The cabinet as it is now.
 *
 * ⚠️ MERGED OVER THE DEFAULTS, ACTION BY ACTION, AND AN EMPTY LIST IS NOT A BINDING. A table saved by
 * a version of this game with fewer actions would otherwise leave the new one with an action bound to
 * nothing — a key that does nothing at all, no error, no warning, which is the defect shape this
 * repository has found more often than any other.
 */
export function readBindings(store: Store): BindingTable {
  let held: string | null = null;
  try {
    held = store.getItem(KEYMAP_STORAGE_KEY);
  } catch {
    // A browser with storage refused is a browser this game still has to start in.
    return DEFAULT_BINDINGS;
  }
  if (held === null) return DEFAULT_BINDINGS;

  let saved: Partial<Record<PinballAction, unknown>>;
  try {
    saved = JSON.parse(held) as Partial<Record<PinballAction, unknown>>;
  } catch {
    // What is stored is the player's, and unreadable is not the same as wrong: the cabinet they get
    // is the one that ships, and the next thing they rebind overwrites this.
    return DEFAULT_BINDINGS;
  }

  const out = {} as Record<PinballAction, readonly string[]>;
  for (const action of ACTIONS) {
    const codes = saved[action];
    const usable = Array.isArray(codes) && codes.length > 0 && codes.every((c) => typeof c === 'string');
    out[action] = usable ? (codes as string[]).slice() : DEFAULT_BINDINGS[action];
  }
  return out;
}

export function writeBindings(store: Store, table: BindingTable): void {
  try {
    store.setItem(KEYMAP_STORAGE_KEY, JSON.stringify(table));
  } catch {
    // Nothing to do and nothing to say: the cabinet still works for this session.
  }
}

/**
 * Which OTHER action holds `code` today, or `null`.
 *
 * The menu asks before it takes, so a player can be told what they are about to lose rather than
 * discovering it the next time they reach for it.
 */
export function conflictOf(
  table: BindingTable, action: PinballAction, code: string,
): PinballAction | null {
  return ACTIONS.find((other) => other !== action && table[other].includes(code)) ?? null;
}

/**
 * The table with `code` given to `action`.
 *
 * ⚠️ AND TAKEN FROM WHOEVER HAD IT — unless that would leave them with nothing, in which case the
 * rebind is REFUSED entire. Refusing is the honest answer: a cabinet that quietly kept the key on
 * both actions would answer a question the player did not ask, and one that emptied an action would
 * strand them. The caller has already been told by `conflictOf` what it was about to hit.
 */
export function rebind(table: BindingTable, action: PinballAction, code: string): BindingTable {
  if (table[action].length === 1 && table[action][0] === code) return table;

  const loser = conflictOf(table, action, code);
  if (loser !== null && table[loser].length <= 1) return table;

  const out = {} as Record<PinballAction, readonly string[]>;
  for (const other of ACTIONS) {
    out[other] = other === action
      ? [code]
      : table[other].filter((held) => held !== code);
  }
  return out;
}
