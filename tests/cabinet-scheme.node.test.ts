// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CABINET, AS THE DEV SPECIFIED IT, POSITION BY POSITION.
//
// ⚠️ HIS TABLE, VERBATIM:
//
//     wasd ou xbox_direcional = movimento (pelos menus)
//     u ou xbox_X   = action 1 = arremeço de bola
//     j ou xbox_A   = action 2 = pá esquerda ou confirmação/seleção/ação
//     k ou xbox_B   = action 3 = pá direita ou negação
//     i ou xbox_Y   = action 5 = nada atribuído por enquanto
//     h, enter ou xbox_menu = start / pausa
//
//     7, left shoulder  = pá esquerda
//     Y, left trigger   = pá esquerda
//     8, right shoulder = pá direita
//     O, right trigger  = pá direita
//     F, Select = nada atribuído por enquanto.
//
//     IMPORTANTE: botões esquerda e direita não devem mais mover as pás.
//
// ========================= THE LAST LINE IS THE WHOLE CHANGE =========================
// A and D have been the left and right flippers since the cabinet was first written, beside J and K,
// and the module's own comment argued for the pair: "A/D are a direction pair for one hand; J/K are a
// button pair for the other." That reasoning is now retired by the Dev, and the reason he gives is
// better than the one it replaces: the directions have a JOB, which is moving through menus, and a key
// that flips a paddle in a game and walks a list in a menu is a key a player has to think about.
//
// ⚠️ AND `Y` IS TWO DIFFERENT THINGS IN THAT TABLE, which is the one place it can be misread. "i ou
// xbox_Y" is the pad's Y BUTTON and carries nothing yet; "Y, left trigger" is the keyboard's Y KEY and
// is a left flipper. They are not the same control and this file keeps them apart.
import { describe, test, expect } from 'vitest';
import { DEFAULT_BINDINGS, MENU_BINDINGS, type PinballAction } from '../app/js/shell/controls.js';
import { CABINET_OF_ENGINE_ACTION } from '../app/js/shell/pad.js';

describe('the flippers', () => {
  test('⚠️ the left is J, 7 and Y — the button, the shoulder and the trigger', () => {
    expect(DEFAULT_BINDINGS.left).toEqual(['KeyJ', 'Digit7', 'KeyY']);
  });

  test('⚠️ and the right is K, 8 and O', () => {
    expect(DEFAULT_BINDINGS.right).toEqual(['KeyK', 'Digit8', 'KeyO']);
  });

  test('⚠️ and NO DIRECTION MOVES A PADDLE, which is the line he marked IMPORTANT', () => {
    /**
     * "IMPORTANTE: botões esquerda e direita não devem mais mover as pás."
     *
     * Checked against every key that is a direction on either device rather than against the two that
     * used to be bound: the failure this guards is somebody adding the arrows back, or W and S, on the
     * reasoning that "the directions are free now" — which is exactly backwards. They are not free;
     * they have a job.
     */
    const directions = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const onAPaddle = directions.filter((code) =>
      DEFAULT_BINDINGS.left.includes(code) || DEFAULT_BINDINGS.right.includes(code));

    expect(onAPaddle, 'these directions still move a paddle').toEqual([]);
  });
});

describe('the buttons', () => {
  test('the launch is U, and it is the only thing on it', () => {
    expect(DEFAULT_BINDINGS.plunger).toEqual(['KeyU']);
  });

  test('start is H and Enter', () => {
    expect([...DEFAULT_BINDINGS.pause].sort()).toEqual(['Enter', 'KeyH']);
  });

  test('⚠️ and nothing is bound twice, on any device', () => {
    // A code in two actions is answered by whichever the lookup reaches first — silently, for ever.
    // `bindPinballControls` finds the FIRST action whose list contains the code, and the order is the
    // table's own, so a duplicate is not an error anywhere: it is a key that does the wrong one.
    const seen = new Map<string, PinballAction>();
    const clashes: string[] = [];
    for (const [action, codes] of Object.entries(DEFAULT_BINDINGS) as [PinballAction, readonly string[]][]) {
      for (const code of codes) {
        const already = seen.get(code);
        if (already) clashes.push(`${code} is both ${already} and ${action}`);
        else seen.set(code, action);
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe('the menus move on WASD and answer on J and K', () => {
  test('⚠️ the directions walk, which is the job that took them off the paddles', () => {
    expect(MENU_BINDINGS.up).toEqual(['KeyW']);
    expect(MENU_BINDINGS.down).toEqual(['KeyS']);
    expect(MENU_BINDINGS.left).toEqual(['KeyA']);
    expect(MENU_BINDINGS.right).toEqual(['KeyD']);
  });

  test('⚠️ J confirms and K refuses — "confirmação/seleção/ação" and "negação"', () => {
    expect(MENU_BINDINGS.confirm).toEqual(['KeyJ']);
    expect(MENU_BINDINGS.cancel).toEqual(['KeyK']);
  });

  test('and start still reaches a menu, because start is how you leave one', () => {
    expect([...MENU_BINDINGS.pause].sort()).toEqual(['Enter', 'KeyH']);
  });

  test('⚠️ the launch key is NOT a menu answer any more', () => {
    // It was: the pause menu chose with the plunger, because the plunger was the only button the
    // cabinet had spare. J is that button now, and leaving U on it as well would be two ways to do one
    // thing, one of which the Dev's table does not mention.
    const menuCodes = Object.values(MENU_BINDINGS).flat();
    expect(menuCodes, 'U still answers a menu').not.toContain('KeyU');
  });
});

describe('the gamepad follows the same table', () => {
  test('⚠️ the D-PAD no longer moves a paddle either', () => {
    // The engine emits `left` and `right` for the D-pad AND for the analog stick, and both used to be
    // flippers. "botões esquerda e direita não devem mais mover as pás" is about the cabinet, not
    // about the keyboard: a player on a pad was pressing the same two directions.
    expect(CABINET_OF_ENGINE_ACTION['left'], 'the D-pad still flips').toBeUndefined();
    expect(CABINET_OF_ENGINE_ACTION['right'], 'the D-pad still flips').toBeUndefined();
  });

  test('⚠️ and the shoulders and triggers do, which is where they went', () => {
    expect(CABINET_OF_ENGINE_ACTION['leftShoulder']).toBe('left');
    expect(CABINET_OF_ENGINE_ACTION['leftTrigger']).toBe('left');
    expect(CABINET_OF_ENGINE_ACTION['rightShoulder']).toBe('right');
    expect(CABINET_OF_ENGINE_ACTION['rightTrigger']).toBe('right');
  });

  test('A and B stay the flippers, X the launch, and Y unassigned', () => {
    // The four face buttons, in the engine's fourteen-position vocabulary.
    expect(CABINET_OF_ENGINE_ACTION['action1'], 'X is the launch').toBe('plunger');
    expect(CABINET_OF_ENGINE_ACTION['action2'], 'A is the left flipper').toBe('left');
    expect(CABINET_OF_ENGINE_ACTION['action3'], 'B is the right flipper').toBe('right');
    // ⚠️ "i ou xbox_Y = action 5 = nada atribuído por enquanto", and `select` likewise. Binding either
    // because it is there is how a cabinet grows a control nobody asked for.
    expect(CABINET_OF_ENGINE_ACTION['action4'], 'Y was given a job nobody asked for').toBeUndefined();
    expect(CABINET_OF_ENGINE_ACTION['select'], 'Select was given a job nobody asked for').toBeUndefined();
  });
});
