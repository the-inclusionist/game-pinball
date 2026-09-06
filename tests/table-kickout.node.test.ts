// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createKickout, type KickoutBall } from '../app/js/table/kickout.js';
import type { TimerService } from '../app/js/table/bumper.js';
import type { Edge } from '../app/js/physics/grid.js';
import type { Vector2 } from '../app/js/maths/maths.js';

function fakeTimer() {
  let pending: (() => void)[] = [];
  const timer: TimerService = {
    set: (_s, cb) => { pending.push(cb); return pending.length; },
    kill: () => { pending = []; },
  };
  return { timer, tick: () => { const r = pending; pending = []; r.forEach((cb) => cb()); } };
}

const anEdge = (): Edge =>
  ({ active: true, collisionGroup: 0xffff, findCollisionDistance: () => 1, edgeCollision: () => {} });

function build(tiltLocked = false) {
  const t = fakeTimer();
  const edges = [anEdge()];
  const played: number[] = [];
  const captures: number[] = [];
  const thrown: Vector2[] = [];
  const k = createKickout({
    table: { tiltLocked }, timer: t.timer, edges,
    center: { x: 100, y: 200 },
    fieldRadiusSq: 25, // reach of 5
    fieldMult: 10,
    capturedZ: -3,
    holdTime: 1.5,
    throwDirection: { x: 0, y: -1 },
    throwAngleMult: 0, throwSpeedMult1: 1, throwSpeedMult2: 1,
    captureSoundId: 1, releaseSoundId: 2,
    sound: { play: (id) => played.push(id) },
  });
  k.control = () => captures.push(1);
  return { k, t, edges, played, captures, thrown };
}

const ballAt = (x: number, y: number, dx = 0, dy = 0, speed = 0): KickoutBall => ({
  position: { x, y, z: 7 },
  direction: { x: dx, y: dy },
  speed,
  collisionDisabled: false,
  component: null,
  memory: { record: () => {} },
  throwBall: () => {},
});

describe('kickout — the field is a controller, not an attraction', () => {
  test('it CANCELS the ball’s velocity and substitutes a pull toward the center', () => {
    // dst = normalize(center - pos) * fieldMult - direction * speed. Dropping the second term would
    // leave a hole a fast ball simply flies over.
    const { k } = build();
    // Two units left of the center, traveling right at speed 4.
    const ball = ballAt(98, 200, 1, 0, 4);
    const out = { x: 0, y: 0 };

    expect(k.fieldEffect(ball, out)).toBe(true);
    expect(out.x).toBeCloseTo(10 - 4); // pull of 10 toward +x, minus the 4 it already had
    expect(out.y).toBeCloseTo(0);
  });

  test('a ball standing still gets pure pull', () => {
    const { k } = build();
    const out = { x: 0, y: 0 };

    k.fieldEffect(ballAt(98, 200), out);

    expect(out.x).toBeCloseTo(10);
  });

  test('outside the reach the field says nothing', () => {
    const { k } = build();
    const out = { x: 99, y: 99 };

    expect(k.fieldEffect(ballAt(120, 200), out)).toBe(false);
    expect(out).toEqual({ x: 99, y: 99 }); // untouched
  });

  test('a hole that is already full has nothing to pull with', () => {
    const { k } = build();
    k.collision(ballAt(100, 200), { x: 100, y: 200 }, { x: 0, y: 1 }, 0, anEdge());
    const out = { x: 0, y: 0 };

    expect(k.fieldEffect(ballAt(98, 200), out)).toBe(false);
  });
});

describe('kickout — capture', () => {
  test('the ball is teleported to the center and handed to the component', () => {
    // From then on physics/step skips the grid for that ball and lets the component move it.
    const { k, captures, played } = build();
    const ball = ballAt(101, 201);

    k.collision(ball, { x: 101, y: 201 }, { x: 0, y: 1 }, 0, anEdge());

    expect(k.captured).toBe(true);
    expect(ball.position.x).toBe(100);
    expect(ball.position.y).toBe(200);
    expect(ball.component).not.toBeNull();
    expect(ball.collisionDisabled).toBe(true);
    expect(captures).toEqual([1]);
    expect(played).toEqual([1]);
  });

  test('capturing sinks the ball’s Z into the hole', () => {
    const { k } = build();
    const ball = ballAt(101, 201);

    k.collision(ball, { x: 101, y: 201 }, { x: 0, y: 1 }, 0, anEdge());

    expect(ball.position.z).toBe(-3);
  });

  test('a second ball touching a full hole just passes through', () => {
    const { k, captures } = build();
    k.collision(ballAt(101, 201), { x: 101, y: 201 }, { x: 0, y: 1 }, 0, anEdge());
    const second = ballAt(105, 205, 0, -1, 9);

    k.collision(second, { x: 7, y: 8 }, { x: 0, y: 1 }, 1, anEdge());

    expect(second.position.x).toBe(7);
    expect(second.direction).toEqual({ x: 0, y: -1 }); // untouched
    expect(second.speed).toBe(9);
    expect(captures).toEqual([1]); // still only one capture
  });
});

describe('kickout — release', () => {
  test('the ball is thrown, its Z restored, and it is given back to the grid', () => {
    const { k, t, played } = build();
    const ball = ballAt(101, 201);
    let thrownWith: Vector2 | null = null;
    ball.throwBall = (d) => { thrownWith = d; };
    k.collision(ball, { x: 101, y: 201 }, { x: 0, y: 1 }, 0, anEdge());

    k.restartTimer();
    t.tick();

    expect(k.captured).toBe(false);
    expect(ball.position.z).toBe(7);
    expect(ball.component).toBeNull();
    expect(ball.collisionDisabled).toBe(false);
    expect(thrownWith).toEqual({ x: 0, y: -1 });
    expect(played).toEqual([1, 2]);
  });

  test('it goes DEAF the instant it spits, and wakes up later', () => {
    // The departing ball is still inside the circle. Without the gap it would be captured again on the
    // very next frame.
    const { k, t, edges } = build();
    k.collision(ballAt(101, 201), { x: 101, y: 201 }, { x: 0, y: 1 }, 0, anEdge());
    k.restartTimer();

    t.tick(); // the throw

    expect(edges[0]!.active).toBe(false);
    t.tick(); // the deaf timer
    expect(edges[0]!.active).toBe(true);
  });

  test('restartTimer on an empty hole does nothing', () => {
    const { k, t } = build();

    k.restartTimer();
    t.tick();

    expect(k.captured).toBe(false);
  });
});

describe('kickout — tilt', () => {
  test('a tilted table swallows and spits straight back, silently', () => {
    const { k, t, played, captures } = build(true);
    const ball = ballAt(101, 201);

    k.collision(ball, { x: 101, y: 201 }, { x: 0, y: 1 }, 0, anEdge());

    expect(k.captured).toBe(true);
    expect(played).toEqual([]);
    expect(captures).toEqual([]);

    t.tick(); // the short tilted hold fires on its own, with no restartTimer call
    expect(k.captured).toBe(false);
  });
});

/**
 * ⚠️ A DORMANT HOLE MUST NOT PULL, AND THIS ONE DID.
 *
 * `TEdgeManager::FieldEffects` tests `*field->ActiveFlag` before it asks a field for anything, and a
 * `Kickout2` — the gravity well — is born with that flag clear: it is dormant until a mission arms it.
 * This port's field checked only whether the hole was full and whether the ball was inside its reach.
 *
 * The gravity well of the 1995 table sits at (0, 6) with a reach of three and a half units, which is
 * the MIDDLE OF THE PLAYFIELD. So every ball that crossed the centre was dragged in and parked there,
 * drifting at a fifth of a unit a second, for the rest of the game. Reported by the player as "the ball
 * gets caught at some points", which is exactly what it looked like: no error, no collision, no drain.
 */
describe('a hole that is not armed', () => {
  function well(startsActive: boolean) {
    const t = fakeTimer();
    const kickout = createKickout({
      table: { tiltLocked: false }, timer: t.timer, edges: [anEdge()],
      center: { x: 0, y: 6 },
      fieldRadiusSq: 12.25, // the 1995 well's own reach, three and a half units
      fieldMult: 10,
      capturedZ: -3,
      holdTime: 1.5,
      throwDirection: { x: 0, y: -1 },
      throwAngleMult: 0, throwSpeedMult1: 1, throwSpeedMult2: 1,
      startsActive,
    });
    return kickout;
  }

  const ballNearIt = () => ({
    position: { x: 0.5, y: 6.5, z: 0 }, direction: { x: 0, y: 1 }, speed: 4,
    collisionDisabled: false, component: null as unknown,
    memory: { record: () => {} },
    throwBall: () => {},
  });

  test('⚠️ pulls NOTHING while it is dormant', () => {
    const kickout = well(false);
    const destination = { x: 0, y: 0 };

    const answered = kickout.fieldEffect(ballNearIt() as never, destination);

    expect(answered, 'it declines').toBe(false);
    expect(destination, 'and writes nothing').toEqual({ x: 0, y: 0 });
  });

  test('and pulls once a mission arms it', () => {
    const kickout = well(false);
    kickout.active = true;
    const destination = { x: 0, y: 0 };

    expect(kickout.fieldEffect(ballNearIt() as never, destination)).toBe(true);
    expect(Math.hypot(destination.x, destination.y)).toBeGreaterThan(0);
  });

  test('⚠️ and a hole that is armed and FULL pulls nothing either', () => {
    // Already answered before this: a hole that has the ball has nothing to pull with.
    const kickout = well(true);
    kickout.collision(ballNearIt(), { x: 0, y: 6 }, { x: 0, y: 1 }, 0, null);
    const destination = { x: 0, y: 0 };

    expect(kickout.fieldEffect(ballNearIt() as never, destination)).toBe(false);
  });
});
