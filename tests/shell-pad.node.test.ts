// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CABINET ON A GAMEPAD, THROUGH THE ENGINE'S OWN READER.
//
// ⚠️ THE DEV ASKED WHETHER THE ENGINE PROVIDES THIS, AND IT DOES. `input/gamepad` ships a binding
// wizard, analog-axis and hat thresholds, `localStorage` persistence and `padActions(pad, customMap)`,
// which turns a raw pad into the engine's action vocabulary. The pinball was using NONE of it: it read
// `event.code` off the keyboard and nothing else, so a controller did nothing at all.
//
// What this module adds is the one thing the engine cannot know — which of ITS actions are this game's
// cabinet. Everything below that translation is the engine's, including every reason an analog stick
// counts as "left" at some threshold and not another.
//
// ⚠️ AND THE ENGINE'S VOCABULARY IS PLATFORMER-SHAPED, which is a constraint rather than a complaint:
// `jump`, `run`, `swap`, `especial`. There is no "left shoulder" among them, so on a pad the flippers
// are driven by the DIRECTIONS — which is exactly how the Dev specified the cabinet ("esquerda move pá
// da esquerda") — with two face buttons as the alternates that buttons 2 and 3 are.
import { describe, test, expect } from 'vitest';
import { cabinetFromPad, createPadReader, type PadReaderEvents } from '../app/js/shell/pad.js';

/**
 * ⚠️ THE ENGINE'S MIGRATION LANDED, AND THIS FIXTURE IS WHERE IT SURFACED. `padActions` used to return
 * `jump`/`run`/`swap`/`especial`; it now returns `action1`..`action4`, which is the engine's issue
 * #103 executing ADR-0085 and ADR-0086. `PadActions` requires the new four, so the old fixture stopped
 * type-checking — the first thing in this repository to notice.
 *
 * ⚠️ AND NOTHING ELSE BROKE, WHICH WAS THE POINT OF THE DUAL TABLE. `CABINET_OF_ENGINE_ACTION` has held
 * both vocabularies since the Dev said the rename was coming, precisely so this day would cost a
 * fixture rather than a controller. The old names stay below as well: they cost nothing, and a game
 * that runs against two engine versions is a game whose player is not waiting on a package.
 */
const NOTHING = {
  left: false, right: false, up: false, down: false,
  action1: false, action2: false, action3: false, action4: false,
  jump: false, run: false, swap: false, especial: false, _start: false, _pause: false,
};

describe('translating the engine’s actions into the cabinet', () => {
  test('⚠️ the directions are NOT the flippers any more, which is how the Dev respecified them', () => {
    /**
     * "IMPORTANTE: botões esquerda e direita não devem mais mover as pás."
     *
     * This test used to assert the opposite, and the reason it did was good at the time: the Dev's
     * first cabinet WAS a direction each way plus three buttons. The directions have a job now —
     * "wasd ou xbox_direcional = movimento (pelos menus)" — and `padActions` emits `left`/`right` for
     * the D-pad AND the analog stick, so leaving them bound would mean a player on a pad flipping
     * with the same two controls they walk a menu with.
     */
    expect(cabinetFromPad({ ...NOTHING, left: true }).left, 'the D-pad still flips').toBe(false);
    expect(cabinetFromPad({ ...NOTHING, right: true }).right, 'the D-pad still flips').toBe(false);
  });

  test('⚠️ and the shoulders and triggers are, which is where the paddles went', () => {
    // "7, left shoulder = pá esquerda / Y, left trigger = pá esquerda / 8, right shoulder = pá
    // direita / O, right trigger = pá direita." Four rails, two paddles, under the hands that hold
    // the machine.
    expect(cabinetFromPad({ ...NOTHING, leftShoulder: true }).left).toBe(true);
    expect(cabinetFromPad({ ...NOTHING, leftTrigger: true }).left).toBe(true);
    expect(cabinetFromPad({ ...NOTHING, rightShoulder: true }).right).toBe(true);
    expect(cabinetFromPad({ ...NOTHING, rightTrigger: true }).right).toBe(true);
  });

  test('⚠️ and the buttons are the slots the Dev\u2019s own keys sit in', () => {
    // Discovered rather than chosen: a/d/u/j/k are the engine's solo defaults for
    // left/right/run/jump/especial, action for action. So button 2 is `jump` and button 3 is
    // `especial` — both flippers again — and button 1, the launch, is `run`.
    expect(cabinetFromPad({ ...NOTHING, jump: true }).left, 'button 2 works the left flipper').toBe(true);
    expect(cabinetFromPad({ ...NOTHING, especial: true }).right, 'button 3 works the right').toBe(true);
    expect(cabinetFromPad({ ...NOTHING, run: true }).launch, 'button 1 launches').toBe(true);
    expect(cabinetFromPad({ ...NOTHING, _pause: true }).pause).toBe(true);
  });

  test('⚠️ and `jump` is NOT the launch, which is what the first version had', () => {
    // It mapped `jump` to the launch because `jump` is the A button and launching felt primary. That
    // put buttons 1 and 2 on each other's slots, so a player who remapped the keyboard through the
    // engine's panel would have found the pad disagreeing with it.
    expect(cabinetFromPad({ ...NOTHING, jump: true }).launch).toBe(false);
  });

  test('⚠️ and a pad at rest asks for NOTHING, or the game plays itself', () => {
    expect(cabinetFromPad(NOTHING)).toEqual({ left: false, right: false, launch: false, pause: false });
  });

  /**
   * ⚠️ THE ENGINE IS RENAMING ITS BUTTONS UNDER THIS GAME, and the Dev said so while the migration is
   * still ahead of it. ADR-0085 replaced the nine platformer actions with FOURTEEN positions and
   * ADR-0086 named the last four for the hand:
   *
   *     up · down · left · right
   *     action1 · action2 · action3 · action4
   *     leftShoulder · leftTrigger · rightShoulder · rightTrigger
   *     start · select
   *
   * ⚠️ AND NOTHING SPEAKS THEM YET. Both records say it in their own consequences: "nothing in the
   * running game changes: no transport reads `core/actions.ts`". `input/gamepad.js` still returns
   * `jump`/`run`/`especial`/`_pause`, and the engine's issue #103 is the migration. The tests above
   * are that vocabulary and must keep passing until it lands.
   *
   * So this table holds BOTH, which costs nothing: `cabinetFromPad` asks whether ANY action bound to a
   * control is pressed, so a name nobody emits contributes `false` for ever. What it buys is that the
   * day #103 lands, the pad keeps working instead of going silent — and going silent is exactly what
   * it did before this module existed, for the same reason: a vocabulary nobody had connected.
   *
   * ⚠️ THE CORRESPONDENCE IS EXACT, and it is ADR-0086 §2 that makes it so. The corrected platformer
   * preset is `action1`→run, `action2`→jump, `action3`→especial, and the Dev's own table gives the
   * same keys and buttons this cabinet already uses: U/X launches, J/A is the left flipper, K/B the
   * right, Enter/Menu pauses. Nothing moves. That is the measurement ADR-0086 makes for the
   * platformer, holding for the pinball as well.
   */
  describe('and the fourteen positions the engine is moving to', () => {
    test('⚠️ button 1 launches under BOTH names', () => {
      expect(cabinetFromPad({ ...NOTHING, run: true }).launch, 'today').toBe(true);
      expect(cabinetFromPad({ ...NOTHING, action1: true }).launch, 'after #103').toBe(true);
    });

    test('and buttons 2 and 3 are the flippers under both', () => {
      expect(cabinetFromPad({ ...NOTHING, action2: true }).left).toBe(true);
      expect(cabinetFromPad({ ...NOTHING, action3: true }).right).toBe(true);
    });

    test('⚠️ `start` pauses, which is the name replacing `_pause`', () => {
      // The one place the two vocabularies genuinely differ for this cabinet: pause arrives as the
      // engine's private `_pause` today and as the ACTION `start` afterwards. ADR-0085 kept `start` a
      // name rather than a number precisely because it is a system function.
      expect(cabinetFromPad({ ...NOTHING, start: true }).pause).toBe(true);
    });

    test('⚠️ and `action4` does NOTHING, because this cabinet has three buttons', () => {
      // The Dev's table has four (`I` / Y), and a pinball uses three. Binding the fourth to something
      // because it is there is how a cabinet grows a control nobody asked for.
      expect(cabinetFromPad({ ...NOTHING, action4: true }))
        .toEqual({ left: false, right: false, launch: false, pause: false });
    });
  });
});

function reader(events: Partial<PadReaderEvents> = {}) {
  const fired: string[] = [];
  let pad: Record<string, unknown> | null = null;
  const api = createPadReader({
    getGamepads: () => [pad as never],
    on: {
      setFlipper: (side, extended) => fired.push(`${side}:${extended ? 'on' : 'off'}`),
      launch: () => fired.push('launch'),
      togglePause: () => fired.push('pause'),
      ...events,
    },
  });
  /** Standard mapping: 0 = A (jump), 1 = B (especial), 2 = X (run), 9 = start. */
  const press = (...indices: number[]) => {
    pad = {
      id: 'fake', index: 0, mapping: 'standard',
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: indices.includes(i) })),
      axes: [0, 0, 0, 0],
    };
    api.poll();
  };
  return { fired, press, none: () => press() };
}

describe('polling a pad', () => {
  test('no pad connected is not an error, and asks for nothing', () => {
    const api = createPadReader({ getGamepads: () => null, on: {} as PadReaderEvents });

    expect(() => api.poll()).not.toThrow();
  });

  test('holding a flipper button raises it, and releasing drops it', () => {
    const { fired, press, none } = reader();

    press(1);   // B → especial → right flipper
    none();

    expect(fired).toEqual(['right:on', 'right:off']);
  });

  test('⚠️ and HOLDING it does not raise it twice, because a flipper is a state', () => {
    // The pad is polled every frame. Reporting a press on each of them would call `setFlipper` sixty
    // times a second — and `setFlipperMotion` on an already-extended flipper leaves it STILL, which is
    // the defect `shell/controls` documents for held keys, arriving by a different road.
    const { fired, press } = reader();

    press(1);
    press(1);
    press(1);

    expect(fired).toEqual(['right:on']);
  });

  test('⚠️ and the same for the LEFT flipper, because two branches are two chances', () => {
    // Written after a mutation survived: removing the edge check on the LEFT branch changed nothing,
    // because every test above presses Y and Y is the right flipper. Two sides of an `if` are two
    // things to get wrong, and a test that exercises one of them proves one of them.
    const { fired, press } = reader();

    press(0);   // A → jump → left flipper
    press(0);
    press(0);

    expect(fired).toEqual(['left:on']);
  });

  test('⚠️ launch fires on the PRESS, not on every frame it is held', () => {
    // A launch repeated sixty times a second would relaunch a ball already in play, or refuse in a
    // loop. It is an edge, like the key it mirrors.
    const { fired, press } = reader();

    press(2);
    press(2);
    press(2);

    expect(fired).toEqual(['launch']);
  });

  test('and pressing it again after a release fires again', () => {
    const { fired, press, none } = reader();

    press(2);
    none();
    press(2);

    expect(fired).toEqual(['launch', 'launch']);
  });

  test('start pauses on the press, once', () => {
    const { fired, press } = reader();

    press(9);
    press(9);

    expect(fired).toEqual(['pause']);
  });
});
