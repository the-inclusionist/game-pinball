// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { bindPinballControls, DEFAULT_BINDINGS } from '../app/js/shell/controls.js';
import { CABINET_OF_ENGINE_ACTION } from '../app/js/shell/pad.js';

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

    h.region.send('keydown', { code: 'KeyJ' });
    h.region.send('keyup', { code: 'KeyJ' });

    expect(h.moved).toEqual(['left:up', 'left:down']);
  });

  test('and the right key is a different flipper', () => {
    const h = harness();

    h.region.send('keydown', { code: 'KeyK' });

    expect(h.moved).toEqual(['right:up']);
  });

  test('⚠️ a HELD key is not a stream of presses', () => {
    // The operating system repeats a held key, and `setFlipperMotion` on an already-extended flipper
    // leaves it STILL — which is correct there and wrong here: a player holding the button would have
    // the flipper stop kicking a few milliseconds in, and nothing would look broken. The repeat flag
    // exists for exactly this and the browser sets it for us.
    const h = harness();

    h.region.send('keydown', { code: 'KeyJ' });
    h.region.send('keydown', { code: 'KeyJ', repeat: true });
    h.region.send('keydown', { code: 'KeyJ', repeat: true });

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

    h.region.send('keydown', { code: 'KeyU' });

    expect(h.launched).toEqual([1]);
  });

  test('⚠️ a handled key is swallowed, so the page does not scroll under the table', () => {
    // Arrow keys and space scroll a document. A pinball whose left flipper also scrolls the page is
    // unplayable on the first table taller than the window.
    const h = harness();
    let prevented = 0;

    h.region.send('keydown', { code: 'KeyU', preventDefault: () => { prevented++; } });
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

  test('⚠️ and EVERY action in the table is actually dispatched', () => {
    // `bindPinballControls` used to keep its own list of the actions, beside the type and beside
    // `DEFAULT_BINDINGS` — three copies of the same five names. A sixth added to the type and the
    // table but not to that list would be bound to a key, swallowed on the way down, and do nothing:
    // no error, no warning, a key that just does not work. The list is now derived from the table, and
    // this is what says it must stay derived.
    const fired: string[] = [];
    const region = fakeRegion();
    bindPinballControls({
      region: region as never,
      setFlipper: (side) => fired.push(side),
      launch: () => fired.push('plunger'),
      setPlunger: () => fired.push('plunger'),
      togglePause: () => fired.push('pause'),
    });

    for (const codes of Object.values(DEFAULT_BINDINGS)) {
      region.send('keydown', { code: codes[0]! });
    }

    expect([...new Set(fired)].sort(), 'every bound action reached its callback')
      .toEqual(Object.keys(DEFAULT_BINDINGS).sort());
  });

  test('and no key does two things', () => {
    const all = Object.values(DEFAULT_BINDINGS).flat();

    expect(new Set(all).size).toBe(all.length);
  });
});

/**
 * ⚠️ THE ENGINE IS RENAMING ITS ACTIONS UNDER THIS GAME, AND THE KEYBOARD READS THEM THROUGH A SEAM.
 *
 * `actionOf` is the engine's remapper: `main.ts` hands it `KeyboardRuntime.actionOf`, whose answers are
 * in the ENGINE's vocabulary and are translated by `CABINET_OF_ENGINE_ACTION`. ADR-0085 and ADR-0086
 * replace the nine platformer names with fourteen positions — `action1`..`action4`, the shoulders and
 * triggers, `start` and `select` — and the migration (the engine's #103) has not run.
 *
 * These tests come through the SEAM rather than reading the table, which is the difference between
 * checking that a mapping exists and checking that a key does something. Both vocabularies have to
 * work: the old one until #103 lands, the new one the day it does.
 */
describe('⚠️ both of the engine’s action vocabularies drive this cabinet', () => {
  const through = (engineAction: string) => {
    const fired: string[] = [];
    const region = fakeRegion();
    bindPinballControls({
      region: region as never,
      // Exactly what `main.ts` hands in — the engine's answer, translated by the one table both
      // devices read. Composed here rather than imported because the entry point boots a whole game;
      // that the entry point does this and not something else is gated on its source separately.
      actionOf: () => CABINET_OF_ENGINE_ACTION[engineAction] ?? null,
      setFlipper: (side, extended) => fired.push(`${side}:${extended ? 'up' : 'down'}`),
      launch: () => fired.push('launch'),
      togglePause: () => fired.push('pause'),
    });
    // The code is arbitrary: `actionOf` answers before the binding table is consulted, which is the
    // whole point of the seam — a player who remaps in the engine's panel is not pressing our key.
    region.send('keydown', { code: 'Numpad9' });
    return fired;
  };

  test('the platformer names still work, because that is what the transports emit today', () => {
    expect(through('run'), 'button 1').toEqual(['launch']);
    expect(through('jump'), 'button 2').toEqual(['left:up']);
    expect(through('especial'), 'button 3').toEqual(['right:up']);
  });

  test('⚠️ and the fourteen positions work too, so #103 does not silence the keyboard', () => {
    expect(through('action1'), 'button 1').toEqual(['launch']);
    expect(through('action2'), 'button 2').toEqual(['left:up']);
    expect(through('action3'), 'button 3').toEqual(['right:up']);
  });

  test('⚠️ `start` pauses, which is the slot the engine’s KeyScheme did not have', () => {
    // `shell/pad`'s header recorded the asymmetry: pause was a binding of this port's own because the
    // engine's keyboard vocabulary had no `start`. ADR-0085 gives it one and puts it on `Enter` —
    // the key this cabinet already pauses with — so the asymmetry closes rather than moving.
    expect(through('start')).toEqual(['pause']);
  });

  test('and an action this cabinet does not use falls through to the key itself', () => {
    // ⚠️ FALLS THROUGH, NOT SWALLOWED. `actionFor` consults `DEFAULT_BINDINGS` when the engine's
    // answer is not one of ours, so a fourth button the pinball has no use for leaves the key
    // working. Without it, remapping in the engine's panel could quietly disable a key here.
    const fired: string[] = [];
    const region = fakeRegion();
    bindPinballControls({
      region: region as never,
      actionOf: () => CABINET_OF_ENGINE_ACTION['action4'] ?? null,
      setFlipper: (side) => fired.push(side),
      launch: () => fired.push('launch'),
    });

    region.send('keydown', { code: 'KeyJ' });

    expect(fired, 'A is still the left flipper').toEqual(['left']);
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
/**
 * ⚠️ THE FIVE TESTS THAT WERE HERE HAVE MOVED TO `tests/shell-a11y-bar`, AND SO HAS THE FEATURE.
 *
 * They drove blind mode, the sonar sweep and the palette through `B`, `S` and `C`, and the Dev has
 * taken all three off the keyboard: "remova modo cego sonar e cores via teclado: eles devem aparecer no
 * hud da mesma forma que aparecem no projeto game-platformer." There is no key to press any more, so a
 * test that pressed one would be asking about a route that does not exist.
 *
 * What those tests were REALLY about survives, and is asked of the new route instead: that the switch
 * is reachable without a settings panel, that a toggle does not repeat itself into a blur, and that a
 * game with no engine behind it does not fall over when one is pressed.
 */

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

    region.send('keydown', { code: 'KeyU' });
    region.send('keyup', { code: 'KeyU' });

    expect(pressed).toEqual([true, false]);
  });

  test('⚠️ and WITHOUT one the key still launches, on the way down', () => {
    // `bindPinballControls` calls `setPlunger` INSTEAD of `launch` when it has one, so a table with no
    // plunger has to keep the one-shot — otherwise its launch key does nothing at all.
    const launched: number[] = [];
    const region = fakeRegion();
    bindPinballControls({ region: region as never, setFlipper: () => {}, launch: () => launched.push(1) });

    region.send('keydown', { code: 'KeyU' });
    region.send('keyup', { code: 'KeyU' });

    expect(launched).toEqual([1]);
  });
});

/**
 * ⚠️ A CHEAT IS TYPED, AND A KEY CODE IS NOT A CHARACTER.
 *
 * `control/cheats` is fed one character at a time — `pbctrl_bdoor_controller` reads WM_CHAR — and the
 * flipper bindings are read off `event.code`, which says `KeyB` where the buffer needs `b`. Both come
 * off the same event and neither can stand in for the other: a layout where `KeyZ` types `y` flips the
 * left flipper on Z and spells the cheat with y, which is exactly right.
 */
describe('the back door’s characters', () => {
  function typing() {
    const region = fakeRegion();
    const typed: string[] = [];
    const flipped: string[] = [];
    bindPinballControls({
      region: region as never,
      setFlipper: (side, extended) => { if (extended) flipped.push(side); },
      launch: () => {},
      typeCharacter: (c) => typed.push(c),
    });
    return { region, typed, flipped };
  }

  test('a printable key is one character', () => {
    const t = typing();

    t.region.send('keydown', { code: 'KeyB', key: 'b' });
    t.region.send('keydown', { code: 'KeyU', key: ' ' });

    expect(t.typed).toEqual(['b', ' ']);
  });

  test('⚠️ and Tab is a TAB, which is the second spelling of `hidden test`', () => {
    // `hidden	test` is in `CHEAT_CODES` because of the character the original's handler reports
    // between the two words. The browser calls that key `Tab` and gives no character for it, so the
    // one place that can put the tab back is here.
    const t = typing();

    t.region.send('keydown', { code: 'Tab', key: 'Tab' });

    expect(t.typed).toEqual(['	']);
  });

  test('⚠️ and the CASE is not folded, though every code is lowercase', () => {
    // The original compares raw characters against lowercase literals, so `HIDDEN TEST` does not open
    // the back door there. Folding the case here would open it — a kindness that changes the game,
    // and the kind of change nobody would think to look for.
    //
    // This test exists because a mutant survived without it: `demo.typeCheat` is fed characters
    // directly by the demonstration's own tests, so nothing they assert ever passes through this
    // function, and lowercasing here was invisible to all of them.
    const t = typing();

    t.region.send('keydown', { code: 'KeyB', key: 'B' });

    expect(t.typed).toEqual(['B']);
  });

  test('a named key is not a character, and never enters the buffer', () => {
    const t = typing();

    t.region.send('keydown', { code: 'KeyJ', key: 'ArrowLeft' });
    t.region.send('keydown', { code: 'ShiftLeft', key: 'Shift' });

    expect(t.typed).toEqual([]);
  });

  test('⚠️ a HELD key repeats into the buffer, though it does not repeat a flipper', () => {
    // The flippers return on `repeat` because re-extending an extended flipper leaves it still. The
    // buffer has the opposite need: the original is fed every WM_CHAR the system sends, repeats and
    // all, and a player holding a letter is typing that letter.
    const t = typing();

    t.region.send('keydown', { code: 'KeyJ', key: 'j', repeat: true });

    expect(t.typed).toEqual(['j']);
  });

  test('⚠️ and a cabinet key still fires — the cheat does not take the letter away', () => {
    /**
     * `bmax` and `easy mode` are typed with letters that were once blind mode and the sonar, and a back
     * door that swallowed them would have traded a feature this project exists for against an easter
     * egg. Both happened: the character reached the buffer AND the action ran.
     *
     * ⚠️ THE EXAMPLE MOVED WHEN THE KEYS DID. Blind mode, the sonar and the palette are icons in the
     * HUD now — the Dev's "remova modo cego sonar e cores via teclado" — so B and S belong to nobody
     * and the claim needs a key that is still bound. `KeyJ` is the left flipper and a letter, which is
     * the same collision the cheat buffer was always about.
     */
    const t = typing();

    t.region.send('keydown', { code: 'KeyJ', key: 'j' });

    expect(t.typed).toEqual(['j']);
    expect(t.flipped, 'the flipper still answers its own key').toEqual(['left']);
  });
});
