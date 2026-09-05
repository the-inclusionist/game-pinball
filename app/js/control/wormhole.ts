// SPDX-License-Identifier: AGPL-3.0-or-later
// control/wormhole — the three sinks that move the ball. Ports of `AdvanceWormHoleDestination`,
// `WormHoleControl`, `WormHoleDestinationControl`, `FlagControl`, `BlackHoleKickoutControl` and
// `GravityWellKickoutControl`.
//
// ========================= THE TELEPORT IS ONE ARRAY INDEX =========================
// Three sinks, three arrival lamps, three arrow lamps, and every path through `WormHoleControl` ends
// the same way: flash the lamps at index `i` and reset SINK `i`'s timer, which is what releases a ball.
// The whole wormhole is the choice of `i`.
//
//   · No destination armed → `i` is the sink the ball fell into. It comes back out where it went in.
//   · A destination armed, ball in the WRONG sink → `i` is the destination. The ball leaves somewhere
//     else. That is the teleport, and it is one subtraction.
//   · A destination armed, ball in the RIGHT sink → `i` is that same sink, plus a replay and a much
//     larger score.
//
// The single exception is the one path that does NOT reset a timer: during multiball with one ball
// loose, hitting the armed sink locks the ball and returns early. Every other path releases the ball
// by re-arming a timer; this one keeps it by not doing so. Absence of a call is the whole mechanic.
//
// ========================= THE DESTINATION IS DRAWN, NOT STORED =========================
// `AdvanceWormHoleDestination` writes the new destination into the ARROW LAMPS' message fields — and
// `lite4`, the lamp it reads the current destination back out of, is one of those lamps. Nothing else
// remembers where the wormhole points. The arrow's frame is `3 - destination`, so the number and the
// picture are the same fact written twice, which is why nothing has to keep them in step.
//
// It wraps from 3 to 1 rather than to 0, because 0 means "no destination at all": a cycle reaching zero
// would switch the wormhole off every third advance. And three missions freeze it outright, by number.
//
// ========================= THE GRAVITY WELL IS TIMED BY ITS OWN SOUND =========================
// `soundwave7->Play(...)` RETURNS its duration, and that duration is handed straight to the kickout's
// timer. The ball is released the instant the noise stops. The animation is not synchronized to the
// mechanism — the animation IS the mechanism's clock.
//
// ========================= AND ONE DELIBERATE DEVIATION =========================
// `GravityWellKickoutControl`'s arming branch reads `reinterpret_cast<size_t>(caller)` and prints it as
// a score: the original smuggles an integer through the component pointer. That is a type pun the
// decompiler preserved faithfully and it cannot be transcribed into TypeScript, so the arming path
// takes an explicit number here. The behavior is the same; the pun is not.

import { getScoring, type ControlFunc, type ControlledComponent } from './dispatch.js';
import { addScore } from './score.js';
import type { LaneLight } from './lanes.js';

/** Missions during which the wormhole does not move. `lite198->MessageField`. */
export const MISSIONS_THAT_FREEZE_THE_WORMHOLE: readonly number[] = [16, 22, 23];

export interface AdvanceOptions {
  /** `lite198`, whose message field is the current mission. */
  readonly missionLamp: { readonly messageField: number };
  /** `lite4` — one of the arrow lamps, and where the destination is read back from. */
  readonly destinationLamp: { readonly messageField: number; readonly on: boolean };
  readonly arrowLights: {
    setMessageField(value: number): void;
    setOnFrame(value: number): void;
    lightsResetAndTurnOn(): void;
  };
  readonly wormHoleLights: { lightsResetAndTurnOn(): void };
}

/**
 * `AdvanceWormHoleDestination`. `forced` is the difference between its two callers: the destination
 * target opens the wormhole from nothing, the spinner loop only moves a cycle already running.
 */
export function advanceWormHoleDestination(o: AdvanceOptions, forced: boolean): void {
  if (MISSIONS_THAT_FREEZE_THE_WORMHOLE.includes(o.missionLamp.messageField)) return;

  const current = o.destinationLamp.messageField;
  if (!forced && !current) return;

  // 1, 2, 3, 1, … Zero is "no destination", so the cycle must skip it.
  const next = current + 1 === 4 ? 1 : current + 1;

  o.arrowLights.setMessageField(next);
  // The arrow's frame and the destination are the same fact drawn two ways.
  o.arrowLights.setOnFrame(3 - next);

  if (!o.destinationLamp.on) {
    o.wormHoleLights.lightsResetAndTurnOn();
    o.arrowLights.lightsResetAndTurnOn();
  }
}

/* ===================== THE SINKS ===================== */

export interface WormholeSink {
  /** `TSink::TimerTime` — how long the ball is held before it is thrown back out. */
  readonly timerTime: number;
  resetTimer(seconds: number): void;
}

/** An arrow lamp, which can also be told which frame to draw. */
export type ArrowLamp = LaneLight & {
  setOnFrame(index: number): void;
  flasherStartTimedThenStayOff(seconds: number): void;
};

export interface WormHoleOptions {
  readonly sinks: readonly WormholeSink[];
  /** `WormholeLightArray1`. */
  readonly arrivalLamps: readonly { flasherStartTimedThenStayOff(seconds: number): void }[];
  /** `WormholeLightArray2`. */
  readonly arrowLamps: readonly ArrowLamp[];
  /** `lite4`, cleared by any hit at all. */
  readonly destinationLamp: { messageField: number };
  /** `lite110`, the destination target's own lamp. */
  readonly targetLamp: LaneLight;
  readonly wormHoleLights: { lightsResetAndTurnOff(): void };
  readonly arrowLights: { lightsResetAndTurnOff(): void };
  readonly table: { readonly multiballFlag: boolean; readonly multiballCount: number };
  /** `table_bump_ball_sink_lock`. */
  readonly lockBall: () => void;
  readonly setReplay: (seconds: number) => void;
  readonly arrivalText: string;
  readonly sinkIndexFor: (caller: ControlledComponent) => number | undefined;
}

export function makeWormHoleControl(o: WormHoleOptions): ControlFunc {
  /**
   * The tail every path but one ends with. The original writes it out twice, identically; it is one
   * function here for the reason `physics/grid` deduplicates its traversal — the duplication carries
   * no information.
   */
  const sendBallTo = (index: number, held: number, ctx: { showInfo(t: string, s: number): void }): void => {
    o.arrivalLamps[index]?.flasherStartTimedThenStayOff(held);
    o.arrowLamps[index]?.setOnFrame(2 - index);
    o.arrowLamps[index]?.flasherStartTimedThenStayOff(held);
    o.sinks[index]?.resetTimer(held);
    ctx.showInfo(o.arrivalText, 2);
  };

  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;

    const entered = o.sinkIndexFor(caller);
    if (entered === undefined) return;
    const held = o.sinks[entered]?.timerTime ?? 0;

    const armed = o.destinationLamp.messageField;
    if (!armed) {
      addScore(ctx.score, getScoring(caller, 0));
      sendBallTo(entered, held, ctx);
      return;
    }

    // Any hit at all spends the destination.
    o.destinationLamp.messageField = 0;
    o.wormHoleLights.lightsResetAndTurnOff();
    o.arrowLights.lightsResetAndTurnOff();
    o.targetLamp.resetTimed();
    o.targetLamp.turnOff();

    if (armed !== entered + 1) {
      // The wrong sink: the ball leaves from the one the arrows pointed at.
      addScore(ctx.score, getScoring(caller, 2));
      sendBallTo(armed - 1, held, ctx);
      return;
    }

    if (o.table.multiballFlag) {
      if (o.table.multiballCount === 1) {
        // The ONE path that does not release the ball. See this module's header.
        o.lockBall();
        addScore(ctx.score, 10000);
        return;
      }
      o.setReplay(4);
      addScore(ctx.score, 50000);
    } else {
      o.setReplay(4);
      addScore(ctx.score, getScoring(caller, 1));
    }

    sendBallTo(entered, held, ctx);
  };
}

/* ===================== WHAT ARMS AND MOVES IT ===================== */

export interface WormHoleDestinationOptions {
  readonly targetLamp: LaneLight & { flasherStartTimedThenStayOn(seconds: number): void };
  readonly announceText: string;
  readonly advance: (forced: boolean) => void;
}

/** `WormHoleDestinationControl`: announce once, score, and FORCE the cycle on. */
export function makeWormHoleDestinationControl(o: WormHoleDestinationOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;

    if (!o.targetLamp.on) {
      o.targetLamp.flasherStartTimedThenStayOn(3);
      ctx.showInfo(o.announceText, 2);
    }
    addScore(ctx.score, getScoring(caller, 0));
    o.advance(true);
  };
}

export interface FlagOptions {
  /** `lite20`. Its lit state is handed straight to `get_scoring` as an index. */
  readonly lamp: LaneLight;
  readonly advance: (forced: boolean) => void;
}

/** `FlagControl`. Two scores in one row and no conditional: the lamp IS the index. */
export function makeFlagControl(o: FlagOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code === 'ControlSpinnerLoopReset') {
      // Unforced: the spinner moves a cycle, it does not start one.
      o.advance(false);
      return;
    }
    if (code !== 'ControlCollision') return;
    addScore(ctx.score, getScoring(caller, o.lamp.on ? 1 : 0));
  };
}

/* ===================== THE TWO KICKOUTS ===================== */

export interface BlackHoleOptions {
  readonly kickout: { restartTimer(seconds: number): void };
  readonly scoreText: (points: number) => string;
}

/** `BlackHoleKickoutControl`: score, announce, and hold the ball with a timer that never fires. */
export function makeBlackHoleKickoutControl(o: BlackHoleOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;
    const points = addScore(ctx.score, getScoring(caller, 0));
    ctx.showInfo(o.scoreText(points), 2);
    o.kickout.restartTimer(-1);
  };
}

export interface GravityWellOptions {
  /** `lite62`. */
  readonly lamp: LaneLight;
  readonly kickout: { active: boolean; restartTimer(seconds: number): void };
  /** What `soundwave7->Play` returns: the ball is held exactly this long. */
  readonly soundDuration: () => number;
  readonly scoreText: (points: number) => string;
  /** Used by `announceGravityWell`; see this module's header for the pointer pun it replaces. */
  readonly armedText: (points: number) => string;
  readonly unknownText: string;
}

export function makeGravityWellKickoutControl(o: GravityWellOptions): ControlFunc {
  return (code, caller, ctx) => {
    switch (code) {
      case 'ControlCollision': {
        const points = addScore(ctx.score, getScoring(caller, 0));
        ctx.showInfo(o.scoreText(points), 2);
        o.lamp.resetTimed();
        o.lamp.turnOff();
        o.kickout.active = false;
        // The sound's own length is the hold.
        o.kickout.restartTimer(o.soundDuration());
        return;
      }
      case 'ControlEnableMultiplier':
        o.lamp.flasherStart();
        o.kickout.active = true;
        return;
      case 'Reset':
        o.kickout.active = false;
        return;
      default:
        return;
    }
  };
}

/**
 * The announcement half of `ControlEnableMultiplier` on the gravity well, which in the original
 * arrives as an integer cast to a pointer. Called alongside the control, with the value spelled out.
 */
export function announceGravityWell(o: GravityWellOptions, points: number,
  showInfo: (text: string, seconds: number) => void): void {
  showInfo(points ? o.armedText(points) : o.unknownText, 2);
}
