// SPDX-License-Identifier: AGPL-3.0-or-later
// maths — the collision geometry. Port of `maths.cpp`.
//
// There is no physics engine in Space Cadet. There is a ray, a circle and a line segment, and
// everything the ball does comes out of those three. So this file is a transcription, not an
// equivalent.

/** The original's "no collision": 1e9, not Infinity and not null. Comparisons treat it as far away. */
export const NO_COLLISION = 1000000000;

export interface Vector2 { x: number; y: number }

export interface Circle {
  readonly center: Vector2;
  /** SQUARED. The original never stores the radius, only its square, to avoid needless square roots. */
  readonly radiusSq: number;
}

export interface Ray {
  readonly origin: Vector2;
  readonly direction: Vector2;
  readonly maxDistance: number;
  /** Penetration tolerance: a hit as far back as `-minDistance` still counts. */
  readonly minDistance: number;
  readonly collisionMask: number;
}

export interface Line {
  direction: Vector2;
  /** Clockwise perpendicular of the direction: (dir.y, -dir.x). It is the normal of the facing side. */
  perpendicular: Vector2;
  origin: Vector2;
  end: Vector2;
  minCoord: number;
  maxCoord: number;
  /** Where the last ray crossed. Written by `rayIntersectLine`, exactly as the original does. */
  rayIntersect: Vector2;
}

export function cross(a: Vector2, b: Vector2): number {
  return a.x * b.y - a.y * b.x;
}

export function dot(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

/** Normalizes IN PLACE and returns the PREVIOUS magnitude — the original uses that return as a speed. */
export function normalize2d(v: Vector2): number {
  const magnitude = Math.sqrt(v.x * v.x + v.y * v.y);
  if (magnitude !== 0) { v.x /= magnitude; v.y /= magnitude; }
  return magnitude;
}

/**
 * Distance from the ray's origin to its first intersection with the circle.
 *
 * TWO RETURNS THAT LOOK LIKE BUGS AND ARE NOT:
 *
 * · `tca < 0` cuts out BEFORE the inside-the-circle test. A ball already inside and moving away from
 *   the center is not pushed again — without it the ball would buzz against the edge.
 *
 * · a ray whose origin is INSIDE returns a NEGATIVE distance, and skips the max-distance check. The
 *   sign is the instruction to back out: the nearest positive intersection is behind the ball, and
 *   returning it would send the ball through the circle instead of out of it.
 */
export function rayIntersectCircle(ray: Ray, circle: Circle): number {
  const lx = circle.center.x - ray.origin.x;
  const ly = circle.center.y - ray.origin.y;

  const tca = lx * ray.direction.x + ly * ray.direction.y;
  if (tca < 0) return NO_COLLISION;

  const magSq = lx * lx + ly * ly;
  const thcSq = circle.radiusSq - magSq + tca * tca;

  if (magSq < circle.radiusSq) return tca - Math.sqrt(thcSq);

  if (thcSq < 0) return NO_COLLISION;

  const t0 = tca - Math.sqrt(thcSq);
  if (t0 < 0 || t0 > ray.maxDistance) return NO_COLLISION;
  return t0;
}

/** The original's epsilon for deciding a line is vertical. */
const NEARLY_ZERO = 0.000000001;

export function lineInit(x0: number, y0: number, x1: number, y1: number): Line {
  const direction = { x: x1 - x0, y: y1 - y0 };
  normalize2d(direction);

  // WHY THE DIRECTION IS SNAPPED TO ZERO: `rayIntersectLine` picks the axis it measures the segment
  // along by testing `direction.x !== 0`. On a vertical line every point shares the same X, so
  // measuring the segment along it would collapse the segment to a point and the wall would collide at
  // any height. A rounding remainder in X is the difference between a wall and an infinite one.
  let start = x0, finish = x1;
  if (Math.abs(direction.x) < NEARLY_ZERO) {
    direction.x = 0;
    start = y0;
    finish = y1;
  }

  return {
    direction,
    perpendicular: { x: direction.y, y: -direction.x },
    origin: { x: x0, y: y0 },
    end: { x: x1, y: y1 },
    minCoord: Math.min(start, finish),
    maxCoord: Math.max(start, finish),
    rayIntersect: { x: 0, y: 0 },
  };
}

/**
 * Distance to the crossing with the SEGMENT, writing the point into `line.rayIntersect`.
 *
 * THE LINE IS ONE-SIDED. `v2 . v3 >= 0` returns no-collision, so a ray arriving at the back face
 * passes through. That is not an omission — it is what lets the original use segments as one-way
 * gates, and what stops the ball being trapped when it penetrates a wall between two frames.
 */
export function rayIntersectLine(ray: Ray, line: Line): number {
  const v1 = { x: ray.origin.x - line.origin.x, y: ray.origin.y - line.origin.y };
  const v2 = line.direction;
  const v3 = { x: -ray.direction.y, y: ray.direction.x };

  const v2DotV3 = dot(v2, v3);
  if (v2DotV3 >= 0) return NO_COLLISION;

  const distance = cross(v2, v1) / v2DotV3;
  if (distance < -ray.minDistance || distance > ray.maxDistance) return NO_COLLISION;

  line.rayIntersect.x = distance * ray.direction.x + ray.origin.x;
  line.rayIntersect.y = distance * ray.direction.y + ray.origin.y;

  const testPoint = line.direction.x !== 0 ? line.rayIntersect.x : line.rayIntersect.y;
  if (testPoint < line.minCoord || testPoint > line.maxCoord) return NO_COLLISION;

  return distance;
}
