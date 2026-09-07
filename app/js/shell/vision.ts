// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/vision — the colour-blindness CORRECTION, which the engine has and this game never turned on.
//
// ========================= THE PLAN PROMISED THIS AND NOTHING DELIVERED IT =========================
// ⚠️ FROM THE PLAN'S OWN ARCHITECTURE SECTION: "a partir daí o pinball herda de graça os filtros de
// daltonismo (`render/cvd-matrices`), o alto contraste, o CRT e o pipeline multi-tela — nada disso
// precisa ser escrito." Measured: `aplicarFiltroDeVisao` and `cvdFilters` are returned by
// `createGame` and this port referenced NEITHER. The filters were installed at boot — `problems` is
// empty, so the `<svg id="cvd-filters">` host was found and the six matrices went in — and then
// nothing ever asked for one. Inherited for free and never collected.
//
// ⚠️ THE DEV FOUND THE HOLE FROM THE OTHER SIDE: "para acessar um menu com opções de voltar, editar
// controle, modos de acessibilidade para visão etc."
//
// ========================= AND IT IS NOT THE SAME THING AS THE CB-SAFE PALETTE =========================
// ⚠️ THE TWO ANSWER DIFFERENT QUESTIONS AND BOTH ARE KEPT. `shell/options` chooses which COLOURS the
// table is drawn in — a palette whose every pair survives the Machado simulations, which is a change
// to the game's own artwork. This chooses a FILTER over the finished picture, which corrects what
// reaches the eye and leaves the artwork alone.
//
// A player who cannot tell the drain from the ramp may be helped by either. They are offered
// separately because a player might want one, the other, or both — and because the palette cannot
// help with the Dev's photographs, which are not drawn from a palette at all.
//
// ========================= WHY ONLY THE CORRECTIONS =========================
// ⚠️ `VIZ_MODES` ALSO CARRIES SIMULATIONS, AND THEY ARE NOT OFFERED HERE. The engine's own catalogue
// separates them for a reason its source records as the Dev's decision on issue #60: the corrections
// belong to a VISUAL ACCESSIBILITY menu and the simulations to an EMPATHY one, because they serve two
// opposite audiences — somebody who wants to feel what colour blindness is like, and somebody who has
// it. They spent years in the wrong menu there. This list is `VIZ_CORRECTIONS`, which the engine
// DERIVES from the catalogue rather than writing out, so a fourth correction added there appears here
// without this file changing.

import { VIZ_CORRECTIONS, VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';

/** No correction, which is what everybody starts on. */
export const NO_VISION = 'normal';

/**
 * The choices, in the order they are offered: none first, then the engine's corrections.
 *
 * ⚠️ DERIVED FROM THE ENGINE, NOT LISTED. `VIZ_CORRECTIONS` is itself derived there — "exatamente os
 * filtros que não simulam" — so this cannot drift out of step with what the engine installs, and a
 * hand-written list of three keys is a list that would.
 */
export const VISION_CHOICES: readonly string[] = [NO_VISION, ...VIZ_CORRECTIONS.map((m) => m.key)];

/**
 * What each choice is called, in this game's own dictionary.
 *
 * ⚠️ NOT THE ENGINE'S `nome`, WHICH IS A KEY INTO THE ENGINE'S DICTIONARY. This game ships pt-BR, en
 * and es of its own and a test fails if any of the three loses a key; borrowing another package's
 * i18n would put half of one screen outside that guarantee.
 */
export const VISION_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  VISION_CHOICES.map((key) => [key, `pinball.vision.${key}`]),
);

export const VISION_DIALOG_ID = 'pinball-vision';
export const VISION_STORAGE_KEY = 'pinball:vision';

/** The same narrow store `shell/options` uses: two methods, so a test needs no browser. */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The CSS filter for a choice, or the empty string for none.
 *
 * ⚠️ AN UNKNOWN KEY IS NO FILTER, NOT A CRASH. What is stored survives a version of this game that
 * offered a mode a later one does not, and a saved setting must never be able to stop the game
 * starting — `readVision` refuses it on the way in as well, so this is the second of two guards and
 * both are cheap.
 */
export function visionFilter(choice: string): string {
  return choice === NO_VISION ? '' : (VIZ_FILTER[choice] ?? '');
}

/** What was chosen last time, or none. Anything unrecognised is none. */
export function readVision(store: Store): string {
  let held: string | null = null;
  try {
    held = store.getItem(VISION_STORAGE_KEY);
  } catch {
    // A browser with storage refused is a browser this game still has to start in.
    return NO_VISION;
  }
  return held !== null && VISION_CHOICES.includes(held) ? held : NO_VISION;
}

export function writeVision(store: Store, choice: string): void {
  try {
    store.setItem(VISION_STORAGE_KEY, choice);
  } catch {
    // Nothing to do and nothing to say: the setting still applies for this session.
  }
}
