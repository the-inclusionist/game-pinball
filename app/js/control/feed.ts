// SPDX-License-Identifier: AGPL-3.0-or-later
// control/feed — putting a ball back into play. Ports of `PlungerControl` and
// `DrainBallBlockerControl`. The other half of the story is `drainTimerExpired` in `control/drain`.
//
// ========================= ONE `if` DEFINES WHAT A SAVED BALL KEEPS =========================
// `PlungerStartFeedTimer` reads like the new-ball setup routine, and it is — but the whole of it sits
// inside `if (!lite200->light_on())`. `lite200` is the shoot-again lamp, so the lamp that saved the
// ball also means "this is the same ball continuing", and a saved ball inherits the launch chute, the
// trek lights, the fuel, the reflex score and the multiplier exactly as it left them.
//
// That is the counterpart to the drain's reset list. Between them, three things decide what survives
// what: the drain's fifty named lamps say what belongs to a ball, the omissions from that list say
// what belongs to a game, and this single `if` says what a SAVE is worth beyond the ball itself.
//
// `lite200->MessageField = 0` is outside the guard, because it is not game state — it is the latch
// `ShootAgainLightControl` uses against its own fade (see `control/launch`), cleared so the next one
// can happen.
//
// ========================= THE BLOCKER IS SOLID, THEN FLASHING, THEN GONE =========================
// `DrainBallBlockerControl` gives the blocker across the drain two lives: an initial duration with the
// lamp lit STEADY, and, when that expires, an extended one with the lamp FLASHING. Nothing is written
// on screen; the lamp's behavior is the entire countdown, and the player learns that flashing means
// "about to open" from the one thing that ever happens next.
//
// In easy mode the duration is -1 — the third place in this port where a negative period means never
// (the escape chute sink holds a ball with it, the disabled multiplier stops its clock with it). Easy
// mode does not make the blocker last longer. It removes its clock.

import type { ControlFunc } from './dispatch.js';

/** `TableG->ReflexShotScore` is set to this at the start of every new ball. */
export const NEW_BALL_REFLEX_SCORE = 25000;

/** A light group as the feed drives it. */
export interface FeedGroup {
  readonly onCount: number;
  lightsResetAndTurnOn(): void;
  lightsResetAndTurnOff(): void;
  offsetAnimationForward(period: number): void;
  animationBackward(period: number): void;
}

export interface FeedTable {
  /** The cheat, switched off by the mere act of feeding a ball. */
  unlimitedBalls: boolean;
  reflexShotScore: number;
}

export interface PlungerLamp {
  readonly on: boolean;
  turnOn(): void;
  resetTimed(): void;
  /** The self-retriggering latch, not game state. See this module's header. */
  messageField: number;
}

export interface PlungerControlOptions {
  readonly table: FeedTable;
  /** `lite200`. Lit, it means the ball being fed is a SAVED one. */
  readonly shootAgainLamp: PlungerLamp;
  /** `lite67`, relit alone so the launch chute starts fresh. */
  readonly firstSkillLamp: { turnOn(): void; resetTimed(): void };
  readonly skillShotGroup: FeedGroup;
  readonly trekGroups: readonly FeedGroup[];
  /** The rank circle. Nudged forward only when it is completely dark. */
  readonly middleCircle: FeedGroup;
  readonly fuelBargraph: FeedGroup;
  readonly gates: readonly { disable(): void }[];
  readonly isEasyMode: () => boolean;
  readonly blocker: { readonly active: boolean; enable(): void };
  readonly disableMultiplier: () => void;
}

export function makePlungerControl(o: PlungerControlOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code === 'PlungerFeedBall') {
      // The mission machine is told directly; it is not listening for the plunger.
      ctx.missionControl('ControlMissionStarted', caller, ctx);
      if (o.isEasyMode() && !o.blocker.active) o.blocker.enable();
      return;
    }

    if (code !== 'PlungerStartFeedTimer') return;

    o.table.unlimitedBalls = false;
    if (!o.middleCircle.onCount) o.middleCircle.offsetAnimationForward(0);

    if (!o.shootAgainLamp.on) {
      // Everything below happens ONLY for a genuinely new ball. See this module's header.
      o.skillShotGroup.lightsResetAndTurnOff();
      o.firstSkillLamp.resetTimed();
      o.firstSkillLamp.turnOn();
      o.skillShotGroup.animationBackward(0.25);

      for (const trek of o.trekGroups) {
        trek.lightsResetAndTurnOff();
        trek.offsetAnimationForward(0.2);
        trek.animationBackward(0.2);
      }

      o.table.reflexShotScore = NEW_BALL_REFLEX_SCORE;
      o.disableMultiplier();
      o.fuelBargraph.lightsResetAndTurnOn();
      o.shootAgainLamp.resetTimed();
      o.shootAgainLamp.turnOn();
      for (const gate of o.gates) gate.disable();
    }

    // Outside the guard: the latch, not the state.
    o.shootAgainLamp.messageField = 0;
  };
}

/* ===================== THE DRAIN BLOCKER ===================== */

export interface BlockerLike {
  /** 0 not raised, 1 in its solid phase, 2 in its flashing extension. */
  messageField: number;
  enable(duration: number): void;
  restartTimeout(duration: number): void;
  disable(): void;
}

export interface DrainBlockerOptions {
  readonly blocker: BlockerLike;
  /** `lite1`. Steady through the first phase, flashing through the second. */
  readonly lamp: { turnOnTimed(seconds: number): void; flasherStartTimed(seconds: number): void };
  readonly initialDuration: number;
  readonly extendedDuration: number;
  readonly isEasyMode: () => boolean;
}

export function makeDrainBallBlockerControl(o: DrainBlockerOptions): ControlFunc {
  return (code) => {
    if (code === 'TBlockerEnable') {
      o.blocker.messageField = 1;
      // -1 never expires: in easy mode the blocker has no clock at all.
      const duration = o.isEasyMode() ? -1 : o.initialDuration;
      o.blocker.enable(duration);
      o.lamp.turnOnTimed(duration);
      return;
    }

    if (code !== 'ControlTimerExpired') return;

    if (o.blocker.messageField === 1) {
      o.blocker.messageField = 2;
      o.blocker.restartTimeout(o.extendedDuration);
      o.lamp.flasherStartTimed(o.extendedDuration);
      return;
    }

    o.blocker.messageField = 0;
    o.blocker.disable();
  };
}
