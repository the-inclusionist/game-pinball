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

const NOTHING = {
  left: false, right: false, up: false, down: false,
  jump: false, run: false, swap: false, especial: false, _start: false, _pause: false,
};

describe('translating the engine’s actions into the cabinet', () => {
  test('the directions are the flippers, which is how the Dev specified them', () => {
    expect(cabinetFromPad({ ...NOTHING, left: true }).left).toBe(true);
    expect(cabinetFromPad({ ...NOTHING, right: true }).right).toBe(true);
  });

  test('and the face buttons are the same two flippers again, as buttons 2 and 3', () => {
    // The cabinet gives a player two ways to work each flipper. On a pad that is a direction and a
    // button, so a player using a stick and a player using their thumb both have a full set.
    expect(cabinetFromPad({ ...NOTHING, especial: true }).left).toBe(true);
    expect(cabinetFromPad({ ...NOTHING, swap: true }).right).toBe(true);
  });

  test('button 1 launches and start pauses', () => {
    expect(cabinetFromPad({ ...NOTHING, jump: true }).launch).toBe(true);
    expect(cabinetFromPad({ ...NOTHING, _pause: true }).pause).toBe(true);
  });

  test('⚠️ and a pad at rest asks for NOTHING, or the game plays itself', () => {
    expect(cabinetFromPad(NOTHING)).toEqual({ left: false, right: false, launch: false, pause: false });
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
  /** Buttons by standard-mapping index: 0 = A (jump), 9 = start. */
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

    press(3);   // Y → swap → right flipper
    none();

    expect(fired).toEqual(['right:on', 'right:off']);
  });

  test('⚠️ and HOLDING it does not raise it twice, because a flipper is a state', () => {
    // The pad is polled every frame. Reporting a press on each of them would call `setFlipper` sixty
    // times a second — and `setFlipperMotion` on an already-extended flipper leaves it STILL, which is
    // the defect `shell/controls` documents for held keys, arriving by a different road.
    const { fired, press } = reader();

    press(3);
    press(3);
    press(3);

    expect(fired).toEqual(['right:on']);
  });

  test('⚠️ and the same for the LEFT flipper, because two branches are two chances', () => {
    // Written after a mutation survived: removing the edge check on the LEFT branch changed nothing,
    // because every test above presses Y and Y is the right flipper. Two sides of an `if` are two
    // things to get wrong, and a test that exercises one of them proves one of them.
    const { fired, press } = reader();

    press(1);   // B → especial → left flipper
    press(1);
    press(1);

    expect(fired).toEqual(['left:on']);
  });

  test('⚠️ launch fires on the PRESS, not on every frame it is held', () => {
    // A launch repeated sixty times a second would relaunch a ball already in play, or refuse in a
    // loop. It is an edge, like the key it mirrors.
    const { fired, press } = reader();

    press(0);
    press(0);
    press(0);

    expect(fired).toEqual(['launch']);
  });

  test('and pressing it again after a release fires again', () => {
    const { fired, press, none } = reader();

    press(0);
    none();
    press(0);

    expect(fired).toEqual(['launch', 'launch']);
  });

  test('start pauses on the press, once', () => {
    const { fired, press } = reader();

    press(9);
    press(9);

    expect(fired).toEqual(['pause']);
  });
});
