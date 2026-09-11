// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { buildOriginalRollovers, rolloverNames } from '../app/js/table/original-rollovers.js';
import { buildOriginalTable, WALL_RECORD } from '../app/js/table/original.js';
import { floatAttribute } from '../app/js/dat/attributes.js';
import { loadTable } from '../app/js/dat/loader.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ EIGHTEEN LANES THE BALL IS MEANT TO ROLL ACROSS, AND THE TABLE WAS BUILDING WALLS IT BOUNCED OFF.
 *
 * `TRollover`'s constructor passes `createWall = false` and calls `build_walls` itself: record 600
 * against `ActiveFlag` — the entry boundary, live from the start — and record 603 against
 * `RolloverFlag`, which starts CLEAR. The way out of the lane does not exist until the ball is on it.
 * The whole "am I on the lane?" state is which edges the collision search can see.
 */

const DAT = resource('PINBALL.DAT');
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

function build(o: { tilt?: boolean } = {}) {
  const table = manifest();
  if (!table) return null;
  const names = rolloverNames(table);
  const clock = fakeTimers();
  const entered: string[] = [];
  const played: number[] = [];
  const geometry = buildOriginalTable(table.groups, { skipWall: (name) => names.has(name) });
  const rollovers = buildOriginalRollovers(table, {
    table: { tiltLocked: o.tilt ?? false },
    grid: geometry.grid,
    timer: clock.service,
    sound: { play: (id) => played.push(id) },
    onEnter: (name) => entered.push(name),
  });
  return { table, names, geometry, rollovers, clock, entered, played };
}

/** A ball as a lane meets it: it is moved, and nothing else about it may change. */
function rollingBall() {
  const seen: unknown[] = [];
  return {
    position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed: 7,
    memory: { record: (edge: unknown) => { seen.push(edge); } },
    seen,
  };
}

describe('the eighteen lanes the ball rolls across', () => {
  test('⚠️ all eighteen are built — seventeen ordinary and the one green', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect(b.rollovers.size).toBe(18);
    expect(b.rollovers.has('a_roll1')).toBe(true);
    expect(b.rollovers.has('a_roll9'), 'the green one is a rollover too').toBe(true);
  });

  test('⚠️ and the table did not build them as walls the ball bounces off', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect(b.names.size).toBe(18);
    // Eighteen fewer than the hundred and forty-three the wall loop installs when it is told to skip
    // nothing. (The demonstration skips the nine one-ways as well, and lands on a hundred and sixteen.)
    expect(b.geometry.wallCount).toBe(125);
  });

  test('⚠️ BOTH boundaries are installed with offset ZERO, not the ball’s radius', () => {
    // Every other wall is pushed out by a radius so the ball can be treated as a point. A lane
    // boundary is not: it is a line the ball's CENTRE crosses. Offset it and the trip point moves half
    // a ball early going in and half a ball late coming out.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const lane = b.rollovers.get('a_roll1')!;
    const index = b.table.groups.findIndex((group) => group?.name === 'a_roll1');
    const raw = floatAttribute(b.table.groups[index]!, WALL_RECORD)!;

    const edge = lane.entryEdges[0] as unknown as { x0: number; y0: number };
    expect(edge.x0).toBeCloseTo(raw[1]!, 6);
    expect(edge.y0).toBeCloseTo(raw[2]!, 6);
  });

  test('⚠️ and the two records are ONE POLYGON WOUND BOTH WAYS, like the one-ways', () => {
    // 600 and 603 carry the same points with the same first point and the rest reversed. Line
    // collision is one-sided, so the two windings answer opposite FACES: that is what makes the way
    // out reachable only from inside the lane. Read one record for the other and both boundaries
    // answer the same face — the ball trips the way in, and can then never trip the way out.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const lane = b.rollovers.get('a_roll1')!;
    const index = b.table.groups.findIndex((group) => group?.name === 'a_roll1');
    const entryRecord = floatAttribute(b.table.groups[index]!, WALL_RECORD)!;
    const exitRecord = floatAttribute(b.table.groups[index]!, 603)!;
    expect(entryRecord[1], 'the same first point').toBeCloseTo(exitRecord[1]!, 6);

    const entry = lane.entryEdges[0] as unknown as { x1: number; y1: number };
    const exit = lane.exitEdges[0] as unknown as { x1: number; y1: number };

    expect(entry.x1, 'the way in runs the record-600 way').toBeCloseTo(entryRecord[3]!, 6);
    expect(entry.y1).toBeCloseTo(entryRecord[4]!, 6);
    expect(exit.x1, 'and the way out runs back around').toBeCloseTo(exitRecord[3]!, 6);
    expect(exit.y1).toBeCloseTo(exitRecord[4]!, 6);
    expect(entry.x1, 'which are not the same point').not.toBeCloseTo(exit.x1, 3);
  });

  test('⚠️ every lane has BOTH of its sets in the grid, or it is not there at all', () => {
    // An edge the grid does not hold is never tested against. The way out missing means a ball that
    // enters a lane can never leave it: the lane stays lit and deaf for the rest of the game.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const inGrid = new Set<unknown>();
    for (let x = 0; x < 10; x++) for (let y = 0; y < 15; y++) {
      for (const edge of b.geometry.grid.edgesInBox(x, y)) inGrid.add(edge);
    }

    for (const [name, lane] of b.rollovers) {
      expect(lane.entryEdges.every((edge) => inGrid.has(edge)), `${name} in`).toBe(true);
      expect(lane.exitEdges.every((edge) => inGrid.has(edge)), `${name} out`).toBe(true);
    }
  });

  test('⚠️ the way OUT does not exist until the ball is on the lane', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const lane = b.rollovers.get('a_roll1')!;

    expect(lane.entryEdges.every((edge) => edge.active), 'the way in is always live').toBe(true);
    expect(lane.exitEdges.some((edge) => edge.active), 'and the way out is not').toBe(false);

    lane.collision(rollingBall(), { x: 1, y: 2 }, { x: 0, y: 1 }, 0, lane.entryEdges[0]);

    expect(lane.inside).toBe(true);
    expect(lane.exitEdges.every((edge) => edge.active), 'now it does').toBe(true);
  });

  test('⚠️ rolling over is NOT colliding: the ball keeps its speed and its heading', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const lane = b.rollovers.get('a_roll1')!;
    const ball = rollingBall();

    lane.collision(ball, { x: 5, y: 6 }, { x: 0, y: 1 }, 0, lane.entryEdges[0]);

    expect(ball.speed, 'untouched').toBe(7);
    expect(ball.direction).toEqual({ x: 0, y: -1 });
    expect(ball.position).toEqual({ x: 5, y: 6 });
    expect(ball.seen, 'and marked, so the same frame does not cross it twice').toHaveLength(1);
  });

  test('⚠️ only ENTERING is announced; leaving is silent and makes the lane deaf', () => {
    // A ball hovering on the boundary would otherwise rattle the lane open and shut, and score every
    // time. The way in switches off for a tenth of a second instead.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const lane = b.rollovers.get('a_roll1')!;

    lane.collision(rollingBall(), { x: 1, y: 2 }, { x: 0, y: 1 }, 0, lane.entryEdges[0]);
    expect(b.entered).toEqual(['a_roll1']);

    lane.collision(rollingBall(), { x: 1, y: 2 }, { x: 0, y: 1 }, 0, lane.exitEdges[0]);

    expect(b.entered, 'leaving tells nobody').toEqual(['a_roll1']);
    expect(lane.entryEdges.some((edge) => edge.active), 'deaf').toBe(false);

    b.clock.advance(0.2);
    expect(lane.entryEdges.every((edge) => edge.active), 'and listening again').toBe(true);
  });

  test('⚠️ the lane borrows the SOFT-HIT sound, record 304, and has no voice of its own', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const lane = b.rollovers.get('a_roll1')!;

    lane.collision(rollingBall(), { x: 1, y: 2 }, { x: 0, y: 1 }, 0, lane.entryEdges[0]);

    expect(b.played.length, 'one sound, going in').toBe(1);
    expect(b.played[0]).toBeGreaterThan(0);
  });

  test('⚠️ a TILTED table still lets the ball across and simply does not register it', () => {
    // Toggling on tilt would leave the lane stuck open when the tilt cleared.
    const b = build({ tilt: true });
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const lane = b.rollovers.get('a_roll1')!;
    const ball = rollingBall();

    lane.collision(ball, { x: 3, y: 4 }, { x: 0, y: 1 }, 0, lane.entryEdges[0]);

    expect(ball.position, 'across it goes').toEqual({ x: 3, y: 4 });
    expect(lane.inside, 'and the lane never noticed').toBe(false);
    expect(b.entered).toEqual([]);
  });
});
