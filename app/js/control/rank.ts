// SPDX-License-Identifier: AGPL-3.0-or-later
// control/rank — the player's rank. Port of `control::AddRankProgress`.
//
// ========================= THERE IS NO RANK VARIABLE =========================
// The player's rank is the COUNT OF LIT LAMPS IN THE MIDDLE CIRCLE. Nothing stores it, nothing
// increments it, and asking what rank the player holds means asking a light group how many of its
// lamps are on.
//
// This is the payoff of everything the light group was built for. `getOnCount` is not a debugging
// convenience — it is where the game keeps one of its two most important numbers.
//
// ========================= AND PROGRESS IS THE OUTER CIRCLE FILLING =========================
// Each point of progress lights one more lamp in the outer circle. When the outer circle is FULL, it
// flashes itself off, the middle circle gains one lamp, and the new rank is announced. At three
// quarters full, the middle circle starts animating — a warning that the next rank is close, made of
// the same lamps that will record it.

import type { LightGroup } from '../table/light-group.js';
import type { Light } from '../table/light.js';

/** How many ranks exist. `RankRcArray[9]` in the original. */
export const RANK_COUNT = 9;

export interface RankOptions {
  /** Fills as the player progresses; when full, one rank is earned. */
  readonly outerCircle: LightGroup;
  /** ONE LAMP PER RANK. Its lit count IS the rank. */
  readonly middleCircle: LightGroup;
  /** Lit whenever progress is made at all. */
  readonly progressLight: Light;
  readonly rankNames: readonly string[];
  readonly showMessage?: (text: string, seconds: number) => void;
  readonly playSound?: () => void;
  /** The message template, e.g. "You have been promoted to %s". */
  readonly promotionTemplate?: (rankName: string) => string;
}

export interface RankResult {
  /** A rank was completed by this call. */
  readonly promoted: boolean;
  /** The rank held afterwards, which is the middle circle's lit count. */
  readonly rank: number;
}

/**
 * Adds `points` of progress and reports whether that completed a rank.
 *
 * Each point is one `resetAndTurnOn` on the outer circle, which lights its next dark lamp — so
 * progress is literally the row filling up.
 */
export function addRankProgress(points: number, o: RankOptions): RankResult {
  o.progressLight.turnOn();
  o.progressLight.resetTimed();

  for (let i = points; i > 0; i--) {
    // Two seconds of flashing before the lamp settles lit: the flash is the feedback.
    o.outerCircle.turnOnNext();
  }

  const lit = o.outerCircle.onCount;
  const total = o.outerCircle.lightCount;

  if (lit === total) {
    // FULL. Flash the outer circle away and promote.
    o.outerCircle.flashWhenOn(5);
    o.middleCircle.resetGroup();

    const currentRank = o.middleCircle.onCount;
    if (currentRank < RANK_COUNT) {
      o.middleCircle.turnOnNext();
      const name = o.rankNames[currentRank] ?? '';
      o.showMessage?.(o.promotionTemplate ? o.promotionTemplate(name) : name, 8);
      o.playSound?.();
    }
    return { promoted: true, rank: o.middleCircle.onCount };
  }

  if (lit >= (3 * total) / 4) {
    // Three quarters: the middle circle stirs. A warning made of the same lamps that will record the
    // promotion, so the player learns to read one row instead of two.
    o.middleCircle.animateForward(-1);
  }

  return { promoted: false, rank: o.middleCircle.onCount };
}
