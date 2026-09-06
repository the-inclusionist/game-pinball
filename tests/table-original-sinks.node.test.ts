// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { buildOriginalSinks } from '../app/js/table/original-sinks.js';
import { loadTable } from '../app/js/dat/loader.js';
import type { Vector2 } from '../app/js/maths/maths.js';

/**
 * ⚠️ A SINK IS A HOLE THAT GIVES THE BALL BACK, AND EVERY NUMBER IN IT IS IN THE FILE.
 *
 * `TSink`'s constructor reads two attributes and one visual: record 601 for where the ball reappears,
 * record 407 for how long it is held, and the KICKER for how it is thrown — with the two speed
 * multipliers taken from fields whose names do not match their use (`Boost` and `ThrowBallMult / 100`).
 *
 * ⚠️ AND THERE ARE FOUR OF THEM. Three are the wormhole's — the teleport is the choice of which of the
 * three gives the ball back — and the fourth, `v_sink7`, is the escape chute, which no control's
 * reference list names at all. Counting the wormhole instead of the file would leave it a plain wall.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

/** A clock that only moves when the test says so. */
function fakeTimers() {
  const pending = new Map<number, { at: number; run: () => void }>();
  let next = 1;
  let now = 0;
  return {
    service: {
      set(seconds: number, callback: () => void): number {
        const id = next++;
        pending.set(id, { at: now + seconds, run: callback });
        return id;
      },
      kill(id: number): void { pending.delete(id); },
    },
    advance(seconds: number): void {
      now += seconds;
      for (const [id, entry] of [...pending]) {
        if (entry.at <= now) { pending.delete(id); entry.run(); }
      }
    },
  };
}

interface ThrownBall {
  at: Vector2;
  collisionDisabled: boolean;
  throws: { direction: Vector2; angleMult: number; speedMult1: number; speedMult2: number }[];
}

function build(o: { tilt?: boolean; occupied?: number } = {}) {
  const t = manifest();
  if (!t) return null;
  const clock = fakeTimers();
  const drained: string[] = [];
  const swallowed: string[] = [];
  const played: number[] = [];
  const born: ThrownBall[] = [];
  let occupied = o.occupied ?? 0;
  const table = {
    tiltLocked: o.tilt ?? false,
    collisionCompOffset: 0.25,
    drainCollision: () => { drained.push('drain'); },
    ballCountInRect: () => occupied,
    addBall: (at: Vector2) => {
      const ball: ThrownBall = { at, collisionDisabled: false, throws: [] };
      born.push(ball);
      return {
        get collisionDisabled() { return ball.collisionDisabled; },
        set collisionDisabled(value: boolean) { ball.collisionDisabled = value; },
        throwBall: (direction: Vector2, angleMult: number, speedMult1: number, speedMult2: number) => {
          ball.throws.push({ direction, angleMult, speedMult1, speedMult2 });
        },
      };
    },
  };
  const sinks = buildOriginalSinks(t, {
    table,
    timer: clock.service,
    sound: { play: (id) => played.push(id) },
    onSwallow: (name) => swallowed.push(name),
  });
  return {
    sinks, clock, drained, swallowed, played, born,
    freeTheExit: () => { occupied = 0; },
  };
}

/** A ball as the sink meets it: the only thing it is asked to do is stop existing. */
function ballThatCanBeDisabled() {
  const state = { disabled: false };
  return { state, ball: { disable: () => { state.disabled = true; } } };
}

describe('the four holes that give the ball back', () => {
  test('⚠️ FOUR of them are built, by the archive\u2019s own names', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect([...b.sinks.keys()].sort()).toEqual(['v_sink1', 'v_sink2', 'v_sink3', 'v_sink7']);
  });

  test('a hit swallows the ball and says so', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const { state, ball } = ballThatCanBeDisabled();

    b.sinks.get('v_sink1')!.collision(ball, { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);

    expect(state.disabled, 'the ball stops existing').toBe(true);
    expect(b.swallowed).toEqual(['v_sink1']);
    expect(b.drained, 'and the drain is not involved').toEqual([]);
  });

  test('⚠️ ON TILT EVERY HOLE ON THE BOARD BECOMES THE DRAIN', () => {
    // `TSink::Collision` opens with `if (TiltLockFlag) Drain->Collision(...)`. Not "do not swallow" —
    // hand the ball to the drain. It is the harshest thing tilt does and it is one line.
    const b = build({ tilt: true });
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const { state, ball } = ballThatCanBeDisabled();

    b.sinks.get('v_sink1')!.collision(ball, { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);

    expect(b.drained).toEqual(['drain']);
    expect(state.disabled, 'not swallowed: lost').toBe(false);
    expect(b.swallowed).toEqual([]);
  });

  test('⚠️ the ball comes back where record 601 says, after the two seconds record 407 says', () => {
    // The numbers are the file's, quoted here rather than read back through the code that reads them.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    b.sinks.get('v_sink1')!.scheduleRelease();
    b.clock.advance(1.9);
    expect(b.born, 'still held').toEqual([]);

    b.clock.advance(0.2);

    expect(b.born.length).toBe(1);
    expect(b.born[0]!.at.x).toBeCloseTo(-2.6182670, 5);
    expect(b.born[0]!.at.y).toBeCloseTo(-8.8287105, 5);
  });

  test('⚠️ and each hole has its own exit, which is what makes them four holes', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    b.sinks.get('v_sink3')!.scheduleRelease();
    b.clock.advance(2.1);

    expect(b.born[0]!.at.x).toBeCloseTo(-4.7144298, 5);
    expect(b.born[0]!.at.y).toBeCloseTo(3.3290209, 5);
  });

  test('⚠️ the two speed multipliers come from fields whose names do not match their use', () => {
    // `ThrowSpeedMult1 = Kicker.Boost` and `ThrowSpeedMult2 = Kicker.ThrowBallMult * 0.01`. Reading
    // them by name — a `throwBallMult` into the first multiplier — would throw the ball at five
    // hundredths of the speed it should have, and the ball would dribble out of every hole.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    b.sinks.get('v_sink1')!.scheduleRelease();
    b.clock.advance(2.1);

    const thrown = b.born[0]!.throws[0]!;
    expect(thrown.speedMult1, 'record 402, the boost').toBe(35);
    expect(thrown.speedMult2, 'record 403, divided by a hundred').toBeCloseTo(0.05, 10);
    expect(thrown.angleMult, 'record 405').toBe(0);
    expect(thrown.direction.x).toBeCloseTo(1, 6);
    expect(thrown.direction.y).toBeCloseTo(1, 6);
  });

  test('⚠️ and the direction is each hole\u2019s own — v_sink2 throws the other way', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    b.sinks.get('v_sink2')!.scheduleRelease();
    b.clock.advance(2.1);

    expect(b.born[0]!.throws[0]!.direction.y).toBeCloseTo(-1, 6);
  });

  test('⚠️ the returned ball starts with its collisions OFF', () => {
    // It has to leave the mouth of the sink before the grid can touch it; otherwise it collides with
    // the very hole it is being born inside, on the frame it is born.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    b.sinks.get('v_sink1')!.scheduleRelease();
    b.clock.advance(2.1);

    expect(b.born[0]!.collisionDisabled).toBe(true);
  });

  test('⚠️ and it WAITS FOR ROOM rather than being born inside another ball', () => {
    // Two balls born inside each other are flung apart at a speed neither of them earned. The original
    // reschedules for half a second and asks again.
    const b = build({ occupied: 1 });
    if (!b) return expect(existsSync(DAT)).toBe(false);

    b.sinks.get('v_sink1')!.scheduleRelease();
    b.clock.advance(2.1);
    expect(b.born, 'the exit is occupied').toEqual([]);

    b.clock.advance(0.4);
    expect(b.born, 'and half a second has not passed').toEqual([]);

    b.freeTheExit();
    b.clock.advance(0.2);
    expect(b.born.length, 'now there is room').toBe(1);
  });

  test('⚠️ a negative delay means the hole\u2019s own hold time, which is how the message says "default"', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    b.sinks.get('v_sink1')!.scheduleRelease(-1);
    b.clock.advance(1.9);
    expect(b.born).toEqual([]);

    b.clock.advance(0.2);
    expect(b.born.length).toBe(1);
  });

  test('⚠️ and swallowing sounds exactly like giving back, because the file says 48 twice', () => {
    // Every one of the four carries 48 in both 1100 and 1101, so this file cannot tell the two records
    // apart — the same situation `v_bloc1` is in. Asserting a difference would be asserting a wish.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const { ball } = ballThatCanBeDisabled();

    b.sinks.get('v_sink1')!.collision(ball, { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);
    b.sinks.get('v_sink1')!.scheduleRelease();
    b.clock.advance(2.1);

    expect(b.played).toEqual([48, 48]);
  });
});
