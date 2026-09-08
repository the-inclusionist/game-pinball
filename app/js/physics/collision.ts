// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/collision — the collision response. Port of `maths::basic_collision`.
//
// One function, and three behaviors come out of it that look separate in the game: the bounce off a
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
  /**
   * ⚠️ THE THIRD LABELLED DEVIATION FROM THE TRANSCRIPTION, AND IT IS OFF FOR THE 1995 TABLE.
   *
   * `TBall::Collision` multiplies the ALONG-SURFACE speed by `smoothness` on every contact, whatever
   * the contact is. That is a fixed toll, and it is wrong in one specific place: a ball RESTING on a
   * surface collides every frame — gravity puts it back as fast as the collision pushes it off — so the
   * toll is paid sixty times a second. A wall at 0.1 leaves a ball `0.1^60` of its speed after a second
   * of sliding, which is why the Dev photographed one motionless on `ring-belt`'s guide: "a bolinha
   * simplesmente congelou-se embaixo ao invés de rolar pela ladeira." The steady state on a 30° slope
   * is 0.43 units a second.
   *
   * ⚠️ FRICTION IS PROPORTIONAL TO THE NORMAL IMPULSE, which is the physics the fixed toll is missing.
   * A hard perpendicular hit presses the ball into the surface and scrubs its sideways speed; a ball
   * sitting still presses on it with almost nothing and is barely slowed. `1 − smoothness` is read as
   * that coefficient and multiplied by the impact, so:
   *
   *   · AT 45° THE TWO MODELS AGREE EXACTLY. The tangential and normal parts are equal there, so
   *     `(1 − s)·proj / tangent` is `1 − s` and what is kept is `s` — the transcribed number.
   *   · A STEEPER HIT keeps a little less than the toll did, and the difference is invisible: there is
   *     hardly any tangential speed to keep.
   *   · A GRAZE, AND A SLIDE, KEEP THEIRS. That is the whole of the change, and it is the case the
   *     original's own tables never sit in for long.
   *
   * ⚠️ AND IT IS OPT-IN SO THE DEMONSTRATION IS UNTOUCHED. The 1995 table is a transcription being
   * validated against the Dev's own archive, and its components' elasticity and smoothness come out of
   * `PINBALL.DAT`. The authored tables' numbers are OURS — `table/physics-build` writes them by hand —
   * so this changes our tables and not Microsoft's.
   */
  readonly frictionByImpact?: boolean;
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
    // The part of the incoming direction that runs ALONG the surface: `v + proj·n`.
    const tx = dx + ball.direction.x;
    const ty = dy + ball.direction.y;
    /**
     * How much of the along-surface speed survives. The transcription's answer is `smoothness`,
     * whatever the contact; `frictionByImpact` makes it Coulomb — a loss proportional to how hard the
     * ball is pressed into the surface, which is `projection`. See `CollisionResponse`.
     */
    let keep = r.smoothness;
    if (r.frictionByImpact === true) {
      const tangent = Math.hypot(tx, ty);
      // `min` because friction stops a slide; it never drags the ball backwards along the surface.
      keep = tangent > 0 ? Math.max(0, tangent - (1 - r.smoothness) * projection) / tangent : 0;
    }
    ball.direction.x = tx * keep + dx * r.elasticity;
    ball.direction.y = ty * keep + dy * r.elasticity;
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
