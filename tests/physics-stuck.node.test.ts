// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  throwBall, checkStuckBall, unstuckBall,
  STUCK_IDLE_TICKS, STUCK_ACTIVE_SPEED, STUCK_GIVE_UP_COUNT,
  type StuckBall,
} from '../app/js/physics/stuck.js';
import { createBall } from '../app/js/physics/step.js';

function ball(over: Partial<StuckBall> = {}): StuckBall {
  return {
    active: true, inGroup: false, inCollisionComponent: false,
    speed: 0, radius: 4,
    position: { x: 100, y: 100 },
    prevPosition: { x: 100, y: 100 },
    direction: { x: 0, y: 0 },
    stuckCounter: 0, lastActiveTime: 0,
    ...over,
  };
}

describe('throwing a ball is a direction, a spread and a fixed speed', () => {
  test('a spread multiplier of zero throws it exactly where told', () => {
    const b = ball();

    throwBall(b, { x: 0, y: -1 }, 0, 1, 0, () => 0.5);

    expect(b.direction.x).toBeCloseTo(0);
    expect(b.direction.y).toBeCloseTo(-1);
    expect(b.speed).toBe(1);
  });

  test('the SECOND speed multiplier being zero makes the speed exact', () => {
    // `speed = (1 - 2r) * (m1 * m2) + m1`. With m2 = 0 the random term vanishes entirely, which is
    // how the unstuck nudge gets a random DIRECTION but a perfectly predictable strength.
    const slow = ball();
    const fast = ball();

    throwBall(slow, { x: 0, y: -1 }, 90, 1, 0, () => 0);
    throwBall(fast, { x: 0, y: -1 }, 90, 1, 0, () => 1);

    expect(slow.speed).toBe(1);
    expect(fast.speed).toBe(1);
  });

  test('a non-zero second multiplier spreads the speed either side of the first', () => {
    const low = ball();
    const high = ball();

    throwBall(low, { x: 1, y: 0 }, 0, 10, 0.5, () => 1);
    throwBall(high, { x: 1, y: 0 }, 0, 10, 0.5, () => 0);

    expect(low.speed).toBe(5);
    expect(high.speed).toBe(15);
  });

  test('the spread is symmetric: the two extremes of the random draw mirror each other', () => {
    const left = ball();
    const right = ball();

    throwBall(left, { x: 0, y: -1 }, 90, 1, 0, () => 0);
    throwBall(right, { x: 0, y: -1 }, 90, 1, 0, () => 1);

    expect(left.direction.x).toBeCloseTo(-right.direction.x);
    expect(left.direction.y).toBeCloseTo(right.direction.y);
  });

  test('throwing frees the ball from whatever component was holding it', () => {
    const b = ball({ inCollisionComponent: true });

    throwBall(b, { x: 0, y: -1 }, 0, 1, 0, () => 0.5);

    expect(b.inCollisionComponent).toBe(false);
  });
});

describe('what counts as stuck', () => {
  const moved = (b: StuckBall, dx: number) => { b.position = { x: b.prevPosition.x + dx, y: b.prevPosition.y }; };

  test('a ball moving at speed is never stuck, and its clock is refreshed', () => {
    const b = ball({ speed: STUCK_ACTIVE_SPEED, stuckCounter: 5, lastActiveTime: 0 });
    moved(b, 100);

    checkStuckBall(b, 9999);

    expect(b.stuckCounter).toBe(0);
    expect(b.lastActiveTime).toBe(9999);
  });

  test('a FAST ball that has not actually moved keeps its counter', () => {
    // The clearing test is displacement, not speed: a ball spinning against a wall at full speed is
    // still stuck, and two radii is what it must cover to prove otherwise.
    const b = ball({ speed: 5, stuckCounter: 5 });
    moved(b, 4); // less than 2 * radius

    checkStuckBall(b, 9999);

    expect(b.stuckCounter).toBe(5);
  });

  test('a ball held by a component is treated as moving, whatever its speed', () => {
    // A ball sitting in a sink is not stuck; it is being held on purpose.
    const b = ball({ speed: 0, inCollisionComponent: true, lastActiveTime: 0 });

    checkStuckBall(b, 500);

    expect(b.lastActiveTime).toBe(500);
    expect(b.stuckCounter).toBe(0);
  });

  test('a slow free ball is not judged until it has been idle long enough', () => {
    const b = ball({ speed: 0, lastActiveTime: 0 });

    expect(checkStuckBall(b, STUCK_IDLE_TICKS)).toBe(false);
    expect(b.stuckCounter).toBe(0);
  });

  test('past that, standing still increments the counter', () => {
    const b = ball({ speed: 0, lastActiveTime: 0 });

    expect(checkStuckBall(b, STUCK_IDLE_TICKS + 1)).toBe(true);
    expect(b.stuckCounter).toBe(1);
  });

  test('and half a radius of movement is enough to clear it', () => {
    // Asymmetric on purpose: while moving it takes TWO radii to prove innocence, while idle it takes
    // only half of one. The idle test is the forgiving one.
    const b = ball({ speed: 0, lastActiveTime: 0, stuckCounter: 7 });
    moved(b, 3); // more than radius / 2

    checkStuckBall(b, STUCK_IDLE_TICKS + 1);

    expect(b.stuckCounter).toBe(0);
  });

  test('only the idle branch moves the reference point', () => {
    // `PrevPosition` is updated in the idle branch alone, so the moving branch measures displacement
    // since the last idle CHECK rather than since the last frame.
    const idle = ball({ speed: 0, lastActiveTime: 0 });
    const moving = ball({ speed: 5, lastActiveTime: 0 });
    moved(idle, 50);
    moved(moving, 50);

    checkStuckBall(idle, STUCK_IDLE_TICKS + 1);
    checkStuckBall(moving, STUCK_IDLE_TICKS + 1);

    expect(idle.prevPosition).toEqual({ x: 150, y: 100 });
    expect(moving.prevPosition).toEqual({ x: 100, y: 100 });
  });
});

describe('getting a stuck ball moving again', () => {
  function build(o: { counter?: number; inside?: boolean } = {}) {
    const b = ball({ stuckCounter: o.counter ?? 1 });
    const calls: string[] = [];
    const table = { multiballCount: 3 };
    const bounds = [{ xMin: 0, xMax: 10, yMin: 0, yMax: 10 }];
    if (o.inside) b.position = { x: 5, y: 5 };
    const run = () => unstuckBall(b, {
      controlBounds: bounds,
      boundsMargin: 2,
      table,
      relaunch: () => calls.push('relaunch'),
      random: () => 0.5,
    });
    return { b, table, calls, run };
  }

  test('a ball resting ON A FLIPPER is left alone', () => {
    // "Stuck" is defined by WHERE the ball is, not by how long it has been there. A ball held on a
    // raised flipper or waiting in the plunger lane is legitimately still.
    const t = build({ inside: true });

    t.run();

    expect(t.b.speed).toBe(0);
    expect(t.calls).toEqual([]);
  });

  test('the margin is half the collision offset, so the edges count as inside', () => {
    const t = build();
    t.b.position = { x: 11.5, y: 5 }; // outside the box, inside the margin

    t.run();

    expect(t.b.speed).toBe(0);
  });

  test('elsewhere it is nudged UPWARD at a fixed speed', () => {
    const t = build({ counter: 1 });

    t.run();

    expect(t.b.speed).toBe(1);
    expect(t.b.direction.y).toBeLessThan(0);
  });

  test('the nudge is random within a half-turn, so it never repeats itself', () => {
    const a = build();
    const z = build();

    unstuckBall(a.b, { controlBounds: [], boundsMargin: 0, table: { multiballCount: 1 }, relaunch: () => {}, random: () => 0 });
    unstuckBall(z.b, { controlBounds: [], boundsMargin: 0, table: { multiballCount: 1 }, relaunch: () => {}, random: () => 1 });

    expect(a.b.direction.x).not.toBeCloseTo(z.b.direction.x);
  });

  test('after twenty nudges it gives up and RELAUNCHES the ball', () => {
    const t = build({ counter: STUCK_GIVE_UP_COUNT + 1 });

    t.run();

    expect(t.b.active).toBe(false);
    expect(t.calls).toEqual(['relaunch']);
  });

  test('and the relaunch costs a ball off the multiball count', () => {
    // Which is what stops a stuck ball being destroyed and silently replaced, growing the count.
    const t = build({ counter: STUCK_GIVE_UP_COUNT + 1 });

    t.run();

    expect(t.table.multiballCount).toBe(2);
    expect(STUCK_GIVE_UP_COUNT).toBe(20);
  });

  test('exactly twenty is still a nudge, not a relaunch', () => {
    const t = build({ counter: STUCK_GIVE_UP_COUNT });

    t.run();

    expect(t.b.active).toBe(true);
    expect(t.calls).toEqual([]);
  });
});

describe('⚠️ a ball can be thrown, and throwing RELEASES whatever held it', () => {
  test('the method puts the ball on the given direction at the given speed', () => {
    // `speedMult2` of zero makes the speed exact: `speedMult1 + 0`. The angle spread is zero when the
    // random source answers exactly a half, which is what makes this checkable at all.
    const ball = createBall({
      radius: 5, position: { x: 0, y: 0 }, direction: { x: 0, y: 1 }, speed: 0, random: () => 0.5,
    });

    ball.throwBall({ x: 1, y: 0 }, 45, 30, 0);

    expect(ball.speed).toBeCloseTo(30);
    expect(ball.direction.x).toBeCloseTo(1);
    expect(ball.direction.y).toBeCloseTo(0);
  });

  test('⚠️ and the component that was holding it is let go', () => {
    // A ball thrown while still held is moved by the component on the very next frame, and the throw
    // goes nowhere. `inCollisionComponent = false` is the same line upstream.
    const ball = createBall({
      radius: 5, position: { x: 0, y: 0 }, direction: { x: 0, y: 1 }, speed: 0, random: () => 0.5,
    });
    ball.component = { fieldEffect: () => {} } as unknown as typeof ball.component;

    ball.throwBall({ x: 0, y: -1 }, 0, 10, 0);

    expect(ball.component).toBe(null);
  });
});
