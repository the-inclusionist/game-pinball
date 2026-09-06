// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  buildOriginalRamps, findClosestEdge, PLANE_FLOATS,
} from '../app/js/table/original-ramps.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { planeBounds, boundsCorrected } from '../app/js/table/ramp.js';
import { loadTable } from '../app/js/dat/loader.js';

/**
 * ⚠️ A RAMP IS THE ONLY THING ON THIS TABLE THAT IS NOT MADE OF WALL RECORDS.
 *
 * `ramp` and `s_ramp9` carry no record 600 at all, so the wall loop never saw them and the two ramps
 * were simply absent — the ball could not ride either of them. What they carry instead is record 1300:
 * a count and then a run of TRIANGLES, each with its own plane equation and its own gravity.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

/** A ball as a ramp meets it: it needs a heading and a speed before a ramp's drag means anything. */
function rampBall(at: { x: number; y: number }) {
  return {
    position: { x: at.x, y: at.y, z: 0 },
    direction: { x: 1, y: 0 }, speed: 5, radius: 0.25,
    collisionMask: 1, collisionFlag: false,
    collisionOffset: { x: 0, y: 0, z: 0 },
    rampFieldForce: { x: 0, y: 0 },
    memory: { record: () => {} },
  };
}

function build() {
  const table = manifest();
  if (!table) return null;
  const entered: string[] = [];
  const geometry = buildOriginalTable(table.groups);
  const ramps = buildOriginalRamps(table, {
    table: { tiltLocked: false },
    grid: geometry.grid,
    gravityMult: 1,
    onEnter: (name) => entered.push(name),
  });
  return { table, geometry, ramps, entered };
}

describe('the two ramps, which are triangles and not walls', () => {
  test('both are built, and neither was ever in the wall loop', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect([...b.ramps.keys()].sort()).toEqual(['ramp', 's_ramp9']);
    for (const name of b.ramps.keys()) {
      expect(b.geometry.wallGroups.includes(name), `${name} has no record 600`).toBe(false);
    }
  });

  test('⚠️ a plane is THIRTEEN floats and the first three are a PLANE EQUATION, not a vertex', () => {
    // `z = x * offset.x + y * offset.y + radius + offset.z`. Read as a point it is a vertex near the
    // origin, and every triangle would be the wrong shape while still being a triangle.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const ramp = b.ramps.get('ramp')!;

    expect(PLANE_FLOATS).toBe(13);
    expect(ramp.planes.length, 'the count is the record’s own first float').toBe(18);
    expect(b.ramps.get('s_ramp9')!.planes.length).toBe(2);

    const first = ramp.planes[0]!;
    expect(first.ballCollisionOffset.x).toBeCloseTo(0.004391, 6);
    expect(first.ballCollisionOffset.y).toBeCloseTo(0.005337, 6);
    expect(first.ballCollisionOffset.z, 'about a unit above the playfield').toBeCloseTo(1.051996, 5);
    expect(first.v1.x).toBeCloseTo(4.394761, 5);
    expect(first.v1.y).toBeCloseTo(-0.676098, 5);
    expect(first.gravityAngle1).toBeCloseTo(0.006914, 6);
    expect(first.gravityAngle2).toBeCloseTo(-2.259304, 5);
  });

  test('⚠️ the collision groups are ONE SHIFTED, not the number in the file', () => {
    // `1 << floor(arr[0])`. The mask is a set of bits and the file stores which bit, so reading the
    // number straight puts the ramp in world 2 instead of world 4 — and two ramps that should never
    // see each other's walls start sharing them.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const ramp = b.ramps.get('ramp')!;

    // `ramp`'s record 1303 opens with 2, and 1301 with 0, and 1302 with 2.
    expect(ramp.entryCollisionGroup).toBe(1 << 2);
    expect(ramp.wall1CollisionGroup).toBe(1 << 0);
    expect(ramp.wall2CollisionGroup).toBe(1 << 2);
  });

  test('⚠️ the entry line runs BACKWARDS from the record — Pt1 to Pt0', () => {
    // `new TLine(this, ..., wall0Pts->Pt1, wall0Pts->Pt0)`. Line collision is one-sided, so a line
    // wound the other way answers the other face: the ball would enter the ramp from the wrong side.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const line = b.ramps.get('ramp')!.entryLine as unknown as { x0: number; y0: number; x1: number; y1: number };

    // Record 1303 is [2, 2, 6.684728, -1.751842, 6.117420, -0.918833, -1].
    expect(line.x0, 'starts at Pt1').toBeCloseTo(6.117420, 5);
    expect(line.y0).toBeCloseTo(-0.918833, 5);
    expect(line.x1, 'and ends at Pt0').toBeCloseTo(6.684728, 5);
    expect(line.y1).toBeCloseTo(-1.751842, 5);
  });

  test('⚠️ the two boundary lines are SNAPPED to a triangle edge, not taken from the record', () => {
    // `find_closest_edge` walks every edge of every triangle and keeps the one whose two ends are
    // nearest the record's two points. The record is a HINT; the line that is built is the mesh's own
    // edge, so the boundary can never fall a hair off the surface it is supposed to divide.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const ramp = b.ramps.get('ramp')!;
    const wall1 = ramp.wall1Line as unknown as { x0: number; y0: number };

    // Record 1301's own first point is (3.267362, 1.277511) and no triangle has a vertex there.
    expect(wall1.x0).not.toBeCloseTo(3.267362, 3);
    const vertices = ramp.planes.flatMap((plane) => [plane.v1, plane.v2, plane.v3]);
    expect(vertices.some((v) => Math.hypot(v.x - wall1.x0, v.y - wall1.y0) < 1e-6),
      'it is a vertex of the mesh').toBe(true);
  });

  test('⚠️ every triangle edge carries ITS OWN plane, and the three named lines carry none', () => {
    // The plane on the edge is how the ball learns which world it has just entered: crossing an edge
    // adopts that triangle's equation and gravity. A named boundary carries null, which is what tells
    // the component to hand the ball to another collision group instead.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const ramp = b.ramps.get('ramp')!;

    expect(ramp.planeEdges.length).toBeGreaterThan(0);
    for (const edge of ramp.planeEdges) expect(edge.plane).not.toBe(null);
    for (const line of [ramp.entryLine, ramp.wall1Line, ramp.wall2Line]) {
      expect((line as unknown as { plane: unknown }).plane).toBe(null);
    }
  });

  test('⚠️ and a triangle edge that IS a DISABLED boundary gets no line at all', () => {
    // The constructor asks, for each of the three edges of each triangle, whether it coincides with
    // wall one's or wall two's edge; if it does and that wall's second float is zero the edge is
    // SKIPPED entirely. That hole in the mesh is how the ball leaves the ramp.
    //
    // The long ramp has both of its boundaries enabled and so keeps every edge; the short one has
    // wall 1 disabled — record 1301 opens [0, 0] — and is one edge short. Reading the ENABLED flag as
    // part of the collision group, or ignoring it, closes that hole and the ball can never get off.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const long = b.ramps.get('ramp')!;
    const short = b.ramps.get('s_ramp9')!;

    expect(long.planeEdges.length, 'both boundaries enabled').toBe(long.planes.length * 3);
    expect(short.planeEdges.length, 'wall one disabled: one edge missing')
      .toBe(short.planes.length * 3 - 1);
  });

  test('⚠️ every line the ramp made is in the grid, or the ball rides through the mesh', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const inGrid = new Set<unknown>();
    for (let x = 0; x < 10; x++) for (let y = 0; y < 15; y++) {
      for (const edge of b.geometry.grid.edgesInBox(x, y)) inGrid.add(edge);
    }

    for (const [name, ramp] of b.ramps) {
      for (const edge of ramp.planeEdges) expect(inGrid.has(edge), `${name} plane edge`).toBe(true);
      expect(inGrid.has(ramp.entryLine), `${name} entry`).toBe(true);
      expect(inGrid.has(ramp.wall1Line), `${name} wall 1`).toBe(true);
      expect(inGrid.has(ramp.wall2Line), `${name} wall 2`).toBe(true);
    }
  });

  test('⚠️ the drag and the Z pin come from the file, with the original’s own defaults', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect(b.ramps.get('ramp')!.ballFieldMult, 'record 701').toBeCloseTo(0.2, 6);
    expect(b.ramps.get('ramp')!.ballZOffsetFlag, 'record 1305 — the long ramp does not pin Z').toBe(false);
    expect(b.ramps.get('s_ramp9')!.ballZOffsetFlag, 'and the short one does').toBe(true);
  });
});

describe('⚠️ a ramp’s gravity reaches only where the ramp is', () => {
  test('the field is registered over the ramp’s own boxes, and asked by the ball’s box alone', () => {
    // Both ramps carry collision group 2, so the MASK alone cannot tell them apart — the box is what
    // does. A flat list of every field on the table would give a ball on one ramp the other's gravity
    // as well, and the two are at opposite ends of the playfield.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const short = b.ramps.get('s_ramp9')!;
    const ball = rampBall(short.planes[0]!.v1);

    // Cross a triangle edge first: that is what puts the ball in the ramp's world and hands it the
    // triangle's gravity. Asking the field of a ball that never crossed is asking about nothing.
    short.planeEdges[0]!.component.collision(
      ball, { x: ball.position.x, y: ball.position.y }, { x: 0, y: 1 }, 0, short.planeEdges[0],
    );
    expect(ball.collisionMask, 'in the ramp’s world now').toBe(2);
    const pull = { x: 0, y: 0 };

    b.geometry.grid.fieldEffects(ball, pull);

    // The short ramp's first triangle is FLAT — its steepness is zero — so all that is left is the
    // drag: a fifth of the ball's own velocity, against it.
    expect(pull.x).toBeCloseTo(-1 * 5 * 0.2, 6);
    expect(pull.y).toBeCloseTo(0, 6);
  });

  test('⚠️ and a ball that has not crossed onto it is in another world', () => {
    // A free ball's mask is 1 and a ramp's group is 2. The mask IS which set of walls the ball can
    // see, and a ball that never crossed a triangle edge never adopted the ramp's.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const short = b.ramps.get('s_ramp9')!;
    const free = rampBall(short.planes[0]!.v1);
    const pull = { x: 0, y: 0 };

    b.geometry.grid.fieldEffects(free, pull);

    expect(pull).toEqual({ x: 0, y: 0 });
  });

  test('⚠️ the box comes from the SIC bounds, defect and all', () => {
    // `TRamp`'s constructor folds three of its four accumulators against `xMin`, and the upstream
    // marks the line `// Sic`. For the long ramp that is not harmless: the box it registers over is a
    // patch of the ramp rather than the whole of it, so the ball feels the ramp's gravity on part of
    // its own surface and not on the rest. Transcribed, because correcting it changes how the table
    // plays — and stated here so the difference can be measured rather than argued about.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const ramp = b.ramps.get('ramp')!;

    const sic = planeBounds(ramp.planes);
    const corrected = boundsCorrected(ramp.planes);
    expect(sic.yMin, 'the Sic box starts above the ramp’s lowest triangle')
      .toBeGreaterThan(corrected.yMin);
    expect(sic.xMax, 'and stops short of its rightmost').toBeLessThan(corrected.xMax);
  });
});

describe('finding the mesh edge a boundary means', () => {
  test('it keeps the edge whose two ENDS are nearest the two given points, in order', () => {
    // The sum of the two distances, end to end. Comparing without the order — nearest point to
    // nearest point — would happily pick an edge running the wrong way, and a backwards boundary
    // answers the wrong face.
    const planes = [{
      v1: { x: 0, y: 0 }, v2: { x: 10, y: 0 }, v3: { x: 0, y: 10 },
      ballCollisionOffset: { x: 0, y: 0, z: 0 },
      gravityAngle1: 0, gravityAngle2: 0, fieldForce: { x: 0, y: 0 },
    }];

    const found = findClosestEdge(planes, { x: 9.9, y: 0.1 }, { x: 0.1, y: 9.9 });

    expect(found.end).toEqual({ x: 10, y: 0 });
    expect(found.start).toEqual({ x: 0, y: 10 });
  });

  test('⚠️ and the SECOND point is measured against the second vertex, not the first', () => {
    // Two points landing exactly on the third edge's ends: the ordered sum is zero and nothing can
    // beat it. Measure both against the first vertex instead and every edge of this triangle scores
    // ten, so the FIRST one wins and the boundary comes back running along a different side.
    const planes = [{
      v1: { x: 0, y: 0 }, v2: { x: 10, y: 0 }, v3: { x: 0, y: 10 },
      ballCollisionOffset: { x: 0, y: 0, z: 0 },
      gravityAngle1: 0, gravityAngle2: 0, fieldForce: { x: 0, y: 0 },
    }];

    const found = findClosestEdge(planes, { x: 0, y: 10 }, { x: 0, y: 0 });

    expect(found.end).toEqual({ x: 0, y: 10 });
    expect(found.start).toEqual({ x: 0, y: 0 });
  });
});
