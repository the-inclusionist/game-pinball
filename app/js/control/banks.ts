// SPDX-License-Identifier: AGPL-3.0-or-later
// control/banks — the two target banks whose award is chosen by lamps, and the flipper trick. Ports of
// `BoosterTargetControl`, `MedalTargetControl`, `LeftFlipperControl` and `RightFlipperControl`.
//
// ========================= THE NESTED `if`s ARE A LINEAR SEARCH =========================
// `BoosterTargetControl` completes into four levels of nested `if`, testing `lite61`, then `lite60`,
// then `lite59`, then `lite58`. Read what each award does and the shape falls out:
//
//     table_set_flag_lights()  lights lite61
//     table_set_jackpot()      lights lite60
//     table_set_bonus()        lights lite59
//     table_set_bonus_hold()   lights lite58
//
// Every award lights EXACTLY the lamp the next step tests. So the nested conditionals are a linear
// search for the first dark lamp in that chain, and the awards themselves are what advance it — a
// queue that refills as it is drained, with no queue anywhere.
//
// And it is not a ratchet. Three of the four lamps are lit with a sixty-second timer, so a rung goes
// back the moment its award expires and the next completion refills whichever one lapsed. The chain
// slides both ways.
//
// Two details are transcribed rather than tidied. With the whole chain lit, `get_scoring(1)` is added
// inside the deepest branch AND again in the shared tail, so that completion pays the top score
// twice; it reads like a slip, it is observable, it stays. And during missions 15 and 29 the first
// rung is refused with no award and no sound, while the bank still completes and still pays — the
// player cannot tell they were refused except by the silence.
//
// ========================= THE MEDAL BANK IS THE SAME IDEA COUNTED =========================
// `MedalTargetControl` lights one medal lamp on completion and reads `onCount - 1` back out to choose
// the award: two scores and then, from the third on, an extra ball and no score at all. The same
// "read the row of lamps" trick as the hyperspace ladder, arrived at from the other side — there the
// count is read before it grows, here after.
//
// ========================= AND FLIPPING ROTATES THE LANE LAMPS =========================
// `LeftFlipperControl` and `RightFlipperControl` are four lines each and they are not decoration: a
// flip steps the two bumper-lane light groups backward or forward. The flippers are an INPUT TO THE
// LANE PUZZLE. A player who needs the lamp on the other side can flip to move it there, with the ball
// nowhere near a lane. Nothing in the game says so.

import { getScoring, type ControlFunc, type ControlledComponent } from './dispatch.js';
import { addScore } from './score.js';
import { makeTargetBankControl } from './controls.js';
import type { LaneLight } from './lanes.js';

/** A bank member. Completion is the members' fields summing to the bank's size — see `control/controls`. */
export interface BankTarget extends ControlledComponent {
  messageField: number;
}

/** During these missions the booster bank's first award is refused. `lite198->MessageField`. */
export const MISSIONS_WITHOUT_FLAG_LIGHTS: readonly number[] = [15, 29];

export interface AwardChainStep {
  /** Lit means this award has already been granted. */
  readonly lamp: LaneLight;
  /** Granting it lights that same lamp, which is what moves the chain on. */
  readonly grant: () => void;
  readonly sound: string;
}

export interface BoosterTargetOptions {
  readonly bank: readonly BankTarget[];
  /** In order: flag lights, jackpot, bonus, bonus hold. */
  readonly chain: readonly AwardChainStep[];
  readonly popUp: (target: BankTarget) => void;
  readonly missionLamp: { readonly messageField: number };
}

export function makeBoosterTargetControl(o: BoosterTargetOptions): ControlFunc {
  return makeTargetBankControl({
    bank: o.bank,
    popUp: (t) => o.popUp(t as BankTarget),
    partialIndex: 0,
    completeIndex: 1,
    onComplete: (ctx) => {
      const step = o.chain.findIndex((s) => !s.lamp.lit);

      if (step === -1) {
        // The whole chain is lit: the top score, which the shared tail then pays AGAIN. Transcribed.
        const top = o.bank[0];
        if (top) addScore(ctx.score, getScoring(top, 1));
        return;
      }

      // Only the FIRST rung is mission-blocked, and being blocked costs the sound too.
      if (step === 0 && MISSIONS_WITHOUT_FLAG_LIGHTS.includes(o.missionLamp.messageField)) return;

      o.chain[step]!.grant();
      ctx.playSound(o.chain[step]!.sound);
    },
  });
}

/* ===================== THE MEDAL BANK ===================== */

export interface MedalTargetOptions {
  readonly bank: readonly BankTarget[];
  /** The medal lamps. One more is lit per completion, and the count chooses the award. */
  readonly group: { readonly onCount: number; lightOneMore(): void };
  readonly addExtraBall: (seconds: number) => void;
  readonly popUp: (target: BankTarget) => void;
  /** One per rung; the last is reused for every rung past it. */
  readonly texts: readonly string[];
}

export function makeMedalTargetControl(o: MedalTargetOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;
    const target = caller as BankTarget;
    if (target.messageField) return;

    target.messageField = 1;

    const struck = o.bank.reduce((sum, t) => sum + t.messageField, 0);
    if (struck !== o.bank.length) {
      addScore(ctx.score, getScoring(caller, 0));
      return;
    }

    o.group.lightOneMore();
    // Read back AFTER lighting, unlike the hyperspace ladder.
    const rung = o.group.onCount - 1;

    if (rung === 0) addScore(ctx.score, getScoring(caller, 1));
    else if (rung === 1) addScore(ctx.score, getScoring(caller, 2));
    else o.addExtraBall(4);

    ctx.showInfo(o.texts[Math.min(rung, o.texts.length - 1)] ?? '', 2);

    for (const t of o.bank) {
      t.messageField = 0;
      o.popUp(t);
    }
  };
}

/* ===================== THE FLIPPER TRICK ===================== */

export interface FlipperLightOptions {
  /** `bmpr_inc_lights` and `ramp_bmpr_inc_lights` — the two bumper-lane sets. */
  readonly groups: readonly { stepForward(): void; stepBackward(): void }[];
  /** Left steps backward, right steps forward. */
  readonly direction: 'forward' | 'backward';
}

/** `LeftFlipperControl` / `RightFlipperControl`. See this module's header — this is a hidden control. */
export function makeFlipperLightControl(o: FlipperLightOptions): ControlFunc {
  return (code) => {
    // `TLightTurnOn` is the flipper going UP, not a collision with it.
    if (code !== 'TLightTurnOn') return;
    for (const group of o.groups) {
      if (o.direction === 'forward') group.stepForward();
      else group.stepBackward();
    }
  };
}
