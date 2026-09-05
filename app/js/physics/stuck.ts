// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/stuck — noticing that a ball has stopped, and doing something about it. Ports of
// `pb::timed_frame`'s ball loop, `control::UnstuckBall`, `control::CheckBallInControlBounds` and
// `TBall::throw_ball`.
//
// ========================= STUCK IS A PLACE, NOT A DURATION =========================
// `UnstuckBall` does nothing at all if the ball is inside the bounding box of either flipper or the
// plunger. A ball resting on a raised flipper, or waiting in the plunger lane, is legitimately still
// and must never be nudged. So the game's definition of stuck is WHERE the ball is standing, and the
// counter only decides how hard to try once it has already been ruled a problem.
//
// The boxes are widened by half the table's collision offset, so the edges count as inside.
//
// ========================= TWO DIFFERENT DISTANCES FOR ONE QUESTION =========================
// The detection loop asks "has it moved?" twice, with different answers:
//
//   · A ball that is inactive, held, or travelling at 0.8 or more clears its counter only if it has
//     covered TWO RADII since the reference point. A ball spinning against a wall at full speed is
//     still stuck; speed is not movement.
//   · A ball that is slow and free, and has been idle for 500 ticks, clears its counter after only
//     HALF A RADIUS.
//
// And `PrevPosition` is updated in the idle branch ALONE. So the first test measures displacement
// since the last idle check, not since the last frame — which is what makes two radii a reasonable
// thing to ask for.
//
// ========================= THE NUDGE IS RANDOM IN DIRECTION AND EXACT IN STRENGTH =========================
// `throw_ball(&{0,-1,0}, 90, 1.0, 0.0)`. The angle is drawn uniformly from ±90° — anywhere in the
// upward half-turn — while the second speed multiplier being ZERO cancels the random speed term
// entirely, leaving exactly 1.0. Randomising the direction is what stops the ball getting stuck the
// same way twice; keeping the speed fixed is what stops the rescue from looking like a bumper hit.
//
// After twenty nudges it gives up: the ball is disabled, THE MULTIBALL COUNT IS DECREMENTED, and the
// plunger relaunches. The decrement is what stops a rescue from quietly growing the number of balls.

/** Below this speed a free ball is a candidate for being stuck. */
export const STUCK_ACTIVE_SPEED = 0.8;
/** How long it must sit still before the question is even asked. */
export const STUCK_IDLE_TICKS = 500;
/** Nudges past this many and the ball is relaunched instead. */
export const STUCK_GIVE_UP_COUNT = 20;

export interface Vec2 { x: number; y: number }

export interface StuckBall {
  active: boolean;
  /** `HasGroupFlag`. */
  inGroup: boolean;
  /** `CollisionComp` — a sink or kickout is holding it on purpose. */
  inCollisionComponent: boolean;
  speed: number;
  radius: number;
  position: Vec2;
  /** The reference point, moved only by the idle branch. */
  prevPosition: Vec2;
  direction: Vec2;
  stuckCounter: number;
  lastActiveTime: number;
}

/**
 * `TBall::throw_ball`. The angle is uniform in ±`angleMult`; the speed is `speedMult1` plus a random
 * term scaled by `speedMult1 * speedMult2`, so a zero second multiplier makes the speed exact.
 */
export function throwBall(
  ball: StuckBall, direction: Vec2, angleMult: number,
  speedMult1: number, speedMult2: number, random: () => number,
): void {
  // Throwing frees the ball from whatever was holding it.
  ball.inCollisionComponent = false;

  const spread = random();
  const angle = (1 - (spread + spread)) * angleMult;
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  ball.direction = {
    x: direction.x * cos - direction.y * sin,
    y: direction.x * sin + direction.y * cos,
  };

  const jitter = random();
  ball.speed = (1 - (jitter + jitter)) * (speedMult1 * speedMult2) + speedMult1;
}

/**
 * One ball's turn through `pb::timed_frame`. Returns whether the ball is currently a stuck-ball
 * candidate, which is the caller's cue to run `unstuckBall`.
 */
export function checkStuckBall(ball: StuckBall, now: number): boolean {
  const movingOrHeld = !ball.active || ball.inGroup || ball.inCollisionComponent
    || ball.speed >= STUCK_ACTIVE_SPEED;

  if (movingOrHeld) {
    if (ball.stuckCounter > 0) {
      // Two radii, and measured from the last IDLE check — see this module's header.
      const reach = ball.radius * 2;
      if (reach * reach < distanceSquared(ball)) ball.stuckCounter = 0;
    }
    ball.lastActiveTime = now;
    return false;
  }

  if (now - ball.lastActiveTime <= STUCK_IDLE_TICKS) return false;

  const reach = ball.radius / 2;
  const moved = distanceSquared(ball);
  ball.prevPosition = { x: ball.position.x, y: ball.position.y };
  if (reach * reach < moved) ball.stuckCounter = 0;
  else ball.stuckCounter++;
  return true;
}

function distanceSquared(ball: StuckBall): number {
  const dx = ball.position.x - ball.prevPosition.x;
  const dy = ball.position.y - ball.prevPosition.y;
  return dx * dx + dy * dy;
}

export interface Bounds { xMin: number; xMax: number; yMin: number; yMax: number }

export interface UnstuckOptions {
  /** The flippers' and the plunger's boxes. Inside any of them, nothing happens. */
  readonly controlBounds: readonly Bounds[];
  /** `TableG->CollisionCompOffset / 2`. */
  readonly boundsMargin: number;
  readonly table: { multiballCount: number };
  /** `PlungerRelaunchBall`. */
  readonly relaunch: () => void;
  readonly random?: () => number;
}

/** `control::CheckBallInControlBounds`. */
function inControlBounds(ball: StuckBall, bounds: Bounds, margin: number): boolean {
  return ball.active
    && ball.position.x >= bounds.xMin - margin && ball.position.x <= bounds.xMax + margin
    && ball.position.y >= bounds.yMin - margin && ball.position.y <= bounds.yMax + margin;
}

/** `control::UnstuckBall`. */
export function unstuckBall(ball: StuckBall, o: UnstuckOptions): void {
  if (o.controlBounds.some((b) => inControlBounds(ball, b, o.boundsMargin))) return;

  if (ball.stuckCounter <= STUCK_GIVE_UP_COUNT) {
    // Straight up the table, anywhere within a half-turn of it, at exactly speed 1.
    throwBall(ball, { x: 0, y: -1 }, 90, 1, 0, o.random ?? Math.random);
    return;
  }

  ball.active = false;
  // Without this the rescue would quietly grow the number of balls in play.
  o.table.multiballCount--;
  o.relaunch();
}
