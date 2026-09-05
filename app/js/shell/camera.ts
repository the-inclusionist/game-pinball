// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/camera — the view that follows the ball. Not a port: the original shows the whole table at
// once, and this is the piece that pays for a 320×180 screen.
//
// ========================= WHY THERE IS A CAMERA AT ALL =========================
// The playfield is 365×470 in the original art and half of that here, 183×235. The screen is 180 tall.
// So 55 pixels of the table are off-screen at any moment, and something has to decide which 55.
//
// The rule, in the words it was decided in: the view sits at the BOTTOM, on the flippers. When the
// ball climbs, the view follows it up — never faster than the ball itself, because a view that
// outruns what the player is watching causes motion sickness. While the view is up, the flippers are
// out of sight, and THAT IS INTENTIONAL: the player gives up the base of the table for as long as the
// ball is high. It is a rule of this version of the game, not a defect of the camera.
//
// ========================= A DEAD ZONE, AND TWO THRESHOLDS THAT DIFFER =========================
// The camera wants the ball at a fixed distance from the top of the view — `anchor`. The gap between
// where the view is and where it wants to be is the error, and the camera only starts moving once the
// error passes `startTolerance`, then keeps moving until it falls under `stopTolerance`.
//
// THE TWO MUST DIFFER. With one threshold the camera starts and stops on the same value, so a ball
// hovering on the boundary makes it chatter — start, stop, start — once per frame, which is exactly
// the shimmer this design exists to avoid. There is a test that fails if anybody equalises them.
//
// ========================= AND THE SPEED CAP IS A HARD RULE =========================
// Each frame the camera covers `damping` of the remaining error, but never more than
// `maxSpeedFactor` of the ball's own vertical speed. `maxSpeedFactor` is strictly below one, so the
// view can never overtake the thing the player is following.
//
// A consequence, stated rather than smoothed over: with the ball still, the cap is zero and the camera
// cannot move. In play the ball is only still when it is held or stuck, and both are handled
// elsewhere. If it ever looks wrong on the table, that is a tuning decision and not a bug.
//
// ========================= ONE AXIS SOLVER, CALLED AS MANY TIMES AS NEEDED =========================
// `stepAxis` knows nothing about vertical. The authored table of phase 8 may be wider than 320, and
// when it is, it scrolls horizontally through this same function with a different `anchor` and a
// different pair of sizes. One rule, two axes.
//
// ========================= FRAMES, NOT SECONDS =========================
// `damping` is per FRAME, because the engine's `update(dt)` counts in frames. Reading it as a rate per
// second would make the camera roughly sixty times too slow.

export interface CameraConfig {
  /** How much of the world the screen shows along this axis. */
  readonly viewHeight: number;
  /** How much there is to show. */
  readonly worldHeight: number;
  /** Where along the view the camera prefers to keep the ball, measured from the near edge. */
  readonly anchor: number;
  /** Error that must build up before the camera starts moving. */
  readonly startTolerance: number;
  /** Error at which it stops again. STRICTLY SMALLER — that is the hysteresis. */
  readonly stopTolerance: number;
  /** Fraction of the remaining error covered per FRAME. */
  readonly damping: number;
  /** Hard cap, as a fraction of the ball's own speed along this axis. Strictly below 1. */
  readonly maxSpeedFactor: number;
}

export interface CameraState {
  readonly offset: number;
  /** Whether the camera is currently correcting. Half of the hysteresis lives here. */
  readonly moving: boolean;
}

/**
 * The numbers the table starts with. Every one of them is meant to be adjusted per map during play
 * testing — the plan says so — and they are gathered here so that adjusting them is one edit.
 */
export const DEFAULT_CAMERA: CameraConfig = {
  viewHeight: 180,
  worldHeight: 235,
  // With the view at rest the ball reaches this line at a table height of 155, which is where the
  // follow was decided to begin.
  anchor: 100,
  startTolerance: 4,
  stopTolerance: 1,
  damping: 0.08,
  maxSpeedFactor: 0.6,
};

/** How far the view can travel. 55 pixels, for the shipped numbers. */
export function maxOffsetOf(config: CameraConfig): number {
  return Math.max(0, config.worldHeight - config.viewHeight);
}

/** The view starts at the far end of its travel: on the flippers. */
export function createCamera(config: CameraConfig): CameraState {
  return { offset: maxOffsetOf(config), moving: false };
}

const clamp = (value: number, low: number, high: number): number =>
  (value < low ? low : value > high ? high : value);

/** One axis, one frame. See this module's header for why it is written without an axis name. */
export function stepAxis(
  state: CameraState, config: CameraConfig, ballPosition: number, ballSpeed: number,
): CameraState {
  const limit = maxOffsetOf(config);
  const desired = clamp(ballPosition - config.anchor, 0, limit);
  const error = desired - state.offset;
  const distance = Math.abs(error);

  // Two thresholds, chosen by which state we are already in. This is the hysteresis.
  const moving = state.moving ? distance > config.stopTolerance : distance > config.startTolerance;
  if (!moving) return { offset: state.offset, moving: false };

  let step = error * config.damping;
  // Never faster than the ball. Not a soft preference.
  const cap = Math.abs(ballSpeed) * config.maxSpeedFactor;
  if (Math.abs(step) > cap) step = Math.sign(step) * cap;

  // A guard, not a rule: `desired` is already inside the range and a step never exceeds the error,
  // so while `damping` stays at or below 1 this clamp cannot fire. It is here for the day someone
  // raises the damping past 1, and a test pins that precondition rather than this line.
  return { offset: clamp(state.offset + step, 0, limit), moving: true };
}

/** The vertical camera: `stepAxis` with the ball's vertical position and speed. */
export function stepCamera(
  state: CameraState, config: CameraConfig, ball: { readonly y: number; readonly speedY: number },
): CameraState {
  return stepAxis(state, config, ball.y, ball.speedY);
}
