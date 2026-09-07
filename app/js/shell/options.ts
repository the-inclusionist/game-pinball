// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/options — what the player can choose, and where the choice is kept.
//
// ========================= NO DOM IN HERE, AND THAT IS THE POINT =========================
// This repository has one Vitest project and it is `node`: there is no browser environment, so
// anything that lives inside an event handler is a decision nothing can check. The same split
// `drawDemoInto` made for the demonstration's frame is made here — the decision is a function, the
// dialog is markup over it — and it is why "an unknown stored value falls back" and "a browser that
// refuses to store still opens the game" are testable claims rather than hopeful ones.
//
// ========================= WHY STORAGE IS INJECTED =========================
// ⚠️ `localStorage` IS NOT ABSENT WHEN IT IS UNAVAILABLE. In a private window, and wherever the person
// has blocked site data, the property is there and THROWS on the first access. A `typeof window`
// guard reads as a check and is not one. Every access here goes through a try, and the setting is
// worth less than the game: a browser that will not remember which palette was chosen still opens the
// table in the normal one.

export type PaletteChoice = 'normal' | 'cbSafe';

/**
 * The choices, in the order a menu lists them and a key cycles them.
 *
 * The normal palette is first because it is the default, and the default is first so that a player
 * cycling with one key leaves from where they are rather than from an arbitrary point in a ring.
 */
export const PALETTE_CHOICES: readonly PaletteChoice[] = ['normal', 'cbSafe'];

/**
 * ⚠️ NOBODY IS OPTED IN. The CB-Safe palette is an alternative, not an improvement: it spends the
 * gate's blue to buy separability, and a player who does not need that trade should not be handed it.
 * Guessing from `prefers-*` media queries was considered and is not possible — no browser reports
 * colour vision, and inferring it from anything else would be inventing a fact about a person.
 */
export const DEFAULT_PALETTE: PaletteChoice = 'normal';

/** What each choice is called, for the menu and for the announcement when a key changes it. */
export const PALETTE_LABEL: Readonly<Record<PaletteChoice, string>> = {
  normal: 'pinball.palette.normal',
  cbSafe: 'pinball.palette.cbSafe',
};

/**
 * Namespaced, because the origin is shared with whatever else is served from it.
 *
 * ⚠️ A COLON, NOT A DOT, AND THE PUNCTUATION IS LOAD-BEARING. `pinball.` with a dot is this port's
 * TEXT namespace: `tests/i18n-keys-exist` reads every `'pinball.…'` literal in `app/js` and requires a
 * written string behind it, which is what stops a menu from showing a player its own key. A storage
 * key spelled the same way is not a text key and has no string behind it — it tripped that gate the
 * hour it was written, which is the gate working rather than the gate being wrong. Stored keys are
 * `pinball:`, and the two namespaces no longer look alike.
 */
/**
 * ⚠️ THE ID IS THE HANDLE THE ENGINE KEEPS. `register`, `closeById` and `restoreFocus` all address a
 * dialog by it. It lives with the PALETTE rather than with the dialog shell, because the shell became
 * generic the day a second setting wanted the same shape and each caller now brings its own id — two
 * dialogs sharing one would collide in the engine's registry with no error anywhere.
 */
export const OPTIONS_DIALOG_ID = 'pinball-options';

export const PALETTE_STORAGE_KEY = 'pinball:palette';

/** The two methods this module uses, so a test can supply them and a hostile browser can be simulated. */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isChoice = (value: unknown): value is PaletteChoice =>
  PALETTE_CHOICES.includes(value as PaletteChoice);

/**
 * The palette in force.
 *
 * An unrecognised stored value is discarded rather than passed on: it is a string in somebody else's
 * storage — an older build, another game on the same origin, a person editing it by hand — and handing
 * it to `paletteFor` would draw every table on the neutral ground with nothing reporting why.
 */
export function readPalette(store: Store): PaletteChoice {
  try {
    const stored = store.getItem(PALETTE_STORAGE_KEY);
    return isChoice(stored) ? stored : DEFAULT_PALETTE;
  } catch {
    // See this module's header: the setting is worth less than the game.
    return DEFAULT_PALETTE;
  }
}

export function writePalette(store: Store, choice: PaletteChoice): void {
  try {
    store.setItem(PALETTE_STORAGE_KEY, choice);
  } catch {
    // Nothing to tell the player: they chose, the choice is in force for this session, and it is the
    // remembering that failed. Saying so would report a browser setting as a game fault.
  }
}

/** The next choice round the ring, so one key reaches all of them. */
export function nextPalette(current: PaletteChoice): PaletteChoice {
  const at = PALETTE_CHOICES.indexOf(current);
  // `indexOf` gives -1 for a value that is not a choice, and -1 + 1 is the first one: an unknown
  // current lands somewhere real rather than off the end.
  return PALETTE_CHOICES[(at + 1) % PALETTE_CHOICES.length]!;
}

/** Whether this choice draws the alternative. One place, so `drawTable` is never handed a guess. */
export const isCbSafe = (choice: PaletteChoice): boolean => choice === 'cbSafe';
