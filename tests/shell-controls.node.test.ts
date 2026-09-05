// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { bindPinballControls, DEFAULT_BINDINGS } from '../app/js/shell/controls.js';

/**
 * ⚠️ THE GAME HAD NO INPUT AT ALL, AND NOTHING SAID SO.
 *
 * `main.ts` boots, draws, launches a ball and watches it drain. It binds no key. Every gate in the
 * project was green over a game the player cannot touch, because every gate asks about physics,
 * geometry, licence or layout, and none of them asks whether a button does anything.
 *
 * The listeners go on `#game-region` rather than `window` — the engine binds there for its own keys and
 * a game that reached for the window would take keys away from the page around it.
 */

/** Just enough of an element: this file is about the wiring, not about the DOM. */
function fakeRegion() {
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  return {
    addEventListener(type: string, fn: (e: unknown) => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type: string, fn: (e: unknown) => void) {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
    },
    send(type: string, event: Record<string, unknown>) {
      for (const fn of listeners.get(type) ?? []) fn({ preventDefault() {}, repeat: false, ...event });
    },
    count(type: string) { return (listeners.get(type) ?? []).length; },
  };
}

function harness() {
  const region = fakeRegion();
  const moved: string[] = [];
  const launched: number[] = [];
  const unbind = bindPinballControls({
    region: region as never,
    setFlipper: (side, extended) => moved.push(`${side}:${extended ? 'up' : 'down'}`),
    launch: () => launched.push(1),
  });
  return { region, moved, launched, unbind };
}

describe('the flippers answer the keyboard', () => {
  test('pressing the left key raises the left flipper and releasing drops it', () => {
    const h = harness();

    h.region.send('keydown', { code: 'ArrowLeft' });
    h.region.send('keyup', { code: 'ArrowLeft' });

    expect(h.moved).toEqual(['left:up', 'left:down']);
  });

  test('and the right key is a different flipper', () => {
    const h = harness();

    h.region.send('keydown', { code: 'ArrowRight' });

    expect(h.moved).toEqual(['right:up']);
  });

  test('⚠️ a HELD key is not a stream of presses', () => {
    // The operating system repeats a held key, and `setFlipperMotion` on an already-extended flipper
    // leaves it STILL — which is correct there and wrong here: a player holding the button would have
    // the flipper stop kicking a few milliseconds in, and nothing would look broken. The repeat flag
    // exists for exactly this and the browser sets it for us.
    const h = harness();

    h.region.send('keydown', { code: 'ArrowLeft' });
    h.region.send('keydown', { code: 'ArrowLeft', repeat: true });
    h.region.send('keydown', { code: 'ArrowLeft', repeat: true });

    expect(h.moved).toEqual(['left:up']);
  });

  test('a key that means nothing does nothing', () => {
    const h = harness();

    h.region.send('keydown', { code: 'KeyQ' });

    expect(h.moved).toEqual([]);
    expect(h.launched).toEqual([]);
  });

  test('the plunger has its own key', () => {
    const h = harness();

    h.region.send('keydown', { code: 'Space' });

    expect(h.launched).toEqual([1]);
  });

  test('⚠️ a handled key is swallowed, so the page does not scroll under the table', () => {
    // Arrow keys and space scroll a document. A pinball whose left flipper also scrolls the page is
    // unplayable on the first table taller than the window.
    const h = harness();
    let prevented = 0;

    h.region.send('keydown', { code: 'Space', preventDefault: () => { prevented++; } });
    h.region.send('keydown', { code: 'KeyQ', preventDefault: () => { prevented++; } });

    expect(prevented).toBe(1);
  });

  test('unbinding leaves nothing behind', () => {
    const h = harness();

    h.unbind();

    expect(h.region.count('keydown')).toBe(0);
    expect(h.region.count('keyup')).toBe(0);
  });
});

describe('what the keys are', () => {
  test('each side has more than one, because one hand is not everybody’s', () => {
    // Z/. beside the arrows: the classic pinball pair, and a player who cannot reach across the
    // keyboard uses whichever half is nearer. Remapping proper belongs to the engine's settings; this
    // is the floor beneath it.
    expect(DEFAULT_BINDINGS.left.length).toBeGreaterThan(1);
    expect(DEFAULT_BINDINGS.right.length).toBeGreaterThan(1);
  });

  test('and no key does two things', () => {
    const all = Object.values(DEFAULT_BINDINGS).flat();

    expect(new Set(all).size).toBe(all.length);
  });
});

/**
 * ⚠️ BLIND MODE COULD NOT BE TURNED ON, AND THE SONAR HAD JUST BEEN GIVEN TARGETS.
 *
 * `createGame` takes `isBlindMode?: () => boolean` and `bootPinball` passes it through — and `main.ts`
 * never supplied one, so the engine's default `() => false` stood and the audio guide never fired. Two
 * commits earlier the contract's target list had been filled in for exactly this, which means half the
 * accessibility work was reaching a switch nobody could flip. Tenth time in this port.
 *
 * The toggle is a KEY because the whole point is a player who is not looking at a settings panel.
 */
describe('the accessibility keys', () => {
  function withBlind() {
    const region = fakeRegion();
    const toggled: string[] = [];
    bindPinballControls({
      region: region as never,
      setFlipper: () => {},
      launch: () => {},
      toggleBlindMode: () => toggled.push('blind'),
      sweep: () => toggled.push('sweep'),
    });
    return { region, toggled };
  }

  test('one key turns blind mode on and off', () => {
    const h = withBlind();

    h.region.send('keydown', { code: DEFAULT_BINDINGS.blindMode[0] });

    expect(h.toggled).toEqual(['blind']);
  });

  test('another asks the sonar where things are', () => {
    // The guide pings on its own every 0.8 seconds; a sweep is the player ASKING, which is what makes
    // the table explorable rather than merely announced at.
    const h = withBlind();

    h.region.send('keydown', { code: DEFAULT_BINDINGS.sweep[0] });

    expect(h.toggled).toEqual(['sweep']);
  });

  test('⚠️ and holding either does not repeat, because a toggle that repeats never settles', () => {
    const h = withBlind();

    h.region.send('keydown', { code: DEFAULT_BINDINGS.blindMode[0] });
    h.region.send('keydown', { code: DEFAULT_BINDINGS.blindMode[0], repeat: true });

    expect(h.toggled).toEqual(['blind']);
  });

  test('they are optional, because a table under construction has no engine behind it', () => {
    const region = fakeRegion();
    bindPinballControls({ region: region as never, setFlipper: () => {}, launch: () => {} });

    expect(() => region.send('keydown', { code: DEFAULT_BINDINGS.blindMode[0] })).not.toThrow();
  });
});

describe('⚠️ a table with a plunger holds it, and one without still launches', () => {
  test('the launch key reports BOTH edges when a plunger is given', () => {
    // The 1995 plunger is drawn back while the key is down and fires at whatever was drawn. A
    // one-shot on the way down would always fire at the minimum and take away the only choice the
    // player makes before the ball is in play.
    const pressed: boolean[] = [];
    const region = fakeRegion();
    bindPinballControls({
      region: region as never, setFlipper: () => {}, launch: () => pressed.push(true),
      setPlunger: (down) => pressed.push(down),
    });

    region.send('keydown', { code: 'Space' });
    region.send('keyup', { code: 'Space' });

    expect(pressed).toEqual([true, false]);
  });

  test('⚠️ and WITHOUT one the key still launches, on the way down', () => {
    // `bindPinballControls` calls `setPlunger` INSTEAD of `launch` when it has one, so a table with no
    // plunger has to keep the one-shot — otherwise its launch key does nothing at all.
    const launched: number[] = [];
    const region = fakeRegion();
    bindPinballControls({ region: region as never, setFlipper: () => {}, launch: () => launched.push(1) });

    region.send('keydown', { code: 'Space' });
    region.send('keyup', { code: 'Space' });

    expect(launched).toEqual([1]);
  });
});
