// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createLight } from '../app/js/table/light.js';
import type { TimerService } from '../app/js/table/bumper.js';

/** A timer that records the delay it was asked for, and fires rounds by hand. */
function fakeTimer() {
  let pending: { seconds: number; cb: () => void }[] = [];
  const asked: number[] = [];
  const timer: TimerService = {
    set: (seconds, cb) => { asked.push(seconds); pending.push({ seconds, cb }); return pending.length; },
    kill: () => { pending = []; },
  };
  return {
    timer, asked,
    tick: () => { const r = pending; pending = []; r.forEach((p) => p.cb()); },
    pendingCount: () => pending.length,
  };
}

function build() {
  const t = fakeTimer();
  const sprites: number[] = [];
  const timeouts: number[] = [];
  const light = createLight({
    timer: t.timer, frameCount: 3,
    darkDelay: 0.2, litDelay: 0.05,
    setSprite: (i) => sprites.push(i),
  });
  light.control = () => timeouts.push(1);
  light.reset();
  sprites.length = 0;
  t.asked.length = 0;
  return { light, t, sprites, timeouts };
}

describe('light — layer 1: what the game means', () => {
  test('off shows no sprite at all, on shows the on-frame', () => {
    const { light, sprites } = build();

    light.turnOn();
    light.turnOff();

    expect(sprites).toEqual([0, -1]);
  });

  test('toggling flips the persistent state and reports it', () => {
    const { light } = build();

    expect(light.toggle()).toBe(true);
    expect(light.toggle()).toBe(false);
  });
});

describe('light — layer 2: a timed override hides layer 1', () => {
  test('a timed OFF hides a light that is really ON', () => {
    const { light, sprites } = build();
    light.turnOn();
    sprites.length = 0;

    light.turnOffTimed(2);

    expect(sprites).toEqual([-1]);
    expect(light.on).toBe(true); // layer 1 is untouched
  });

  test('when the timeout fires it falls back to LAYER 1, not to dark', () => {
    // A timed override always returns to what the lamp really is. Falling back to "off" would lose
    // whatever the mission had set.
    const { light, t, sprites, timeouts } = build();
    light.turnOn();
    light.turnOffTimed(2);
    sprites.length = 0;

    t.tick();

    expect(sprites).toEqual([0]); // back on
    expect(timeouts).toEqual([1]);
  });

  test('turning the light on while a timed override is up does not redraw it', () => {
    const { light, sprites } = build();
    light.turnOffTimed(2);
    sprites.length = 0;

    light.turnOn();

    expect(sprites).toEqual([]); // layer 2 still owns the display
    expect(light.on).toBe(true);
  });
});

describe('light — the flasher has TWO delays', () => {
  test('the dark half and the lit half are asked for separately', () => {
    // A lamp can blink briefly bright against a long dark. Collapsing them into one period would make
    // every lamp on the table blink the same way.
    const { light, t } = build();

    light.flasherStart(); // first tick runs immediately
    t.tick();
    t.tick();

    // Starting dark: lit(0.05), dark(0.2), lit(0.05)
    expect(t.asked).toEqual([0.05, 0.2, 0.05]);
  });

  test('starting the flasher WIPES a multiplier applied before it', () => {
    // Counter-intuitive and faithful. TLightFlasherStart calls schedule_timeout(0) FIRST, and
    // schedule_timeout restores both delays from source. So a multiplier only takes effect if it is
    // applied after the flashing has started.
    const { light, t } = build();

    light.applyDelayMultiplier(10);
    light.flasherStart();

    expect(t.asked).toEqual([0.05]); // the multiplier is gone
  });

  test('a multiplier applied AFTER the flasher started does take effect', () => {
    const { light, t } = build();
    light.flasherStart();
    t.asked.length = 0;

    light.applyDelayMultiplier(10);
    t.tick();

    expect(t.asked).toEqual([2]); // the dark half, 0.2 x 10
  });

  test('the TIMED flasher uses the multiplier for the FIRST tick only', () => {
    // The mirror-image ordering of the same pair: TLightFlasherStartTimed calls flasher_start BEFORE
    // schedule_timeout, so the first delay is the multiplied one and everything after it is source.
    // Two commands that look like siblings, two different orders, and the difference shows on the table.
    const { light, t } = build();
    light.applyDelayMultiplier(10);

    light.flasherStartTimed(3);
    t.tick();

    expect(t.asked[0]).toBe(0.5);  // multiplied
    expect(t.asked[2]).toBe(0.2);  // back to source from the second tick on
  });
});

describe('light — flash then settle', () => {
  test('flash-then-stay-ON leaves the lamp lit when the flashing ends', () => {
    const { light, t } = build();

    light.flasherStartTimedThenStayOn(3);
    t.tick();

    expect(light.on).toBe(true);
    expect(light.flashing).toBe(false);
  });

  test('flash-then-stay-OFF turns the lamp off when the flashing ends', () => {
    const { light, t } = build();
    light.turnOn();

    light.flasherStartTimedThenStayOff(3);
    t.tick();

    expect(light.on).toBe(false);
    expect(light.flashing).toBe(false);
  });
});

describe('light — which frame "on" means', () => {
  test('setting the on-frame redraws at once when the lamp is lit', () => {
    const { light, sprites } = build();
    light.turnOn();
    sprites.length = 0;

    light.setOnFrame(2);

    expect(sprites).toEqual([2]);
  });

  test('the frame is clamped to the lamp’s own frame count', () => {
    const { light } = build();

    light.setOnFrame(99);
    expect(light.onFrame).toBe(2);

    light.setOnFrame(-5);
    expect(light.onFrame).toBe(0);
  });

  test('incrementing and decrementing stay inside the range', () => {
    const { light } = build();

    light.incOnFrame(); light.incOnFrame(); light.incOnFrame();
    expect(light.onFrame).toBe(2);

    light.decOnFrame(); light.decOnFrame(); light.decOnFrame();
    expect(light.onFrame).toBe(0);
  });
});

describe('light — layer 3: the display-only override', () => {
  test('while overriding, layer 1 and 2 keep computing but nothing is drawn', () => {
    const { light, sprites } = build();
    light.temporaryOverride(true, 5);
    sprites.length = 0;

    light.turnOn();
    light.turnOffTimed(2);

    expect(sprites).toEqual([]); // the override owns the screen
  });

  test('releasing restores what the lamp WOULD have been showing', () => {
    // The truth was recorded all along, so nobody had to remember it across the override.
    const { light, sprites } = build();
    light.turnOn();
    light.temporaryOverride(false, 5);
    light.setOnFrame(2);
    sprites.length = 0;

    light.releaseOverride();

    expect(sprites).toEqual([2]);
  });

  test('the override expires on its own', () => {
    const { light, t, sprites } = build();
    light.turnOn();
    light.temporaryOverride(false, 5);
    sprites.length = 0;

    t.tick();

    expect(sprites).toEqual([0]);
  });
});

describe('light — reset', () => {
  test('reset clears every layer and goes dark', () => {
    const { light, sprites } = build();
    light.turnOn();
    light.flasherStart();
    sprites.length = 0;

    light.reset();

    expect(light.on).toBe(false);
    expect(light.flashing).toBe(false);
    expect(light.onFrame).toBe(0);
    expect(sprites).toEqual([-1]);
  });

  test('resetTimed cancels the override but keeps the persistent state', () => {
    const { light, sprites } = build();
    light.turnOn();
    light.turnOffTimed(2);
    sprites.length = 0;

    light.resetTimed();

    expect(light.on).toBe(true);
    expect(sprites).toEqual([0]);
  });
});

describe('⚠️ `light_on()` is THREE flags, and the control layer asks that question', () => {
  test('a lamp lit by a TIMED command is lit, though its persistent state is dark', () => {
    // `TLight::light_on()` is `LightOnFlag || ToggledOnFlag || FlasherOnFlag`. Nearly every award in
    // the game lights its lamp with `TLightTurnOnTimed` — the lamp's own sixty seconds ARE the award —
    // so a control that asked only the persistent flag would find every one of those lamps dark. The
    // booster chain would never advance past its first rung, and an out lane would never notice the
    // extra ball it is standing on.
    //
    // The GROUP is the other way round: `next_light_up`, `next_light_down` and `GetOnCount` all read
    // `LightOnFlag` alone, which is why the two questions need two names.
    const { light } = build();

    light.turnOnTimed(60);

    expect(light.on, 'the persistent flag is untouched').toBe(false);
    expect(light.lit, 'but the lamp IS lit, and that is what a control asks').toBe(true);
  });

  test('and a FLASHING lamp is lit too', () => {
    const { light } = build();

    light.flasherStart();

    expect(light.on).toBe(false);
    expect(light.lit).toBe(true);
  });

  test('⚠️ but a timed-OFF lamp over a lit one still reports lit, which is the original', () => {
    // `light_on()` does not subtract `ToggledOffFlag`. Transcribed rather than tidied: a control that
    // turned a lamp off for two seconds would otherwise change what every other control sees.
    const { light } = build();
    light.turnOn();

    light.turnOffTimed(2);

    expect(light.lit).toBe(true);
  });
});
