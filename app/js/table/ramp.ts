// SPDX-License-Identifier: AGPL-3.0-or-later
// table/ramp — the ramps, and with them the whole illusion of levels. Port of `TRamp`.
//
// ========================= THE BALL CHANGES WHICH WORLD IT IS IN =========================
// This is the deepest idea in the table, and it explains the `collisionMask` ported back in phase 3.
//
// Crossing into a ramp plane sets `ball.collisionMask = CollisionGroup`. From that instant the
// collision search — which filters by `edge.collisionGroup & ray.collisionMask` — can only see edges
// belonging to the ramp. Crossing one of the boundary lines switches the mask to a DIFFERENT group,
// and the ball is suddenly in a different set of walls.
//
// So the table has overlapping levels with no 3D geometry anywhere: the collision mask IS the floor the
// ball is standing on, and a line on the playfield is a staircase. Nothing is moved, nothing is
// rebuilt, and two ramps crossing over each other never see one another's walls.
//
// ========================= THE HEIGHT IS A PLANE EQUATION =========================
//     z = x * offset.x + y * offset.y + radius + offset.z
//
// A plane, evaluated analytically at the ball's position. `BallCollisionOffset` is literally the
// coefficients. There is no mesh and no interpolation between vertices — a ramp is a handful of
// triangles each carrying its own three numbers.
//
// ========================= AND EACH TRIANGLE HAS ITS OWN GRAVITY =========================
//     fieldForce.x = cos(angle2) * sin(angle1) * gravityMult
//     fieldForce.y = sin(angle2) * sin(angle1) * gravityMult
//
// `angle1` is how steep the triangle is and `angle2` which way it falls. Per-triangle gravity is how a
// ramp curves: the ball is not following a path, it is rolling downhill on whichever triangle it is on.
//
// The field then subtracts a fraction of the ball's own velocity — the same shape as the kickout's
// field, but here the fraction is small (0.2 by default) and it reads as DRAG. A ball on a ramp feels
// the triangle's gravity and a friction proportional to how fast it is going.

import type { Vector2 } from '../maths/maths.js';
import type { Edge } from '../physics/grid.js';
import type { SoundPlayer, TableState } from './collision-component.js';

export interface Vector3 { x: number; y: number; z: number }

export interface RampPlane {
  /** The triangle. */
  readonly v1: Vector2;
  readonly v2: Vector2;
  readonly v3: Vector2;
  /** The plane equation's coefficients: z = x*ox + y*oy + radius + oz. */
  readonly ballCollisionOffset: Vector3;
  /** How steep the triangle is. */
  readonly gravityAngle1: number;
  /** Which way it falls. */
  readonly gravityAngle2: number;
  /** Computed from the two angles at construction. */
  fieldForce: Vector2;
}

export interface RampBall {
  position: Vector2 & { z: number };
  direction: Vector2;
  speed: number;
  radius: number;
  collisionMask: number;
  /** True while the ball is on a ramp plane. */
  collisionFlag: boolean;
  /** The plane equation the ball is currently standing on. */
  collisionOffset: Vector3;
  /** The gravity of the triangle the ball is on. */
  rampFieldForce: Vector2;
  memory: { record(edge: Edge): void };
}

/** An edge that belongs to a ramp carries the plane it bounds, or null for a boundary line. */
export interface RampEdge extends Edge {
  plane: RampPlane | null;
}

export interface RampOptions {
  readonly table: TableState;
  readonly planes: readonly RampPlane[];
  /** `GravityDirVectMult` of the table. */
  readonly gravityMult: number;
  /** The drag coefficient. `BallFieldMult`, 0.2 by default. */
  readonly ballFieldMult: number;
  /** Whether crossing a boundary line also pins the ball's Z. */
  readonly ballZOffsetFlag: boolean;
  readonly collisionGroup: number;
  readonly wall1CollisionGroup: number;
  readonly wall2CollisionGroup: number;
  readonly wall1BallOffset: number;
  readonly wall2BallOffset: number;
  /** The line that reports the ball entering the ramp. `Line1` in the original. */
  readonly entryLine: Edge;
  /** The two boundary lines that hand the ball to another world. `Line2` and `Line3`. */
  readonly wall1Line: Edge;
  readonly wall2Line: Edge;
  readonly hitSoundId?: number;
  readonly sound?: SoundPlayer;
  readonly onEnter?: () => void;
}

export interface Ramp {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  fieldEffect(ball: RampBall, destination: Vector2): boolean;
  /** The rectangle the ramp's field is registered over. See the note about the original's Sic. */
  readonly fieldBounds: { xMin: number; yMin: number; xMax: number; yMax: number };
}

/** Turns the two angles into the plane's gravity vector. */
export function computeFieldForce(plane: RampPlane, gravityMult: number): Vector2 {
  return {
    x: Math.cos(plane.gravityAngle2) * Math.sin(plane.gravityAngle1) * gravityMult,
    y: Math.sin(plane.gravityAngle2) * Math.sin(plane.gravityAngle1) * gravityMult,
  };
}

/**
 * The bounding box of the ramp's planes, TRANSCRIBED WITH THE ORIGINAL'S DEFECT.
 *
 * Three of the four accumulators in `TRamp`'s constructor fold against `xMin` instead of their own,
 * and the upstream marks the line `// Sic` — it knows. The box only decides which grid boxes the
 * ramp's field is registered into, so the defect makes a ramp's gravity reach the wrong area rather
 * than crash anything.
 *
 * Kept because this port's rule is to transcribe: correcting it would change which balls feel a ramp's
 * gravity, which is a change to how the table plays that nobody asked for. `boundsCorrected` is here
 * beside it so the difference can be measured rather than argued about.
 */
export function planeBounds(planes: readonly RampPlane[]): { xMin: number; yMin: number; xMax: number; yMax: number } {
  let xMin = 1e9, yMin = 1e9, xMax = -1e9, yMax = -1e9;
  for (const plane of planes) {
    xMin = Math.min(plane.v3.x, plane.v1.x, plane.v2.x, xMin);
    yMin = Math.min(plane.v3.y, plane.v1.y, plane.v2.y, xMin); // Sic — folds against xMin
    xMax = Math.max(plane.v3.x, plane.v1.x, plane.v2.x, xMin); // Sic
    yMax = Math.max(plane.v3.y, plane.v1.y, plane.v2.y, xMin); // Sic
  }
  return { xMin, yMin, xMax, yMax };
}

/** What the bounds would be without the defect. Not used by the game; here to make the gap measurable. */
export function boundsCorrected(planes: readonly RampPlane[]): { xMin: number; yMin: number; xMax: number; yMax: number } {
  let xMin = 1e9, yMin = 1e9, xMax = -1e9, yMax = -1e9;
  for (const plane of planes) {
    xMin = Math.min(plane.v3.x, plane.v1.x, plane.v2.x, xMin);
    yMin = Math.min(plane.v3.y, plane.v1.y, plane.v2.y, yMin);
    xMax = Math.max(plane.v3.x, plane.v1.x, plane.v2.x, xMax);
    yMax = Math.max(plane.v3.y, plane.v1.y, plane.v2.y, yMax);
  }
  return { xMin, yMin, xMax, yMax };
}

export function createRamp(o: RampOptions): Ramp {
  for (const plane of o.planes) plane.fieldForce = computeFieldForce(plane, o.gravityMult);

  return {
    fieldBounds: planeBounds(o.planes),

    collision(ball, position, _direction, _distance, edge): void {
      const b = ball as RampBall;
      const e = edge as RampEdge;

      // Every ramp edge passes the ball through: a ramp is something the ball travels along.
      b.memory.record(e);
      b.position.x = position.x;
      b.position.y = position.y;

      if (e.plane) {
        // ENTERING A PLANE: adopt its equation, its gravity, and ITS WORLD.
        b.collisionFlag = true;
        b.collisionOffset = e.plane.ballCollisionOffset;
        b.rampFieldForce = e.plane.fieldForce;
        b.position.z = b.position.x * b.collisionOffset.x
          + b.position.y * b.collisionOffset.y
          + b.radius + b.collisionOffset.z;
        b.collisionMask = o.collisionGroup;
        return;
      }

      if (e === o.entryLine) {
        // The entry line only reports. A tilted table lets the ball through and says nothing.
        if (o.table.tiltLocked) return;
        if (o.hitSoundId !== undefined) o.sound?.play(o.hitSoundId, ball);
        o.onEnter?.();
        return;
      }

      // A BOUNDARY LINE: the ball leaves the ramp's world for the wall's.
      b.collisionFlag = false;
      if (e === o.wall1Line) {
        b.collisionMask = o.wall1CollisionGroup;
        if (o.ballZOffsetFlag) b.position.z = b.radius + o.wall1BallOffset;
      } else {
        b.collisionMask = o.wall2CollisionGroup;
        if (o.ballZOffsetFlag) b.position.z = b.radius + o.wall2BallOffset;
      }
    },

    fieldEffect(ball, destination): boolean {
      // The triangle's gravity, minus a fraction of the ball's own velocity. The fraction is small and
      // it reads as drag: a ball on a ramp is slowed in proportion to how fast it is going.
      destination.x = ball.rampFieldForce.x - ball.direction.x * ball.speed * o.ballFieldMult;
      destination.y = ball.rampFieldForce.y - ball.direction.y * ball.speed * o.ballFieldMult;
      return true;
    },
  };
}
