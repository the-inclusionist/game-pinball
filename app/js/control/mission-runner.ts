// SPDX-License-Identifier: AGPL-3.0-or-later
// control/mission-runner — one generic mission, and the table that defines all of them.
//
// ========================= FIFTEEN CONTROLLERS ARE ONE FUNCTION =========================
// Read PracticeMissionController, LaunchTrainingController, ReconnaissanceController and the eight
// Maelstrom parts side by side and they are the SAME forty lines with different nouns:
//
//     if (code is not a collision) {
//         if (code is MissionComplete) { flash this mission's lamps; set the counter }
//         else if (code is not MissionStarted) return;
//         show the template, formatted with the counter, indefinitely;
//         return;
//     }
//     if (the caller is one of THIS mission's components) {
//         counter--;
//         if (counter still stands) re-announce;
//         else { lamps off; move to the next mission; award; rank progress }
//     }
//
// So a mission IS: a counter, a set of lamps, a set of components that count, and a reward. The
// original repeats those forty lines fifteen times because C had nothing better to offer; here it is
// one function and a table, which is the same rule said once.
//
// ========================= THE COUNTER LIVES IN THE SELECTION LAMP =========================
// `lite56` held which mission the player picked. Once the mission is running, the same field holds HOW
// MANY HITS REMAIN. One lamp, two meanings, chosen by which mission is active — and it is why
// SelectMissionController clears that field when it takes over again.
//
// The announcement is formatted with the counter, so "destroy 8 more targets" counts itself down on
// screen. The display is the state, again.
//
// ========================= AND A PROMOTION OUTRANKS A SCORE =========================
// The completion score is announced only `if (!AddRankProgress(...))`. A promotion has its own, more
// important message, and the two never compete for the same text box.

import { specialAddScore, type ScoreState } from './score.js';
import type { ControlledComponent } from './dispatch.js';
import type { MissionController } from './mission.js';
import type { LampWithField } from './select-mission.js';

/** A lamp this mission flashes while it runs. */
export interface MissionLampControl {
  flasherStartTimed(seconds: number): void;
  turnOff(): void;
  resetTimed(): void;
}

export interface MissionDefinition {
  readonly name: string;
  /** Flashed while the mission runs, switched off when it ends. */
  readonly lamps: readonly MissionLampControl[];
  /**
   * How many qualifying hits the mission needs. `null` means one hit ends it, with no counter and no
   * countdown in the text — the shape several Maelstrom parts take.
   */
  readonly count: number | null;
  /** Hitting any of these counts. Anything else is ignored entirely. */
  readonly components: readonly ControlledComponent[];
  /** Where to go when it finishes. 1 is back to mission selection; anything else chains. */
  readonly nextMission: number;
  /** Formatted with the remaining count. Shown indefinitely. */
  readonly text: (remaining: number) => string;
  /** Shown for four seconds on completion, when there is one. */
  readonly completeText?: string;
  /** Shown in the info box on completion, for the parts that use it. */
  readonly infoText?: string;
  /** The award. Missions pass `mission: true` to SpecialAddScore. */
  readonly award?: number;
  /** Rank points earned. When the rank advances, the score message is suppressed. */
  readonly rankPoints?: number;
  /** Formats the "you scored N" line. */
  readonly scoreText?: (points: number) => string;
}

export interface MissionRunnerOptions {
  readonly definition: MissionDefinition;
  /** `lite56`, which holds the countdown while a mission runs. */
  readonly counterLamp: LampWithField;
  readonly missionLamp: { messageField: number };
  readonly score: ScoreState;
  /** Returns true when the rank advanced, which suppresses the score message. */
  readonly addRankProgress: (points: number) => boolean;
  readonly playCompleteSound?: () => void;
}

export function makeMissionController(o: MissionRunnerOptions): MissionController {
  const d = o.definition;

  return (code, caller, ctx) => {
    if (code !== 'ControlCollision') {
      if (code === 'ControlMissionComplete') {
        // Taking over: light up and set the counter.
        for (const lamp of d.lamps) lamp.flasherStartTimed(0);
        if (d.count !== null) o.counterLamp.messageField = d.count;
      } else if (code !== 'ControlMissionStarted') {
        return;
      }
      // -1: leave it up until something changes it.
      ctx.showMissionText(d.text(o.counterLamp.messageField), -1);
      return;
    }

    if (!caller || !d.components.includes(caller)) return;

    if (d.count !== null) {
      o.counterLamp.messageField -= 1;
      if (o.counterLamp.messageField > 0) {
        // Still going: re-announce, which redraws the countdown.
        ctx.dispatch('ControlMissionStarted', caller);
        return;
      }
    }

    finish(o, ctx);
  };
}

function finish(o: MissionRunnerOptions, ctx: Parameters<MissionController>[2]): void {
  const d = o.definition;

  for (const lamp of d.lamps) { lamp.turnOff(); lamp.resetTimed(); }

  // Write the lamp, THEN announce — the re-entrant dispatch lands on whatever comes next.
  o.missionLamp.messageField = d.nextMission;
  ctx.dispatch('ControlMissionComplete', null);

  if (d.completeText) ctx.showMissionText(d.completeText, 4);
  if (d.infoText) ctx.showInfo(d.infoText, 4);

  if (d.award === undefined) return;

  const points = specialAddScore(o.score, d.award);
  const promoted = d.rankPoints !== undefined ? o.addRankProgress(d.rankPoints) : false;

  // A PROMOTION OUTRANKS A SCORE: the two never compete for the same text box.
  if (!promoted) {
    if (d.scoreText) ctx.showMissionText(d.scoreText(points), 8);
    o.playCompleteSound?.();
  }
}
