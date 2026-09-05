// SPDX-License-Identifier: AGPL-3.0-or-later
// control/two-stage — the four missions that are two missions. Ports of
// `SpaceRadiationController`, `StrayCometController`, `BlackHoleThreatController` and
// `RescueMissionController`.
//
// ========================= A MESSAGE FIELD USED AS A BITMASK =========================
// `SpaceRadiationController` opens with `if (lite104->MessageField == 7)`, and 7 is not a count. The
// hazard spot targets write `lite104->MessageField |= 1u`, `|= 2u`, `|= 4u` — ONE BIT PER TARGET — so
// seven means all three are down and the mission tests the whole set with a single comparison.
//
// The promotion is then written as FIFTEEN: seven, plus a bit no target can set. That is what makes
// the stage-two test unambiguous. The same field carries "which targets are down" and "which stage we
// are in", and they cannot be confused because the two live in different bits.
//
// The lamp holding that mask is `lite104`, which is ALSO one of the three lamps the targets light. One
// lamp, its own lit state, and a bitmask about its neighbours in its message field.
//
// ========================= AND THE MASK OUTLIVES THE LAMPS =========================
// The hazard spot targets flash their lamp group off when all three are down, but they never clear the
// mask. Only the mission clears it, when it takes over. So the same three hits are remembered twice,
// with different lifetimes: the lamps say "you just did this", the mask says "this is still true".
//
// ========================= THE OTHER TWO READ SOMEBODY ELSE'S STATE =========================
// `BlackHoleThreatController` and `RescueMissionController` have the same two-stage shape, but their
// stage is not theirs. One reads `bump5->BmpIndex`, the bumper level that the LAUNCH LANES raise; the
// other reads `lite20`, which `table_set_flag_lights` lights and which the BOOSTER TARGET BANK grants.
// So a mission's second stage can be unlocked from the far side of the table by something that has
// never heard of it.
//
// The two families are kept apart here rather than merged behind a flag. They differ in where the lamp
// swap happens — the masked pair swap once, at the promotion; the gated pair swap on every
// announcement, guarded by "if it is not already" — and merging them would restart a lamp's flash
// cycle at moments the original does not.

import type { ControlledComponent } from './dispatch.js';
import type { MissionController } from './mission.js';
import { specialAddScore, type ScoreState } from './score.js';

/** All three hazard targets down. One bit each. */
export const MASK_ALL_TARGETS = 0b111;
/** Seven plus a bit no target can set: the mission is in its second stage. */
export const MASK_STAGE_TWO = 0b1111;

export interface StageLamp {
  readonly on: boolean;
  turnOff(): void;
  resetTimed(): void;
  flasherStartTimed(seconds: number): void;
}

interface TwoStageBase {
  readonly stageOneLamp?: StageLamp;
  readonly stageTwoLamp?: StageLamp;
  /** Hitting one of these finishes the mission, once the stage allows it. */
  readonly stageTwoComponents: readonly ControlledComponent[];
  readonly missionLamp: { messageField: number };
  readonly score: ScoreState;
  readonly addRankProgress: (points: number) => boolean;
  readonly award: number;
  readonly rankPoints: number;
  readonly texts: {
    readonly stageOne: string;
    readonly stageTwo: string;
    readonly complete: string;
    readonly score: (points: number) => string;
  };
  readonly onTakeOver: () => void;
  readonly playCompleteSound?: () => void;
}

type Ctx = Parameters<MissionController>[2];

/** `TLightResetAndTurnOff`. */
function darken(lamp: StageLamp | undefined): void {
  if (!lamp) return;
  lamp.resetTimed();
  lamp.turnOff();
}

/** The shared ending: lamps off, hand back to selection, pay, and let a promotion take the message. */
function finish(o: TwoStageBase, ctx: Ctx): void {
  darken(o.stageOneLamp);
  darken(o.stageTwoLamp);

  o.missionLamp.messageField = 1;
  ctx.dispatch('ControlMissionComplete', null);
  ctx.showMissionText(o.texts.complete, 4);

  const points = specialAddScore(o.score, o.award);
  // A PROMOTION OUTRANKS A SCORE — the two never compete for the same text box.
  if (!o.addRankProgress(o.rankPoints)) {
    ctx.showMissionText(o.texts.score(points), 8);
    o.playCompleteSound?.();
  }
}

/* ===================== THE MASKED PAIR ===================== */

export interface MaskedTwoStageOptions extends TwoStageBase {
  /** `lite104` / `lite107`. Its message field is the bitmask. */
  readonly maskLamp: { messageField: number };
  /** Hitting one of these checks the mask; the targets themselves set the bits elsewhere. */
  readonly stageOneComponents: readonly ControlledComponent[];
  /** `SpaceRadiationController` advances the wormhole here. */
  readonly onEnterStageTwo?: () => void;
}

export function makeMaskedTwoStageMission(o: MaskedTwoStageOptions): MissionController {
  return (code, caller, ctx) => {
    if (code === 'ControlMissionComplete') {
      o.onTakeOver();
      o.maskLamp.messageField = 0;
      o.stageOneLamp?.flasherStartTimed(0);
      return;
    }

    if (code === 'ControlMissionStarted') {
      const stageTwo = o.maskLamp.messageField === MASK_STAGE_TWO;
      ctx.showMissionText(stageTwo ? o.texts.stageTwo : o.texts.stageOne, -1);
      return;
    }

    if (code !== 'ControlCollision' || !caller) return;

    if (o.stageOneComponents.includes(caller)) {
      // Only the full mask promotes; a partial one is simply not yet.
      if (o.maskLamp.messageField !== MASK_ALL_TARGETS) return;

      o.maskLamp.messageField = MASK_STAGE_TWO;
      darken(o.stageOneLamp);
      o.stageTwoLamp?.flasherStartTimed(0);
      o.onEnterStageTwo?.();
      ctx.dispatch('ControlMissionStarted', caller);
      return;
    }

    if (!o.stageTwoComponents.includes(caller)) return;
    if (o.maskLamp.messageField !== MASK_STAGE_TWO) return;

    finish(o, ctx);
  };
}

/* ===================== THE GATED PAIR ===================== */

export interface GatedTwoStageOptions extends TwoStageBase {
  /** Reads state this mission does not own. See this module's header. */
  readonly inStageTwo: () => boolean;
  /** Hitting one of these only re-announces; it cannot advance anything. */
  readonly stageOneComponents: readonly ControlledComponent[];
  /** `lite56` again, for the one of the two that counts. */
  readonly counterLamp?: { messageField: number };
  readonly count?: number;
}

export function makeGatedTwoStageMission(o: GatedTwoStageOptions): MissionController {
  const count = o.count ?? 1;

  return (code, caller, ctx) => {
    if (code === 'ControlMissionComplete') {
      o.onTakeOver();
      if (o.counterLamp) o.counterLamp.messageField = count;
      return;
    }

    if (code === 'ControlMissionStarted') {
      // The lamp swap lives HERE, on every announcement, guarded both ways.
      //
      // Only the DARKEN guard can ever fire. `light_on()` reports the persistent state, and
      // `TLightFlasherStartTimed` does not set it (see `table/light`: flashing is a separate layer),
      // so `if (!lamp.on)` before a flash is always true and the lamp is re-flashed every time this
      // runs. The guard is dead in the original and it is transcribed dead, because writing it as an
      // unconditional flash would be asserting something about `TLight` that this module has no
      // business knowing.
      if (o.inStageTwo()) {
        ctx.showMissionText(o.texts.stageTwo, -1);
        if (o.stageOneLamp?.on) darken(o.stageOneLamp);
        if (!o.stageTwoLamp?.on) o.stageTwoLamp?.flasherStartTimed(0);
      } else {
        ctx.showMissionText(o.texts.stageOne, -1);
        if (o.stageTwoLamp?.on) darken(o.stageTwoLamp);
        if (!o.stageOneLamp?.on) o.stageOneLamp?.flasherStartTimed(0);
      }
      return;
    }

    if (code !== 'ControlCollision' || !caller) return;

    if (o.stageOneComponents.includes(caller)) {
      ctx.dispatch('ControlMissionStarted', caller);
      return;
    }

    if (!o.stageTwoComponents.includes(caller)) return;
    if (!o.inStageTwo()) return;

    if (o.counterLamp) {
      o.counterLamp.messageField -= 1;
      if (o.counterLamp.messageField > 0) {
        ctx.dispatch('ControlMissionStarted', caller);
        return;
      }
    }

    finish(o, ctx);
  };
}
