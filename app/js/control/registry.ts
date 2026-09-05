// SPDX-License-Identifier: AGPL-3.0-or-later
// control/registry — the behaviours an AUTHORED table may ask for.
//
// ========================= TWO VOCABULARIES, AND THE REASON THEY ARE TWO =========================
// The 1995 control layer is transcribed and complete: thirty-two missions, a hundred and forty-five
// components, the calibrated numbers. It is also written for the 1995 TABLE. `BoosterTargetControl`
// wants a target bank and an award chain; `LaunchRampControl` wants lamps called `lite55` and `lite56`
// and a mission lamp with a message field; `WormHoleControl` wants three wells that know about each
// other. An authored table has none of those and no way to declare them.
//
// The five authored tables nevertheless named six of those controls, plus one — `ReentryLanesRollover`
// — that exists nowhere in the project. Every one of them passed validation, was drawn, and did
// nothing. That is the third time in this port that something declared turned out to be inert, after
// the target with no collision and the flipper the player could not move, and it is the same defect
// each time: a gate proves what it looks at, and nothing was looking here.
//
// So the vocabularies are separate, which the plan always implied — the 1995 controls belong to the
// 1995 table, which is the VALIDATION configuration, and the authored table is what ships. What an
// authored table may ask for is what it can actually supply the arguments for, and `validateTable`
// refuses anything else BY NAME rather than accepting it and doing nothing.
//
// ========================= THE SET IS SMALL ON PURPOSE =========================
// Six behaviours cover everything the five tables do. A seventh goes in when a table needs it and can
// declare what it needs — not before, and not because the 1995 table has one.

import {
  bumperControl, rebounderControl, getScoring,
  type ControlFunc, type ControlledComponent, type ControlContext,
} from './dispatch.js';
import { addScore } from './score.js';

/**
 * What an authored component carries into its control. `self` on `ControlledComponent` is `unknown`
 * because the 1995 components are forty different classes; an authored one is always this.
 */
export interface AuthoredSelf {
  /** How many times it has been hit this ball. `bumperControl` indexes its score table with it. */
  level: number;
  /** The lamps the component declared, resolved by name at dispatch time. */
  readonly lamps: readonly string[];
}

export function authoredSelf(lamps: readonly string[] = []): AuthoredSelf {
  return { level: 0, lamps: [...lamps] };
}

const selfOf = (caller: ControlledComponent): AuthoredSelf | undefined =>
  caller.self as AuthoredSelf | undefined;

/**
 * `TargetControl`. A target is worth more the second time, which is the shape every target in the 1995
 * table has (`[partial, complete]`) without any of the bank machinery around it. It lights whatever
 * lamps the component declared, and it stops climbing at the end of its own score table.
 */
export const targetControl: ControlFunc = (code, caller, ctx) => {
  if (code !== 'ControlCollision') return;
  const self = selfOf(caller);
  const level = self ? self.level : 0;
  addScore(ctx.score, getScoring(caller, level));
  if (self) {
    // Clamped rather than wrapped: a target that cycled back to its cheapest score on the third hit
    // would pay less for more work.
    self.level = Math.min(self.level + 1, Math.max(0, caller.scores.length - 1));
    for (const lamp of self.lamps) ctx.light(lamp)?.turnOn();
  }
};

/**
 * `RampControl`. One score and a lamp lit while the ball is on it. The 1995 ramp branches on three
 * lamps and pays four different ways; an authored ramp has one lamp and one score, and saying so is
 * better than pretending the branch exists.
 */
export const rampControl: ControlFunc = (code, caller, ctx) => {
  if (code !== 'ControlCollision') return;
  addScore(ctx.score, getScoring(caller, 0));
  for (const lamp of selfOf(caller)?.lamps ?? []) ctx.light(lamp)?.turnOnTimed(1);
};

/**
 * `LaneControl`. A rollover: score once and light, and do not climb. A lane the ball crosses twice in
 * a second should not pay twice as much the second time — that is what a target does, and the
 * difference between the two is the whole reason both exist.
 */
export const laneControl: ControlFunc = (code, caller, ctx) => {
  if (code !== 'ControlCollision') return;
  addScore(ctx.score, getScoring(caller, 0));
  for (const lamp of selfOf(caller)?.lamps ?? []) ctx.light(lamp)?.turnOn();
};

/**
 * `DrainControl`. Deliberately EMPTY on a collision, and that is not a stub.
 *
 * A drain is a hole: nothing collides with it, so `ControlCollision` never arrives here at all. Losing
 * the ball is a position test (`drainedBy`) that the game loop owns, and the bonus payout is
 * `control/drain`'s four-question cascade, which needs a game around it rather than a component. This
 * entry exists so a drain can NAME a control without the registry refusing it, and it does nothing
 * because there is nothing here for it to do.
 */
export const drainControl: ControlFunc = () => {};

/** `PlungerControl`. Same shape and same reason: the launch is the game's, not the component's. */
export const plungerControl: ControlFunc = () => {};

/**
 * The whole vocabulary. Frozen because a table naming something outside it must be refused, and a
 * registry that could be extended at run time could not be checked at validation time.
 */
export const AUTHORED_CONTROLS: Readonly<Record<string, ControlFunc>> = Object.freeze({
  BumperControl: bumperControl,
  RebounderControl: rebounderControl,
  TargetControl: targetControl,
  RampControl: rampControl,
  LaneControl: laneControl,
  DrainControl: drainControl,
  PlungerControl: plungerControl,
});

export function controlNamed(name: string): ControlFunc | undefined {
  return AUTHORED_CONTROLS[name];
}

/** The names, for the validator's message — a refusal that does not say what IS allowed is a riddle. */
export const AUTHORED_CONTROL_NAMES: readonly string[] = Object.keys(AUTHORED_CONTROLS);

export type { ControlContext };
