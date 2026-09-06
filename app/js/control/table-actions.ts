// SPDX-License-Identifier: AGPL-3.0-or-later
// control/table-actions — the table-level awards. Port of the `control::table_*` helpers.
//
// Every one of them is the same three moves: change a flag, light a lamp, say something. That is the
// whole vocabulary the game has for telling the player they earned an award, and the uniformity is the
// point — a bonus and a jackpot differ only in which flag and which lamp.
//
// ========================= THE LAMP IS THE TIMER =========================
// `table_set_bonus` lights lamp 59 with `turnOnTimed(60)` and sets the flag. The lamp's own timeout is
// what tells the player how long they have; nothing separately counts the sixty seconds down. The lamp
// going dark IS the award expiring, as far as the player is concerned — and the flag it announced is
// cleared elsewhere, by whatever collects it.

import type { ControlContext } from './dispatch.js';

/** How long a bonus or jackpot lamp stays lit. Both are 60 in the original. */
const AWARD_SECONDS = 60;

export interface TableActionText {
  extraBall: string;
  bonusHeld: string;
  bonusSet: string;
  jackpotSet: string;
  multiball: string;
  flagLightsSet: string;
  replay: string;
}

export interface TableActionOptions {
  readonly ctx: ControlContext;
  readonly text: TableActionText;
  /** Lamp tag names, kept together so a different table can wire different lamps. */
  readonly lamps: {
    bonusHold: string;
    bonus: string;
    jackpot: string;
    replay: string;
    multiball: readonly string[];
    /** `lite20`, `lite19` and `lite61`, all three timed together. */
    flagLights: readonly string[];
  };
  /** The sinks that hold the extra balls during multiball. */
  readonly resetSinkTimers?: (seconds: number) => void;
  /** `TableG->Plunger->Message(PlungerRelaunchBall, 2.0)` after a ball is locked away. */
  readonly relaunchBall?: (seconds: number) => void;
  /** `STRING102`, shown for the first two locks. The third says MULTIBALL instead. */
  readonly lockedText?: string;
}

/** How many balls go into the hole before it gives all three back at once. */
const LOCKS_BEFORE_MULTIBALL = 2;
/** `table_set_multiball(2.0)` and `PlungerRelaunchBall, 2.0f` — the original's literal, twice. */
const LOCK_SECONDS = 2;

/**
 * `control::table_add_extra_ball`. Exported on its own because the OUT LANES grant one directly, and
 * two copies of a three-line rule is how the counter and the announcement drift apart.
 *
 * ⚠️ THE SECONDS ARE HOW LONG THE LINE IS SHOWN, not how long the ball lasts. The original passes 2.0
 * from every call site, and reading it as a duration of the award would be a plausible and completely
 * wrong transcription.
 */
export function addExtraBall(ctx: ControlContext, text: string, seconds: number): void {
  ctx.table.extraBalls++;
  ctx.playSound('extraBall');
  ctx.showInfo(text, seconds);
}

export function createTableActions(o: TableActionOptions) {
  const { ctx } = o;
  /** `TableG->BallLockedCounter`. Two balls waiting; the third is the one that pays. */
  let ballLockedCounter = 0;

  return {
    /** An extra ball is a counter and an announcement, and nothing else. */
    addExtraBall(count: number): void {
      addExtraBall(ctx, o.text.extraBall, count);
    },

    /** Holds the bonus into the next ball. Only the lamp records it. */
    setBonusHold(): void {
      const lamp = ctx.light(o.lamps.bonusHold);
      lamp?.turnOn();
      lamp?.resetTimed();
      ctx.showInfo(o.text.bonusHeld, 2);
    },

    setBonus(): void {
      ctx.score.bonusScoreFlag = true;
      ctx.light(o.lamps.bonus)?.turnOnTimed(AWARD_SECONDS);
      ctx.showInfo(o.text.bonusSet, 2);
    },

    /**
     * The odd one out: `table_set_flag_lights` sets NO flag on the table at all. Three lamps go on for
     * sixty seconds and whatever that means is read back off them by whoever cares — `FlagControl`
     * uses one of them straight as a score index. And `lite61` being among them is what walks the
     * booster bank's award chain on by one; see `control/banks`.
     */
    setFlagLights(): void {
      for (const lamp of o.lamps.flagLights) ctx.light(lamp)?.turnOnTimed(AWARD_SECONDS);
      ctx.showInfo(o.text.flagLightsSet, 2);
    },

    setJackpot(): void {
      ctx.score.jackpotScoreFlag = true;
      ctx.light(o.lamps.jackpot)?.turnOnTimed(AWARD_SECONDS);
      ctx.showInfo(o.text.jackpotSet, 2);
    },

    /**
     * Multiball. THE GUARD IS `<= 1`, not `=== 1`: it refuses to start while more than one ball is
     * already in play, so a second trigger during multiball does nothing rather than stacking to six.
     */
    setMultiball(seconds: number): void {
      if (ctx.table.multiballCount > 1) return;
      ctx.table.multiballCount += 3;
      o.resetSinkTimers?.(seconds);
      for (const lamp of o.lamps.multiball) ctx.light(lamp)?.flasherStartTimed(-1);
      ctx.showInfo(o.text.multiball, 2);
      ctx.playMusic('track3');
    },

    /**
     * `control::table_bump_ball_sink_lock` — THE ONLY THING IN THE GAME THAT STARTS MULTIBALL.
     *
     * ⚠️ A LOCKED BALL IS ONE FEWER ON THE TABLE, and the decrement is the load-bearing line. The ball
     * is sitting in a hole that will not give it back; leaving the count alone would have the drain
     * believing other balls were still out there, and it would answer every drain with
     * "multiball continues" — a ball could never be lost and the game could never end.
     *
     * ⚠️ AND THE COUNTER IS READ BEFORE IT IS WRITTEN. `BallLockedCounter == 2` is the THIRD ball: the
     * first two announce themselves and have another ball sent out after them, and the third finds the
     * counter already at two, starts multiball and puts it back to zero. Testing for three would make
     * multiball need a fourth ball that the table has no way to supply.
     */
    bumpBallSinkLock(): void {
      // The same `<= 1` guard `setMultiball` uses: locking during multiball would walk the count down
      // one hole at a time and end the ball with balls still in play.
      if (ctx.table.multiballCount > 1) return;
      ctx.table.multiballCount--;

      if (ballLockedCounter === LOCKS_BEFORE_MULTIBALL) {
        ctx.playSound('multiball');
        this.setMultiball(LOCK_SECONDS);
        ballLockedCounter = 0;
        return;
      }

      ballLockedCounter++;
      ctx.playSound('ballLocked');
      if (o.lockedText !== undefined) ctx.showInfo(o.lockedText, LOCK_SECONDS);
      o.relaunchBall?.(LOCK_SECONDS);
    },

    setReplay(value: number): void {
      const lamp = ctx.light(o.lamps.replay);
      lamp?.turnOn();
      lamp?.resetTimed();
      ctx.showInfo(o.text.replay, value);
    },
  };
}
