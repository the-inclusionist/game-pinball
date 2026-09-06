// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CONTROLS, WRITTEN DOWN WHERE A PLAYER CAN READ THEM.
//
// ⚠️ NOTHING IN THIS GAME HAS EVER SAID WHAT THE KEYS ARE. The cabinet is exactly what the Dev
// specified — "a - esquerda, d - direita, u - botão 1, j - botão 2, k - botão 3, start - enter" — it is
// bound, it is tested, it works on a gamepad, and a player who opens the page is told none of it. They
// press the arrows, which do nothing, and conclude the same thing the Dev concluded twice: "teclado e
// mouse continuam não funcionando no jogo."
//
// ⚠️ AND THE ACCESSIBILITY KEYS ARE THE HALF THAT MATTERS MOST. `shell/controls` says it in its own
// header — "a player who needs blind mode is not the player who is going to find it in a settings
// panel" — and then B, S and C were left exactly as findable as if they were in one.
//
// ========================= WHY IT IS DERIVED AND NOT WRITTEN =========================
// A hand-written legend is prose about code, and prose drifts. `docs/README` already carries a ledger
// of these keys and it is kept honest by a BIDIRECTIONAL gate — every binding is documented, every
// documented key is bound — because a list of controls that is merely typed out is a list that will be
// right on the day it is typed and wrong afterwards. The screen gets the same treatment for the same
// reason, and the tests below are that gate: the legend is read out of `DEFAULT_BINDINGS`, and a key
// that changes there changes on the screen without anybody remembering to.
import { describe, test, expect } from 'vitest';
import { controlLegend, keyLabel, LEGEND_ORDER } from '../app/js/shell/control-legend.js';
import { DEFAULT_BINDINGS, type PinballAction } from '../app/js/shell/controls.js';
import { allKeys } from '../app/js/i18n/index.js';

describe('every control is on the list, and every line is a real control', () => {
  test('⚠️ each bound action appears exactly once', () => {
    // The first half of the ledger. Adding an action to the cabinet and forgetting the screen is the
    // failure this catches, and it is the one that has already happened to the README twice.
    const shown = controlLegend().map((row) => row.action).sort();

    expect(shown).toEqual((Object.keys(DEFAULT_BINDINGS) as PinballAction[]).sort());
  });

  test('and no line names an action the cabinet does not have', () => {
    // The other half. A legend that outlives the binding it describes teaches a key that does nothing.
    for (const row of controlLegend()) {
      expect(DEFAULT_BINDINGS[row.action], `${row.action} is bound`).toBeDefined();
    }
  });

  test('⚠️ the keys come from the BINDINGS, which is the whole point of the module', () => {
    // Handed a cabinet whose left flipper is on Q, the legend says Q. A legend built from a literal
    // would say A here and would be green for as long as nobody rebound anything.
    const rebound = { ...DEFAULT_BINDINGS, left: ['KeyQ'] };

    const left = controlLegend(rebound).find((row) => row.action === 'left')!;

    expect(left.keys).toEqual(['Q']);
  });

  test('the order is the player’s, not the object’s', () => {
    // The flippers first, because that is what a player reaches for; the accessibility keys after the
    // game's own, because they are read once rather than every time.
    expect(controlLegend().map((row) => row.action)).toEqual([...LEGEND_ORDER]);
  });
});

describe('the key names are readable', () => {
  test('⚠️ `KeyA` is A, because nothing on a keyboard is labelled KeyA', () => {
    expect(keyLabel('KeyA')).toBe('A');
  });

  test('and a code that is already a word is left alone', () => {
    expect(keyLabel('Enter')).toBe('Enter');
  });

  test('⚠️ EVERY code the cabinet actually binds comes out short and human', () => {
    // The gate rather than the two examples: a binding added on some future day gets checked here on
    // that day, and `Key`/`Digit`/`Arrow` prefixes are the ones that reach a screen unnoticed.
    for (const codes of Object.values(DEFAULT_BINDINGS)) {
      for (const code of codes) {
        const label = keyLabel(code);
        expect(label, code).not.toMatch(/^(Key|Digit|Arrow|Numpad)/);
        expect(label.length, `${code} is short enough for a 320-pixel screen`).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe('and it can be said in three languages', () => {
  test('⚠️ every label the legend asks for is a key all three dictionaries have', () => {
    // ⚠️ AND THE USUAL GATE CANNOT SEE THESE. `tests/i18n-keys-exist` scans the source for `t('…')`
    // literals; these keys are COMPUTED from the action name, so that scan finds none of them and a
    // missing translation would reach the screen as the key itself.
    const known = new Set(allKeys());

    for (const row of controlLegend()) {
      expect(known.has(row.labelKey), `${row.labelKey} is translated`).toBe(true);
    }
  });
});
