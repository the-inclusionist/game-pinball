// SPDX-License-Identifier: AGPL-3.0-or-later
// control/select-mission — mission 1, where the player chooses. Port of
// `control::SelectMissionController`.
//
// ========================= THREE TARGETS, AND THEIR MEANING CHANGES WITH RANK =========================
// The heart of it is a two-dimensional lookup. The ROW is the player's rank — which, as ever, is the
// count of lit lamps in the middle circle — bucketed into five bands. The COLUMN is which of three
// targets was struck, plus a fourth reached only through a secret. The cell is the mission.
//
// So the table has three physical targets and seventeen missions, and the way it gets from one to the
// other is promotion. The same target means a different mission at every rank, which is why the player
// keeps shooting the same three things for an entire game and keeps getting somewhere new.
//
// ========================= SELECTING IS NOT STARTING =========================
// Hitting a target only writes `lite56`, the SELECTION lamp, and flashes it. The mission actually
// begins when the ball goes up the RAMP while that lamp is lit and there is fuel in the bargraph — and
// starting it is this line:
//
//     lite198->MessageField = lite56->MessageField;
//
// One lamp holds what you picked, another holds what you are doing, and starting a mission is copying
// one into the other. The same "state lives in the display" pattern as everywhere else, now twice over
// in a single statement.

import { specialAddScore, type ScoreState } from './score.js';
import type { ControlledComponent } from './dispatch.js';
import type { MissionController, MissionLamp } from './mission.js';

/**
 * THE SELECTION TABLE, transcribed from the nested switches of the original.
 *
 * Rows are rank bands and columns are which target was hit (the fourth being the secret path). It is
 * written as data rather than as nested switches because that is what it IS — the original's shape is
 * a consequence of C having no table literal handy, not of the rule being procedural.
 */
export const MISSION_TABLE: readonly (readonly number[])[] = [
  /* rank 1     */ [3, 4, 2, 5],
  /* rank 2-3   */ [9, 11, 10, 16],
  /* rank 4-5   */ [6, 8, 7, 15],
  /* rank 6-7   */ [12, 13, 14, 17],
  /* rank 8-9   */ [15, 16, 17, 18],
];

/** Which row of the table a rank falls in. Ranks outside these bands select nothing at all. */
export function rankBand(rank: number): number {
  if (rank === 1) return 0;
  if (rank === 2 || rank === 3) return 1;
  if (rank === 4 || rank === 5) return 2;
  if (rank === 6 || rank === 7) return 3;
  if (rank === 8 || rank === 9) return 4;
  return -1;
}

/** The value lamp 101 must hold for the secret column to open. */
const SECRET_UNLOCK = 7;

export interface LampWithField {
  messageField: number;
  turnOn(): void;
  turnOff(): void;
  resetTimed(): void;
  flasherStart(): void;
  flasherStartTimedThenStayOn(seconds: number): void;
  /**
   * ⚠️ `TLight::light_on()` — `LightOnFlag || ToggledOnFlag || FlasherOnFlag`, not the persistent flag
   * alone. Awards light their lamps with `TLightTurnOnTimed`, so asking `on` here finds them dark.
   */
  readonly lit: boolean;
}

export interface GroupCount {
  readonly onCount: number;
  animateBackward(period: number): void;
  resetGroup(): void;
}

export interface SelectMissionOptions {
  /** The three targets, in the order that gives columns 1, 2 and 3. */
  readonly targets: readonly ControlledComponent[];
  /** Going up this while a mission is selected is what STARTS it. */
  readonly ramp: ControlledComponent;
  /** `lite56` — holds what the player picked. */
  readonly selectionLamp: LampWithField;
  /** `lite198` — holds what the player is doing. Also the machine's own state. */
  readonly missionLamp: MissionLamp & LampWithField;
  /** `lite101` — at 7, the secret column opens and the 7 is consumed. */
  readonly secretLamp: LampWithField;
  /** The middle circle. Its lit count is the rank. */
  readonly rankGroup: GroupCount;
  readonly outerCircle: GroupCount;
  /** Starting a mission needs fuel. */
  readonly fuelBargraph: ControlledComponent & { readonly onCount: number };
  /** Indexed by `selection - 2`, as the original does. */
  readonly missionSelectScores: readonly number[];
  /** Template for "mission started, N points". */
  readonly startedText: (points: number) => string;
  readonly score: ScoreState;
}

export function makeSelectMissionController(o: SelectMissionOptions): MissionController {
  return (code, caller, ctx) => {
    if (code === 'ControlMissionComplete') {
      // Leaving selection: put the board back to neutral.
      ctx.playMusic('track1');
      o.missionLamp.turnOff();
      o.missionLamp.resetTimed();
      o.outerCircle.resetGroup();
      o.selectionLamp.messageField = 0;
      o.secretLamp.messageField = 0;
      return;
    }

    if (code !== 'ControlCollision' || !caller) return;

    const column = o.targets.indexOf(caller);

    if (column < 0) {
      // Not a target. The only other thing that matters here is the ramp, and only when a mission has
      // been picked and there is fuel to fly it with.
      if (caller !== o.ramp || !o.selectionLamp.lit || o.fuelBargraph.onCount === 0) return;

      o.selectionLamp.turnOff();
      o.selectionLamp.resetTimed();
      o.missionLamp.turnOn();
      o.missionLamp.resetTimed();
      o.outerCircle.animateBackward(-1);

      // STARTING IS COPYING ONE LAMP INTO THE OTHER.
      o.missionLamp.messageField = o.selectionLamp.messageField;
      const scoreIndex = o.selectionLamp.messageField - 2;

      // Announce to the NEW mission — the lamp has already changed.
      ctx.dispatch('ControlMissionComplete', null);

      const points = specialAddScore(o.score, o.missionSelectScores[scoreIndex] ?? 0);
      ctx.showMissionText(o.startedText(points), 4);
      ctx.playMusic('track2');
      return;
    }

    // A target. The secret column, when it is open, replaces whichever target was hit.
    let effectiveColumn = column;
    if (o.secretLamp.messageField === SECRET_UNLOCK) {
      o.secretLamp.messageField = 0; // consumed by using it
      effectiveColumn = 3;
    }

    const band = rankBand(o.rankGroup.onCount);
    if (band < 0) return; // a rank outside the bands selects nothing

    o.selectionLamp.messageField = MISSION_TABLE[band]![effectiveColumn]!;
    o.selectionLamp.flasherStartTimedThenStayOn(2);
    o.missionLamp.flasherStart();
    ctx.dispatch('ControlMissionStarted', caller);
  };
}
