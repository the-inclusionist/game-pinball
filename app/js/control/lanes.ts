// SPDX-License-Identifier: AGPL-3.0-or-later
// control/lanes — the rollovers. Ports of `SpaceWarpRolloverControl`, `ReentryLanesRolloverControl`,
// `BumperGroupControl`, `LaunchLanesRolloverControl`, `OutLaneRolloverControl`,
// `ExtraBallLightControl`, `ReturnLaneRolloverControl`, `BonusLaneRolloverControl` and
// `FuelRollover1Control` … `FuelRollover6Control`.
//
// ========================= A LANE IS A LAMP THE BALL TOGGLES =========================
// The reentry lanes and the launch lanes are the same twenty lines twice, and what they do is unusual
// enough to be worth stating plainly: rolling through a lane that is ALREADY LIT puts it OUT again.
// Progress can be undone by a stray ball, which is why filling a three-lane set is a shot and not an
// accumulation. `pb::FullTiltMode` skips that branch — Full Tilt shipped with the toggle removed, so
// the flag is a record of Maxis deciding it had been a mistake.
//
// A flashing lamp is untouchable in either direction, because a flash means the group is mid-animation
// and the lamp's persistent state is being restored from underneath it (see `table/light`).
//
// ========================= WHAT THE LANES BUY, TIME TAKES BACK =========================
// Completing a lane set sends `TBumperIncBmpIndex` to a bumper GROUP: the bumpers become worth more.
// And `BumperGroupControl` is four lines that undo it — every sixty seconds the level drops by one and
// the timer re-arms itself. So the bumper value is not a score the player banks, it is a level held
// only while the lanes keep being fed.
//
// The timer restart sits OUTSIDE the `level < 3` guard. At the top level a completed set buys no
// upgrade but still buys another sixty seconds of keeping the one you have.
//
// ========================= THE FUEL BARGRAPH IS SIX FUNCTIONS OF ONE ROW EACH =========================
// The six fuel rollovers are byte-identical except for two numbers, and THE TWO NUMBERS ARE THE SAME
// NUMBER: rollover N tests `onCount > k` and, if not, fills the bargraph to split index `k`. So each
// rollover tops the tank up to its own segment and no further — which is why the table needs six of
// them in a row rather than one that adds fuel. They are transcribed as one function and a table of
// `k`, because the original repeats the shape for want of anything better, not because the rule
// differs. What is left is `{ lamp, splitIndex }`, six times.
//
// ========================= AND THE BONUS PAYS OUT IN TWO PLACES, NOT ONE =========================
// `BonusLaneRolloverControl` calls `SpecialAddScore(TableG->BonusScore)` exactly as the drain does —
// the difference being that it costs no ball and DOES NOT ZERO THE ACCUMULATOR. A lit `lite16` is
// therefore worth the whole bonus twice: once through the lane, and again when the ball finally
// drains. See `control/drain` for the other half.

import { getScoring, type ControlContext, type ControlFunc, type ControlledComponent } from './dispatch.js';
import { addScore, specialAddScore } from './score.js';

/** The slice of a lamp the lanes drive. `TLight`. */
export interface LaneLight {
  readonly on: boolean;
  /** `FlasherOnFlag`. A flashing lamp is mid-animation and must not be disturbed. */
  readonly flashing: boolean;
  turnOn(): void;
  turnOff(): void;
  turnOnTimed(seconds: number): void;
  turnOffTimed(seconds: number): void;
  flasherStart(): void;
  flasherStartTimed(seconds: number): void;
  resetTimed(): void;
}

/** The slice of a light group the lanes drive. `TLightGroup`. */
export interface LaneGroup {
  readonly onCount: number;
  readonly lightCount: number;
  flasherStartTimed(seconds: number): void;
  turnOff(): void;
  /** Bargraph fill: everything up to `index` on, everything past it off. */
  toggleSplitIndex(index: number): void;
}

/** `TLightResetAndTurnOff` — cancel the timed override, then set the persistent state. */
function resetAndTurnOff(light: LaneLight): void {
  light.resetTimed();
  light.turnOff();
}

function resetAndTurnOn(light: LaneLight): void {
  light.resetTimed();
  light.turnOn();
}

/* ===================== THE BUMPER LANES ===================== */

/** A bumper group as the lanes see it. `attack_bump` and `launch_bump`. */
export interface BumperLevels {
  /**
   * `bump1->BmpIndex`. The original reads the level off ONE member and increments the whole group;
   * they move together, so the group carries the level here.
   */
  readonly level: number;
  incLevel(): void;
  restartNotifyTimer(seconds: number): void;
}

export interface BumperLaneOptions {
  /** Which lamp belongs to the component that was hit. `roll3 → lite8`, and so on. */
  readonly lightFor: (caller: ControlledComponent) => LaneLight | undefined;
  /** The lane set. Complete when every lamp in it is lit. */
  readonly group: LaneGroup;
  readonly bumpers: BumperLevels;
  readonly completeText: string;
  /** Full Tilt removed the toggle-off branch. See this module's header. */
  readonly isFullTilt: () => boolean;
  /** The reentry lanes clear the trek lights before anything else. `ReentryLanesRolloverControl`. */
  readonly prelude?: (ctx: ControlContext) => void;
}

export function makeBumperLaneControl(o: BumperLaneOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;
    o.prelude?.(ctx);

    const light = o.lightFor(caller);
    if (light && !light.flashing) {
      if (light.on) {
        // Hitting a lit lane puts it OUT — unless Full Tilt, which dropped the branch.
        if (!o.isFullTilt()) resetAndTurnOff(light);
      } else {
        resetAndTurnOn(light);
        if (o.group.onCount === o.group.lightCount) {
          o.group.flasherStartTimed(5);
          o.group.turnOff();
          if (o.bumpers.level < 3) {
            o.bumpers.incLevel();
            ctx.showInfo(o.completeText, 2);
          }
          // Outside the guard: a full set at the top level still renews the decay timer.
          o.bumpers.restartNotifyTimer(60);
        }
      }
    }

    // The score is paid whatever happened to the lamp, including for a component this control does
    // not own. Transcribed, not tidied.
    addScore(ctx.score, getScoring(caller, 0));
  };
}

export interface BumperGroupOptions {
  readonly bumpers: { decLevel(): void; restartNotifyTimer(seconds: number): void };
}

/** `BumperGroupControl`: the decay. What the lanes buy, sixty seconds take back. */
export function makeBumperGroupControl(o: BumperGroupOptions): ControlFunc {
  return (code) => {
    if (code !== 'ControlNotifyTimerExpired') return;
    o.bumpers.restartNotifyTimer(60);
    o.bumpers.decLevel();
  };
}

/* ===================== THE FUEL BARGRAPH ===================== */

/**
 * ⚠️ WHAT A FUEL CONTROL REACHES FOR, WHICH IS LESS THAN A GROUP. The tank is a `TLightBargraph`: it
 * answers `onCount` with its LEVEL rather than with a count of lit lamps, and the two rollover
 * controls touch nothing else on it. Asking for a whole `LaneGroup` would oblige every caller to
 * supply a `turnOff` and a `flasherStartTimed` that are never called — two methods that exist only to
 * satisfy a type, which is the smallest version of the defect this port keeps finding.
 */
export interface Bargraph {
  readonly onCount: number;
  toggleSplitIndex(index: number): void;
}

export interface FuelRolloverOptions {
  /** The rollover's own lamp, blinked when the tank is already fuller than this segment. */
  readonly lamp: LaneLight;
  /** Both the threshold and the fill level. They are the same number — see the header. */
  readonly splitIndex: number;
  readonly bargraph: Bargraph;
  readonly refuelText: string;
}

export function makeFuelRolloverControl(o: FuelRolloverOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;

    if (o.bargraph.onCount > o.splitIndex) {
      o.lamp.turnOffTimed(0.05);
    } else {
      o.bargraph.toggleSplitIndex(o.splitIndex);
      ctx.showInfo(o.refuelText, 2);
    }

    addScore(ctx.score, getScoring(caller, 0));
  };
}

/** `FuelRollover1Control` … `FuelRollover6Control`, as the data they are. */
export const FUEL_ROLLOVER_SPLITS: readonly number[] = [1, 3, 5, 7, 9, 11];

/* ===================== THE OUT LANES ===================== */

export interface OutLaneOptions {
  /** `lite17` and `lite18`. Either one lit means an extra ball is waiting to be collected. */
  readonly extraBallLamps: readonly LaneLight[];
  /** `table_add_extra_ball`. The ball is BANKED, not given back: this one still drains. */
  readonly addExtraBall: (seconds: number) => void;
  /** The warp lamps on the side the ball went out. `roll4 → lite30 + lite196`. */
  readonly warpLampsFor: (caller: ControlledComponent) => readonly LaneLight[] | undefined;
  readonly missSound: string;
}

export function makeOutLaneControl(o: OutLaneOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;

    if (o.extraBallLamps.some((l) => l.on)) {
      o.addExtraBall(2);
      for (const lamp of o.extraBallLamps) resetAndTurnOff(lamp);
    } else {
      ctx.playSound(o.missSound);
    }

    const warp = o.warpLampsFor(caller);
    // The FIRST lamp being lit is what arms the pair; the second only follows it.
    if (warp && warp[0]?.on) {
      for (const lamp of warp) lamp.flasherStart();
    }

    addScore(ctx.score, getScoring(caller, 0));
  };
}

export interface ExtraBallLightOptions {
  readonly lamps: readonly LaneLight[];
}

/**
 * `ExtraBallLightControl`. Lighting the pair gives the player FIFTY-FIVE SECONDS to reach an out lane;
 * when that runs out the lamps flash for five seconds and the chance is gone.
 *
 * `extraball_light_flag` is a module-level variable in the original and a closure here. It exists
 * because `ControlTimerExpired` arrives for every light timeout on the table: without the flag, any
 * unrelated one would flash this pair.
 */
export function makeExtraBallLightControl(o: ExtraBallLightOptions): ControlFunc {
  let armed = false;

  return (code) => {
    if (code === 'TLightResetAndTurnOn') {
      for (const lamp of o.lamps) lamp.turnOnTimed(55);
      armed = true;
    } else if (code === 'ControlTimerExpired') {
      if (!armed) return;
      for (const lamp of o.lamps) lamp.flasherStartTimed(5);
      armed = false;
    }
  };
}

/* ===================== THE SPACE WARP AND THE RETURN LANES ===================== */

export interface SpaceWarpOptions {
  /** `lite27` and `lite28`, the two return-lane lamps. */
  readonly lamps: readonly LaneLight[];
}

/**
 * `SpaceWarpRolloverControl`, entire: it lights the two RETURN LANE lamps and scores nothing. The
 * shot is worth something only when the ball later comes down a return lane — one rule spread across
 * two components, with the lamp as the only thing joining them.
 */
export function makeSpaceWarpRolloverControl(o: SpaceWarpOptions): ControlFunc {
  return (code) => {
    if (code !== 'ControlCollision') return;
    for (const lamp of o.lamps) resetAndTurnOn(lamp);
  };
}

export interface ReturnLaneOptions {
  /** Each lane and the lamp the space warp lit for it. */
  readonly lanes: readonly { readonly component: ControlledComponent; readonly lamp: LaneLight }[];
  /** `lite59`, the shared warp indicator, darkened by whichever lane collects. */
  readonly warpLamp: LaneLight;
}

/** `ReturnLaneRolloverControl`: collecting what the space warp lit, at index 1 instead of index 0. */
export function makeReturnLaneControl(o: ReturnLaneOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;
    const lane = o.lanes.find((l) => l.component === caller);
    // Unlike the bumper lanes, a caller this control does not own scores NOTHING.
    if (!lane) return;

    if (lane.lamp.on) {
      resetAndTurnOff(o.warpLamp);
      resetAndTurnOff(lane.lamp);
      addScore(ctx.score, getScoring(caller, 1));
    } else {
      addScore(ctx.score, getScoring(caller, 0));
    }
  };
}

/* ===================== THE BONUS LANE ===================== */

export interface BonusLaneOptions {
  /** `lite16`. Lit, it turns this lane into a bonus payout. */
  readonly lamp: LaneLight;
  readonly bargraph: LaneGroup;
  /** The lane fills the tank right to the top whatever else happens. */
  readonly topSplitIndex: number;
  readonly bonusText: (points: number) => string;
  readonly missText: string;
  readonly collectSound: string;
  readonly missSound: string;
}

export function makeBonusLaneControl(o: BonusLaneOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;

    if (o.lamp.on) {
      // The accumulator is PAID but not cleared — the drain will pay it again. See the header.
      const points = specialAddScore(ctx.score, ctx.score.bonusScore);
      ctx.showInfo(o.bonusText(points), 2);
      resetAndTurnOff(o.lamp);
      ctx.playSound(o.collectSound);
    } else {
      addScore(ctx.score, getScoring(caller, 0));
      ctx.playSound(o.missSound);
      ctx.showInfo(o.missText, 2);
    }

    o.bargraph.toggleSplitIndex(o.topSplitIndex);
  };
}
