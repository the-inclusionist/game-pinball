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
  };
  /** The sinks that hold the extra balls during multiball. */
  readonly resetSinkTimers?: (seconds: number) => void;
}

export function createTableActions(o: TableActionOptions) {
  const { ctx } = o;

  return {
    /** An extra ball is a counter and an announcement, and nothing else. */
    addExtraBall(count: number): void {
      ctx.table.extraBalls++;
      ctx.playSound('extraBall');
      ctx.showInfo(o.text.extraBall, count);
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

    setReplay(value: number): void {
      const lamp = ctx.light(o.lamps.replay);
      lamp?.turnOn();
      lamp?.resetTimed();
      ctx.showInfo(o.text.replay, value);
    },
  };
}
