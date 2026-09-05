// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createRollover, type RolloverBall } from '../app/js/table/rollover.js';
import { createSoloTarget } from '../app/js/table/solo-target.js';
import type { TimerService } from '../app/js/table/bumper.js';
import type { Edge } from '../app/js/physics/grid.js';
import type { BallState } from '../app/js/physics/collision.js';

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

const UP = { x: 0, y: 1 };
const AT = { x: 5, y: 3 };

describe('rollover — a state machine made of live edges', () => {
  function build(tiltLocked = false) {
    const t = fakeTimer();
    const entry = [anEdge()];
    const exit = [anEdge()];
    const played: number[] = [];
    const entries: number[] = [];
    const sprites: number[] = [];
    const r = createRollover({
      table: { tiltLocked }, timer: t.timer,
      entryEdges: entry, exitEdges: exit,
      enterSoundId: 5, sound: { play: (id) => played.push(id) },
      setSprite: (i) => sprites.push(i),
      onEnter: () => entries.push(1),
    });
    const ball: RolloverBall = {
      position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed: 10,
      memory: { record: () => {} },
    };
    return { r, t, entry, exit, played, entries, sprites, ball };
  }

  test('the exit boundary does NOT exist until the ball has come in', () => {
    // The whole "am I on the lane?" state is carried by which edge set the collision search can see.
    // There is no inside/outside test anywhere.
    const { exit } = build();

    expect(exit[0]!.active).toBe(false);
  });

  test('entering switches the exit boundary ON', () => {
    const { r, exit, ball } = build();

    r.collision(ball, AT, UP, 1, exit[0]!);

    expect(r.inside).toBe(true);
    expect(exit[0]!.active).toBe(true);
  });

  test('rolling over does not touch direction or speed', () => {
    const { r, ball, exit } = build();

    r.collision(ball, AT, UP, 1, exit[0]!);

    expect(ball.direction).toEqual({ x: 0, y: -1 });
    expect(ball.speed).toBe(10);
    expect(ball.position).toEqual(AT);
  });

  test('only ENTERING scores and sounds', () => {
    const { r, ball, exit, played, entries } = build();

    r.collision(ball, AT, UP, 1, exit[0]!); // in
    r.collision(ball, AT, UP, 1, exit[0]!); // out

    expect(played).toEqual([5]);
    expect(entries).toEqual([1]);
  });

  test('leaving goes DEAF briefly so a hovering ball cannot rattle the lane', () => {
    const { r, t, entry, ball, exit } = build();
    r.collision(ball, AT, UP, 1, exit[0]!); // in

    r.collision(ball, AT, UP, 1, exit[0]!); // out

    expect(r.inside).toBe(false);
    expect(exit[0]!.active).toBe(false);
    expect(entry[0]!.active).toBe(false); // the whole component is deaf
    t.tick();
    expect(entry[0]!.active).toBe(true);
  });

  test('the sprite hides while the ball is on the lane', () => {
    // The ball itself covers it.
    const { r, ball, sprites, exit } = build();
    sprites.length = 0;

    r.collision(ball, AT, UP, 1, exit[0]!);

    expect(sprites).toEqual([-1]);
  });

  test('a TILTED table lets the ball across and registers nothing', () => {
    // Toggling on tilt would leave the lane stuck open when the tilt cleared.
    const { r, ball, played, entries, exit } = build(true);

    r.collision(ball, AT, UP, 1, exit[0]!);

    expect(r.inside).toBe(false);
    expect(played).toEqual([]);
    expect(entries).toEqual([]);
    expect(ball.position).toEqual(AT); // it still passed through
  });
});

describe('solo target — it drops by switching off', () => {
  function build(tiltLocked = false) {
    const t = fakeTimer();
    const edges = [anEdge()];
    const hits: number[] = [];
    const sprites: number[] = [];
    const target = createSoloTarget({
      table: { tiltLocked }, timer: t.timer, edges,
      elasticity: 1, smoothness: 1, threshold: 5, boost: 0,
      setSprite: (i) => sprites.push(i),
      onHit: () => hits.push(1),
    });
    return { target, t, edges, hits, sprites };
  }

  const ball = (speed: number): BallState => ({ position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed });

  test('a HARD hit knocks it down: it stops colliding', () => {
    // Dropped is not "moved out of the way" — it is the same geometry nobody looks at.
    const { target, edges, hits } = build();

    target.collision(ball(10), AT, UP, 0, null);

    expect(target.standing).toBe(false);
    expect(edges[0]!.active).toBe(false);
    expect(hits).toEqual([1]);
  });

  test('a soft hit bounces off a standing target and scores nothing', () => {
    const { target, edges, hits } = build();

    target.collision(ball(1), AT, UP, 0, null);

    expect(target.standing).toBe(true);
    expect(edges[0]!.active).toBe(true);
    expect(hits).toEqual([]);
  });

  test('the timer stands it back up', () => {
    const { target, t, edges } = build();
    target.collision(ball(10), AT, UP, 0, null);

    t.tick();

    expect(target.standing).toBe(true);
    expect(edges[0]!.active).toBe(true);
  });

  test('the sprite is the state: 0 standing, 1 down', () => {
    const { target, t, sprites } = build();
    sprites.length = 0;

    target.collision(ball(10), AT, UP, 0, null);
    t.tick();

    expect(sprites).toEqual([1, 0]);
  });

  test('on a TILTED table nothing counts as a hard hit, so it never drops', () => {
    const { target, hits } = build(true);

    target.collision(ball(100), AT, UP, 0, null);

    expect(target.standing).toBe(true);
    expect(hits).toEqual([]);
  });
});
