// SPDX-License-Identifier: AGPL-3.0-or-later
// control/dispatch — how every event on the table reaches the game's rules. Port of
// `control::handler` and `TPinballComponent::get_scoring`.
//
// ========================= EVERY EVENT IS DISPATCHED TWICE, ALWAYS =========================
// The whole of `control::handler` is four lines:
//
//     auto control = cmp->Control;
//     if (control) control->ControlFunc(code, cmp);
//     MissionControl(code, cmp);
//
// The component's own control function runs if it has one, and then the MISSION CONTROL runs
// UNCONDITIONALLY. Every collision, every timeout, every light change is seen twice: once by the
// thing that knows what this component does locally, and once by the state machine that knows what
// the player is currently trying to achieve.
//
// That is why nothing in the game subscribes to anything. The mission does not register interest in
// the ramps it cares about — it sees the whole table and decides for itself. Adding a mission means
// adding a branch, never wiring an event.
//
// ========================= AND THE SCORES ARE A TABLE, NOT CODE =========================
// A component's control entry carries an ARRAY of scores, and the control function picks an index out
// of it. A rebounder always takes index 0; a bumper takes its own level, so a bumper that has been hit
// more is worth more without a single conditional. An index past the end returns ZERO, silently — the
// original's own guard, and it is what keeps a component with a short score array from crashing when
// its level runs ahead.

import { addScore, type ScoreState } from './score.js';

/** The subset of the original's MessageCode that the control layer reacts to. */
export type MessageCode =
  | 'ControlCollision'
  | 'ControlTimerExpired'
  | 'ControlNotifyTimerExpired'
  | 'TLightResetAndTurnOn'
  | 'ControlBallReleased'
  | 'TLightGroupNull'
  | 'TLightGroupResetAndTurnOn'
  | 'ControlEnableMultiplier'
  | 'ControlDisableMultiplier'
  | 'ControlMissionStarted'
  | 'PlungerFeedBall'
  | 'PlungerStartFeedTimer'
  | 'TBlockerEnable'
  | 'ControlSpinnerLoopReset'
  | 'TLightTurnOn'
  | 'TBumperSetBmpIndex'
  | 'Reset'
  | 'SetTiltLock'
  | 'GameOver'
  | 'PlayerChanged';

/** A component as the control layer sees it: a score table and, sometimes, a behavior. */
export interface ControlledComponent {
  readonly name: string;
  /** The score table from the component's control entry. */
  readonly scores: readonly number[];
  control: ControlFunc | null;
  /** Whatever the component itself is; the control functions narrow it as they need. */
  readonly self?: unknown;
}

export type ControlFunc = (code: MessageCode, caller: ControlledComponent, ctx: ControlContext) => void;

/** Everything a control function is allowed to reach. */
export interface ControlContext {
  readonly score: ScoreState;
  readonly table: TableFlags;
  /** Looks a lamp up by its tag name, as the original's globals do. */
  light(name: string): LightLike | undefined;
  group(name: string): LightGroupLike | undefined;
  showInfo(text: string, seconds: number): void;
  showMission(text: string, seconds: number): void;
  playSound(name: string): void;
  playMusic(track: string): void;
  /** The mission state machine. Runs on EVERY event — see this module's header. */
  missionControl(code: MessageCode, caller: ControlledComponent, ctx: ControlContext): void;
}

export interface TableFlags {
  extraBalls: number;
  multiballCount: number;
  ballCount: number;
  tiltLocked: boolean;
}

/** The slice of a lamp the control layer uses. */
export interface LightLike {
  turnOn(): void;
  turnOnTimed(seconds: number): void;
  resetTimed(): void;
  flasherStartTimed(seconds: number): void;
  readonly on: boolean;
}

export interface LightGroupLike {
  readonly onCount: number;
  readonly lightCount: number;
  turnOnNext(): boolean;
  resetGroup(): void;
}

/**
 * `TPinballComponent::get_scoring`. Out of range is ZERO and no complaint — the original's own guard.
 */
export function getScoring(component: ControlledComponent, index: number): number {
  if (index < 0 || index >= component.scores.length) return 0;
  return component.scores[index]!;
}

/** `control::handler`. Both dispatches, in this order, every time. */
export function handler(code: MessageCode, component: ControlledComponent, ctx: ControlContext): void {
  if (component.control) component.control(code, component, ctx);
  ctx.missionControl(code, component, ctx);
}

/* ===================== THE FIRST BATCH OF CONTROL FUNCTIONS ===================== */
//
// They are this small on purpose. Almost every part of the table does one of three things on a hit:
// score a fixed entry, score an entry chosen by its own state, or score and light something.

/** `RebounderControl`: the plainest one there is. */
export const rebounderControl: ControlFunc = (code, caller, ctx) => {
  if (code !== 'ControlCollision') return;
  addScore(ctx.score, getScoring(caller, 0));
};

/**
 * `BumperControl`: the score is indexed by THE BUMPER'S OWN LEVEL, so a bumper that has been hit more
 * is worth more — with no conditional anywhere, just a different index into the same table.
 */
export const bumperControl: ControlFunc = (code, caller, ctx) => {
  if (code !== 'ControlCollision') return;
  const level = (caller.self as { level?: number } | undefined)?.level ?? 0;
  addScore(ctx.score, getScoring(caller, level));
};

/**
 * `FlipperRebounderControl1`: score, and blink a lamp for a tenth of a second. The blink is the only
 * reason this is not `rebounderControl`.
 */
export function makeFlipperRebounderControl(lampName: string): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;
    ctx.light(lampName)?.turnOnTimed(0.1);
    addScore(ctx.score, getScoring(caller, 0));
  };
}
