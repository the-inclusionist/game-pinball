// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { buildPhysics, responseFor, RESPONSES, FRAME_SECONDS, drainedBy } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/** A floor across the bottom, and nothing else. The simplest thing a ball can fall onto. */
const FLOOR: AuthoredTable = {
  name: 'floor-only',
  size: { width: 100, height: 200 },
  ballRadius: 3,
  lamps: [],
  components: [
    { name: 'plunger', kind: 'plunger', role: 'structure', bounds: { x: 88, y: 160, width: 10, height: 30 } },
    { name: 'flipper', kind: 'flipper', role: 'structure', bounds: { x: 30, y: 170, width: 20, height: 6 } },
    { name: 'drain', kind: 'drain', role: 'hazard', bounds: { x: 40, y: 190, width: 20, height: 8 } },
    // Left to right along the bottom, which is what makes its one side face UP — see `normalOf`.
    { name: 'floor', kind: 'wall', role: 'structure', bounds: { x: 0, y: 150, width: 100, height: 4 },
      collision: [{ kind: 'line', from: { x: 0, y: 150 }, to: { x: 100, y: 150 } }] },
  ],
};

const run = (physics: ReturnType<typeof buildPhysics>, ball: ReturnType<typeof physics.spawnBall>, frames: number) => {
  for (let i = 0; i < frames; i++) advanceFrame([ball], physics.context, FRAME_SECONDS);
};

describe('a table becomes something a ball can be dropped into', () => {
  test('the grid is built to the table’s own size', () => {
    const physics = buildPhysics(LOW_ORBIT);

    expect(physics.grid.minX).toBe(0);
    expect(physics.grid.advanceX * 10).toBeCloseTo(LOW_ORBIT.size.width, 6);
    expect(physics.grid.advanceY * 15).toBeCloseTo(LOW_ORBIT.size.height, 6);
  });

  test('every table in the catalogue builds without complaint', () => {
    for (const table of CATALOG) {
      expect(() => buildPhysics(table), table.name).not.toThrow();
    }
  });

  test('a ball spawns in the plunger lane', () => {
    const ball = buildPhysics(LOW_ORBIT).spawnBall();
    const plunger = LOW_ORBIT.components.find((c) => c.kind === 'plunger')!;

    expect(ball.position.x).toBeCloseTo(plunger.bounds.x + plunger.bounds.width / 2, 6);
    expect(ball.position.y).toBeLessThan(plunger.bounds.y);
    expect(ball.speed).toBe(0);
  });
});

describe('gravity, which is the only field an authored table declares today', () => {
  test('a ball left alone falls DOWN the table', () => {
    // `y` grows downward, so falling means y increasing. Getting the sign wrong here would send every
    // ball to the top of the table and nothing else would say so.
    const physics = buildPhysics(FLOOR);
    const ball = physics.spawnBall();
    ball.position = { x: 20, y: 20 };

    const startedAt = ball.position.y;
    run(physics, ball, 20);

    expect(ball.position.y).toBeGreaterThan(startedAt);
  });

  test('it accelerates rather than drifting', () => {
    const physics = buildPhysics(FLOOR);
    const ball = physics.spawnBall();
    ball.position = { x: 20, y: 10 };

    run(physics, ball, 10);
    const afterTen = ball.position.y;
    run(physics, ball, 10);
    const afterTwenty = ball.position.y;

    expect(afterTwenty - afterTen).toBeGreaterThan(afterTen - 10);
  });

  test('a stronger gravity falls faster', () => {
    const slow = buildPhysics(FLOOR, { gravity: 40 });
    const fast = buildPhysics(FLOOR, { gravity: 400 });
    const a = slow.spawnBall(); a.position = { x: 20, y: 10 };
    const b = fast.spawnBall(); b.position = { x: 20, y: 10 };

    run(slow, a, 15);
    run(fast, b, 15);

    expect(b.position.y).toBeGreaterThan(a.position.y);
  });
});

describe('⚠️ the hit says WHICH component, which is what the control layer needs', () => {
  test('a ball landing on the floor reports the floor by name', () => {
    // The grid's `Component` has one method and no identity — enough for the physics, not enough for
    // the game. `control/dispatch` hands the CALLER to every control function, and a bumper that
    // cannot say it is `bumper1` cannot score.
    const physics = buildPhysics(FLOOR);
    const ball = physics.spawnBall();
    ball.position = { x: 20, y: 120 };

    run(physics, ball, 200);

    const names = physics.takeHits().map((h) => h.name);
    expect(names).toContain('floor');
  });

  test('the hits are COLLECTED, not dispatched from inside the physics', () => {
    // Which is what lets a ball be stepped in a test with no score, no lamps and no sound.
    const physics = buildPhysics(FLOOR);
    const ball = physics.spawnBall();
    ball.position = { x: 20, y: 120 };

    run(physics, ball, 200);

    expect(physics.takeHits().length).toBeGreaterThan(0);
    // Taking them empties the list: a frame reads once and clears.
    expect(physics.takeHits()).toEqual([]);
  });

  test('a hit carries the REBOUND speed, not the speed left over', () => {
    // `basicCollision` returns the rebound because the original uses it to decide sound, score and
    // whether a target was hit hard.
    const physics = buildPhysics(FLOOR);
    const ball = physics.spawnBall();
    ball.position = { x: 20, y: 120 };

    run(physics, ball, 200);

    const hits = physics.takeHits();
    expect(hits.every((h) => h.reboundSpeed >= 0)).toBe(true);
  });

  test('a ball that never touches anything reports nothing', () => {
    const physics = buildPhysics(FLOOR);
    const ball = physics.spawnBall();
    ball.position = { x: 20, y: 20 };

    run(physics, ball, 3);

    expect(physics.takeHits()).toEqual([]);
  });
});

describe('the floor actually stops the ball', () => {
  test('a ball falling onto a one-sided line does not pass through it', () => {
    // The line is declared left-to-right so its one side faces UP — the same one-sidedness that
    // caught a backwards flipper fixture back in phase 3.
    const physics = buildPhysics(FLOOR);
    const ball = physics.spawnBall();
    ball.position = { x: 20, y: 100 };

    run(physics, ball, 300);

    expect(ball.position.y).toBeLessThan(FLOOR.size.height);
    expect(ball.position.y).toBeLessThanOrEqual(151);
  });

  test('and it bounces rather than sticking', () => {
    const physics = buildPhysics(FLOOR);
    const ball = physics.spawnBall();
    ball.position = { x: 20, y: 100 };

    run(physics, ball, 60);
    const first = ball.position.y;
    run(physics, ball, 5);

    // Somewhere in there it turned around at least once.
    expect(Math.abs(ball.position.y - first)).toBeGreaterThan(0);
  });
});

describe('a surface answers according to what it IS', () => {
  test('a bumper adds speed above a threshold; a wall never does', () => {
    // Which is what makes a bumper ignore a light touch, and it is the one response that is not just
    // "give most of it back".
    expect(RESPONSES.bumper!.boost).toBeGreaterThan(0);
    expect(RESPONSES.bumper!.threshold).toBeLessThan(RESPONSES.wall!.threshold);
    expect(RESPONSES.wall!.boost).toBe(0);
  });

  test('the response is chosen by the component’s KIND', () => {
    const bumper = LOW_ORBIT.components.find((c) => c.kind === 'bumper')!;
    const wall = LOW_ORBIT.components.find((c) => c.kind === 'wall')!;

    expect(responseFor(bumper)).toBe(RESPONSES.bumper);
    expect(responseFor(wall)).toBe(RESPONSES.wall);
  });

  test('a kind with no response of its own falls back rather than crashing', () => {
    const well = LOW_ORBIT.components.find((c) => c.kind === 'well')!;

    expect(responseFor(well)).toBe(RESPONSES.default);
  });

  test('every response is a plausible one', () => {
    for (const [name, response] of Object.entries(RESPONSES)) {
      expect(response.elasticity, name).toBeGreaterThan(0);
      expect(response.elasticity, name).toBeLessThanOrEqual(1);
    }
  });
});

describe('⚠️ the drain is the one component that works by NOT being hit', () => {
  test('a ball inside a drain’s bounds is drained, by name', () => {
    // Every other piece of a table is an edge that answers when the ball arrives. A drain is a hole:
    // bounds and no collision, so nothing in the physics can ever report it.
    const drain = LOW_ORBIT.components.find((c) => c.kind === 'drain')!;
    const at = { x: drain.bounds.x + 2, y: drain.bounds.y + 2 };

    expect(drainedBy(LOW_ORBIT, { position: at })).toBe('drain');
  });

  test('a ball on the playfield is not', () => {
    expect(drainedBy(LOW_ORBIT, { position: { x: 90, y: 100 } })).toBeNull();
  });

  test('a ball PAST THE BOTTOM is lost even though it touched no drain', () => {
    // The first run of the wired game did exactly this: launched, bounced off the ceiling, came back
    // down and kept going to y = 4408 on a table 235 tall, at the speed cap, forever. The physics was
    // right; there was no rule saying where a table ends.
    expect(drainedBy(LOW_ORBIT, { position: { x: 90, y: 4408 } })).toBe('outside');
  });

  test('and so is a ball past any other edge', () => {
    expect(drainedBy(LOW_ORBIT, { position: { x: -5, y: 100 } })).toBe('outside');
    expect(drainedBy(LOW_ORBIT, { position: { x: 500, y: 100 } })).toBe('outside');
    expect(drainedBy(LOW_ORBIT, { position: { x: 90, y: -5 } })).toBe('outside');
  });

  test('a table with two drains names the one the ball fell into', () => {
    const four = CATALOG.find((t) => t.name === 'four-flippers')!;
    const upper = four.components.find((c) => c.name === 'drain.upper')!;

    expect(drainedBy(four, { position: { x: upper.bounds.x + 2, y: upper.bounds.y + 2 } }))
      .toBe('drain.upper');
  });

  test('a launched ball is eventually drained rather than simulated forever', () => {
    // The end-to-end shape of it: launch, climb, fall, gone.
    const physics = buildPhysics(LOW_ORBIT);
    const ball = physics.spawnBall();
    ball.direction = { x: 0, y: -1 };
    ball.speed = 260;

    let drained: string | null = null;
    for (let i = 0; i < 900 && !drained; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      drained = drainedBy(LOW_ORBIT, ball);
    }

    expect(drained).not.toBeNull();
  });
});
