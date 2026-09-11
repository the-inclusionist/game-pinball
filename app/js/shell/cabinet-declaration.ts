// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/cabinet-declaration — this cabinet, in the engine's own vocabulary, so the engine can own it.
//
// ========================= THE ENGINE WAS RUNNING ON ITS OWN FACTORY =========================
// ⚠️ `createGame` REGISTERS `null` FOR BOTH MAPPINGS WHEN A GAME DECLARES NEITHER, so `initKB()` builds the
// ENGINE's keyboard and `resetKB()` — the "restore defaults" a child presses — hands back the ENGINE's
// cabinet rather than this one. The engine's own note on why that is the expensive kind of wrong: "a
// criança carrega no botão esperando voltar ao que o jogo lhe deu, e volta para outra coisa — num jogo cujo
// autor escolheu o layout por uma razão de acessibilidade, ela perde essa razão e nada o diz."
//
// ⚠️ AND IT WAS INVISIBLE BECAUSE THE TWO TABLES COINCIDE BY ACCIDENT. `DEFAULT_BINDINGS` is
// U / J / K / 7 / Y / 8 / O / Enter / H, which is exactly `KEYBOARD_SOLO` — and `shell/pad`'s header
// records that this was DISCOVERED rather than designed. An accident is not an agreement: it is one edit
// wide, and the edit would go on working here and stop working in the engine, silently.
//
// ========================= DERIVED FROM THE TWO TABLES THAT ALREADY EXIST =========================
// `shell/controls.DEFAULT_BINDINGS` says which KEYS work which CONTROL. `shell/pad.CABINET_OF_ENGINE_ACTION`
// says which engine POSITION is which control. Between them the mapping is determined, except for one
// question, and this module answers only that one:
//
//   ⚠️ WHERE DOES A KEY GO WHEN THE ENGINE HAS NO OPINION ABOUT IT? To the FIRST position, in the engine's
//   canonical `ACTIONS` order, that this cabinet maps to that control. For the left flipper that is
//   `action2`, which is where the engine puts `KeyJ` anyway; for a key the engine has never seen it is the
//   position a remap screen would name first.
//
// Anything the engine's own factory already places on one of this cabinet's positions stays there, so
// `Digit7` is `leftShoulder` and `KeyY` is `leftTrigger` — the Dev's table, which `shell/pad` quotes:
// "7, left shoulder = pá esquerda / Y, left trigger = pá esquerda".
//
// ========================= WHAT IS DELIBERATELY NOT DECLARED =========================
// ⚠️ THE SWEEP AND THE PALETTE KEYS STAY OUT. `shell/keymap` records that they live in this game's table so
// that a conflict AGAINST them can be seen; they are not `KeyScheme` positions, and inventing a slot in a
// vocabulary three hundred games share to hold one pinball's accessibility keys is the wrong place to put
// them.
//
// ⚠️ AND THE PAD DECLARES ABSENCES ONLY. This game has no button arrangement of its own — it reads the pad
// through `padActions` and the engine's factory indices — so naming numbers here would be choosing a layout
// nobody asked for, on hardware this project has never measured. What it does know is which positions do
// not exist in it, and `null` is the engine's word for exactly that: "esta posição não existe neste jogo,
// que é diferente de a deixar na fábrica".

import { ACTIONS, isAction, type Action } from '@the-inclusionist/engine/core/actions.js';
import { KEYBOARD_SOLO } from '@the-inclusionist/engine/input/default-bindings.js';
import { DEFAULT_BINDINGS } from './controls.js';
import { CABINET_OF_ENGINE_ACTION } from './pad.js';

/** The engine positions this cabinet answers to, in the engine's canonical order. */
const MINE: readonly Action[] = ACTIONS.filter(
  (action) => isAction(action) && CABINET_OF_ENGINE_ACTION[action] !== undefined,
);

/**
 * THIS GAME'S KEYBOARD, as `GameDeclaration.mapeamentoDoTeclado` wants it.
 *
 * ⚠️ IT IGNORES `jogadores` AND `assento`, AND THAT IS THE ANSWER RATHER THAN A SHORTCUT. The parameters
 * exist because a two-player keyboard is not a one-player keyboard — the arrows change owner — and this
 * game has one seat. A pinball is one player at a machine; when it grows a second, this function is where
 * that question is answered, and the signature is already asking it.
 */
export function cabinetKeyboard(
  _players: number, _seat: number,
): Partial<Record<Action, readonly string[]>> {
  const map: Partial<Record<Action, string[]>> = {};
  for (const action of MINE) map[action] = [];

  for (const [control, codes] of Object.entries(DEFAULT_BINDINGS)) {
    /** The positions of this cabinet that work this control, in canonical order. */
    const positions = MINE.filter((action) => CABINET_OF_ENGINE_ACTION[action] === control);
    if (positions.length === 0) continue; // an accessibility key: see this module's header

    for (const code of codes) {
      /**
       * ⚠️ THE ENGINE'S OWN PLACEMENT WINS WHERE IT HAS ONE, which is what keeps `Digit7` on the shoulder
       * and `KeyY` on the trigger instead of piling all three of the left flipper's keys onto `action2`.
       * A key the engine has never placed falls to the first position — see the header.
       */
      const engines = positions.find((action) => (KEYBOARD_SOLO[action] ?? []).includes(code));
      map[engines ?? positions[0]!]!.push(code);
    }
  }
  return map;
}

/**
 * THIS GAME'S PAD: the positions it does NOT have, refused by name.
 *
 * ⚠️ `null` IS A STATEMENT AND AN ABSENT KEY IS NOT. Leaving `up` unmentioned says "the factory's button is
 * fine"; saying `up: null` says "there is no such thing in this game". The directions went to the menus
 * when the Dev took them off the paddles, `action4` is the button his table has and a pinball does not,
 * and nothing here selects.
 */
export function cabinetPad(_players: number, _seat: number): Partial<Record<Action, number | null>> {
  const map: Partial<Record<Action, number | null>> = {};
  for (const action of ACTIONS) {
    if (CABINET_OF_ENGINE_ACTION[action] === undefined) map[action] = null;
  }
  return map;
}
