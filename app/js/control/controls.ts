// SPDX-License-Identifier: AGPL-3.0-or-later
// control/controls — the recurring shapes of the 57 control functions.
//
// Read them all and four shapes account for most of the table. They are written here as factories
// taking their nouns, for the same reason the mission runner is: the original repeats the shape because
// C offered nothing better, not because the rule differs each time.
//
// ========================= THE TARGET BANK HAS NO COUNTER =========================
// Booster, Medal, Multiplier and the two Hazard banks all do this:
//
//     if (collision && !caller->MessageField) {
//         caller->MessageField = 1;
//         if (t1->MessageField + t2->MessageField + t3->MessageField == 3) { ...award...; reset all }
//         else AddScore(get_scoring(0));
//     }
//
// Each target marks ITSELF with a one, and the bank is complete when the members' fields SUM to the
// bank's size. No counter, no set, nothing owning the group — the state is spread across the pieces
// that show it, which is this game's whole habit.
//
// `!caller->MessageField` is what stops a second hit on the same target counting twice.
//
// ========================= AND COMPLETING THE BANK IS WHAT RAISES THE TARGETS =========================
// On completion every member's field is cleared AND every member is sent `TPopupTargetEnable`. That
// answers the question the popup target left open: it does not raise itself because the BANK raises
// it. The piece cannot know when the round is over; only the group can.

import { getScoring, type ControlContext, type ControlFunc, type ControlledComponent } from './dispatch.js';
import { addScore } from './score.js';

/** A component whose message field the control layer reads and writes. */
export interface FieldComponent extends ControlledComponent {
  messageField: number;
}

export interface TargetBankOptions {
  /** The targets that make up the bank. Completion is their fields summing to this length. */
  readonly bank: readonly FieldComponent[];
  /** What the bank awards when it completes. */
  readonly onComplete: (ctx: ControlContext) => void;
  /** Score index for a hit that does not complete the bank. */
  readonly partialIndex?: number;
  /** Score index for the hit that completes it. */
  readonly completeIndex?: number;
  /** Sends a target back up. `TPopupTargetEnable` in the original. */
  readonly popUp: (target: FieldComponent) => void;
  /**
   * ⚠️ WHERE THE COMPLETING SCORE IS PAID, WHICH IS A RULE AND NOT A STYLE. `BoosterTargetControl`
   * pays LAST, after its awards and the pop-ups. `MultiplierTargetControl` pays FIRST, before it
   * raises the multiplier — and `addScore` multiplies by the CURRENT multiplier, so paying afterwards
   * settles the completing hit at the new one. The hit that doubles the table would pay double for
   * itself, every time, and the score would read as generous rather than as wrong.
   */
  readonly payCompleteFirst?: boolean;
}

export function makeTargetBankControl(o: TargetBankOptions): ControlFunc {
  const partial = o.partialIndex ?? 0;
  const complete = o.completeIndex ?? 1;

  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;
    const target = caller as FieldComponent;
    // A target already struck this round is not struck again.
    if (target.messageField) return;

    target.messageField = 1;

    const struck = o.bank.reduce((sum, t) => sum + t.messageField, 0);
    if (struck !== o.bank.length) {
      addScore(ctx.score, getScoring(caller, partial));
      return;
    }

    // See `payCompleteFirst`: the multiplier bank pays before it changes the multiplier.
    if (o.payCompleteFirst) addScore(ctx.score, getScoring(caller, complete));

    o.onComplete(ctx);

    // Clear the round and put every target back up. The bank raises them, not themselves.
    for (const t of o.bank) {
      t.messageField = 0;
      o.popUp(t);
    }

    if (!o.payCompleteFirst) addScore(ctx.score, getScoring(caller, complete));
  };
}

/* ===================== THE MULTIPLIER BANK ===================== */

export interface MultiplierBankOptions extends Omit<TargetBankOptions, 'onComplete'> {
  /** The lamps that count how many times the bank has been completed. */
  readonly lightGroup: { turnOnNext(): boolean; readonly onCount: number };
  /** Index into SCORE_MULTIPLIERS, chosen by how many lamps are lit. */
  readonly multiplierTexts: readonly string[];
}

/**
 * `MultiplierTargetControl`. Completing the bank lights one more lamp, and THE NUMBER OF LIT LAMPS IS
 * THE MULTIPLIER — a fourth instance of the game keeping a number in a row of lights rather than in a
 * variable. Past the fourth lamp the multiplier stops climbing and stays at its top index.
 */
export function makeMultiplierBankControl(o: MultiplierBankOptions): ControlFunc {
  return makeTargetBankControl({
    ...o,
    // The original's `AddScore` is the first line of the completing branch. See `payCompleteFirst`.
    payCompleteFirst: true,
    onComplete: (ctx) => {
      o.lightGroup.turnOnNext();
      const lit = o.lightGroup.onCount;
      // 1, 2, 3 lamps map to multiplier indices 1, 2, 3; anything beyond stays at 4.
      ctx.score.scoreMultiplier = lit >= 4 ? 4 : lit;
      const text = o.multiplierTexts[Math.min(lit, o.multiplierTexts.length) - 1];
      if (text) ctx.showInfo(text, 2);
    },
  });
}

/* ===================== SPOT TARGETS ===================== */

export interface SpotTargetOptions {
  /** One lamp per target, in the same order. */
  readonly targets: readonly ControlledComponent[];
  readonly lamps: readonly { flasherStartTimedThenStayOn(seconds: number): void }[];
  /** The group those lamps belong to; completion is judged by its lit count. */
  readonly group: { readonly onCount: number; flashWhenOn(seconds: number): void };
  readonly onComplete: (ctx: ControlContext) => void;
  readonly hitSound: string;
  readonly completeSound: string;
  /**
   * The HAZARD spot targets also record themselves as bits in one lamp's message field —
   * `lite104->MessageField |= 1u`, `|= 2u`, `|= 4u`. See `control/two-stage`: the mission reads that
   * mask, and nothing here ever clears it.
   */
  readonly maskLamp?: { messageField: number };
}

/**
 * `FuelSpotTargetControl` and its siblings. Each target owns ONE lamp; hitting it lights that lamp and
 * scores, and the group being fully lit is what completes the set.
 *
 * The difference from a target bank is where the memory lives: a bank remembers in the TARGETS' fields,
 * a spot set remembers in the LAMPS. Both are the same idea and neither keeps a count.
 */
export function makeSpotTargetControl(o: SpotTargetOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision' || !caller) return;
    const index = o.targets.indexOf(caller);
    if (index < 0) return;

    // The SECOND memory of the same hit, with a different lifetime — see `maskLamp` above.
    if (o.maskLamp) o.maskLamp.messageField |= 1 << index;

    o.lamps[index]?.flasherStartTimedThenStayOn(2);
    addScore(ctx.score, getScoring(caller, 0));

    if (o.group.onCount === o.targets.length) {
      o.group.flashWhenOn(2);
      o.onComplete(ctx);
      ctx.playSound(o.completeSound);
    } else {
      ctx.playSound(o.hitSound);
    }
  };
}

export interface MissionSpotTargetOptions {
  readonly targets: readonly ControlledComponent[];
  readonly lamps: readonly { flasherStartTimedThenStayOn(seconds: number): void }[];
  readonly group: { readonly onCount: number; flashWhenOn(seconds: number): void };
  /** `lite101`, which records which of the three were struck as bits. Never cleared here. */
  readonly maskLamp: { messageField: number };
  /**
   * ⚠️ `lite198`, WHOSE STATE CHOOSES THE SOUND BEFORE ANYTHING ELSE IS KNOWN. Dark OR flashing means
   * no mission is running, and the set sounds different for it.
   */
  readonly missionLamp: { readonly lit: boolean; readonly flashing: boolean };
  /** Played when no mission is running. */
  readonly noMissionSound: string;
  readonly hitSound: string;
}

/**
 * `MissionSpotTargetControl`, which is a spot set with two differences and needs its own function.
 *
 * ⚠️ THE SOUND IS CHOSEN BY A LAMP, NOT BY THE OUTCOME. `makeSpotTargetControl` plays one sound for a
 * hit and another for the set completing; this one asks `lite198` whether a mission is running and
 * plays that answer — before it knows whether the set completed, and regardless. The completion here
 * plays NOTHING, which no amount of bending the shared factory would express.
 *
 * ⚠️ AND IT IS `!lit || flashing`, NOT `!lit`. A mission lamp mid-flash counts as no mission: the
 * flash is how the game says a mission is ending, and the set follows the lamp rather than the state.
 */
export function makeMissionSpotTargetControl(o: MissionSpotTargetOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision' || !caller) return;
    const index = o.targets.indexOf(caller);
    if (index < 0) return;

    o.maskLamp.messageField |= 1 << index;
    o.lamps[index]?.flasherStartTimedThenStayOn(2);

    // Before the score, as the original has it.
    const running = o.missionLamp.lit && !o.missionLamp.flashing;
    ctx.playSound(running ? o.hitSound : o.noMissionSound);

    addScore(ctx.score, getScoring(caller, 0));

    if (o.group.onCount === o.targets.length) o.group.flashWhenOn(2);
  };
}

/* ===================== KICKERS AND THEIR GATES ===================== */

export interface KickerOptions {
  /** Re-enabled when the kicker's timer runs out. */
  readonly gate: { shutGate(): void };
  /** In easy mode the gate is never put back, so the lane stays open. */
  readonly isEasyMode: () => boolean;
}

/**
 * `LeftKickerControl` and `RightKickerControl`, entire. The kicker itself does nothing on a hit: its
 * only job is to SHUT ITS GATE AGAIN when the timer expires — and not to, in easy mode, which is how
 * the option makes the outlanes forgiving without touching the geometry.
 */
export function makeKickerControl(o: KickerOptions): ControlFunc {
  return (code) => {
    if (code !== 'ControlTimerExpired') return;
    if (o.isEasyMode()) return;
    o.gate.shutGate();
  };
}

export interface GateLightOptions {
  /** Lit while the gate stands open, dark when it shuts. */
  readonly lamps: readonly {
    flasherStartTimedThenStayOn(seconds: number): void;
    flasherStartTimed(seconds: number): void;
    turnOff(): void;
    resetTimed(): void;
  }[];
}

/**
 * `LeftKickerGateControl`. The gate's own lamps: lit while it stands open, dark when it shuts. It is
 * the only place the player is told an outlane is currently survivable.
 *
 * ⚠️ THE TWO LAMPS SETTLE DIFFERENTLY, AND THAT IS THE RULE. `lite30` gets
 * `TLightFlasherStartTimedThenStayOn` and `lite196` gets `TLightFlasherStartTimed`: the first flashes
 * for five seconds and stays LIT, the second flashes for five seconds and returns to what it was,
 * which is dark. The first is the standing announcement that the outlane is survivable; the second is
 * the attention-getter that fetches the player's eye and then stops.
 *
 * Giving both the staying form leaves the second lit for the rest of the ball, and a lamp that never
 * goes out stops meaning anything. It is also invisible to any test that passes a single lamp, which
 * is how it survived: with one lamp the two forms cannot be told apart.
 */
export function makeGateLightControl(o: GateLightOptions): (opened: boolean) => void {
  return (opened: boolean) => {
    o.lamps.forEach((lamp, index) => {
      if (!opened) {
        lamp.turnOff();
        lamp.resetTimed();
      } else if (index === 0) {
        lamp.flasherStartTimedThenStayOn(5);
      } else {
        lamp.flasherStartTimed(5);
      }
    });
  };
}
