// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/collision — the collision response. Port of `maths::basic_collision`.
//
// One function, and three behaviours come out of it that look separate in the game: the bounce off a
// wall, the energy lost in a graze, and the bumper's kick. They are the same ten calculations with
// different parameters, which is why this is transcribed rather than split into three "clearer"
// functions — splitting them would invent differences that do not exist.
//
// It lives in `physics/` rather than `maths/` because it mutates a ball. Upstream keeps it in
// `maths.cpp` among the pure functions; that split is the one liberty this module takes.

import { normalize2d, dot, type Vector2 } from '../maths/maths.js';

export interface BallState {
  position: Vector2;
  direction: Vector2;
  speed: number;
}

export interface CollisionResponse {
  /** 1 = perfect bounce; 0 = the ball dies on the surface. */
  readonly elasticity: number;
  readonly smoothness: number;
  /** Rebound speed above which the boost applies. It is what makes a bumper ignore a light touch. */
  readonly threshold: number;
  readonly boost: number;
}

/** Moves the ball past the contact so the next frame does not detect the same collision again. */
const NUDGE = 0.0005;

/**
 * Applies the collision and returns the REBOUND SPEED (not the speed left over) — the original uses
 * that return to decide sound, score, and whether the target was "hit hard".
 *
 * `direction` is the surface normal pointing out of it, toward the ball.
 */
export function basicCollision(ball: BallState, nextPosition: Vector2, direction: Vector2, r: CollisionResponse): number {
  ball.position.x = nextPosition.x + direction.x * NUDGE;
  ball.position.y = nextPosition.y + direction.y * NUDGE;

  // Projection of the ball's direction onto the rebound normal.
  let projection = -dot(direction, ball.direction);

  if (projection < 0) {
    // NEGATIVE means both vectors point the same way: the ball is ALREADY leaving. There is nothing to
    // reflect, but the magnitude still feeds the energy loss below. Skipping this case would let the
    // ball GAIN energy grazing a surface it was already leaving.
    projection = -projection;
  } else {
    const dx = projection * direction.x;
    const dy = projection * direction.y;
    ball.direction.x = (dx + ball.direction.x) * r.smoothness + dx * r.elasticity;
    ball.direction.y = (dy + ball.direction.y) * r.smoothness + dy * r.elasticity;
    normalize2d(ball.direction);
  }

  const reboundSpeed = projection * ball.speed;
  ball.speed -= (1 - r.elasticity) * reboundSpeed;

  if (reboundSpeed >= r.threshold) {
    // THE BOOST IS NOT "MORE ELASTICITY": it adds a fixed-magnitude vector along the normal, and the
    // magnitude of the result becomes the speed. That is how a bumper returns more energy than it
    // received without elasticity ever exceeding 1 anywhere.
    ball.direction.x = ball.speed * ball.direction.x + direction.x * r.boost;
    ball.direction.y = ball.speed * ball.direction.y + direction.y * r.boost;
    ball.speed = normalize2d(ball.direction);
  }

  return reboundSpeed;
}
