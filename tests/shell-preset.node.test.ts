// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME SAYS WHAT IT TAKES TO PLAY IT, AND UNTIL NOW IT SAID NOTHING.
//
// ⚠️ `createGame` TAKES A `preset` — the WORDS of this game's actions — AND THIS PORT PASSED NONE. The
// engine's consequence is arithmetic and silent: with no preset it computes `acoesDoJogo = []`, skips
// `mostrarAvisoDeAlcance` entirely, and `engine.alcance` comes back `{ ok: false, pedidas: 0 }` for ever —
// a value that says "nothing fits" and is shown to nobody.
//
// ========================= WHAT THAT COSTS A CHILD =========================
// A pinball needs two paddles held at once and a plunger drawn back. On a phone that registers two
// fingers, or a tablet with no keyboard and no pad, this game is a table with a ball on it and NOTHING
// that can move a flipper. The engine has a card for exactly that — `ui/reach-notice` names which
// transport is short and tells the child to plug a controller in — and it never fires here, because the
// arithmetic that decides whether to show it is fed by the preset.
//
// The engine's own note on the field: "Sem elas a engine não sabe QUANTAS ações pedir a um transporte, e a
// garantia do ADR-0079 §3 não tem como ser medida."
//
// ========================= AND THE PRESET IS DERIVED, NOT TYPED =========================
// ⚠️ THE POSITIONS THIS CABINET USES ARE ALREADY WRITTEN DOWN, ONCE, in `shell/pad`'s
// `CABINET_OF_ENGINE_ACTION` — the table both devices read so that "button one is the launch" is not
// stated twice. A second list here would be a third statement of the same fact, and this repository has
// paid for that shape on a bumper's rectangle, a HUD inset and a plunger's speed.
//
// So the preset is derived from that table, and this file names the eight positions as LITERALS on the
// other side. `CLAUDE.md`: "A test that reads by the same link as the code cannot fail... Name the literal
// on one side."
import { describe, test, expect } from 'vitest';
import { pinballPreset } from '../app/js/shell/preset.js';
import { CABINET_OF_ENGINE_ACTION } from '../app/js/shell/pad.js';
import { createTranslator } from '../app/js/i18n/index.js';
import { presetActions, presetProblems, isAction } from '@the-inclusionist/engine/core/actions.js';

const t = createTranslator('en');

/** What a pinball asks a transport for, written out rather than read from the code under test. */
const EXPECTED = [
  'action1', 'action2', 'action3',
  'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger',
  'start',
];

describe('the words this cabinet gives the engine', () => {
  test('⚠️ the engine accepts the preset, which is what makes the reach card possible at all', () => {
    // `presetProblems` catches the defect the engine names: an empty label is "a nameless button on the
    // remap screen", which is a control a child cannot be told the name of.
    expect(presetProblems(pinballPreset(t))).toEqual([]);
  });

  test('⚠️ and it names EXACTLY the positions this cabinet has — eight, by name', () => {
    /**
     * ⚠️ EIGHT AND NOT FOURTEEN, AND THE THREE ABSENCES ARE EACH A DECISION:
     *
     *   · the four DIRECTIONS are absent because the Dev took them off the paddles — "IMPORTANTE: botões
     *     esquerda e direita não devem mais mover as pás" — and gave them the menus instead.
     *   · `action4` is absent because the Dev's table has a fourth button and a pinball has three.
     *     Binding it because it is there is how a cabinet grows a control nobody asked for.
     *   · `select` is absent because nothing in this game selects.
     *
     * A preset that named more would make the engine ask every transport for positions this game will
     * never use, and the reach card would refuse a machine that can play this perfectly well.
     */
    expect(presetActions(pinballPreset(t)).sort()).toEqual([...EXPECTED].sort());
  });

  test('and the cabinet table agrees, which is the half that makes the derivation honest', () => {
    // The preset is BUILT from `CABINET_OF_ENGINE_ACTION`, so comparing the two would compare the code
    // with itself. The literals above are the third party: both sides must match them.
    const named = Object.keys(CABINET_OF_ENGINE_ACTION).filter(isAction).sort();

    expect(named, 'the cabinet map names the same eight engine positions').toEqual([...EXPECTED].sort());
  });

  test('⚠️ every label is a WORD, and never a key that leaked through the translator', () => {
    /**
     * `createTranslator` answers an unknown key with the key itself, which is the right behaviour and the
     * wrong thing to ship: a child on the remap screen would read `pinball.controls.plunger` where the
     * name of the button belongs. `presetProblems` cannot catch it — a key is a non-empty string.
     */
    const preset = pinballPreset(t);

    for (const action of presetActions(preset)) {
      const label = preset[action]!.label;
      expect(label, `${action} is labelled with a key`).not.toMatch(/^pinball\./);
      expect(label.length, `${action} has a word`).toBeGreaterThan(1);
    }
  });

  test('⚠️ and the four rails say FLIPPER, because that is what the child’s hands are doing', () => {
    /**
     * The Dev's table: "7, left shoulder = pá esquerda / Y, left trigger = pá esquerda / 8, right
     * shoulder = pá direita / O, right trigger = pá direita." Four rails, two paddles — the layout a real
     * cabinet has, with the buttons under the hands that hold the machine.
     *
     * ⚠️ SO FOUR POSITIONS SHARE TWO WORDS, and that is correct rather than lazy: the remap screen names
     * what the control DOES, and two of these do the same thing. A label that said "left shoulder" would
     * be naming the hardware back at the person holding it.
     */
    const preset = pinballPreset(t);

    expect(preset.leftShoulder!.label).toBe(preset.leftTrigger!.label);
    expect(preset.rightShoulder!.label).toBe(preset.rightTrigger!.label);
    expect(preset.action2!.label, 'and the keyboard flipper says the same thing')
      .toBe(preset.leftShoulder!.label);
    expect(preset.leftShoulder!.label).not.toBe(preset.rightShoulder!.label);
  });

  test('the words follow the locale, because they are read by a child and not by the engine', () => {
    // `ActionWord.label` is a rendered STRING and not a key — the engine has no dictionary of this game's
    // words. So the preset is built with a translator rather than with literals.
    expect(pinballPreset(createTranslator('pt')).action1!.label)
      .not.toBe(pinballPreset(createTranslator('en')).action1!.label);
  });
});
