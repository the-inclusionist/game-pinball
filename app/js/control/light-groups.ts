// SPDX-License-Identifier: AGPL-3.0-or-later
// control/light-groups — rows of lamps that drain away. Ports of `HyperspaceLightGroupControl`,
// `MedalLightGroupControl`, `MultiplierLightGroupControl`, `JackpotLightControl` and
// `BonusLightControl`.
//
// ========================= WHAT IS EARNED DRAINS ONE LAMP AT A TIME =========================
// Three of the table's light groups share one switch statement, differing only in a period. On every
// notify timeout the group steps its animation BACKWARD by one and, if any lamp is still lit, arms the
// timer again. So a group is not given a lifetime after which it all goes dark: it empties one lamp per
// period, in front of the player, and the last lamp going out is also what stops the clock.
//
// ========================= AND THE MULTIPLIER FOLLOWS ITS LAMPS =========================
// `MultiplierLightGroupControl` is that same statement with one line added: the timeout ALSO steps
// `TableG->ScoreMultiplier` down by one. Which makes the multiplier a fifth instance of this game's
// habit of keeping a number in a row of lights rather than in a variable — enabling it sets 4 and
// lights every lamp, and thereafter the number and the lamps come down together. Nothing anywhere
// recomputes one from the other; they are simply moved in the same breath.
//
// `ControlDisableMultiplier` arms the timer with -1, which is how this game switches a timer OFF: a
// negative period can never fire. The escape chute sink holds a ball forever the same way.
//
// ========================= THE ACCUMULATOR LAMPS ARE TWO LINES EACH =========================
// `JackpotLightControl` and `BonusLightControl` do exactly one thing: when the lamp's own timer
// expires, clear the flag. And the flag is what makes every point scored also feed the accumulator
// (see `control/score`), so these two lamps are the only thing that ever ends a jackpot or bonus
// window. The lamp is not an indicator of the state — the lamp's timer IS the state.

import type { ControlFunc } from './dispatch.js';
import type { ScoreState } from './score.js';

/** A light group as its decay control drives it. `TLightGroup`. */
export interface DecayingGroup {
  readonly onCount: number;
  /** `TLightTurnOff`, sent when the animation runs out of lamps. */
  turnOff(): void;
  /** `TLightGroupResetAndTurnOn` — the group-level animation, given a period. */
  groupResetAndTurnOn(period: number): void;
  /** `TLightResetAndTurnOn` sent to the group: every lamp lit, now. */
  lightsResetAndTurnOn(): void;
  lightsResetAndTurnOff(): void;
  restartNotifyTimer(seconds: number): void;
  /** `TLightGroupOffsetAnimationBackward` — one lamp back. */
  offsetAnimationBackward(): void;
}

/** The only thing that differs between the three groups that share this shape. */
export const DECAY_PERIODS = { hyperspace: 60, medal: 30, multiplier: 30 } as const;

export interface DecayingLightGroupOptions {
  readonly group: DecayingGroup;
  readonly period: number;
  /** The multiplier group's one extra line. See this module's header. */
  readonly onDecay?: (score: ScoreState) => void;
}

export function makeDecayingLightGroupControl(o: DecayingLightGroupOptions): ControlFunc {
  return (code, _caller, ctx) => {
    switch (code) {
      case 'TLightGroupNull':
        o.group.turnOff();
        return;

      case 'TLightGroupResetAndTurnOn':
        o.group.groupResetAndTurnOn(2);
        o.group.restartNotifyTimer(o.period);
        return;

      case 'ControlNotifyTimerExpired':
        o.onDecay?.(ctx.score);
        o.group.offsetAnimationBackward();
        // The last lamp going out is what stops the clock.
        if (o.group.onCount) o.group.restartNotifyTimer(o.period);
        return;

      default:
        return;
    }
  };
}

export interface MultiplierLightGroupOptions {
  readonly group: DecayingGroup;
  readonly enableText: string;
  readonly period?: number;
}

/** `MultiplierLightGroupControl`: the decaying group, plus the two ways the mission logic drives it. */
export function makeMultiplierLightGroupControl(o: MultiplierLightGroupOptions): ControlFunc {
  const period = o.period ?? DECAY_PERIODS.multiplier;
  const decay = makeDecayingLightGroupControl({
    group: o.group,
    period,
    onDecay: (score) => { if (score.scoreMultiplier) score.scoreMultiplier--; },
  });

  return (code, caller, ctx) => {
    if (code === 'ControlEnableMultiplier') {
      // Straight to the top index: x10, and every lamp lit to say so.
      ctx.score.scoreMultiplier = 4;
      o.group.lightsResetAndTurnOn();
      o.group.restartNotifyTimer(period);
      ctx.showInfo(o.enableText, 2);
      return;
    }
    if (code === 'ControlDisableMultiplier') {
      ctx.score.scoreMultiplier = 0;
      o.group.lightsResetAndTurnOff();
      // -1 never fires: this is how the timer is switched off.
      o.group.restartNotifyTimer(-1);
      return;
    }
    decay(code, caller, ctx);
  };
}

/** `JackpotLightControl` and `BonusLightControl`, which are the same two lines about different flags. */
export function makeAccumulatorLampControl(o: { readonly flag: 'jackpot' | 'bonus' }): ControlFunc {
  return (code, _caller, ctx) => {
    if (code !== 'ControlTimerExpired') return;
    if (o.flag === 'jackpot') ctx.score.jackpotScoreFlag = false;
    else ctx.score.bonusScoreFlag = false;
  };
}
