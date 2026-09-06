// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/plunger — drawing the plunger back, and letting it go.
//
// ========================= WHAT WAS MISSING =========================
// ⚠️ THE AUTHORED TABLES HAD NO PLUNGER, ONLY A TRIGGER. `setPlunger(pressed)` called `launch()` on the
// PRESS at a fixed `launchSpeedFor(table)`: every launch identical, and no way to send a ball anywhere
// but as hard as the table allows. The Dev, playing: "não permitindo controlar a força com que a
// bolinha será lançada (quanto mais tempo pressionado, mais é esticado, quanto mais é esticado, mais
// longe)".
//
// The 1995 table has the real thing and always did — `demo.plunge` draws it back a hundredth of its
// travel per frame and fires at whatever was drawn. This is that, for the half of the game the Dev is
// going to ship.
//
// ========================= WHY IT IS A MODEL AND NOT A TIMER =========================
// A charge computed inside a keydown handler is a charge nothing can check: this repository has one
// Vitest project and it is `node`. "How hard did that launch" is exactly the kind of number that goes
// quietly wrong — see `launchSpeedFor`, which was added because a hard-coded 260 was 75 short of what
// `narrow-tower` needs, and which the only launch a PLAYER performs went on ignoring for weeks.

/**
 * How long a full draw takes.
 *
 * The 1995 plunger moves one hundredth of its travel per frame at 8 frames per tick and 12 ticks a
 * second — `PullbackIncrement = floor(100 / (12 * 8))` — which is a full pull in about two and a half
 * seconds. That is the number a player of the original has in their hands, so it is the number here.
 */
export const PLUNGER_SECONDS_TO_FULL = 2.5;

/**
 * What the weakest possible tap launches at, as a fraction of the table's full speed.
 *
 * ⚠️ NOT ZERO. A tap that launched at nought would leave the ball sitting in the lane while the player
 * pressed a key that did nothing they could see — which is indistinguishable from a broken control,
 * and this game has already shipped one of those.
 */
export const MINIMUM_PULL = 0.35;

export interface PlungerOptions {
  /** The speed a FULL draw launches at: the table's own, from `launchSpeedFor`. */
  readonly maxSpeed: number;
  /** Seconds for a full draw. Defaults to the original's two and a half. */
  readonly secondsToFull?: number;
}

export interface Plunger {
  /** How far back it is drawn, 0 to 1. What the renderer needs. */
  readonly pull: number;
  /**
   * Whether it is being held right now.
   *
   * ⚠️ NAMED `held` AFTER THE TEST CAUGHT IT CALLED `launched`. The two are near-opposites: a plunger
   * being held has launched nothing, and the launch is what happens when the hold ENDS. A property
   * that says the reverse of what it means is a defect waiting for whoever reads it next.
   */
  readonly held: boolean;
  press(): void;
  /** Lets go, and reports the speed to launch at. Nought if it was never pressed. */
  release(): number;
  /** Draws it further back. Seconds, like everything in `physics/step`. */
  advance(seconds: number): void;
}

export function createPlunger(o: PlungerOptions): Plunger {
  const secondsToFull = o.secondsToFull ?? PLUNGER_SECONDS_TO_FULL;
  let pull = 0;
  let held = false;

  return {
    get pull() { return pull; },
    get held() { return held; },

    press() {
      held = true;
    },

    advance(seconds: number) {
      if (!held) return;
      // ⚠️ CAPPED AT FULLY DRAWN. Without it a player leaning on the key launches through the ceiling,
      // and `physics/stuck` spends its twenty nudges on a ball that has left the table.
      pull = Math.min(1, pull + seconds / secondsToFull);
    },

    release(): number {
      // A keyup with no keydown behind it — a key held while the page loaded, a window that lost the
      // focus mid-press — must not fire a ball nobody charged.
      if (!held) return 0;
      held = false;
      const drawn = pull;
      pull = 0;
      return o.maxSpeed * (MINIMUM_PULL + (1 - MINIMUM_PULL) * drawn);
    },
  };
}
