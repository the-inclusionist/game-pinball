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
    const all = [...DEFAULT_BINDINGS.left, ...DEFAULT_BINDINGS.right, ...DEFAULT_BINDINGS.plunger];

    expect(new Set(all).size).toBe(all.length);
  });
});
