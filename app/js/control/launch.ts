// SPDX-License-Identifier: AGPL-3.0-or-later
// control/launch — the launch chute, the skill shot and the ramp. Ports of `SkillShotGate1Control`
// … `SkillShotGate6Control`, `DeploymentChuteToEscapeChuteOneWayControl`,
// `DeploymentChuteToTableOneWayControl`, `LaunchRampControl`, `LaunchRampHoleControl`,
// `ShootAgainLightControl` and `EscapeChuteSinkControl`.
//
// ========================= THE NUMBER OF GATES PASSED IS THE SCORE INDEX =========================
// This is the piece that explains a score array I transcribed blind. The launch chute has six gates.
// Gate 1 arms the run; gates 2 to 6 each light one lamp, but ONLY while gate 1's lamp is still on. The
// escape chute then pays `get_scoring(count - 1)`, where `count` is how many of those lamps are lit —
// and the array is
//
//     oneway4_score1 = 15000, 30000, 75000, 30000, 15000, 7500
//
// so the peak is at exactly THREE gates and six gates is worth a tenth of three. It is not a "hold it
// longer" shot and not a timing shot: the player is aiming for one particular plunger strength, and
// overdoing it is punished harder than underdoing it.
//
// The same launch has two exits, and the difference between them is the whole game of it: out through
// the escape chute and the run is paid; out onto the table and `DeploymentChuteToTableOneWayControl`
// throws every lamp away.
//
// ========================= A LIT LAMP REPLACES THE RAMP'S SCORE =========================
// `LaunchRampControl` builds a three-bit flag out of three lamps and uses it to pick a SOUND. Only the
// first bit — the reflex lamp — pays anything. If either of the others is lit and the reflex lamp is
// not, the player gets a triumphant noise and zero points, because the ordinary score sits in the
// `else` of `if (someFlag)`. That reads like a defect and is transcribed as written; the mission lamps
// are presumably expected to be worth something through `MissionControl`, which sees the same
// collision (see `control/dispatch`).
//
// ========================= A LAMP THAT FADES RE-RAISES ITS OWN TIMER =========================
// `ShootAgainLightControl` looks pointless until you notice that `TLightFlasherStartTimedThenStayOff`
// ENDS WITH A TIMER EXPIRY of its own. Without `MessageField` the lamp would answer its own fade by
// starting another one, forever. The flag is not state the game reads: it is a one-shot latch against
// self-retriggering, the same trick as `extraball_light_flag` in `control/lanes`.

import { getScoring, type ControlFunc } from './dispatch.js';
import { addScore, specialAddScore } from './score.js';
import type { LaneGroup, LaneLight } from './lanes.js';

/** A light group as the launch drives it. `skill_shot_lights`, `l_trek_lights`, `r_trek_lights`. */
export interface SkillShotGroup {
  readonly onCount: number;
  /** `TLightGroupReset` — stop whatever animation is running. */
  resetGroup(): void;
  /** `TLightResetAndTurnOff` sent to the group: every lamp back to dark. */
  resetAndTurnOff(): void;
  /** `TLightGroupFlashWhenOn` — flash only the lamps that are lit. */
  flashWhenOn(seconds: number): void;
}

export interface SkillShotEntryOptions {
  /** `lite200`, the shoot-again lamp. Passing gate 1 lights it for five seconds. */
  readonly shootAgainLamp: LaneLight;
  /** `lite67`. Its being lit is what "the run is open" means. */
  readonly firstLamp: LaneLight;
  readonly group: SkillShotGroup;
  /** `lite54` and `lite25`, flashed to advertise that the run has restarted. */
  readonly flashLamps: readonly LaneLight[];
  readonly bargraph: LaneGroup;
  readonly topSplitIndex: number;
  readonly sound: string;
}

/**
 * `SkillShotGate1Control`. Two unrelated things at one gate: an unconditional five-second ball save,
 * and — only if the run was ALREADY open — starting it over from one lamp.
 */
export function makeSkillShotEntryControl(o: SkillShotEntryOptions): ControlFunc {
  return (code, _caller, ctx) => {
    if (code !== 'ControlCollision') return;

    o.shootAgainLamp.turnOnTimed(5);

    if (!o.firstLamp.lit) return;

    o.group.resetGroup();
    o.group.resetAndTurnOff();
    o.firstLamp.resetTimed();
    o.firstLamp.turnOn();
    for (const lamp of o.flashLamps) lamp.flasherStartTimed(5);
    o.bargraph.toggleSplitIndex(o.topSplitIndex);
    ctx.playSound(o.sound);
  };
}

export interface SkillShotGateOptions {
  /** `lite67` again. The five later gates count for nothing outside an open run. */
  readonly armLamp: LaneLight;
  readonly lamp: LaneLight;
  readonly sound: string;
}

/** `SkillShotGate2Control` … `SkillShotGate6Control`: five identical functions, one lamp apiece. */
export function makeSkillShotGateControl(o: SkillShotGateOptions): ControlFunc {
  return (code, _caller, ctx) => {
    if (code !== 'ControlCollision') return;
    if (!o.armLamp.lit) return;

    o.lamp.resetTimed();
    o.lamp.turnOn();
    ctx.playSound(o.sound);
  };
}

export interface SkillShotCollectOptions {
  readonly group: SkillShotGroup;
  /** `lite56`. Lit, it protects the trek lights from being cleared. */
  readonly trekGuardLamp: LaneLight;
  readonly trekGroups: readonly SkillShotGroup[];
  readonly sound: string;
  readonly scoreText: (points: number) => string;
}

/** `DeploymentChuteToEscapeChuteOneWayControl`: the payout. See this module's header. */
export function makeSkillShotCollectControl(o: SkillShotCollectOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;

    const count = o.group.onCount;
    if (!count) return;

    ctx.playSound(o.sound);
    const points = addScore(ctx.score, getScoring(caller, count - 1));
    ctx.showInfo(o.scoreText(points), 2);

    if (!o.trekGuardLamp.lit) {
      for (const group of o.trekGroups) {
        group.resetGroup();
        group.resetAndTurnOff();
      }
    }

    o.group.flashWhenOn(1);
  };
}

/** `DeploymentChuteToTableOneWayControl`, entire: the other exit throws the run away. */
export function makeSkillShotLostControl(o: { readonly group: SkillShotGroup }): ControlFunc {
  return (code) => {
    if (code !== 'ControlCollision') return;
    o.group.resetAndTurnOff();
  };
}

/* ===================== THE LAUNCH RAMP ===================== */

export interface LaunchRampOptions {
  /** `lite54`. The only one of the three worth any points. */
  readonly reflexLamp: LaneLight;
  /** `lite55`. */
  readonly rampLamp: LaneLight;
  /** `lite56`. */
  readonly missionLamp: LaneLight;
  /** `TableG->ReflexShotScore`, a table field that starts at 25000 and is raised elsewhere. */
  readonly reflexScore: () => number;
  readonly reflexText: (points: number) => string;
  readonly sounds: {
    readonly reflexOnly: string;
    /**
     * ⚠️ NAMED FOR THE ROLE, NOT FOR THE COMPONENT. This was `ramp`, and `ramp` is ALSO the voice a
     * ramp makes when the ball rolls over it — so wiring `sounds.ramp = 'ramp'` would have played the
     * rolling noise where the award belongs, at the right moment, with nothing to notice.
     */
    readonly rampAward: string;
    readonly mission: string;
    readonly plain: string;
  };
}

export function makeLaunchRampControl(o: LaunchRampOptions): ControlFunc {
  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') return;

    // The original builds this as bits 1, 2 and 4 and then branches on the whole number.
    let flag = 0;
    if (o.reflexLamp.lit) {
      flag = 1;
      const points = specialAddScore(ctx.score, o.reflexScore());
      ctx.showInfo(o.reflexText(points), 2);
    }
    if (o.rampLamp.lit) flag |= 2;
    if (o.missionLamp.lit) flag |= 4;

    if (!flag) {
      // The ordinary score lives HERE, in the else. Any lit lamp replaces it — see the header.
      addScore(ctx.score, getScoring(caller, 0));
      ctx.playSound(o.sounds.plain);
      return;
    }

    if (flag === 1) ctx.playSound(o.sounds.reflexOnly);
    else if (flag > 3) ctx.playSound(o.sounds.mission);
    else ctx.playSound(o.sounds.rampAward);
  };
}

/** `LaunchRampHoleControl`: a ball coming back out re-offers the reflex shot for five seconds. */
export function makeLaunchRampHoleControl(o: { readonly reflexLamp: LaneLight }): ControlFunc {
  return (code) => {
    if (code !== 'ControlBallReleased') return;
    o.reflexLamp.flasherStartTimed(5);
  };
}

/* ===================== TWO SMALL ONES ===================== */

export interface ShootAgainLightOptions {
  readonly lamp: {
    messageField: number;
    flasherStartTimedThenStayOff(seconds: number): void;
  };
}

/** `ShootAgainLightControl`. The latch against its own fade — see this module's header. */
export function makeShootAgainLightControl(o: ShootAgainLightOptions): ControlFunc {
  return (code) => {
    if (code !== 'ControlTimerExpired') return;

    if (o.lamp.messageField) {
      o.lamp.messageField = 0;
      return;
    }
    o.lamp.flasherStartTimedThenStayOff(5);
    o.lamp.messageField = 1;
  };
}

/**
 * `EscapeChuteSinkControl`, entire. A timer of -1 never expires, so the ball simply WAITS in the
 * escape chute until something else releases it — the sink's own hold, expressed as a timer that
 * cannot fire.
 */
export function makeEscapeChuteSinkControl(o: { readonly sink: { resetTimer(seconds: number): void } }): ControlFunc {
  return (code) => {
    if (code !== 'ControlCollision') return;
    o.sink.resetTimer(-1);
  };
}
