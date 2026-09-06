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
  /**
   * The voice this component speaks with, from `audio/voices.soundForKind`. Undefined is SILENT and is
   * a decision — a wall makes no sound because a resting ball would rattle against it.
   */
  readonly sound?: string;
  /** The drop-target bank this component belongs to, if any. See `targetBankControl`. */
  readonly bank?: string;
}

export function authoredSelf(
  lamps: readonly string[] = [], sound?: string, bank?: string,
): AuthoredSelf {
  return { level: 0, lamps: [...lamps], ...(sound ? { sound } : {}), ...(bank ? { bank } : {}) };
}

/** Every authored control sounds its component the same way, so the call lives in one place. */
function sound(caller: ControlledComponent, ctx: ControlContext): void {
  const voice = selfOf(caller)?.sound;
  if (voice) ctx.playSound(voice);
}

/** And lights it the same way. A lamp is state the player reads; declaring one is a promise. */
function light(caller: ControlledComponent, ctx: ControlContext): void {
  for (const lamp of selfOf(caller)?.lamps ?? []) ctx.light(lamp)?.turnOn();
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
  sound(caller, ctx);
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
 * `TargetBankControl`. A DROP target: it goes down when hit and stays down until the bank is cleared.
 *
 * ⚠️ THE DIFFERENCE FROM `TargetControl` IS THAT THE SECOND HIT DOES NOTHING. An ordinary target is
 * worth more every time the ball comes back; a drop target is not there any more. That is what makes
 * a bank a route round the table instead of something to rattle — which is exactly what
 * `crater-run`'s five-target "bank" was, five unrelated targets each paying again for ever, under a
 * mission that has said "derrube o banco de alvos" since the day it was written.
 *
 * ⚠️ AND IT TAKES THE BANK FROM THE CONTEXT RATHER THAN OWNING ONE. A bank is shared by its members
 * and its state has to outlive any single component: a bank held per-target would be five banks that
 * agree about nothing.
 *
 * The lamp is turned OFF on the way down and the bank's own clearing turns them back on, so the row
 * of lamps is the row of targets — the display is the state, which is the rule the 1995 machine
 * follows through `lite56` and this follows with something a table can declare.
 */
export const targetBankControl: ControlFunc = (code, caller, ctx) => {
  if (code !== 'ControlCollision') return;
  const self = selfOf(caller);
  const bank = self?.bank ? ctx.bank?.(self.bank) : undefined;
  // No bank means no drop and no reason to pretend: a member of a bank the table did not declare is
  // refused by `validateTable` long before this, so reaching here is a table nobody validated.
  if (!bank || !self) return;
  if (bank.isDown(caller.name)) return;

  sound(caller, ctx);
  addScore(ctx.score, getScoring(caller, 0));

  const cleared = bank.drop(caller.name);
  if (!cleared.completed) return;
  // ⚠️ THE LAMPS LIGHT WHEN THE BANK IS CLEARED, NOT AS EACH TARGET GOES DOWN, and that is what
  // `LightLike` allows rather than a design choice made freely: a control can turn a lamp ON and time
  // it, and there is no `turnOff` — `TLight` is switched off by its own timer or by a reset, which is
  // the original's arrangement and not one to work around from here. So the row of lamps marks the
  // ACHIEVEMENT, and which targets are still standing is shown by the targets themselves, which the
  // renderer stops drawing. Two ways of saying the state, neither of them a lamp lying about it.
  for (const lamp of self.lamps) ctx.light(lamp)?.turnOnTimed(3);
  addScore(ctx.score, cleared.award);
};

/**
 * `RampControl`. One score and a lamp lit while the ball is on it. The 1995 ramp branches on three
 * lamps and pays four different ways; an authored ramp has one lamp and one score, and saying so is
 * better than pretending the branch exists.
 */
export const rampControl: ControlFunc = (code, caller, ctx) => {
  if (code !== 'ControlCollision') return;
  sound(caller, ctx);
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
  sound(caller, ctx);
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
/**
 * ⚠️ `bumperControl` AND `rebounderControl` ARE THE 1995 ONES, TRANSCRIBED, and they do not sound
 * anything — in the original the sound is played by the COMPONENT, not by its control function. So an
 * authored table wraps them rather than editing them: the transcription stays a transcription.
 */
const withSound = (inner: ControlFunc): ControlFunc => (code, caller, ctx) => {
  if (code === 'ControlCollision') {
    sound(caller, ctx);
    // ⚠️ AND LIGHTS IT. Every bumper in the catalogue declared a lamp and none of them ever lit: in the
    // original a bumper lights ITSELF, through `TBumperSetBmpIndex` on the component, and the control
    // function has nothing to do with it. An authored bumper has no component behind it — the control
    // IS the component — so the lighting has to happen here or nowhere, and it was happening nowhere.
    light(caller, ctx);
  }
  inner(code, caller, ctx);
};

/**
 * ⚠️ WHICH CONTROLS CAN LIGHT A LAMP, so `validateTable` can refuse a component that names one and has
 * no way to turn it on. `DrainControl` and `PlungerControl` do nothing by design — a drain never
 * collides and a launch is the game's — so a drain that declares a lamp is promising feedback no code
 * path can deliver.
 */
export const LIGHTING_CONTROLS: readonly string[] = [
  'BumperControl', 'RebounderControl', 'TargetControl', 'TargetBankControl', 'RampControl',
  'LaneControl',
];

export const AUTHORED_CONTROLS: Readonly<Record<string, ControlFunc>> = Object.freeze({
  BumperControl: withSound(bumperControl),
  RebounderControl: withSound(rebounderControl),
  TargetControl: targetControl,
  TargetBankControl: withSound(targetBankControl),
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
