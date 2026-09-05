// SPDX-License-Identifier: AGPL-3.0-or-later
// control/drain — losing a ball. Port of `control::BallDrainControl`.
//
// ========================= THREE CHANCES, CHECKED IN ORDER =========================
// A ball reaching the drain is not necessarily lost. The original asks four questions in strict
// priority, and only the last one ends anything:
//
//   1. Is the SHOOT AGAIN lamp lit? Then it was already paid for: light it again and give the ball back.
//   2. Is the SPARE lamp lit? Then consume it — it becomes the shoot-again — and give the ball back.
//   3. Are other balls still in play? Then just switch off one multiball lamp. Nothing else happened.
//   4. Otherwise the ball is genuinely gone.
//
// ========================= AND THIS IS WHERE THE BONUS IS CASHED IN =========================
// `SpecialAddScore(TableG->BonusScore)` — the accumulator that has been shadowing every point scored
// all ball long becomes score here, unmultiplied. That is the whole reason the bonus flag exists:
// playing well raises a number that only pays when the ball dies.
//
// It is not the only payout. `BonusLaneRolloverControl` pays the same accumulator whenever `lite16` is
// lit, costs no ball, and does NOT clear it — so a lit bonus lamp is worth the bonus twice, once
// through the lane and again at the drain. See `control/lanes`. What is unique here is the reset that
// follows.
//
// ========================= THE RESET LIST IS THE DEFINITION OF "PER BALL" =========================
// The end of a ball switches off about fifty named lamps and groups, one at a time. There is no
// "reset everything" loop, and the omissions are the point: the rank circles, the mission progress and
// the score are simply NOT in the list, so they survive. The enumerated list IS the game's statement of
// what belongs to a ball and what belongs to a game.
//
// And the very last line is what `table_set_bonus_hold` bought: if the hold lamp is lit, spend it and
// keep the accumulated bonus; otherwise the bonus drops back to 25000. One lamp, one branch.

import { specialAddScore, type ScoreState } from './score.js';

/** The bonus every ball starts with, unless the previous one was held. */
export const BASE_BONUS = 25000;

export interface DrainLamp {
  /**
   * ⚠️ `TLight::light_on()` — `LightOnFlag || ToggledOnFlag || FlasherOnFlag`, not the persistent flag
   * alone. Awards light their lamps with `TLightTurnOnTimed`, so asking `on` here finds them dark.
   */
  readonly lit: boolean;
  turnOn(): void;
  turnOff(): void;
  resetTimed(): void;
  messageField: number;
}

export interface DrainTable {
  tiltLocked: boolean;
  multiballCount: number;
  extraBalls: number;
  ballCount: number;
  currentPlayer: number;
  playerCount: number;
  /** The cheat. When on, a drained ball simply comes back. */
  unlimitedBalls: boolean;
}

export interface DrainOptions {
  readonly table: DrainTable;
  readonly score: ScoreState;
  /** `lite200` — the shoot-again the player already holds. */
  readonly shootAgainLamp: DrainLamp;
  /** `lite199` — a spare, which becomes the shoot-again when spent. */
  readonly spareLamp: DrainLamp;
  /** `lite58` — holding it keeps the accumulated bonus across the drain. */
  readonly bonusHoldLamp: DrainLamp;
  /** `lite198` — the mission. Set to the game-over mission or back to waiting. */
  readonly missionLamp: { messageField: number };
  /** Everything switched off at the end of a ball. The omissions define what survives. */
  readonly perBallLamps: readonly { turnOff(): void; resetTimed(): void }[];
  /** Components reset at the end of a ball. */
  readonly perBallComponents: readonly { reset(): void }[];
  readonly missionOnGameOver: number;
  readonly missionOnNextBall: number;
  readonly showInfo: (text: string, seconds: number) => void;
  readonly playSound: (name: string) => void;
  readonly playMusic: (track: string) => void;
  readonly bonusText: (points: number) => string;
  readonly shootAgainText: (player: number) => string;
  readonly returnBall: () => void;
  readonly switchToNextPlayer: () => void;
  readonly dispatchMissionComplete: () => void;
  readonly clearTiltLock: () => void;
}

export interface DrainResult {
  /** What actually happened, so a caller can be tested against it. */
  readonly outcome: 'returned' | 'shootAgain' | 'spareSpent' | 'multiballContinues' | 'ballLost';
  /** True when that was the last ball of the last player. */
  readonly gameOver: boolean;
}

export function drainBall(o: DrainOptions): DrainResult {
  const t = o.table;

  if (t.unlimitedBalls) {
    o.returnBall();
    return { outcome: 'returned', gameOver: false };
  }

  if (t.tiltLocked) {
    // A tilted table forfeits the saves it was holding.
    o.shootAgainLamp.turnOff(); o.shootAgainLamp.resetTimed();
    o.spareLamp.turnOff(); o.spareLamp.resetTimed();
    o.playMusic('track1');
  }

  // 1. Already holding a shoot again.
  if (o.shootAgainLamp.lit) {
    o.playSound('drain');
    o.shootAgainLamp.turnOn(); o.shootAgainLamp.resetTimed();
    o.showInfo(o.shootAgainText(t.currentPlayer), -1);
    o.playSound('shootAgain');
    return { outcome: 'shootAgain', gameOver: false };
  }

  // 2. A spare, spent into a shoot again.
  if (o.spareLamp.lit) {
    o.playSound('drain');
    o.spareLamp.turnOff(); o.spareLamp.resetTimed();
    o.shootAgainLamp.turnOn(); o.shootAgainLamp.resetTimed();
    o.showInfo(o.shootAgainText(t.currentPlayer), 2);
    o.playSound('shootAgain');
    return { outcome: 'spareSpent', gameOver: false };
  }

  // 3. Other balls are still out there.
  if (t.multiballCount) {
    if (t.multiballCount === 1) o.playMusic('track1');
    return { outcome: 'multiballContinues', gameOver: false };
  }

  // 4. The ball is gone.
  if (!t.tiltLocked) {
    // THE BONUS PAYS OUT HERE, once, unmultiplied.
    const points = specialAddScore(o.score, o.score.bonusScore);
    o.showInfo(o.bonusText(points), 2);
  }

  let gameOver = false;

  if (t.extraBalls) {
    t.extraBalls--;
    o.playSound('shootAgain');
    o.showInfo(o.shootAgainText(t.currentPlayer), -1);
  } else {
    t.ballCount--;
    // The last ball of the LAST player is the only thing that ends a game.
    if (t.currentPlayer + 1 !== t.playerCount || t.ballCount) {
      o.switchToNextPlayer();
      o.spareLamp.messageField = 0;
    } else {
      o.spareLamp.messageField = 1;
      gameOver = true;
    }
    o.playSound('drain');
  }

  // THE RESET LIST. What is missing from it is what survives the ball.
  for (const lamp of o.perBallLamps) { lamp.turnOff(); lamp.resetTimed(); }
  for (const component of o.perBallComponents) component.reset();

  o.missionLamp.messageField = gameOver ? o.missionOnGameOver : o.missionOnNextBall;
  o.dispatchMissionComplete();
  o.clearTiltLock();

  // What bonus hold bought: spend the lamp and keep the accumulator, or start again from the base.
  if (o.bonusHoldLamp.lit) {
    o.bonusHoldLamp.turnOff();
    o.bonusHoldLamp.resetTimed();
  } else {
    o.score.bonusScore = BASE_BONUS;
  }

  return { outcome: 'ballLost', gameOver };
}

/* ===================== THE OTHER HALF, ONE TIMEOUT LATER ===================== */
//
// `BallDrainControl` has a second arm, `ControlTimerExpired`, which runs after the drain animation has
// had its moment. It decides between ending the game and feeding the next ball — and the ONLY thing it
// looks at is `lite199->MessageField`, the flag the collision arm left behind.
//
// So the two halves of the same function talk to each other through a LAMP. Nothing is queued, no
// state is kept between them, and the spare lamp is carrying a boolean that has nothing to do with
// spares. It is the same habit as everywhere else in this game, at its least defensible.

export interface DrainTimerOptions {
  /** `lite199`. Its message field is 1 when the collision arm decided the game was over. */
  readonly spareLamp: { readonly messageField: number };
  readonly endGame: () => void;
  readonly isHighScore: () => boolean;
  /** The table's whole light group, flashed once as a curtain. */
  readonly tableLights: { flasherStartTimedThenStayOff(seconds: number): void };
  readonly showMission: (text: string, seconds: number) => void;
  readonly highScoreText: string;
  readonly playSound: (name: string) => void;
  readonly highScoreSound: string;
  readonly startFeedTimer: () => void;
}

export function drainTimerExpired(o: DrainTimerOptions): 'gameOver' | 'feedNextBall' {
  if (!o.spareLamp.messageField) {
    o.startFeedTimer();
    return 'feedNextBall';
  }

  o.endGame();
  if (o.isHighScore()) {
    o.playSound(o.highScoreSound);
    o.tableLights.flasherStartTimedThenStayOff(3);
    // -1: the prompt stays until the player answers it.
    o.showMission(o.highScoreText, -1);
  }
  return 'gameOver';
}
