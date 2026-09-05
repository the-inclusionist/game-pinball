// SPDX-License-Identifier: AGPL-3.0-or-later
// control/mission-specials — the last four cases of the mission switch, none of which is an ordinary
// mission. Ports of `AlienMenaceController`, `WaitingDeploymentController`, `TimeWarpPartTwoController`
// and `GameoverController`.
//
// ========================= ALIEN MENACE IS WON WITHOUT HITTING ANYTHING =========================
// It does not listen for a collision. It listens for `TBumperSetBmpIndex` — the message the bumper
// group sends when its LEVEL changes — and its take-over sets that level back to zero. So the mission
// is "raise the attack bumpers one level, starting now", and the thing that raises them is completing
// a bumper lane set (see `control/lanes` and `control/banks`). The lanes, the bumper level and this
// mission are one mechanism read at three points, and nothing connects them but the message.
//
// ========================= TIME WARP PART TWO CAN COST YOU A RANK =========================
// The only controller in the game whose two qualifying components pull in opposite directions: the
// ramp PROMOTES the player and the kickout DEMOTES them. Both then pay the same two million and end
// the mission. It is the one place the rank circle ever runs backwards.
//
// One deliberate deviation. In the promotion branch the original formats its message inside
// `if (onCount < 9)` and then displays it unconditionally — so at the top rank it prints an
// uninitialized stack buffer. That cannot be transcribed and should not be: at the top rank this port
// shows nothing, which is what the original was trying to do.
//
// ========================= GAME OVER IS A CAROUSEL DRIVEN BY A TEXT BOX =========================
// `GameoverController` keeps its whole state in `mission_text_box->MessageField`, as a tagged union:
// bit 0x100 means "showing player scores", bit 0x200 means "showing high scores", and the low bits are
// the cursor. Zero means "show the banner". Each `ControlMissionStarted` advances one step — and that
// message arrives when THE PREVIOUS TEXT EXPIRES. There is no timer, no loop and no index variable:
// the text box's own timeout is the clock.
//
// And the cursor is read back with `% 4` and `% 5` WITHOUT masking the phase bit off. For players that
// is harmless, because 0x100 is a multiple of 4. For high scores it is not: 0x200 is 512, and
// 512 mod 5 is 2, so the carousel enters at index 2 and then walks 0, 3, 1, 4. Every place is shown
// exactly once and they come out in the order THIRD, FIRST, FOURTH, SECOND, FIFTH. That is a defect,
// it is observable, and it is transcribed with a test that states the order.

import type { ControlledComponent } from './dispatch.js';
import type { MissionController } from './mission.js';
import { specialAddScore, type ScoreState } from './score.js';
import type { StageLamp } from './two-stage.js';

/* ===================== ALIEN MENACE ===================== */

export interface AlienMenaceOptions {
  /** `attack_bump`. Its level going up is the win condition; take-over resets it to zero. */
  readonly bumpers: { readonly level: number; setLevel(level: number): void };
  /** The component whose level change counts. `bump1`. */
  readonly watched: ControlledComponent;
  readonly lamp: StageLamp;
  readonly trekGroups: readonly {
    lightsResetAndTurnOff(): void;
    offsetAnimationForward(period: number): void;
    animationBackward(period: number): void;
  }[];
  readonly text: string;
  readonly nextMission: number;
  readonly missionLamp: { messageField: number };
}

export function makeAlienMenaceController(o: AlienMenaceOptions): MissionController {
  return (code, caller, ctx) => {
    if (code !== 'TBumperSetBmpIndex') {
      if (code === 'ControlMissionComplete') {
        // Start from zero, so the mission is "raise them ONE more level".
        o.bumpers.setLevel(0);
        for (const trek of o.trekGroups) {
          trek.lightsResetAndTurnOff();
          trek.offsetAnimationForward(0.2);
          trek.animationBackward(0.2);
        }
        o.lamp.flasherStartTimed(0);
      } else if (code !== 'ControlMissionStarted') {
        return;
      }
      ctx.showMissionText(o.text, -1);
      return;
    }

    if (caller !== o.watched) return;
    if (!o.bumpers.level) return;

    o.lamp.resetTimed();
    o.lamp.turnOff();
    o.missionLamp.messageField = o.nextMission;
    ctx.dispatch('ControlMissionComplete', null);
  };
}

/* ===================== WAITING FOR DEPLOYMENT ===================== */

export interface WaitingDeploymentOptions {
  /** The two one-ways out of the deployment chute. */
  readonly exits: readonly ControlledComponent[];
  readonly missionLamp: { messageField: number };
  readonly text: string;
  readonly clearMissionText: () => void;
  readonly setWaitingFlag: (waiting: boolean) => void;
  readonly playMusic: (track: string) => void;
}

/** `WaitingDeploymentController`: not a mission, a held breath. The ball leaving the chute ends it. */
export function makeWaitingDeploymentController(o: WaitingDeploymentOptions): MissionController {
  return (code, caller, ctx) => {
    switch (code) {
      case 'ControlCollision':
        if (!caller || !o.exits.includes(caller)) return;
        o.missionLamp.messageField = 1;
        ctx.dispatch('ControlMissionComplete', null);
        return;

      case 'ControlMissionComplete':
        o.clearMissionText();
        o.setWaitingFlag(false);
        o.playMusic('track1');
        return;

      case 'ControlMissionStarted':
        ctx.showMissionText(o.text, -1);
        return;

      default:
        return;
    }
  };
}

/* ===================== TIME WARP, PART TWO ===================== */

export interface TimeWarpPartTwoOptions {
  /** The rank circle. `onCount` is the rank. */
  readonly rankCircle: {
    readonly onCount: number;
    offsetAnimationBackward(period: number): void;
    resetAndTurnOn(period: number): void;
  };
  /** Hitting this DEMOTES. `kickout2`. */
  readonly demoteComponent: ControlledComponent;
  /** Hitting this PROMOTES. `ramp`. */
  readonly promoteComponent: ControlledComponent;
  readonly lamps: readonly StageLamp[];
  readonly missionLamp: { messageField: number };
  readonly score: ScoreState;
  readonly addRankProgress: (points: number) => boolean;
  readonly rankName: (index: number) => string;
  readonly texts: {
    readonly demoteHeadline: string;
    readonly promoteHeadline: string;
    readonly demoted: (rank: string) => string;
    readonly promoted: (rank: string) => string;
  };
  readonly playPromotionSound?: () => void;
}

export const TIME_WARP_AWARD = 2000000;
export const TIME_WARP_RANK_POINTS = 12;
/** The rank circle's size. The original guards with this constant, not with the circle. */
export const TOP_RANK = 9;

export function makeTimeWarpPartTwoController(o: TimeWarpPartTwoOptions): MissionController {
  return (code, caller, ctx) => {
    if (code === 'ControlMissionComplete') {
      for (const lamp of o.lamps) lamp.flasherStartTimed(0);
      return;
    }
    if (code === 'ControlMissionStarted') {
      ctx.showMissionText(o.texts.promoteHeadline, -1);
      return;
    }
    if (code !== 'ControlCollision' || !caller) return;

    if (caller === o.demoteComponent) {
      ctx.showMissionText(o.texts.demoteHeadline, 4);
      if (o.rankCircle.onCount > 1) {
        o.rankCircle.offsetAnimationBackward(5);
        // Read AFTER the step, so the name is the rank the player has been dropped to.
        ctx.showMissionText(o.texts.demoted(o.rankName(o.rankCircle.onCount - 1)), 8);
      }
    } else if (caller === o.promoteComponent) {
      ctx.showMissionText(o.texts.promoteHeadline, 4);
      let promotionText: string | null = null;
      if (o.rankCircle.onCount < TOP_RANK) {
        // Read BEFORE the step: the name is the rank being reached.
        promotionText = o.texts.promoted(o.rankName(o.rankCircle.onCount));
        o.rankCircle.resetAndTurnOn(5);
      }
      if (!o.addRankProgress(TIME_WARP_RANK_POINTS)) {
        // At the top rank the original prints an uninitialized buffer here. We print nothing.
        if (promotionText) {
          ctx.showMissionText(promotionText, 8);
          o.playPromotionSound?.();
        }
      }
    } else {
      return;
    }

    // Both halves pay the same, and both end the mission.
    specialAddScore(o.score, TIME_WARP_AWARD);
    for (const lamp of o.lamps) { lamp.resetTimed(); lamp.turnOff(); }
    o.missionLamp.messageField = 1;
    ctx.dispatch('ControlMissionComplete', null);
  };
}

/* ===================== GAME OVER ===================== */

/** Bit 0x100: the player-score carousel. */
export const PHASE_PLAYERS = 0x100;
/** Bit 0x200: the high-score carousel. */
export const PHASE_HIGH_SCORES = 0x200;

export interface GameoverOptions {
  /** The text box, whose message field IS the state. See this module's header. */
  readonly state: { messageField: number };
  readonly playerScores: readonly number[];
  readonly playerCount: number;
  readonly highScores: readonly number[];
  readonly goalLights: { lightsResetAndTurnOff(): void };
  readonly flippers: readonly { gameOver(): void }[];
  readonly enterGameOverMode: () => void;
  readonly playMusic: (track: string) => void;
  /** One line per place, indexed from 1. */
  readonly playerText: (place: number, score: number) => string | null;
  readonly highScoreText: (place: number, score: number) => string | null;
  readonly bannerText: string;
}

export function makeGameoverController(o: GameoverOptions): MissionController {
  return (code, _caller, ctx) => {
    if (code === 'ControlMissionComplete') {
      o.goalLights.lightsResetAndTurnOff();
      o.enterGameOverMode();
      for (const flipper of o.flippers) flipper.gameOver();
      o.state.messageField = 0;
      o.playMusic('track1');
      return;
    }
    if (code !== 'ControlMissionStarted') return;

    const state = o.state.messageField;

    if (state & PHASE_PLAYERS) {
      // The phase bit is NOT masked off; 0x100 is a multiple of 4, so players come out in order.
      const playerId = state % 4;
      const score = o.playerScores[playerId] ?? -1;
      const place = playerId + 1;
      if (score >= 0) {
        const text = o.playerText(place, score);
        if (text !== null) {
          ctx.showMissionText(text, 3);
          o.state.messageField = place === o.playerCount ? PHASE_HIGH_SCORES : (place | PHASE_PLAYERS);
          return;
        }
      }
      o.state.messageField = PHASE_HIGH_SCORES;
    }

    if (o.state.messageField & PHASE_HIGH_SCORES) {
      // 0x200 is 512 and 512 mod 5 is 2, so this carousel enters at index 2 and walks 0, 3, 1, 4.
      const index = o.state.messageField % 5;
      const score = o.highScores[index] ?? 0;
      const place = index + 1;
      if (score > 0) {
        const text = o.highScoreText(place, score);
        if (text !== null) {
          ctx.showMissionText(text, 3);
          o.state.messageField = place === 5 ? 0 : (place | PHASE_HIGH_SCORES);
          return;
        }
      }
    }

    o.state.messageField = PHASE_PLAYERS;
    ctx.showMissionText(o.bannerText, 10);
  };
}
