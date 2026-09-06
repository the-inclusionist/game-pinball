// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createBumper, type TimerService } from '../app/js/table/bumper.js';
import { createSink, type SinkTable } from '../app/js/table/sink.js';
import type { BallState } from '../app/js/physics/collision.js';
import type { Vector2 } from '../app/js/maths/maths.js';

/** A timer whose pending callbacks are fired by hand. */
function fakeTimer() {
  const pending = new Map<number, () => void>();
  let next = 1;
  const timer: TimerService = {
    set: (_seconds, callback) => { const id = next++; pending.set(id, callback); return id; },
    kill: (id) => { pending.delete(id); },
  };
  return {
    timer,
    fireAll: () => { const cbs = [...pending.values()]; pending.clear(); cbs.forEach((cb) => cb()); },
    pendingCount: () => pending.size,
  };
}

/** A ball heading down into a surface whose normal points up. */
const ball = (speed: number): BallState => ({ position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed });
const UP = { x: 0, y: 1 };
const AT = { x: 0, y: 0 };

describe('bumper — the debounce IS the threshold', () => {
  function build() {
    const t = fakeTimer();
    const sprites: number[] = [];
    const fires: number[] = [];
    const b = createBumper({
      table: { tiltLocked: false },
      elasticity: 1, smoothness: 1, threshold: 5, boost: 20,
      litTime: 0.1, timer: t.timer,
      setSprite: (i) => sprites.push(i),
      onFire: () => fires.push(1),
    });
    return { b, t, sprites, fires };
  }

  test('a hard hit fires the bumper', () => {
    const { b, fires } = build();

    b.collision(ball(10), AT, UP, 0, null);

    expect(b.lit).toBe(true);
    expect(fires).toEqual([1]);
  });

  test('a soft hit does not fire it', () => {
    const { b, fires } = build();

    b.collision(ball(1), AT, UP, 0, null);

    expect(b.lit).toBe(false);
    expect(fires).toEqual([]);
  });

  test('while LIT a second hard hit does not fire again', () => {
    // There is no busy flag anywhere: firing sets the threshold to infinity, and an infinite threshold
    // is a hit that can never be hard.
    const { b, fires } = build();
    b.collision(ball(10), AT, UP, 0, null);

    b.collision(ball(10), AT, UP, 0, null);

    expect(fires).toEqual([1]);
  });

  test('while LIT the ball is not KICKED either — it bounces off like a wall', () => {
    // The second effect of the infinite threshold, which the original never states: in basicCollision
    // the boost only applies above the threshold. Reimplementing the debounce with a boolean would
    // quietly lose this.
    const { b } = build();
    const first = ball(10);
    b.collision(first, AT, UP, 0, null);
    expect(first.speed).toBeCloseTo(30); // 10 back plus 20 of kick

    const second = ball(10);
    b.collision(second, AT, UP, 0, null);

    expect(second.speed).toBeCloseTo(10); // bounce only
  });

  test('when the timer expires it can fire again', () => {
    const { b, t, fires } = build();
    b.collision(ball(10), AT, UP, 0, null);

    t.fireAll();
    b.collision(ball(10), AT, UP, 0, null);

    expect(b.lit).toBe(true);
    expect(fires).toEqual([1, 1]);
  });
});

describe('bumper — the sprites come in pairs', () => {
  function build() {
    const t = fakeTimer();
    const sprites: number[] = [];
    const b = createBumper({
      table: { tiltLocked: false },
      elasticity: 1, smoothness: 1, threshold: 5, boost: 0,
      litTime: 0.1, timer: t.timer,
      setSprite: (i) => sprites.push(i),
    });
    return { b, t, sprites };
  }

  test('lighting uses 2*level+1 and unlighting 2*level', () => {
    // BmpIndex is the bumper's LEVEL, not its frame. That is why the clamp is on the pair.
    const { b, t, sprites } = build();

    b.setLevel(2, 8);
    t.fireAll();

    expect(sprites).toEqual([5, 4]);
  });

  test('a level whose PAIR would overflow is clamped to half the last frame', () => {
    const { b } = build();

    b.setLevel(99, 8); // frames 0..7, so the highest usable level is 3
    expect(b.level).toBe(3);
  });

  test('setting the level it already has changes nothing', () => {
    const { b, sprites } = build();
    b.setLevel(1, 8);
    sprites.length = 0;

    b.setLevel(1, 8);

    expect(sprites).toEqual([]);
  });
});

describe('sink — swallowing', () => {
  function build(tiltLocked = false) {
    const t = fakeTimer();
    const drained: unknown[] = [];
    const disabled: unknown[] = [];
    const played: number[] = [];
    const thrown: Vector2[] = [];
    let occupied = 0;
    const created: { collisionDisabled: boolean }[] = [];

    const table: SinkTable = {
      tiltLocked,
      drainCollision: (b) => { drained.push(b); },
      ballCountInRect: () => occupied,
      addBall: () => {
        const b = { collisionDisabled: false, throwBall: (d: Vector2) => { thrown.push(d); } };
        created.push(b);
        return b;
      },
      collisionCompOffset: 1,
    };

    const sink = createSink({
      table, timer: t.timer,
      ballPosition: { x: 10, y: 20 },
      throwDirection: { x: 0, y: -1 },
      throwAngleMult: 0, throwSpeedMult1: 1, throwSpeedMult2: 1,
      holdTime: 2,
      swallowSoundId: 4, releaseSoundId: 3,
      sound: { play: (id) => played.push(id) },
    });

    return { sink, t, drained, disabled, played, thrown, created, setOccupied: (n: number) => { occupied = n; } };
  }

  const swallowable = (disabled: unknown[]) => ({ disable: () => disabled.push(1) });

  test('swallows the ball and announces it', () => {
    const { sink, disabled, played } = build();

    sink.collision(swallowable(disabled), AT, UP, 0, null);

    expect(disabled).toHaveLength(1);
    expect(played).toEqual([4]);
  });

  test('⚠️ a hole the file gives NO sound is silent, and zero is not a sound', () => {
    // `loader::play_sound` returns immediately for anything at or below zero, and the original guards
    // the release sound with `if (SoundIndex3)` on top of that. Passing the id straight to the player
    // makes a hole whose records are absent announce itself as voice number nought, which the sound
    // layer would then have to know to ignore.
    const t = fakeTimer();
    const played: number[] = [];
    const disabled: unknown[] = [];
    const table: SinkTable = {
      tiltLocked: false,
      drainCollision: () => {},
      ballCountInRect: () => 0,
      addBall: () => ({ collisionDisabled: false, throwBall: () => {} }),
      collisionCompOffset: 1,
    };
    const sink = createSink({
      table, timer: t.timer,
      ballPosition: { x: 10, y: 20 },
      throwDirection: { x: 0, y: -1 },
      throwAngleMult: 0, throwSpeedMult1: 1, throwSpeedMult2: 1,
      holdTime: 2,
      swallowSoundId: 0, releaseSoundId: 0,
      sound: { play: (id) => played.push(id) },
    });

    sink.collision(swallowable(disabled), AT, UP, 0, null);
    sink.scheduleRelease();
    t.fireAll();

    expect(played).toEqual([]);
  });

  test('on TILT the sink becomes the DRAIN — the ball is lost, not swallowed', () => {
    // The harshest thing tilt does, and it is one line in the original. Treating tilt as merely "no
    // sound and no score" would lose it entirely.
    const { sink, drained, disabled, played } = build(true);

    sink.collision(swallowable(disabled), AT, UP, 0, null);

    expect(drained).toHaveLength(1);
    expect(disabled).toHaveLength(0);
    expect(played).toEqual([]);
  });
});

describe('sink — giving the ball back', () => {
  function build() {
    const t = fakeTimer();
    const thrown: Vector2[] = [];
    let occupied = 0;
    const created: { collisionDisabled: boolean }[] = [];
    const table: SinkTable = {
      tiltLocked: false,
      drainCollision: () => {},
      ballCountInRect: () => occupied,
      addBall: () => {
        const b = { collisionDisabled: false, throwBall: (d: Vector2) => { thrown.push(d); } };
        created.push(b);
        return b;
      },
      collisionCompOffset: 1,
    };
    const sink = createSink({
      table, timer: t.timer,
      ballPosition: { x: 10, y: 20 },
      throwDirection: { x: 0, y: -1 },
      throwAngleMult: 0, throwSpeedMult1: 1, throwSpeedMult2: 1,
      holdTime: 2,
      sound: { play: () => {} },
    });
    return { sink, t, thrown, created, setOccupied: (n: number) => { occupied = n; } };
  }

  test('⚠️ and when the table has no ball to give it, it waits and asks again', () => {
    // `AddBall` returns null when twenty balls are already in play. The original asserts and, in a
    // release build, throws the ball away; this waits the same half second the occupied exit waits.
    // A hole that took null for an answer would swallow a ball and quietly never give it back.
    const t = fakeTimer();
    const created: unknown[] = [];
    let room = false;
    const table: SinkTable = {
      tiltLocked: false,
      drainCollision: () => {},
      ballCountInRect: () => 0,
      addBall: () => {
        if (!room) return null;
        const b = { collisionDisabled: false, throwBall: () => {} };
        created.push(b);
        return b;
      },
      collisionCompOffset: 1,
    };
    const sink = createSink({
      table, timer: t.timer,
      ballPosition: { x: 10, y: 20 },
      throwDirection: { x: 0, y: -1 },
      throwAngleMult: 0, throwSpeedMult1: 1, throwSpeedMult2: 1,
      holdTime: 2,
    });

    sink.scheduleRelease();
    t.fireAll();
    expect(created, 'no ball to be had').toEqual([]);

    room = true;
    t.fireAll();
    expect(created, 'and it asked again').toHaveLength(1);
  });

  test('releases a ball when the exit is clear', () => {
    const { sink, t, created, thrown } = build();

    sink.scheduleRelease();
    t.fireAll();

    expect(created).toHaveLength(1);
    expect(thrown).toEqual([{ x: 0, y: -1 }]);
  });

  test('the released ball starts with collision DISABLED', () => {
    // Otherwise it would collide with the very sink it is being born inside.
    const { sink, t, created } = build();

    sink.scheduleRelease();
    t.fireAll();

    expect(created[0]!.collisionDisabled).toBe(true);
  });

  test('if a ball is already at the exit it WAITS instead of spawning on top of it', () => {
    // Two balls born inside each other would be flung apart at a speed neither of them earned.
    const { sink, t, created, setOccupied } = build();
    setOccupied(1);

    sink.scheduleRelease();
    t.fireAll();

    expect(created).toHaveLength(0);
    expect(t.pendingCount()).toBe(1); // rescheduled
  });

  test('a negative delay means the sink’s own hold time', () => {
    const { sink, t } = build();

    sink.scheduleRelease(-1);

    expect(t.pendingCount()).toBe(1);
  });
});
