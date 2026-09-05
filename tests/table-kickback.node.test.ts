// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  createKickback, KICKBACK_ARM_SECONDS, KICKBACK_KICK_SECONDS, KICKBACK_REST_THRESHOLD,
} from '../app/js/table/kickback.js';
import type { BallState } from '../app/js/physics/collision.js';
import type { TimerService } from '../app/js/table/bumper.js';

/**
 * ⚠️ THE KICKBACK IS A THRESHOLD THAT MOVES.
 *
 * It never decides to kick. It arms itself on the first touch, and seven tenths of a second later it
 * drops its own collision THRESHOLD to zero — after which any contact at all counts as a hard hit and
 * the boost throws the ball out. That is the whole mechanism: no state machine about the ball, one
 * number that changes.
 */

const HARD_SOUND = 29;

function fakeTimer() {
  const pending = new Map<number, { seconds: number; run: () => void }>();
  let next = 1;
  const timer: TimerService = {
    set: (seconds, run) => { const id = next++; pending.set(id, { seconds, run }); return id; },
    kill: (id) => { pending.delete(id); },
  };
  return {
    timer,
    delays: () => [...pending.values()].map((p) => p.seconds),
    alive: () => pending.size,
    fire: () => { const all = [...pending.values()]; pending.clear(); for (const p of all) p.run(); },
  };
}

function build(o: { tiltLocked?: boolean } = {}) {
  const t = fakeTimer();
  const played: number[] = [];
  const sprites: number[] = [];
  const expired: number[] = [];
  const kickback = createKickback({
    table: { tiltLocked: o.tiltLocked ?? false },
    elasticity: 0.2, smoothness: 0.7, boost: 55,
    hardHitSoundId: HARD_SOUND,
    sound: { play: (id) => played.push(id) },
    timer: t.timer,
    setSprite: (index) => sprites.push(index),
  });
  kickback.control = () => expired.push(1);
  return { kickback, t, played, sprites, expired };
}

/** A ball rolling gently into a surface whose normal points up. */
const ball = (speed = 1): BallState => ({ position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed });
const UP = { x: 0, y: 1 };
const AT = { x: 0, y: 0 };

describe('the kickback arms itself, then drops its own threshold', () => {
  test('a fresh one is not armed and will not kick', () => {
    const { kickback } = build();

    expect(kickback.armed).toBe(false);
    expect(kickback.threshold).toBe(KICKBACK_REST_THRESHOLD);
  });

  test('the first touch arms it and starts the long timer', () => {
    const { kickback, t } = build();

    kickback.collision(ball(), AT, UP, 0, null);

    expect(kickback.armed).toBe(true);
    expect(t.delays()).toEqual([KICKBACK_ARM_SECONDS]);
  });

  test('⚠️ and that touch does NOT kick, because the threshold is still out of reach', () => {
    // Seven tenths of a second is the delay the player feels between the ball reaching the outlane
    // and the kickback firing. A port that kicked on contact would remove it and the shot would never
    // be lost the way the table intends.
    const { kickback, played } = build();
    const b = ball(1);

    kickback.collision(b, AT, UP, 0, null);

    expect(b.speed).toBeLessThan(1); // an ordinary elastic bounce, not a boost
    expect(played).toEqual([]);
  });

  test('⚠️ when the long timer expires the threshold drops to ZERO, which is the kick', () => {
    const { kickback, t, played, sprites } = build();
    kickback.collision(ball(), AT, UP, 0, null);

    t.fire();

    expect(kickback.threshold).toBe(0);
    expect(played).toEqual([HARD_SOUND]);
    expect(sprites).toContain(1);
    // And a short timer is armed, so it keeps kicking while the ball is still there.
    expect(t.delays()).toEqual([KICKBACK_KICK_SECONDS]);
  });

  test('and now a touch throws the ball out', () => {
    const { kickback, t } = build();
    kickback.collision(ball(), AT, UP, 0, null);
    t.fire();
    const b = ball(1);

    kickback.collision(b, AT, UP, 0, null);

    expect(b.speed).toBeGreaterThan(50); // the boost, not a bounce
  });

  test('⚠️ a kick DISARMS it, so the next expiry ends the sequence instead of kicking again', () => {
    // `DefaultCollision` answers whether the hit was hard, and a hard hit clears the flag. That is how
    // the kickback knows the ball has gone: it does not look for the ball, it notices it kicked one.
    const { kickback, t, expired, sprites } = build();
    kickback.collision(ball(), AT, UP, 0, null);
    t.fire();
    kickback.collision(ball(1), AT, UP, 0, null);
    expect(kickback.armed).toBe(false);

    t.fire();

    expect(expired).toEqual([1]);
    expect(sprites.at(-1)).toBe(0);
  });

  test('⚠️ and with the ball STILL there it kicks again rather than reporting', () => {
    const { kickback, t, expired, played } = build();
    kickback.collision(ball(), AT, UP, 0, null);

    t.fire();
    t.fire();

    expect(expired).toEqual([]);
    expect(played).toEqual([HARD_SOUND, HARD_SOUND]);
  });

  test('a tilted table just bounces: nothing arms, nothing kicks', () => {
    const { kickback, t } = build({ tiltLocked: true });

    kickback.collision(ball(), AT, UP, 0, null);

    expect(kickback.armed).toBe(false);
    expect(t.alive()).toBe(0);
  });

  test('reset kills the timer and puts the threshold back out of reach', () => {
    const { kickback, t, sprites } = build();
    kickback.collision(ball(), AT, UP, 0, null);
    t.fire();

    kickback.reset();

    expect(kickback.armed).toBe(false);
    expect(kickback.threshold).toBe(KICKBACK_REST_THRESHOLD);
    expect(t.alive()).toBe(0);
    expect(sprites.at(-1)).toBe(-1);
  });
});
