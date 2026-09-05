// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/flipper — collision with the flipper. Port of `TFlipperEdge` and `maths::distance_to_flipper`.
//
// ========================= THE FLIPPER HAS FOUR PIECES, NOT ONE =========================
// Two LINES (the flat faces, A on top and B underneath) and two CIRCLES (the pivot and the tip). The
// nearest wins, and the bounce normal depends on which it was: the line's perpendicular, or the radial
// out of the circle's centre. That is what makes the ball slide along the face and bounce round off
// the tip.
//
// ========================= THE KICK GROWS WITH DISTANCE FROM THE PIVOT =========================
//     v21 = |moveSpeed| * sqrt(distanceSq / divisorSq)
// which is the flipper's TANGENTIAL speed at that radius. Hitting with the tip sends the ball flying;
// hitting by the pivot barely moves it. It comes out of one line, and without it the flipper would be
// nothing but a wall that moves.
//
// And struck FROM BEHIND, elasticity FALLS with that same distance: the flipper gives at the tip. That
// is what stops the ball being spat out when it hits the wrong side of a moving paddle.

import {
  NO_COLLISION, lineInit, normalize2d, dot, cross,
  rayIntersectCircle, rayIntersectLine, type Circle, type Line, type Ray, type Vector2,
} from '../maths/maths.js';
import { basicCollision, type BallState } from './collision.js';

/** Rotates a point about `origin`, with the sine and cosine already computed. */
export function rotatePoint(point: Vector2, sin: number, cos: number, origin: Vector2): void {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  point.x = dx * cos - dy * sin + origin.x;
  point.y = dx * sin + dy * cos + origin.y;
}

/**
 * Rotates a vector. DELIBERATELY CORRECTED with respect to the original.
 *
 * The upstream's `maths::RotateVector` computes Y from the X it has just overwritten, so it traces a
 * figure eight instead of a circle. Upstream documents the defect itself and notes that it only
 * survives because the angle is always zero where the function is called — and at angle zero both
 * versions are the identity. So correcting it CANNOT change current behaviour, and the authored table
 * of phase 8 may want a real angle.
 */
export function rotateVector(vector: Vector2, angle: number): void {
  const s = Math.sin(angle), c = Math.cos(angle);
  const x = c * vector.x - s * vector.y;
  vector.y = s * vector.x + c * vector.y;
  vector.x = x;
}

export type FlipperMotion = 'still' | 'extending' | 'retracting';

export interface Flipper {
  motion: FlipperMotion;
  elasticity: number;
  smoothness: number;
  rotOrigin: Vector2;
  /** The sign picks the side: a left and a right flipper turn opposite ways. */
  angleMax: number;
  currentAngle: number;
  moveSpeed: number;
  extendSpeed: number;
  retractSpeed: number;
  collisionMult: number;
  /** The flipper's reference length, squared. It is the kick's denominator. */
  distanceDivSq: number;
  baseRadiusSq: number;
  tipRadiusSq: number;

  a1Src: Vector2; a2Src: Vector2; b1Src: Vector2; b2Src: Vector2; t1Src: Vector2;
  a1: Vector2; a2: Vector2; b1: Vector2; b2: Vector2; t1: Vector2;
  lineA: Line; lineB: Line;
  baseCircle: Circle; tipCircle: Circle;

  /** Result of the last query, kept as in the original (`NextBallPosition`/`CollisionDirection`). */
  nextBallPosition: Vector2;
  collisionDirection: Vector2;
}

export interface FlipperOptions {
  rotOrigin: Vector2;
  a1Src: Vector2; a2Src: Vector2; b1Src: Vector2; b2Src: Vector2; t1Src: Vector2;
  baseRadius: number; tipRadius: number;
  angleMax: number;
  extendSpeed: number; retractSpeed: number;
  collisionMult: number; elasticity: number; smoothness: number;
  distanceDiv: number;
}

const copy = (v: Vector2): Vector2 => ({ x: v.x, y: v.y });

export function createFlipper(o: FlipperOptions): Flipper {
  return {
    motion: 'still',
    elasticity: o.elasticity,
    smoothness: o.smoothness,
    rotOrigin: copy(o.rotOrigin),
    angleMax: o.angleMax,
    currentAngle: 0,
    moveSpeed: 0,
    extendSpeed: o.extendSpeed,
    retractSpeed: o.retractSpeed,
    collisionMult: o.collisionMult,
    distanceDivSq: o.distanceDiv * o.distanceDiv,
    baseRadiusSq: o.baseRadius * o.baseRadius,
    tipRadiusSq: o.tipRadius * o.tipRadius,
    a1Src: copy(o.a1Src), a2Src: copy(o.a2Src),
    b1Src: copy(o.b1Src), b2Src: copy(o.b2Src), t1Src: copy(o.t1Src),
    a1: copy(o.a1Src), a2: copy(o.a2Src),
    b1: copy(o.b1Src), b2: copy(o.b2Src), t1: copy(o.t1Src),
    lineA: lineInit(o.a1Src.x, o.a1Src.y, o.a2Src.x, o.a2Src.y),
    lineB: lineInit(o.b1Src.x, o.b1Src.y, o.b2Src.x, o.b2Src.y),
    baseCircle: { center: copy(o.rotOrigin), radiusSq: o.baseRadius * o.baseRadius },
    tipCircle: { center: copy(o.t1Src), radiusSq: o.tipRadius * o.tipRadius },
    nextBallPosition: { x: 0, y: 0 },
    collisionDirection: { x: 0, y: 0 },
  };
}

/** `set_control_points`: rotates the five points and rebuilds the two lines and two circles. */
export function setControlPoints(f: Flipper, angle: number): void {
  const sin = Math.sin(angle), cos = Math.cos(angle);
  f.a1 = copy(f.a1Src); f.a2 = copy(f.a2Src);
  f.b1 = copy(f.b1Src); f.b2 = copy(f.b2Src); f.t1 = copy(f.t1Src);
  for (const p of [f.a1, f.a2, f.t1, f.b1, f.b2]) rotatePoint(p, sin, cos, f.rotOrigin);
  f.lineA = lineInit(f.a1.x, f.a1.y, f.a2.x, f.a2.y);
  f.lineB = lineInit(f.b1.x, f.b1.y, f.b2.x, f.b2.y);
  f.baseCircle = { center: copy(f.rotOrigin), radiusSq: f.baseRadiusSq };
  f.tipCircle = { center: copy(f.t1), radiusSq: f.tipRadiusSq };
  f.currentAngle = angle;
}

export interface FlipperHit {
  readonly distance: number;
  readonly origin: Vector2;
  readonly direction: Vector2;
}

/**
 * `maths::distance_to_flipper`: the nearest of the four pieces.
 *
 * THE TIE ORDER IS LINE A, BASE, TIP, LINE B, with a strict `<` — so on an exact tie whichever was
 * tested first wins. Reordering would change the normal returned in tangential cases.
 */
export function distanceToFlipper(f: Flipper, ray: Ray): FlipperHit {
  let distance = NO_COLLISION;
  let piece: 'lineA' | 'lineB' | 'base' | 'tip' | null = null;

  let d = rayIntersectLine(ray, f.lineA);
  if (d < distance) { distance = d; piece = 'lineA'; }

  d = rayIntersectCircle(ray, f.baseCircle);
  if (d < distance) { distance = d; piece = 'base'; }

  d = rayIntersectCircle(ray, f.tipCircle);
  if (d < distance) { distance = d; piece = 'tip'; }

  d = rayIntersectLine(ray, f.lineB);
  if (d < distance) { distance = d; piece = 'lineB'; }

  if (piece === 'lineA') {
    f.collisionDirection = copy(f.lineA.perpendicular);
    f.nextBallPosition = copy(f.lineA.rayIntersect);
  } else if (piece === 'lineB') {
    f.collisionDirection = copy(f.lineB.perpendicular);
    f.nextBallPosition = copy(f.lineB.rayIntersect);
  } else if (piece === 'base' || piece === 'tip') {
    f.nextBallPosition = {
      x: distance * ray.direction.x + ray.origin.x,
      y: distance * ray.direction.y + ray.origin.y,
    };
    const center = piece === 'base' ? f.baseCircle.center : f.tipCircle.center;
    f.collisionDirection = { x: f.nextBallPosition.x - center.x, y: f.nextBallPosition.y - center.y };
    normalize2d(f.collisionDirection);
  }

  return { distance, origin: f.nextBallPosition, direction: f.collisionDirection };
}

/** `TFlipperEdge::EdgeCollision`. Uses the last `distanceToFlipper` result, as the original does. */
export function flipperCollision(f: Flipper, ball: BallState): void {
  if (f.motion === 'still') {
    basicCollision(ball, f.nextBallPosition, f.collisionDirection,
      { elasticity: f.elasticity, smoothness: f.smoothness, threshold: NO_COLLISION, boost: 0 });
    return;
  }

  // WHICH SIDE of the flipper the ball is on: the sign of the cross product between the tip-to-pivot
  // axis and the tip-to-ball vector. Combined with the sign of `angleMax` (which says which way this
  // flipper turns), it decides whether the struck face is the sweeping one or the back.
  const tipToBall = { x: f.nextBallPosition.x - f.t1.x, y: f.nextBallPosition.y - f.t1.y };
  const tipToPivot = { x: f.rotOrigin.x - f.t1.x, y: f.rotOrigin.y - f.t1.y };
  const crossed = cross(tipToPivot, tipToBall);

  let frontCollision = crossed <= 0 ? f.angleMax > 0 : f.angleMax <= 0;

  let collisionLinePerp: Vector2;
  if (f.motion === 'retracting') {
    // RETRACTING INVERTS EVERYTHING: the face that was sweeping is now running from the ball, and the
    // back is the one advancing.
    frontCollision = !frontCollision;
    collisionLinePerp = f.lineB.perpendicular;
  } else {
    collisionLinePerp = f.lineA.perpendicular;
  }

  const dx = f.nextBallPosition.x - f.rotOrigin.x;
  const dy = f.nextBallPosition.y - f.rotOrigin.y;
  const distanceSq = dx * dx + dy * dy;
  // The `1.01` is the original's: slack so a ball resting on the pivot itself gets no kick.
  const offPivot = f.baseCircle.radiusSq * 1.01 < distanceSq;

  if (frontCollision) {
    let boost = 0;
    if (offPivot) {
      const tangentialSpeed = Math.abs(f.moveSpeed) * Math.sqrt(distanceSq / f.distanceDivSq);
      const alignment = dot(collisionLinePerp, f.collisionDirection);
      if (alignment >= 0) boost = f.collisionMult * alignment * tangentialSpeed;
    }
    // A threshold of -1 when there is a boost guarantees it ALWAYS applies. It is the only place in the
    // game that uses a negative threshold, and it is how the flipper escapes the "only above such a
    // rebound speed" rule.
    const threshold = boost <= 0 ? NO_COLLISION : -1;
    basicCollision(ball, f.nextBallPosition, f.collisionDirection,
      { elasticity: f.elasticity, smoothness: f.smoothness, threshold, boost });
    return;
  }

  // FROM BEHIND: the flipper gives, and gives more at the tip.
  const elasticity = offPivot
    ? (1 - Math.sqrt(distanceSq / f.distanceDivSq)) * f.elasticity
    : f.elasticity;
  basicCollision(ball, f.nextBallPosition, f.collisionDirection,
    { elasticity, smoothness: f.smoothness, threshold: NO_COLLISION, boost: 0 });
}
