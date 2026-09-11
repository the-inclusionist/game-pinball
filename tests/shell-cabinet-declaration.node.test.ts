// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CABINET IS A DECLARATION NOW, AND «RESTORE DEFAULTS» RESTORES THIS ONE.
//
// ⚠️ THE ENGINE WAS REGISTERING `null` FOR BOTH MAPPINGS, so `initKB()` built ITS factory and `resetKB()`
// gave a child back the ENGINE's cabinet rather than this game's. Invisible for the whole port, and
// invisible for a reason that is not luck exactly but is not agreement either: `DEFAULT_BINDINGS`
// (U / J / K / 7 / Y / 8 / O / Enter / H) happens to be `KEYBOARD_SOLO`, and `shell/pad`'s own header
// records that it was DISCOVERED to be, not designed to be.
//
// ⚠️ AN ACCIDENT IS NOT AN AGREEMENT, and the difference is one edit wide. Change one key in this game's
// table and the engine goes on answering with the old one — `actionOf` resolves against a scheme this game
// never chose, and "restore defaults" hands back a layout its author did not pick. In a game whose author
// chose a layout for an accessibility reason, the child loses that reason and nothing says so.
//
// ========================= WHY THE MAPPING IS DERIVED AND NOT TYPED =========================
// Two tables already state this: `shell/controls.DEFAULT_BINDINGS` says which keys work which CONTROL,
// and `shell/pad.CABINET_OF_ENGINE_ACTION` says which engine POSITION is which control. A third table
// naming "KeyJ is action2" would be the same fact said again — the shape this repository has paid for on
// a bumper's rectangle, a HUD inset and a plunger's speed.
//
// ⚠️ SO THE ONLY THING THE DERIVATION INVENTS IS WHERE A KEY GOES WHEN THE ENGINE HAS NO OPINION, and it
// does not invent that either: it goes to the FIRST position, in the engine's own canonical order, that
// this cabinet maps to that control. For the left flipper that is `action2`, which is where the engine
// puts `KeyJ` anyway.
import { describe, test, expect } from 'vitest';
import { cabinetKeyboard, cabinetPad } from '../app/js/shell/cabinet-declaration.js';
import { DEFAULT_BINDINGS } from '../app/js/shell/controls.js';
import { CABINET_OF_ENGINE_ACTION } from '../app/js/shell/pad.js';
import { isAction, type Action } from '@the-inclusionist/engine/core/actions.js';
import { registrarMapeamentoDoTeclado, resetKB } from '@the-inclusionist/engine/input/keyboard.js';

/** Every engine position this cabinet answers to. */
const MINE = Object.keys(CABINET_OF_ENGINE_ACTION).filter(isAction) as Action[];

describe('the keyboard this game declares', () => {
  test('⚠️ every key of every control reaches the engine, exactly once', () => {
    /**
     * ⚠️ EXACTLY ONCE IS HALF THE CLAIM AND IT IS THE HALF THAT BITES. `KeyY` is the left flipper and it is
     * also `leftTrigger`; declaring it on BOTH `action2` and `leftTrigger` would work — both resolve to the
     * same paddle — right up until a child remaps one of them and the other goes on firing. A key that two
     * positions claim is a key the remap screen cannot honestly describe.
     */
    const map = cabinetKeyboard(1, 0)!;
    const seen = new Map<string, Action[]>();

    for (const action of Object.keys(map) as Action[]) {
      for (const code of map[action] ?? []) {
        seen.set(code, [...(seen.get(code) ?? []), action]);
      }
    }

    const twice = [...seen].filter(([, actions]) => actions.length > 1);
    expect(twice, 'these keys are claimed by two positions at once').toEqual([]);

    for (const [control, codes] of Object.entries(DEFAULT_BINDINGS)) {
      // The accessibility keys are not cabinet positions — see the module's note on why they stay out.
      if (!Object.values(CABINET_OF_ENGINE_ACTION).includes(control as never)) continue;
      for (const code of codes) {
        expect(seen.has(code), `${code} works the ${control} and the engine is never told`).toBe(true);
      }
    }
  });

  test('⚠️ and a key the engine is told about really does work that control', () => {
    // The mirror. Without it, a mapping that declared every key on one arbitrary position would satisfy
    // the case above and hand the engine a cabinet nobody can play.
    const map = cabinetKeyboard(1, 0)!;

    for (const action of Object.keys(map) as Action[]) {
      const control = CABINET_OF_ENGINE_ACTION[action]!;
      for (const code of map[action] ?? []) {
        expect(DEFAULT_BINDINGS[control as keyof typeof DEFAULT_BINDINGS],
          `${code} is declared as ${action} and this cabinet does not use it for ${control}`)
          .toContain(code);
      }
    }
  });

  test('⚠️ it declares only the positions this cabinet has, and says nothing about the rest', () => {
    /**
     * The mapping is PARTIAL by design — the engine's own note: "um jogo que só queira trocar o `action1`
     * troca o `action1`". Naming a position this game does not use would move a key the engine gave to its
     * MENUS, which is where the directions went when the Dev took them off the paddles.
     */
    expect(Object.keys(cabinetKeyboard(1, 0)!).sort()).toEqual([...MINE].sort());
  });
});

describe('the pad this game declares', () => {
  test('⚠️ it declares ABSENCES and never invents a button index', () => {
    /**
     * ⚠️ THIS GAME HAS NO BUTTON ARRANGEMENT OF ITS OWN, and saying so is the honest declaration. It reads
     * the pad through `padActions` and the engine's factory indices; inventing numbers here would be
     * choosing a layout nobody asked for, on hardware this project has never measured.
     *
     * What it DOES know is which positions do not exist in it, and the engine has a word for that: `null`
     * "diz «esta posição não existe neste jogo», que é diferente de a deixar na fábrica". The four
     * directions belong to the menus, `action4` is the button the Dev's table has and a pinball does not,
     * and nothing here selects.
     */
    const map = cabinetPad(1, 0)!;
    const declared = Object.keys(map) as Action[];

    for (const action of declared) {
      expect(map[action], `${action} was given an invented index`).toBeNull();
      expect(MINE, `${action} IS a position this cabinet uses and must not be refused`).not.toContain(action);
    }
    expect(declared.length, 'it refuses nothing at all, which cannot be right').toBeGreaterThan(0);
  });

  test('and the two declarations do not contradict each other', () => {
    // One says "these positions are mine"; the other says "these are not". A position in both lists would
    // be a cabinet that claims a control and refuses it in the same breath.
    const refused = Object.keys(cabinetPad(1, 0)!);
    const claimed = Object.keys(cabinetKeyboard(1, 0)!);

    expect(refused.filter((a) => claimed.includes(a))).toEqual([]);
  });
});

describe('⚠️ and the engine RESOLVES to this cabinet, which is the whole point', () => {
  /**
   * ⚠️ THE ONE THAT COULD NOT BE BORN RED, AND WHY. `DEFAULT_BINDINGS` already equals the engine's
   * `KEYBOARD_SOLO`, so before this module existed `resetKB()` returned the right keys FOR THE WRONG
   * REASON — the engine's factory happened to agree. A case written against today's keys would have been
   * green on both sides of the change and would have proved nothing at all.
   *
   * 📏 SO IT IS PROVED BY MUTATION, and the mutation is recorded in the commit: change
   * `DEFAULT_BINDINGS.plunger` from `KeyU` to `KeyP` in `shell/controls`. Before the registration,
   * `resetKB()` goes on answering `KeyU` — the engine's factory, which never heard of this game. After it,
   * `resetKB()` answers `KeyP`. That difference is the entire subject of this section.
   *
   * ⚠️ IT WRITES ENGINE MODULE STATE, which is safe because Vitest isolates a file per worker — and is
   * named here because `registrarMapeamentoDoTeclado` is a REGISTRY and not a parameter. The engine's own
   * reason for that shape: `resetKB` is called by the controls panel, which does not have the game's
   * declaration to hand.
   */
  test('restore defaults gives back THIS game\u2019s keys, not the engine\u2019s', () => {
    registrarMapeamentoDoTeclado(cabinetKeyboard);

    const factory = resetKB();
    const mine = cabinetKeyboard(1, 0);

    for (const action of Object.keys(mine) as Action[]) {
      expect([...(factory.solo[action] ?? [])], `${action} after restore`).toEqual([...(mine[action] ?? [])]);
    }
  });

  test('⚠️ and every key of every cabinet control survives the round trip', () => {
    /**
     * The claim a child would notice: press "restore defaults" and the paddles still work from all three
     * of their keys. Asserted through `CABINET_OF_ENGINE_ACTION` rather than position by position, because
     * WHICH position holds a key is the engine's business and WHETHER the key works the paddle is the
     * player's.
     */
    registrarMapeamentoDoTeclado(cabinetKeyboard);
    const factory = resetKB();

    const worksAsCabinet = new Map<string, string>();
    for (const [action, codes] of Object.entries(factory.solo)) {
      const control = CABINET_OF_ENGINE_ACTION[action];
      if (!control) continue;
      for (const code of codes ?? []) worksAsCabinet.set(code, control);
    }

    for (const [control, codes] of Object.entries(DEFAULT_BINDINGS)) {
      if (!Object.values(CABINET_OF_ENGINE_ACTION).includes(control as never)) continue;
      for (const code of codes) {
        expect(worksAsCabinet.get(code), `${code} stopped working the ${control}`).toBe(control);
      }
    }
  });
});
