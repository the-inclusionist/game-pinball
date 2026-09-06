// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createFlagSpinner } from '../app/js/table/flag-spinner.js';
import { buildOriginalFlags, flagNames } from '../app/js/table/original-flags.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { loadTable } from '../app/js/dat/loader.js';

/**
 * ⚠️ THE TWO FLAGS ARE SPINNERS, AND THE BALL GOES THROUGH THEM.
 *
 * `TFlagSpinner::Collision` moves the ball to the contact point, marks the edge and returns: no bounce
 * anywhere in it. What the collision does instead is set the spinner turning, at twenty times the
 * ball's speed, and the spin decays by a third on every frame until it falls under five.
 *
 * Until this existed `a_flag1` was an ordinary wall — a horizontal segment at y = -4.74 running from
 * x 6.5 to 7.5 — and the ball came to rest ON it, at (7.0, -5.07), drifting at a quarter of a unit a
 * second for the rest of the game. Two of six seeded minutes of play ended that way.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

function fakeTimers() {
  const pending = new Map<number, { at: number; run: () => void }>();
  let next = 1;
  let now = 0;
  return {
    pending,
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

const spinningBall = () => {
  const seen: unknown[] = [];
  return {
    position: { x: 0, y: 0 }, direction: { x: 0, y: 1 }, speed: 6,
    memory: { record: (edge: unknown) => { seen.push(edge); } },
    seen,
  };
};

describe('a flag, which is a spinner', () => {
  function build(o: { tilt?: boolean } = {}) {
    const clock = fakeTimers();
    const spun: number[] = [];
    const loops: number[] = [];
    const played: number[] = [];
    const frames: number[] = [];
    const spinner = createFlagSpinner({
      table: { tiltLocked: o.tilt ?? false },
      timer: clock.service,
      frameCount: 8,
      minSpeed: 5, maxSpeed: 50000, speedDecrement: 0.65,
      softHitSoundId: 64,
      sound: { play: (id) => played.push(id) },
      previousCollider: 'prev',
      onSpin: () => spun.push(1),
      onLoopReset: () => loops.push(1),
      setSprite: (index) => frames.push(index),
    });
    return { spinner, clock, spun, loops, played, frames };
  }

  test('⚠️ the ball goes THROUGH: its speed and heading are untouched', () => {
    const b = build();
    const ball = spinningBall();

    b.spinner.collision(ball, { x: 3, y: 4 }, { x: 0, y: 1 }, 0, 'first');

    expect(ball.speed, 'a spinner takes nothing from the ball').toBe(6);
    expect(ball.direction).toEqual({ x: 0, y: 1 });
    expect(ball.position).toEqual({ x: 3, y: 4 });
    expect(ball.seen, 'and the edge is marked').toEqual(['first']);
  });

  test('⚠️ WHICH EDGE WAS HIT DECIDES WHICH WAY IT SPINS', () => {
    // `SpinDirection = 2 * (PrevCollider != edge) - 1`: plus one from one face, minus one from the
    // other. The two lines are the same segment wound opposite ways, so the direction of the spin is
    // the direction the ball crossed — and reading it the other way makes every flag turn backwards.
    const b = build();

    b.spinner.collision(spinningBall(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, 'other');
    expect(b.frames.at(-1), 'forward from the other edge').toBe(1);

    const back = build();
    back.spinner.collision(spinningBall(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, 'prev');
    expect(back.frames.at(-1), 'and backward from the previous collider').toBe(7);
  });

  test('⚠️ the spin is twenty times the ball’s speed, and it decays by a third a frame', () => {
    // `Speed = ball->Speed * 20`, then `Speed *= 0.65` after every frame, and the spinner stops when
    // it falls under the minimum. A spinner that did not decay would turn for ever off one hit.
    const b = build();

    b.spinner.collision(spinningBall(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, 'other');
    const first = b.frames.length;
    // ⚠️ IN STEPS. Each frame arms the next from the moment it runs, so a single jump past the whole
    // spin fires exactly one of them — the same trap the barrier's two deadlines set.
    for (let i = 0; i < 200; i++) b.clock.advance(0.05);

    expect(b.frames.length, 'it turned more than once').toBeGreaterThan(first);
    expect(b.frames.length, 'and it stopped').toBeLessThan(40);
    expect(b.clock.pending.size, 'with no timer left').toBe(0);
  });

  test('⚠️ a ball at a standstill still turns it, at the MINIMUM speed', () => {
    // `if (ball->Speed == 0) Speed = MinSpeed`. A ball resting against a spinner nudges it rather than
    // dividing by zero, which is what `1 / Speed` would do.
    const b = build();
    const still = { ...spinningBall(), speed: 0 };

    b.spinner.collision(still, { x: 0, y: 0 }, { x: 0, y: 1 }, 0, 'other');

    expect(b.frames.length).toBeGreaterThan(0);
  });

  test('⚠️ coming back round to the first picture is its own message', () => {
    // `if (!BmpIndex) control::handler(ControlSpinnerLoopReset)`. A full turn is what the control layer
    // counts, and it is a different message from the hit.
    const b = build();

    b.spinner.collision(spinningBall(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, 'other');
    for (let i = 0; i < 200; i++) b.clock.advance(0.05);

    expect(b.spun.length, 'every frame is a hit').toBeGreaterThan(1);
    expect(b.loops.length, 'and the whole turns are counted apart').toBeGreaterThanOrEqual(1);
  });

  test('⚠️ a TILTED table lets the ball through and says nothing', () => {
    const b = build({ tilt: true });
    const ball = spinningBall();

    b.spinner.collision(ball, { x: 3, y: 4 }, { x: 0, y: 1 }, 0, 'other');

    expect(ball.position, 'through it goes').toEqual({ x: 3, y: 4 });
    expect(b.spun).toEqual([]);
    expect(b.played).toEqual([]);
  });
});

describe('the two flags of the 1995 table', () => {
  function build() {
    const table = manifest();
    if (!table) return null;
    const names = flagNames(table);
    const geometry = buildOriginalTable(table.groups, { skipWall: (name) => names.has(name) });
    const clock = fakeTimers();
    const spun: string[] = [];
    const flags = buildOriginalFlags(table, {
      table: { tiltLocked: false },
      grid: geometry.grid,
      timer: clock.service,
      onSpin: (name) => spun.push(name),
    });
    return { table, names, geometry, flags, clock, spun };
  }

  test('both are built, and the wall loop no longer installs them', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect([...b.flags.keys()].sort()).toEqual(['a_flag1', 'a_flag2']);
    for (const name of b.flags.keys()) {
      expect(b.geometry.wallGroups.includes(name), name).toBe(false);
    }
  });

  test('⚠️ each is TWO lines on one segment, wound opposite ways and offset by NOTHING', () => {
    // `new TLine(this, ..., start, end)` and then `(end, start)`, neither pushed out by the ball's
    // radius. Line collision is one-sided, so the pair answers both faces — and an offset would move
    // the flag half a ball off the segment the archive drew.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const flag = b.flags.get('a_flag1')!;

    // Record 600 is [2, 6.5064, -4.7393, 7.5079, -4.7393, -1].
    const first = flag.lines[0] as unknown as { x0: number; y0: number; x1: number; y1: number };
    const second = flag.lines[1] as unknown as { x0: number; y0: number; x1: number; y1: number };

    expect(first.x0).toBeCloseTo(7.5079, 3);
    expect(first.x1).toBeCloseTo(6.5064, 3);
    expect(second.x0).toBeCloseTo(6.5064, 3);
    expect(second.x1).toBeCloseTo(7.5079, 3);
    expect(first.y0).toBeCloseTo(-4.7393, 3);
  });

  test('⚠️ and the three speeds come from records 1200, 1201 and 1202', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const flag = b.flags.get('a_flag1')!;

    expect(flag.maxSpeed).toBe(50000);
    expect(flag.minSpeed).toBe(5);
    expect(flag.speedDecrement).toBeCloseTo(0.65, 6);
  });

  test('⚠️ and the SECOND line is the one that turns it backwards', () => {
    // `PrevCollider` is the second `TLine` the constructor makes. Point it at the first and every flag
    // on the table spins the wrong way for a given crossing — which is invisible in a still picture
    // and wrong in every frame of a moving one.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const flag = b.flags.get('a_flag1')!;
    const ball = () => ({
      position: { x: 0, y: 0 }, direction: { x: 0, y: 1 }, speed: 6,
      memory: { record: () => {} },
    });

    flag.collision(ball(), { x: 7, y: -4.74 }, { x: 0, y: 1 }, 0, flag.lines[1]);

    expect(flag.frameIndex, 'backwards, off the previous collider').toBe(7);
  });

  test('⚠️ and the FIRST line turns it forwards', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const flag = b.flags.get('a_flag2')!;

    flag.collision(
      { position: { x: 0, y: 0 }, direction: { x: 0, y: 1 }, speed: 6, memory: { record: () => {} } },
      { x: -4.6, y: -2.5 }, { x: 0, y: 1 }, 0, flag.lines[0],
    );

    expect(flag.frameIndex).toBe(1);
  });

  test('⚠️ both lines are in the grid, or the ball sails past the flag', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const inGrid = new Set<unknown>();
    for (let x = 0; x < 10; x++) for (let y = 0; y < 15; y++) {
      for (const edge of b.geometry.grid.edgesInBox(x, y)) inGrid.add(edge);
    }

    for (const [name, flag] of b.flags) {
      for (const line of flag.lines) expect(inGrid.has(line), name).toBe(true);
    }
  });
});
