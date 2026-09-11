// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/preset — the WORDS of this game's controls, for the engine to say them with.
//
// ========================= WHAT WAS MISSING, AND WHAT IT COST =========================
// ⚠️ `createGame` TAKES A `preset` AND THIS PORT PASSED NONE, for the whole of two majors. The engine's
// consequence is arithmetic and completely silent: with no preset it computes `acoesDoJogo = []`, guards
// `mostrarAvisoDeAlcance` behind `if (acoesDoJogo.length)`, and answers `engine.alcance` with
// `{ ok: false, pedidas: 0 }` — a value that says "nothing fits" and reaches nobody.
//
// A pinball needs two paddles held at once and a plunger drawn back. Open this on a tablet with no
// keyboard and no pad and it is a table with a ball on it and nothing that can move a flipper. The engine
// has a card for that case — `ui/reach-notice` names which transport is short and says to plug a
// controller in — and it could not fire, because the arithmetic that decides to show it is fed from here.
//
// ⚠️ AND THE OTHER HALF IS THE REMAP SCREEN. `labellerFrom` is how the engine asks "what is this position
// called in your game?" when it draws a control a child is about to rebind. Without a preset it has no
// words at all, so the screen that exists so a child can move a control they cannot reach would name the
// controls `action1`, `action2`, `leftShoulder` — the engine's own note: "nome abstrato que chega a uma
// pessoa é defeito."
//
// ========================= DERIVED FROM THE CABINET, NOT TYPED OUT AGAIN =========================
// ⚠️ WHICH POSITIONS THIS CABINET USES IS ALREADY WRITTEN DOWN ONCE, in `shell/pad`'s
// `CABINET_OF_ENGINE_ACTION` — the table both devices read so that "button one is the launch" is not
// stated twice. This reads it rather than restating it, and `tests/shell-preset` names the eight as
// literals so that the two are checked against a third party instead of against each other.
//
// ⚠️ AND THE LABELS ARE THE FOUR NAMES THE GAME ALREADY HAS. `pinball.controls.{left,right,plunger,pause}`
// are what the pause menu's key legend and the remap dialog already read; a second set of words for the
// same four controls is how a child meets one name in the menu and another on the remap screen.
//
// ========================= WHAT IS NOT HERE =========================
// No `short` label. The engine falls back to `label` and says the fallback "degrada VISUALMENTE, não
// funcionalmente" — a squeezed word rather than an empty legend. Inventing four abbreviations without a
// measured width would be choosing on taste in the one place the engine says to choose on measurement.

import { isAction, type ActionPreset } from '@the-inclusionist/engine/core/actions.js';
import { CABINET_OF_ENGINE_ACTION } from './pad.js';

/** What this game's i18n needs to be asked for a word. The same shape `shell/boot` threads as `shell.t`. */
export type Words = (key: string, params?: Record<string, string | number>) => string;

/**
 * The words of this cabinet, in the engine's fourteen-position vocabulary.
 *
 * ⚠️ FOUR RAILS SHARE TWO WORDS, and that is the point rather than a shortcut: `leftShoulder` and
 * `leftTrigger` are both the left paddle, because the Dev's table puts two buttons under each hand the way
 * a real cabinet does. The remap screen names what a control DOES; "left shoulder" would be naming the
 * hardware back at the person already holding it.
 */
export function pinballPreset(t: Words): ActionPreset {
  const preset: Record<string, { label: string }> = {};
  for (const [action, control] of Object.entries(CABINET_OF_ENGINE_ACTION)) {
    // ⚠️ THE CABINET TABLE STILL CARRIES THE PLATFORMER'S OLD NINE (`jump`, `especial`, `run`) so that a
    // transport which has not moved to the fourteen goes on working. They are not `Action`s, and a preset
    // that named them would be refused by `presetProblems` — correctly, since no engine surface can draw
    // a position that does not exist.
    if (!isAction(action)) continue;
    preset[action] = { label: t(`pinball.controls.${control}`) };
  }
  return preset as ActionPreset;
}
