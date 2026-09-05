// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createPopupTarget } from '../app/js/table/popup-target.js';
import { createBlocker } from '../app/js/table/blocker.js';
import type { TimerService } from '../app/js/table/bumper.js';
import type { Edge } from '../app/js/physics/grid.js';
import type { BallState } from '../app/js/physics/collision.js';

function fakeTimer() {
  let pending: (() => void)[] = [];
  const timer: TimerService = {
    set: (_s, cb) => { pending.push(cb); return pending.length; },
    kill: () => { pending = []; },
  };
  return { timer, tick: () => { const r = pending; pending = []; r.forEach((cb) => cb()); }, pendingCount: () => pending.length };
}

const anEdge = (): Edge =>
  ({ active: true, collisionGroup: 0xffff, findCollisionDistance: () => 1, edgeCollision: () => {} });

const ball = (speed: number): BallState => ({ position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed });
const UP = { x: 0, y: 1 };
const AT = { x: 0, y: 0 };

describe('popup target — it drops and STAYS down', () => {
  function build(tiltLocked = false) {
    const t = fakeTimer();
    const edges = [anEdge()];
    const hits: number[] = [];
    const played: number[] = [];
    const sprites: number[] = [];
    const target = createPopupTarget({
      table: { tiltLocked }, timer: t.timer, edges,
      elasticity: 1, smoothness: 1, threshold: 5, boost: 0,
      popupDelay: 0.5,
      hardHitSoundId: 1, popupSoundId: 2,
      sound: { play: (id) => played.push(id) },
      setSprite: (i) => sprites.push(i),
      onHit: () => hits.push(1),
    });
    return { target, t, edges, hits, played, sprites };
  }

  test('a hard hit knocks it down and it does NOT come back on its own', () => {
    // This is the whole difference from the drop target: a popup is STATE the mission owns. A row of
    // them stays down until the mission says the row is finished.
    const { target, t, edges, hits } = build();

    target.collision(ball(10), AT, UP, 0, null);
    t.tick(); // nothing is pending

    expect(target.standing).toBe(false);
    expect(edges[0]!.active).toBe(false);
    expect(hits).toEqual([1]);
  });

  test('a soft hit leaves it standing', () => {
    const { target, hits } = build();

    target.collision(ball(1), AT, UP, 0, null);

    expect(target.standing).toBe(true);
    expect(hits).toEqual([]);
  });

  test('it comes back only when the mission asks, and after the delay', () => {
    const { target, t } = build();
    target.collision(ball(10), AT, UP, 0, null);

    target.popUp();
    expect(target.standing).toBe(false); // still down: the delay has not passed
    t.tick();

    expect(target.standing).toBe(true);
  });

  test('rising by timer announces itself; rising by reset is SILENT', () => {
    // One function in the original, and the timer id is what says which occasion this is.
    const byTimer = build();
    byTimer.target.collision(ball(10), AT, UP, 0, null);
    byTimer.played.length = 0;
    byTimer.target.popUp();
    byTimer.t.tick();

    const byReset = build();
    byReset.target.collision(ball(10), AT, UP, 0, null);
    byReset.played.length = 0;
    byReset.target.reset();

    expect(byTimer.played).toEqual([2]);
    expect(byReset.played).toEqual([]);
  });

  test('on a TILTED table it bounces and never drops', () => {
    const { target, hits } = build(true);

    target.collision(ball(100), AT, UP, 0, null);

    expect(target.standing).toBe(true);
    expect(hits).toEqual([]);
  });
});

describe('blocker — a wall that only exists during a mission', () => {
  function build() {
    const t = fakeTimer();
    const edges = [anEdge()];
    const played: number[] = [];
    const timeouts: number[] = [];
    const blocker = createBlocker({
      timer: t.timer, edges,
      enableSoundId: 1, disableSoundId: 2,
      sound: { play: (id) => played.push(id) },
      onTimeout: () => timeouts.push(1),
    });
    return { blocker, t, edges, played, timeouts };
  }

  test('it is born inactive and invisible', () => {
    const { blocker, edges } = build();

    expect(blocker.active).toBe(false);
    expect(edges[0]!.active).toBe(false);
  });

  test('enabling switches the edges on', () => {
    const { blocker, edges, played } = build();

    blocker.enable(10);

    expect(blocker.active).toBe(true);
    expect(edges[0]!.active).toBe(true);
    expect(played).toEqual([1]);
  });

  test('THE TIMEOUT DOES NOT SWITCH IT OFF — it only reports', () => {
    // A real division of responsibility: the blocker measures time and the mission decides what the
    // time meant. Sometimes the mission extends it, and a blocker that switched itself off would make
    // the extension impossible to express.
    const { blocker, t, edges, timeouts } = build();
    blocker.enable(10);

    t.tick();

    expect(timeouts).toEqual([1]);
    expect(blocker.active).toBe(true);
    expect(edges[0]!.active).toBe(true);
  });

  test('a negative duration leaves it open with no deadline', () => {
    const { blocker, t } = build();

    blocker.enable(-1);

    expect(blocker.active).toBe(true);
    expect(t.pendingCount()).toBe(0);
  });

  test('restarting the timeout gives a new deadline without touching whether it is on', () => {
    const { blocker, t, timeouts } = build();
    blocker.enable(10);

    blocker.restartTimeout(5);
    t.tick();

    expect(timeouts).toEqual([1]); // the first deadline was replaced, not added to
    expect(blocker.active).toBe(true);
  });

  test('disabling announces itself; reset is silent', () => {
    const loud = build();
    loud.blocker.enable(10);
    loud.played.length = 0;
    loud.blocker.disable();

    const quiet = build();
    quiet.blocker.enable(10);
    quiet.played.length = 0;
    quiet.blocker.reset();

    expect(loud.played).toEqual([2]);
    expect(quiet.played).toEqual([]);
    expect(loud.blocker.active).toBe(false);
    expect(quiet.blocker.active).toBe(false);
  });

  test('disabling cancels a pending timeout', () => {
    const { blocker, t, timeouts } = build();
    blocker.enable(10);

    blocker.disable();
    t.tick();

    expect(timeouts).toEqual([]);
  });
});
