// SPDX-License-Identifier: AGPL-3.0-or-later
// control/hyperspace — the largest single control function in the game. Port of
// `HyperspaceKickOutControl`.
//
// ========================= THE LADDER IS THE LAMP COUNT, READ BEFORE IT GROWS =========================
// The first two lines are the whole design:
//
//     auto activeCount = hyper_lights->Message(TLightGroupGetOnCount, 0);
//     HyperspaceLightGroupControl(TLightGroupResetAndTurnOn, hyper_lights);
//     switch (activeCount) { … }
//
// Read the count, THEN light one more, then branch on what the count was. So each visit to the
// hyperspace kickout is worth more than the last, with no counter anywhere — the row of lamps in
// front of the player is the ladder, and reading it the other way round would skip the bottom rung
// and start every ball at the jackpot.
//
//   0 → a plain score
//   1 → COLLECT the jackpot, and reset it to 20000
//   2 → raise the drain blocker
//   3 → arm the extra ball
//   4 → clear the lamps, pay the top score, and hand that score to the gravity well
//
// The fifth rung switching the group off is what makes the ladder renewable: it is a cycle, not a
// one-off. And note the score indices — 0, then 2, 3, 4. Index 1 is never used, because rung 1 pays
// the jackpot instead of a table score.
//
// ========================= THREE LAMPS ON TOP, ONE OF WHICH IS THE CLIMAX =========================
// After the ladder comes the same three-bit flag as `LaunchRampControl`, and again only the first bit
// pays. But the third bit, `lite130`, is where the whole table is handed over at once: the multiplier,
// the bumper targets, the jackpot, the bonus, the flag lights, the bonus hold, two warp lamps, the
// extra ball, the drain blocker, possibly multiball, and the gravity well. Eleven awards, written as a
// straight line of statements. The game's biggest moment is not a mission — it is a list.
//
// It also puts a FLOOR under the jackpot and the bonus rather than setting them: a player who has
// already built them past 100000 keeps what they built.
//
// ========================= THE FANFARE RETURNS EARLY =========================
// The `lite130` sound path plays three sounds, flashes the reflex lamp for the sound's duration PLUS
// five rather than a flat five, and returns before the ordinary tail. Everything else falls through to
// one sound, a five-second flash, and a kickout timer of the sound's own length — the ball is held
// exactly as long as the noise, the same idea as the gravity well.

import { getScoring, type ControlFunc } from './dispatch.js';
import { addScore, specialAddScore, type ScoreState } from './score.js';
import type { LaneLight } from './lanes.js';

/** What the jackpot drops to the moment it is collected. */
export const JACKPOT_AFTER_COLLECT = 20000;
/** The floor the climax puts under the jackpot and the bonus. It never lowers them. */
export const AWARD_FLOOR = 100000;

export interface HyperspaceTexts {
  readonly plain: (points: number) => string;
  readonly jackpot: (points: number) => string;
  readonly blocker: (points: number) => string;
  readonly extraBall: (points: number) => string;
  readonly reflex: (points: number) => string;
}

export interface HyperspaceSounds {
  readonly reflexOnly: string;
  readonly pair: string;
  /** Three at once, for the climax. */
  readonly fanfare: readonly string[];
  /** One per ladder rung, by the count that was read. */
  readonly ladder: Readonly<Record<number, string>>;
  readonly ladderDefault: string;
}

export interface HyperspaceKickOutOptions {
  readonly lights: { readonly onCount: number; turnOff(): void };
  /** `HyperspaceLightGroupControl(TLightGroupResetAndTurnOn)` — one more lamp, and its decay timer. */
  readonly lightOneMore: () => void;
  readonly table: { jackpotScore: number };
  readonly reflexScore: () => number;
  readonly lamps: {
    /** `lite25`. */
    readonly reflex: LaneLight;
    /** `lite26`. Changes nothing but the sound. */
    readonly second: LaneLight;
    /** `lite130`. The climax. */
    readonly everything: LaneLight;
  };
  readonly raiseBlocker: () => void;
  readonly armExtraBallLamp: () => void;
  readonly armGravityWell: (points: number) => void;
  readonly awardEverything: () => void;
  readonly kickout: { restartTimer(seconds: number): void };
  readonly texts: HyperspaceTexts;
  readonly sounds: HyperspaceSounds;
  /** Returns the sound's duration, as `TSound::Play` does — the ball is held exactly that long. */
  readonly playSound: (name: string) => number;
}

export function makeHyperspaceKickOutControl(o: HyperspaceKickOutOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;

    // Read the ladder, THEN climb it. See this module's header.
    const rung = o.lights.onCount;
    o.lightOneMore();

    switch (rung) {
      case 0:
        ctx.showInfo(o.texts.plain(addScore(ctx.score, getScoring(caller, 0))), 2);
        break;

      case 1: {
        // Unmultiplied, and the accumulator drops back to a small number the moment it is taken.
        const points = specialAddScore(ctx.score, o.table.jackpotScore);
        ctx.showInfo(o.texts.jackpot(points), 2);
        o.table.jackpotScore = JACKPOT_AFTER_COLLECT;
        break;
      }

      case 2:
        o.raiseBlocker();
        ctx.showInfo(o.texts.blocker(addScore(ctx.score, getScoring(caller, 2))), 2);
        break;

      case 3:
        o.armExtraBallLamp();
        ctx.showInfo(o.texts.extraBall(addScore(ctx.score, getScoring(caller, 3))), 2);
        break;

      case 4:
        // The ladder restarts here, which is what makes it a cycle.
        o.lights.turnOff();
        o.armGravityWell(addScore(ctx.score, getScoring(caller, 4)));
        break;

      default:
        break;
    }

    // The same three-bit flag as the launch ramp, and again only the first bit pays.
    let flag = 0;
    if (o.lamps.reflex.lit) {
      flag = 1;
      ctx.showInfo(o.texts.reflex(specialAddScore(ctx.score, o.reflexScore())), 2);
    }
    if (o.lamps.second.lit) flag |= 2;
    if (o.lamps.everything.lit) {
      flag |= 4;
      o.lamps.everything.resetTimed();
      o.lamps.everything.turnOff();
      o.awardEverything();
    }

    if (flag > 3) {
      // The climax: three sounds, a longer flash, and no ordinary tail.
      let held = 0;
      for (const sound of o.sounds.fanfare) held = o.playSound(sound) || held;
      o.lamps.reflex.flasherStartTimed(held + 5);
      o.kickout.restartTimer(held);
      return;
    }

    let name: string;
    if (flag === 1) name = o.sounds.reflexOnly;
    else if (flag) name = o.sounds.pair;
    else name = o.sounds.ladder[rung] ?? o.sounds.ladderDefault;

    const held = o.playSound(name);
    o.lamps.reflex.flasherStartTimed(5);
    o.kickout.restartTimer(held);
  };
}

/* ===================== THE CLIMAX, ON ITS OWN ===================== */

export interface EverythingAwardOptions {
  readonly table: { jackpotScore: number; readonly multiballFlag: boolean };
  readonly score: ScoreState;
  /** `lite27` and `lite28`, the return-lane lamps the space warp normally lights. */
  readonly warpLamps: readonly LaneLight[];
  readonly enableMultiplier: () => void;
  readonly lightBumperTargets: () => void;
  readonly setJackpot: () => void;
  readonly setBonus: () => void;
  readonly setFlagLights: () => void;
  readonly setBonusHold: () => void;
  readonly armExtraBallLamp: () => void;
  readonly raiseBlocker: () => void;
  readonly setMultiball: (seconds: number) => void;
  /** Its duration is how long the multiball award runs. */
  readonly multiballSound: () => number;
  readonly armGravityWell: () => void;
}

/**
 * The `lite130` branch, written out. Eleven awards in a straight line — the game's biggest moment is a
 * list, not a mission — ending with a floor under the two accumulators rather than a value, so a
 * player who already built them past 100000 keeps what they built.
 */
export function awardEverything(o: EverythingAwardOptions): void {
  o.enableMultiplier();
  o.lightBumperTargets();
  o.setJackpot();
  o.setBonus();
  o.setFlagLights();
  o.setBonusHold();
  for (const lamp of o.warpLamps) {
    lamp.resetTimed();
    lamp.turnOn();
  }
  o.armExtraBallLamp();
  o.raiseBlocker();

  if (o.table.multiballFlag) o.setMultiball(o.multiballSound());

  if (o.table.jackpotScore < AWARD_FLOOR) o.table.jackpotScore = AWARD_FLOOR;
  if (o.score.bonusScore < AWARD_FLOOR) o.score.bonusScore = AWARD_FLOOR;

  o.armGravityWell();
}
