// SPDX-License-Identifier: AGPL-3.0-or-later
// control/score — the table's scoring model. Port of `TPinballTable::AddScore` and
// `control::SpecialAddScore`.
//
// ========================= THE JACKPOT AND THE BONUS SHADOW THE SCORE =========================
// They are not separate awards. While their flags are on, EVERY point scored is also added to them, so
// the jackpot grows by playing and collecting it pays out what the player already earned once. That is
// why they are accumulators on the table rather than numbers a mission hands out.
//
// ========================= A SPECIAL SCORE IS THE RAW VALUE =========================
// `SpecialAddScore` saves the bonus flag, the jackpot flag and the multiplier, ZEROES all three, adds
// the score, and puts them back. A mission award is worth exactly what it says: it is not multiplied,
// and it does not feed the accumulators. Missing that would make a x10 multiplier pay ten times for
// finishing a mission, which no pinball table does.
//
// ========================= THE SCORE DISPLAY WRAPS AT A BILLION =========================
// `CurScore` rolls over past 1e9 and the billions go into `CurScoreE9`, which the display never shows.
// It is there because the original used 32-bit integers and 2^31 is only about 2.1e9. JavaScript would
// not need it — integers are exact to 2^53 — but it is transcribed because it is OBSERVABLE: after a
// billion points the visible score starts again near zero.

/** `TPinballTable::score_multipliers`. The multiplier is an INDEX into this, not a factor. */
export const SCORE_MULTIPLIERS: readonly number[] = [1, 2, 3, 5, 10];

const JACKPOT_LIMIT = 5000000;
const BONUS_LIMIT = 5000000;
const SCORE_ROLLOVER = 1000000000;

export interface ScoreState {
  /** What the display shows. Rolls over at a billion. */
  curScore: number;
  /** How many billions. Never displayed. */
  curScoreE9: number;
  /** A flat amount added on top, AFTER the multiplication — so it is never multiplied. */
  scoreAdded: number;
  /** An index into SCORE_MULTIPLIERS. */
  scoreMultiplier: number;
  bonusScore: number;
  bonusScoreFlag: boolean;
  jackpotScore: number;
  jackpotScoreFlag: boolean;
}

export function createScoreState(): ScoreState {
  return {
    curScore: 0, curScoreE9: 0, scoreAdded: 0, scoreMultiplier: 0,
    bonusScore: 0, bonusScoreFlag: false,
    jackpotScore: 0, jackpotScoreFlag: false,
  };
}

/** Adds a score and returns what was actually added, which is what the caller shows on screen. */
export function addScore(s: ScoreState, score: number): number {
  if (s.jackpotScoreFlag) {
    s.jackpotScore = Math.min(s.jackpotScore + score, JACKPOT_LIMIT);
  }
  if (s.bonusScoreFlag) {
    s.bonusScore = Math.min(s.bonusScore + score, BONUS_LIMIT);
  }

  const added = s.scoreAdded + score * SCORE_MULTIPLIERS[s.scoreMultiplier]!;
  s.curScore += added;
  if (s.curScore > SCORE_ROLLOVER) {
    s.curScoreE9++;
    s.curScore -= SCORE_ROLLOVER;
  }
  return added;
}

/**
 * A mission award: the raw value, with the multipliers switched off for the duration and put back
 * afterwards. See this module's header for why that matters.
 */
export function specialAddScore(s: ScoreState, score: number): number {
  const bonus = s.bonusScoreFlag;
  const jackpot = s.jackpotScoreFlag;
  const multiplier = s.scoreMultiplier;

  s.bonusScoreFlag = false;
  s.jackpotScoreFlag = false;
  s.scoreMultiplier = 0;
  const added = addScore(s, score);
  s.bonusScoreFlag = bonus;
  s.jackpotScoreFlag = jackpot;
  s.scoreMultiplier = multiplier;

  return added;
}
