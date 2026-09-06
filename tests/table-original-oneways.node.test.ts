// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { buildOriginalOneways, onewayNames, PASSING_OFFSET } from '../app/js/table/original-oneways.js';
import { buildOriginalTable, WALL_RECORD } from '../app/js/table/original.js';
import { floatAttribute } from '../app/js/dat/attributes.js';
import { loadTable } from '../app/js/dat/loader.js';

/**
 * ⚠️ A ONE-WAY IS ONE WALL RECORD AND TWO LINES, AND NEITHER IS THE ONE THE TABLE WOULD BUILD.
 *
 * The same two points wound both ways: the blocking line runs pt2 to pt1 offset by the ball's radius,
 * the passing line runs pt1 to pt2 offset by four fifths of it. Line collision is one-sided, so each
 * answers only a ball arriving from its own face — and because the winding is reversed, the two
 * offsets push the lines to OPPOSITE sides of the points they share.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

function build() {
  const table = manifest();
  if (!table) return null;
  const names = onewayNames(table);
  const passed: string[] = [];
  const blocked: string[] = [];
  const played: number[] = [];
  const geometry = buildOriginalTable(table.groups, { skipWall: (name) => names.has(name) });
  const oneways = buildOriginalOneways(table, {
    table: { tiltLocked: false },
    grid: geometry.grid,
    ballRadius: geometry.ballRadius,
    sound: { play: (id) => played.push(id) },
    onPass: (name) => passed.push(name),
    onBlocked: (name) => blocked.push(name),
  });
  return { table, names, geometry, oneways, passed, blocked, played };
}

/** The two points of a named one-way, straight out of the archive — the oracle the edges are measured against. */
function rawSegment(table: NonNullable<ReturnType<typeof manifest>>, name: string) {
  const index = table.groups.findIndex((group) => group?.name === name);
  const data = floatAttribute(table.groups[index]!, WALL_RECORD)!;
  return { x0: data[1]!, y0: data[2]!, x1: data[3]!, y1: data[4]! };
}

const midpoint = (s: { x0: number; y0: number; x1: number; y1: number }) =>
  ({ x: (s.x0 + s.x1) / 2, y: (s.y0 + s.y1) / 2 });

/** A ball that records the edges it has already met, which is what stops a pass counting twice. */
function ballAt(x: number, y: number) {
  const seen: unknown[] = [];
  return {
    position: { x, y }, direction: { x: 0, y: -1 }, speed: 10,
    memory: { record: (edge: unknown) => { seen.push(edge); } },
    seen,
  };
}

describe('the nine one-way gates', () => {
  test('all nine are built, and the table did not build them as plain walls', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect(b.names.size).toBe(9);
    expect(b.oneways.size).toBe(9);
    // Skipped by the wall loop: nine fewer than the hundred and forty-three it used to install.
    expect(b.geometry.wallCount).toBe(134);
  });

  test('⚠️ and the two chutes the skill shot uses are among them', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect(b.oneways.has('s_onewy4'), 'the payout chute').toBe(true);
    expect(b.oneways.has('s_onewy10'), 'the one that throws the run away').toBe(true);
  });

  test('⚠️ the two lines are the SAME two points wound in opposite directions', () => {
    // Wind them the same way and both lines answer a ball arriving from the same face: the gate stops
    // being a one-way and becomes a doubled wall the ball can never cross.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const gate = b.oneways.get('s_onewy4')!;
    const raw = rawSegment(b.table, 's_onewy4');

    const pass = { x: gate.passingEdge.x1 - gate.passingEdge.x0, y: gate.passingEdge.y1 - gate.passingEdge.y0 };
    const block = { x: gate.blockingEdge.x1 - gate.blockingEdge.x0, y: gate.blockingEdge.y1 - gate.blockingEdge.y0 };

    // ⚠️ THE BLOCKING LINE RUNS THE RECORD'S OWN WAY, and the passing line runs back along it.
    // `TOneway`'s constructor names the FIRST pair `linePt2` and the SECOND `linePt1`, then builds
    // `TLine(linePt2, linePt1)` — the file's order — as the wall. This was the other way round, so
    // every one-way on the table blocked the face it should have opened; the launch lane's `s_onewy1`
    // among them, which is why no ball this port ever fired left the lane.
    expect(block.x).toBeCloseTo(raw.x1 - raw.x0, 6);
    expect(block.y).toBeCloseTo(raw.y1 - raw.y0, 6);
    expect(pass.x).toBeCloseTo(-block.x, 6);
    expect(pass.y).toBeCloseTo(-block.y, 6);
  });

  test('⚠️ and the two offsets are NOT equal: four fifths one side, a whole radius the other', () => {
    // Offset them by the same amount and the two lines land the same distance apart on either side —
    // a ball arriving at a shallow angle can clip the blocking line on its way out and be thrown back
    // through a gate it had already crossed. The passing side has to sit nearer.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const gate = b.oneways.get('s_onewy4')!;
    const centre = midpoint(rawSegment(b.table, 's_onewy4'));
    const radius = b.geometry.ballRadius;

    const toPass = { x: midpoint(gate.passingEdge).x - centre.x, y: midpoint(gate.passingEdge).y - centre.y };
    const toBlock = { x: midpoint(gate.blockingEdge).x - centre.x, y: midpoint(gate.blockingEdge).y - centre.y };

    expect(Math.hypot(toPass.x, toPass.y)).toBeCloseTo(radius * PASSING_OFFSET, 6);
    expect(Math.hypot(toBlock.x, toBlock.y)).toBeCloseTo(radius, 6);
    // ⚠️ AND THE SAME SIDE, WHICH IS THE WHOLE POINT OF THE FOUR FIFTHS. Reversing the winding flips
    // the perpendicular and `Offset(-CollisionCompOffset * 0.8f)` flips it back, so both lines land on
    // one side of the segment with the passing line NEARER. That is what puts the pass in front of the
    // bounce for a ball arriving at the open face. Sent to opposite sides — which is what dropping the
    // minus sign does — the wall is the one the ball meets first and the gate never opens.
    expect(toPass.x * toBlock.x + toPass.y * toBlock.y).toBeGreaterThan(0);
  });

  test('⚠️ the ball is let through the passing edge and the crossing is reported', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const gate = b.oneways.get('s_onewy4')!;
    const ball = ballAt(0, 0);

    gate.passingEdge.component.collision(ball, { x: 1, y: 2 }, { x: 0, y: 1 }, 0, gate.passingEdge);

    expect(ball.speed, 'a pass never touches the speed').toBe(10);
    expect(ball.position).toEqual({ x: 1, y: 2 });
    expect(ball.seen, 'marked, so the same frame does not cross it twice').toEqual([gate.passingEdge]);
    expect(b.passed).toEqual(['s_onewy4']);
    expect(b.blocked, 'a pass is not a block').toEqual([]);
  });

  test('⚠️ and the blocking edge bounces it, reporting a block and no crossing', () => {
    // The component routes by EDGE IDENTITY. Route by anything else — the ball, the distance, a flag —
    // and the two faces of the gate stop being told apart.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const gate = b.oneways.get('s_onewy4')!;
    const ball = ballAt(0, 0);

    gate.blockingEdge.component.collision(ball, { x: 1, y: 2 }, { x: 0, y: 1 }, 0, gate.blockingEdge);

    expect(ball.speed, 'a bounce, not a pass').toBeLessThan(10);
    expect(b.blocked).toEqual(['s_onewy4']);
    expect(b.passed, 'a block is not a crossing').toEqual([]);
  });

  test('⚠️ every one of the nine is registered in the grid, both of its lines', () => {
    // A line that is not placed in the grid is never tested against: the gate would be invisible and
    // the ball would sail through both ways.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const inGrid = new Set<unknown>();
    for (let x = 0; x < 10; x++) for (let y = 0; y < 15; y++) {
      for (const edge of b.geometry.grid.edgesInBox(x, y)) inGrid.add(edge);
    }

    for (const [name, gate] of b.oneways) {
      expect(inGrid.has(gate.passingEdge), `${name} passing line`).toBe(true);
      expect(inGrid.has(gate.blockingEdge), `${name} blocking line`).toBe(true);
    }
  });
});
