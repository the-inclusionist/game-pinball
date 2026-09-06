// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-ramps — the two ramps of the 1995 table, built from records nothing else uses.
//
// ⚠️ A RAMP IS THE ONLY THING ON THIS TABLE THAT IS NOT MADE OF WALL RECORDS. `ramp` and `s_ramp9`
// carry no record 600 at all, so the wall loop never saw them and both ramps were simply ABSENT — the
// ball could not ride either one, and nothing reported a thing, because there was nothing to report.
//
// What they carry instead is record 1300: a count, and then a run of TRIANGLES.
//
// ========================= A PLANE IS THIRTEEN FLOATS =========================
//     [0..2]  the plane EQUATION — z = x*ox + y*oy + radius + oz. Not a vertex.
//     [3..8]  the three vertices, two floats each.
//     [9,10]  how steep the triangle is, and which way it falls.
//     [11,12] the gravity vector, computed at construction and stored back into the struct.
//
// Reading the first three as a point gives a vertex near the origin and leaves every triangle the
// wrong shape while still being a triangle — nothing would fail, the ramp would simply be somewhere
// else.
//
// ========================= AND THE GROUPS ARE ONE SHIFTED =========================
// `1 << floor(arr[0])`. The collision mask is a set of BITS and the file stores which bit, so reading
// the number straight puts a ramp in world 2 where it belongs in world 4 — and two ramps that should
// never see each other's walls begin to share them.
//
// ========================= THE BOUNDARIES ARE SNAPPED TO THE MESH =========================
// Records 1301 and 1302 each name two points, and the constructor does NOT build a line from them: it
// walks every edge of every triangle and keeps the one whose two ends are nearest, END TO END. The
// record is a hint; the line that gets built is the mesh's own edge. That is what stops a boundary
// falling a hair off the surface it is meant to divide.
//
// ========================= AND THE MESH HAS DELIBERATE HOLES =========================
// For each of the three edges of each triangle the constructor asks whether it coincides with wall
// one's or wall two's edge. If it does and that wall is DISABLED, no line is built at all. Those gaps
// are how the ball leaves a ramp.

import { createRamp, computeFieldForce, type Ramp, type RampPlane, type Vector3 } from './ramp.js';
import { createLine, type LineEdge } from '../physics/edges.js';
import { insertFieldSquare, placeLineInGrid, type EdgeManager } from '../physics/grid.js';
import { readVisual } from '../dat/visual.js';
import { floatAttribute } from '../dat/attributes.js';
import type { Vector2 } from '../maths/maths.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import { ObjectType, type Table } from '../dat/loader.js';

/** Record 1300's stride. See this module's header for what each float is. */
export const PLANE_FLOATS = 13;
/** `loader::query_float_attribute(groupIndex, 0, 701, 0.2f)` — the original's own default. */
const DEFAULT_BALL_FIELD_MULT = 0.2;

const BALL_FIELD_MULT_RECORD = 701;
const PLANES_RECORD = 1300;
const WALL1_RECORD = 1301;
const WALL2_RECORD = 1302;
const ENTRY_RECORD = 1303;
const Z_OFFSET_FLAG_RECORD = 1305;

/** A line of the mesh, carrying the plane it bounds — or null for one of the three named boundaries. */
export interface RampLine extends LineEdge {
  plane: RampPlane | null;
}

export interface InstalledRamp extends Ramp {
  readonly planes: readonly RampPlane[];
  /** The triangle edges, which are what put the ball on a plane. */
  readonly planeEdges: readonly RampLine[];
  readonly entryLine: RampLine;
  readonly wall1Line: RampLine;
  readonly wall2Line: RampLine;
  readonly entryCollisionGroup: number;
  readonly wall1CollisionGroup: number;
  readonly wall2CollisionGroup: number;
  readonly ballFieldMult: number;
  readonly ballZOffsetFlag: boolean;
}

export interface OriginalRampOptions {
  readonly table: TableState;
  readonly grid: EdgeManager;
  /** `TableG->GravityDirVectMult`, which every triangle's gravity is scaled by. */
  readonly gravityMult: number;
  readonly sound?: SoundPlayer;
  /** The ball crossing the entry line. `LaunchRampControl` counts these. */
  readonly onEnter?: (groupName: string) => void;
}

const same = (a: Vector2, b: Vector2): boolean => a.x === b.x && a.y === b.y;

/**
 * `maths::find_closest_edge`. The sum of the two distances, END TO END: the first point is measured
 * against the edge's first vertex and the second against its second.
 *
 * ⚠️ THE ORDER IS THE POINT. Comparing nearest-point-to-nearest-point would happily pick the same
 * edge running the other way, and line collision is one-sided — a backwards boundary answers the
 * wrong face and the ball is handed to another world from the side it was already on.
 */
export function findClosestEdge(
  planes: readonly RampPlane[], pt0: Vector2, pt1: Vector2,
): { end: Vector2; start: Vector2 } {
  let best = 1e9;
  let end: Vector2 = { x: 0, y: 0 };
  let start: Vector2 = { x: 0, y: 0 };

  for (const plane of planes) {
    const order = [plane.v1, plane.v2, plane.v3, plane.v1];
    for (let pt = 0; pt < 3; pt++) {
      const point1 = order[pt]!;
      const point2 = order[pt + 1]!;
      const distance = Math.hypot(pt0.x - point1.x, pt0.y - point1.y)
        + Math.hypot(pt1.x - point2.x, pt1.y - point2.y);
      if (distance < best) {
        best = distance;
        end = point1;
        start = point2;
      }
    }
  }

  return { end, start };
}

/** Record 1300 read as `count` and then a run of thirteen-float triangles. */
function readPlanes(data: readonly number[]): RampPlane[] {
  const count = Math.floor(data[0] ?? 0);
  const planes: RampPlane[] = [];

  for (let index = 0; index < count; index++) {
    const at = 1 + index * PLANE_FLOATS;
    if (at + PLANE_FLOATS > data.length) break;
    const offset: Vector3 = { x: data[at]!, y: data[at + 1]!, z: data[at + 2]! };
    planes.push({
      ballCollisionOffset: offset,
      v1: { x: data[at + 3]!, y: data[at + 4]! },
      v2: { x: data[at + 5]!, y: data[at + 6]! },
      v3: { x: data[at + 7]!, y: data[at + 8]! },
      gravityAngle1: data[at + 9]!,
      gravityAngle2: data[at + 10]!,
      // The last two floats are the struct's own field-force slot, recomputed at construction.
      fieldForce: { x: 0, y: 0 },
    });
  }

  return planes;
}

export function buildOriginalRamps(
  manifest: Table, o: OriginalRampOptions,
): Map<string, InstalledRamp> {
  const ramps = new Map<string, InstalledRamp>();

  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.Ramp) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const planeData = floatAttribute(group, PLANES_RECORD);
    const entryData = floatAttribute(group, ENTRY_RECORD);
    const wall1Data = floatAttribute(group, WALL1_RECORD);
    const wall2Data = floatAttribute(group, WALL2_RECORD);
    // A ramp missing any of the four is a file this port has not seen; skipped rather than built with
    // a mesh the ball could fall out of.
    if (!planeData || !entryData || !wall1Data || !wall2Data) continue;

    const planes = readPlanes(planeData);
    if (!planes.length) continue;
    for (const plane of planes) plane.fieldForce = computeFieldForce(plane, o.gravityMult);

    const visual = readVisual(manifest.groups, object.group);
    const collisionGroup = visual.collisionGroup;
    const entryCollisionGroup = 1 << Math.floor(entryData[0]!);
    const wall1CollisionGroup = 1 << Math.floor(wall1Data[0]!);
    const wall2CollisionGroup = 1 << Math.floor(wall2Data[0]!);
    const wall1Enabled = Math.floor(wall1Data[1]!) !== 0;
    const wall2Enabled = Math.floor(wall2Data[1]!) !== 0;

    const component = { collision: (): void => {} } as {
      collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
    };
    const line = (start: Vector2, end: Vector2, mask: number, plane: RampPlane | null): RampLine =>
      Object.assign(createLine({ component, start, end, collisionGroup: mask }), { plane });

    // ⚠️ Pt1 TO Pt0, backwards from the record. Line collision is one-sided: wound the other way the
    // entry answers the face the ball is leaving from rather than the one it arrives on.
    const entryLine = line(
      { x: entryData[4]!, y: entryData[5]! }, { x: entryData[2]!, y: entryData[3]! },
      entryCollisionGroup, null,
    );

    const wall1 = findClosestEdge(planes, { x: wall1Data[3]!, y: wall1Data[4]! },
      { x: wall1Data[5]!, y: wall1Data[6]! });
    const wall2 = findClosestEdge(planes, { x: wall2Data[3]!, y: wall2Data[4]! },
      { x: wall2Data[5]!, y: wall2Data[6]! });
    // Both named boundaries take the RAMP's group, not their own: their own is what they hand the
    // ball TO, and it is stored for the component to use.
    const wall1Line = line(wall1.start, wall1.end, collisionGroup, null);
    const wall2Line = line(wall2.start, wall2.end, collisionGroup, null);

    const planeEdges: RampLine[] = [];
    for (const plane of planes) {
      const order = [plane.v1, plane.v2, plane.v3, plane.v1];
      for (let pt = 0; pt < 3; pt++) {
        const point1 = order[pt]!;
        const point2 = order[pt + 1]!;
        let mask = 0;
        if (same(point1, wall1.end) && same(point2, wall1.start)) {
          if (wall1Enabled) mask = wall1CollisionGroup;
        } else if (same(point1, wall2.end) && same(point2, wall2.start)) {
          if (wall2Enabled) mask = wall2CollisionGroup;
        } else {
          mask = collisionGroup;
        }
        // A zero mask collides with nothing, and the original does not build the line at all: those
        // gaps in the mesh are how the ball leaves a ramp.
        if (mask) planeEdges.push(line(point1, point2, mask, plane));
      }
    }

    const ramp = createRamp({
      table: o.table,
      planes,
      gravityMult: o.gravityMult,
      ballFieldMult: floatAttribute(group, BALL_FIELD_MULT_RECORD)?.[0] ?? DEFAULT_BALL_FIELD_MULT,
      ballZOffsetFlag: Math.floor(floatAttribute(group, Z_OFFSET_FLAG_RECORD)?.[0] ?? 0) !== 0,
      collisionGroup,
      wall1CollisionGroup,
      wall2CollisionGroup,
      wall1BallOffset: wall1Data[7] ?? 0,
      wall2BallOffset: wall2Data[7] ?? 0,
      entryLine,
      wall1Line,
      wall2Line,
      hitSoundId: visual.softHitSoundId,
      ...(o.sound ? { sound: o.sound } : {}),
      ...(o.onEnter ? { onEnter: () => o.onEnter!(name) } : {}),
    });

    component.collision = (ball, position, direction, distance, edge) =>
      ramp.collision(ball, position, direction, distance, edge);

    for (const edge of [entryLine, wall1Line, wall2Line, ...planeEdges]) placeLineInGrid(o.grid, edge);

    // ⚠️ THE FIELD GOES IN OVER A RECTANGLE OF BOXES, NOT INTO A LIST OF EVERY FIELD ON THE TABLE.
    // Both ramps carry collision group 2, so the mask cannot tell them apart — the BOX is what does,
    // and a flat list would give a ball on one ramp the gravity of the other from across the table.
    //
    // ⚠️ AND THE RECTANGLE IS THE SIC ONE. `TRamp`'s constructor folds three of its four accumulators
    // against `xMin` and the upstream marks the line. For the long ramp the box that results is a
    // patch of the ramp rather than the whole of it, so the ball feels the ramp on part of its own
    // surface and not on the rest. That is the shipped game's behaviour; `boundsCorrected` is beside
    // it in `table/ramp` so the difference can be measured rather than argued about.
    insertFieldSquare(o.grid, ramp.fieldBounds, {
      collisionGroup,
      fieldEffect: (ball, destination) => ramp.fieldEffect(ball as never, destination),
    });

    // Fields added to the ramp itself: `fieldBounds` is a getter over the live planes, and copying the
    // object would freeze it.
    ramps.set(name, Object.assign(ramp, {
      planes, planeEdges, entryLine, wall1Line, wall2Line,
      entryCollisionGroup, wall1CollisionGroup, wall2CollisionGroup,
      ballFieldMult: floatAttribute(group, BALL_FIELD_MULT_RECORD)?.[0] ?? DEFAULT_BALL_FIELD_MULT,
      ballZOffsetFlag: Math.floor(floatAttribute(group, Z_OFFSET_FLAG_RECORD)?.[0] ?? 0) !== 0,
    }));
  }

  return ramps;
}
