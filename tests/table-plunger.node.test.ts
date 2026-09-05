// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createPlunger } from '../app/js/table/plunger.js';
import type { TimerService } from '../app/js/table/bumper.js';
import type { BallState } from '../app/js/physics/collision.js';

/** A timer whose pending callbacks are fired by hand, one round at a time. */
function fakeTimer() {
  let pending: (() => void)[] = [];
  const timer: TimerService = {
    set: (_s, cb) => { pending.push(cb); return pending.length; },
    kill: () => { pending = []; },
  };
  return {
    timer,
    tick: () => { const round = pending; pending = []; round.forEach((cb) => cb()); },
    pendingCount: () => pending.length,
  };
}

function build(tiltLocked = false, random = () => 0) {
  const t = fakeTimer();
  const sprites: number[] = [];
  const p = createPlunger({
    table: { tiltLocked },
    timer: t.timer,
    maxPullback: 100,
    pullbackIncrement: 25,
    pullbackDelay: 0.025,
    elasticity: 0.5,
    smoothness: 0.5,
    frameCount: 5,
    setSprite: (i) => sprites.push(i),
    random,
  });
  return { p, t, sprites };
}

/** A ball resting against the plunger, pointing into it. */
const ball = (): BallState => ({ position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed: 0.5 });
const UP = { x: 0, y: 1 };
const AT = { x: 0, y: 0 };

describe('plunger — at rest it is an inert wall', () => {
  test('a ball rolling into a resting plunger is NOT launched', () => {
    // The threshold sits at infinity all the time, and no rebound speed can exceed 1e9. The plunger is
    // a wall until the moment it is not.
    const { p } = build();
    const b = ball();

    p.collision(b, AT, UP, 0, null);

    expect(b.speed).toBeLessThan(1);
    expect(p.armed).toBe(false);
  });
});

describe('plunger — pulling back charges it', () => {
  test('each tick adds an increment', () => {
    const { p, t } = build();

    p.press();               // first tick runs immediately
    expect(p.boost).toBe(25);
    t.tick();
    expect(p.boost).toBe(50);
    t.tick();
    expect(p.boost).toBe(75);
  });

  test('the charge is capped at the maximum', () => {
    const { p, t } = build();
    p.press();
    for (let i = 0; i < 10; i++) t.tick();

    expect(p.boost).toBe(100);
  });

  test('the sprite frame tracks the fraction pulled', () => {
    // The sprite IS the state of charge: five frames over a full pull.
    const { p, t, sprites } = build();

    p.press();
    t.tick();

    expect(sprites).toEqual([1, 2]); // floor(4 * 25/100), floor(4 * 50/100)
  });

  test('pressing twice does not restart the charge', () => {
    const { p, t } = build();
    p.press();
    t.tick();

    p.press();

    expect(p.boost).toBe(50);
  });
});

describe('plunger — releasing opens a WINDOW', () => {
  test('releasing arms the plunger: the threshold drops to zero', () => {
    const { p } = build();
    p.press();

    p.release();

    expect(p.armed).toBe(true);
  });

  test('while armed, a resting ball is launched with the whole charge', () => {
    const { p, t } = build();
    p.press();
    t.tick(); // boost 50
    p.release();
    const b = ball();

    p.collision(b, AT, UP, 0, null);

    expect(b.speed).toBeGreaterThan(45);
  });

  test('the window SHUTS after the delay, and the charge is spent for nothing', () => {
    // If the ball is not touching the plunger during the window, the pull is wasted. That is exactly
    // how a real plunger behaves, and it falls out of two numbers rather than any launch logic.
    const { p, t } = build();
    p.press();
    t.tick();
    p.release();

    t.tick(); // the window closes

    expect(p.armed).toBe(false);
    expect(p.boost).toBe(0);
    const b = ball();
    p.collision(b, AT, UP, 0, null);
    expect(b.speed).toBeLessThan(1);
  });

  test('releasing without having pressed does nothing', () => {
    const { p } = build();

    p.release();

    expect(p.armed).toBe(false);
  });
});

describe('plunger — the shot is never exactly repeatable', () => {
  test('the boost carries up to ten per cent of jitter', () => {
    // `rand() * Boost * 0.1 + Boost`: between 1.0 and 1.1 times what was pulled. Deliberate, so the
    // same pull never gives the same shot twice.
    const low = build(false, () => 0);
    low.p.press(); low.p.release();
    const bLow = ball();
    low.p.collision(bLow, AT, UP, 0, null);

    const high = build(false, () => 1);
    high.p.press(); high.p.release();
    const bHigh = ball();
    high.p.collision(bHigh, AT, UP, 0, null);

    expect(bHigh.speed).toBeGreaterThan(bLow.speed);
    expect(bHigh.speed / bLow.speed).toBeLessThan(1.2);
  });
});

describe('plunger — a tilted table launches at full power', () => {
  test('tilt ignores how far the plunger was pulled', () => {
    // The original takes the same branch for an automatic relaunch: when the game is clearing the ball
    // itself, how far the player happened to pull is not part of the answer.
    const { p } = build(true);
    const b = ball();

    p.collision(b, AT, UP, 0, null); // never pressed

    expect(b.speed).toBeGreaterThan(99);
  });
});

describe('plunger — reset', () => {
  test('reset disarms it and empties the charge', () => {
    const { p, t } = build();
    p.press();
    t.tick();

    p.reset();

    expect(p.boost).toBe(0);
    expect(p.armed).toBe(false);
  });
});
