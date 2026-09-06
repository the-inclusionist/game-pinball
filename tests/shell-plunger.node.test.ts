// SPDX-License-Identifier: AGPL-3.0-or-later
// PULLING THE PLUNGER BACK, WHICH THE AUTHORED TABLES COULD NOT DO.
//
// ⚠️ THE DEV FOUND IT BY PLAYING: "o lançador de bola não se mexe de forma adequada, não permitindo
// controlar a força com que a bolinha será lançada (quanto mais tempo pressionado, mais é esticado,
// quanto mais é esticado, mais longe)."
//
// He is describing a plunger, and the authored tables had none. `setPlunger(pressed)` launched on the
// PRESS at a fixed `launchSpeedFor(table)` — every launch identical, the key a trigger rather than a
// spring. The 1995 table has the real thing (`demo.plunge`, drawn back a hundredth of its travel per
// frame) and this half of the game never got one.
//
// ⚠️ AND THE PULL IS A MODEL, NOT A TIMER READ IN AN EVENT HANDLER. This repository has one Vitest
// project and it is `node`: a charge curve computed inside a keydown is a curve nothing can check, and
// "how hard did that launch" is exactly the kind of number that goes quietly wrong.
import { describe, test, expect } from 'vitest';
import { createPlunger, PLUNGER_SECONDS_TO_FULL, MINIMUM_PULL } from '../app/js/shell/plunger.js';

const MAX = 273;
const plunger = () => createPlunger({ maxSpeed: MAX });

describe('holding it back', () => {
  test('it starts at rest, pulling nothing', () => {
    expect(plunger().pull).toBe(0);
  });

  test('⚠️ and a press alone launches NOTHING — the release is the launch', () => {
    // The defect exactly: pressing fired the ball. A plunger that launches on the press cannot be
    // charged, because the charge happens between the press and the release.
    const p = plunger();

    p.press();
    p.advance(0.5);

    expect(p.pull, 'it has been drawing back').toBeGreaterThan(0);
    expect(p.held, 'and it is still being held, so nothing has gone anywhere').toBe(true);
  });

  test('the longer it is held, the further it is drawn', () => {
    const brief = plunger();
    brief.press();
    brief.advance(0.2);

    const long = plunger();
    long.press();
    long.advance(1.2);

    expect(long.pull).toBeGreaterThan(brief.pull);
  });

  test('⚠️ and it STOPS at fully drawn, rather than winding up for ever', () => {
    // Without a cap, a player leaning on the key for ten seconds launches a ball through the ceiling —
    // and `physics/stuck` would then be nudging a ball that left the table.
    const p = plunger();
    p.press();
    p.advance(PLUNGER_SECONDS_TO_FULL * 5);

    expect(p.pull).toBe(1);
  });

  test('advancing while nothing is held draws nothing back', () => {
    const p = plunger();

    p.advance(2);

    expect(p.pull).toBe(0);
  });
});

describe('letting it go', () => {
  test('a full pull launches at the table’s full speed', () => {
    const p = plunger();
    p.press();
    p.advance(PLUNGER_SECONDS_TO_FULL);

    expect(p.release()).toBeCloseTo(MAX, 5);
  });

  test('⚠️ and a barely-touched plunger still launches, weakly', () => {
    // A tap that launched at nought would leave the ball sitting in the lane with the player pressing
    // a key that does nothing visible. The original's weakest pull still fires.
    const p = plunger();
    p.press();
    p.advance(0.01);

    const speed = p.release();
    expect(speed, 'it went somewhere').toBeGreaterThan(0);
    expect(speed, 'and not far').toBeLessThan(MAX * 0.7);
    expect(speed / MAX).toBeCloseTo(MINIMUM_PULL, 2);
  });

  test('half the draw is between the two, which is what "controlling the force" means', () => {
    const half = plunger();
    half.press();
    half.advance(PLUNGER_SECONDS_TO_FULL / 2);
    const speed = half.release();

    expect(speed).toBeGreaterThan(MAX * MINIMUM_PULL);
    expect(speed).toBeLessThan(MAX);
  });

  test('and releasing lets it back to rest, ready for the next ball', () => {
    const p = plunger();
    p.press();
    p.advance(1);
    p.release();

    expect(p.pull).toBe(0);
    expect(p.held, 'and it is no longer held').toBe(false);
  });

  test('⚠️ releasing without having pressed launches nothing at all', () => {
    // A keyup arriving without its keydown — a key held while the page loaded, a window that lost
    // focus mid-press — would otherwise fire a ball the player never charged.
    const p = plunger();

    expect(p.release()).toBe(0);
  });
});
