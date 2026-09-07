// SPDX-License-Identifier: AGPL-3.0-or-later
// table/factory — the assembly bay, laid out on the Dev's own picture.
//
// ⚠️ HIS INSTRUCTION: "Crie a mesa factory, com base em factory.jpg."
//
// ========================= WHAT THE PICTURE DRAWS, AND WHERE =========================
// `art/factory.jpg` is 1600x2656 — an aspect of 0.6024, so 183 wide makes it 304 tall and the crop
// takes a fifth of a pixel. It is a rocket standing in a gantry with its engines already lit, and it is
// the first table in this catalogue whose subject is a MACHINE rather than a place. Traced off the
// reduced picture at 4x, the things a ball could plausibly meet are:
//
//     y  17.. 26   six lit bars across the head of the bay          -> the return lanes
//     y  42.. 48   a yellow bar between a red lamp and a green one  -> the flag
//     y  60.. 65   a gantry beam across the whole width             -> scenery, left alone
//     y  85..122   three round gauges, one high and two flanking    -> the bumper nest
//     y 114..140   a row of five discs, three grey and two yellow   -> the drop bank and two wells
//     y 152..230   the rocket, with two yellow discs up its body    -> the third well and the kicker
//     x 148..180   the crane, its jib reaching in over the bay      -> the mover
//
// ========================= AND THE ART DID NOT DECIDE EVERYTHING =========================
// ⚠️ `low-orbit` RECORDS WHAT HAPPENS WHEN IT IS ALLOWED TO. Its drop bank sits on the rail SEGMENTS
// its picture draws and not on the pads between them, because every placement that moved it onto the
// pads failed `tests/table-playable` — the ball stopped reaching the paddles. "Mapping a table onto its
// art is not translation, it is re-tuning the play."
//
// So this file follows the picture where the picture and the play agree, and says so where they do not.
// Every number here has been through `tests/table-reachable` and `tests/table-playable`; what moved
// away from the art, and why, is written beside it.
//
// ========================= THE LAYOUT =========================
//        0                                                          183
//    0   +------------------------------------------------------------+
//        |      return lanes                              |           |
//   45   |        flag                                    |  plunger  |
//        |   gauges (bumpers)                    crane    |   lane    |
//  127   |   well . drop bank . well                      |           |
//  180   |            rocket: well3                       |           |
//  200   |            rocket: kicker                      |           |
//  245   |   ramp                                                     |
//  275   |     outlane   flipper   flipper   outlane                  |
//  304   +------------------------------------------------------------+

import type { AuthoredTable } from './authored.js';
import { cabinet, CABINET_LAMPS } from './cabinet.js';

/** Half the ball, as on every table here. Every passable gap is at least twice this. */
export const BALL_RADIUS = 3;

const WIDTH = 183;
const HEIGHT = 304;

export const FACTORY: AuthoredTable = {
  name: 'factory',
  size: { width: WIDTH, height: HEIGHT },
  ballRadius: BALL_RADIUS,

  banks: [{ name: 'bank.assembly', award: 14000 }],

  /**
   * Three missions, each two acts, which is the shape `low-orbit` was converted to and the shape the
   * 1995 campaign has: a route, and then the shot that cashes it. The theme is the rocket being built
   * and then lit — check the gauges, load the bay, and light the engines.
   */
  missions: [
    {
      award: 6000,
      stages: [
        { id: 'pinball.mission.factory.gauges', targets: ['gauge1', 'gauge2', 'gauge3'] },
        { id: 'pinball.mission.factory.gauges2', targets: ['ramp'] },
      ],
    },
    {
      award: 12000,
      stages: [
        { id: 'pinball.mission.factory.bay', targets: ['drop1', 'drop2', 'drop3'] },
        { id: 'pinball.mission.factory.bay2', targets: ['kicker'] },
      ],
    },
    {
      award: 22000,
      stages: [
        { id: 'pinball.mission.factory.lanes', targets: ['lane1', 'lane2', 'lane3'] },
        { id: 'pinball.mission.factory.lanes2', targets: ['well1', 'well2', 'well3'] },
      ],
    },
  ],

  lamps: [
    ...CABINET_LAMPS,
    'lamp.mission', 'lamp.jackpot',
    'lamp.gauge1', 'lamp.gauge2', 'lamp.gauge3',
    'lamp.drop1', 'lamp.drop2', 'lamp.drop3',
    'lamp.lane1', 'lamp.lane2', 'lamp.lane3',
    'lamp.well1', 'lamp.well2', 'lamp.well3',
    'lamp.ramp', 'lamp.crane',
    'lamp.pipe1', 'lamp.pipe2', 'lamp.pipe3',
    'lamp.signal1', 'lamp.signal2', 'lamp.signal3',
    'lamp.finLeft', 'lamp.finRight',
    'lamp.deflectorLeft', 'lamp.deflectorRight',
  ],

  /**
   * ⚠️ THE LIGHT COMES OFF THE ENGINES, WHICH IS WHERE THE PICTURE PUTS IT. Two spotlights rake down
   * the bay in the art and the exhaust burns at the bottom; this is the second of those, because it is
   * the one that changes — the crane lamp only burns once the hook has been struck.
   */
  lights: [
    { at: { x: 89, y: 250 }, radius: 78, role: 'hazard', intensity: 0.16 },
    { at: { x: 136, y: 82 }, radius: 42, role: 'goal', intensity: 0.28, lamp: 'lamp.crane' },
  ],

  components: [
    ...cabinet({ width: WIDTH, height: HEIGHT }),

    /* ===================== THE GAUGES ===================== */
    //
    // The three round dials the picture draws across the middle of the bay: one high in the centre and
    // one to each side, a little lower. That IS a bumper nest — three round things a ball rattles
    // between — so it is the one place on this table where the art and the play wanted the same thing
    // and nothing had to be argued.
    { name: 'gauge1', kind: 'bumper', role: 'structure', bounds: { x: 46, y: 99, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.gauge1'],
      collision: [{ kind: 'circle', at: { x: 55, y: 108 }, radius: 9 }] },
    { name: 'gauge2', kind: 'bumper', role: 'structure', bounds: { x: 80, y: 86, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.gauge2'],
      collision: [{ kind: 'circle', at: { x: 89, y: 95 }, radius: 9 }] },
    { name: 'gauge3', kind: 'bumper', role: 'structure', bounds: { x: 114, y: 98, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.gauge3'],
      collision: [{ kind: 'circle', at: { x: 123, y: 107 }, radius: 9 }] },

    /* ===================== THE BAY DOORS ===================== */
    //
    // Three drop targets on the row of grey discs the picture puts under the gauges, faces running LEFT
    // TO RIGHT so the normal points up the table at the thing falling out of the nest. That is where
    // every machine puts a drop bank and it is where the art already drew one.
    { name: 'drop1', kind: 'target', role: 'key', bounds: { x: 59, y: 123, width: 16, height: 8 },
      scores: [1500], control: 'TargetBankControl', bank: 'bank.assembly', lamps: ['lamp.drop1'],
      collision: [{ kind: 'line', from: { x: 59, y: 123 }, to: { x: 75, y: 123 } }] },
    { name: 'drop2', kind: 'target', role: 'key', bounds: { x: 81, y: 123, width: 16, height: 8 },
      scores: [1500], control: 'TargetBankControl', bank: 'bank.assembly', lamps: ['lamp.drop2'],
      collision: [{ kind: 'line', from: { x: 81, y: 123 }, to: { x: 97, y: 123 } }] },
    { name: 'drop3', kind: 'target', role: 'key', bounds: { x: 103, y: 123, width: 16, height: 8 },
      scores: [1500], control: 'TargetBankControl', bank: 'bank.assembly', lamps: ['lamp.drop3'],
      collision: [{ kind: 'line', from: { x: 103, y: 123 }, to: { x: 119, y: 123 } }] },

    /* ===================== THE WELLS ===================== */
    //
    // Three, which is what `control/wormhole` expects: the teleport is a choice among three. The two
    // yellow discs that flank the grey row, and the upper of the two on the rocket's own body.
    { name: 'well1', kind: 'well', role: 'gate', bounds: { x: 32, y: 120, width: 14, height: 14 },
      scores: [1000, 20000, 5000], control: 'LaneControl', lamps: ['lamp.well1'] },
    { name: 'well2', kind: 'well', role: 'gate', bounds: { x: 133, y: 120, width: 14, height: 14 },
      scores: [1000, 20000, 5000], control: 'LaneControl', lamps: ['lamp.well2'] },
    { name: 'well3', kind: 'well', role: 'gate', bounds: { x: 82, y: 171, width: 14, height: 14 },
      scores: [1000, 20000, 5000], control: 'LaneControl', lamps: ['lamp.well3'] },

    /* ===================== THE IGNITION ===================== */
    // The lower disc on the rocket, which in the picture is the one just above the engines.
    { name: 'kicker', kind: 'kicker', role: 'gate', bounds: { x: 81, y: 191, width: 16, height: 16 },
      scores: [15000], control: 'LaneControl', lamps: ['lamp.jackpot'] },

    /* ===================== THE RETURN LANES ===================== */
    // The six lit bars across the head of the bay. Three lanes on them, which is what the other tables
    // carry and what `control/lanes` counts.
    { name: 'lane1', kind: 'lane', role: 'free', bounds: { x: 62, y: 16, width: 12, height: 14 },
      scores: [1000], control: 'LaneControl', lamps: ['lamp.lane1'] },
    { name: 'lane2', kind: 'lane', role: 'free', bounds: { x: 84, y: 16, width: 12, height: 14 },
      scores: [1000], control: 'LaneControl', lamps: ['lamp.lane2'] },
    { name: 'lane3', kind: 'lane', role: 'free', bounds: { x: 106, y: 16, width: 12, height: 14 },
      scores: [1000], control: 'LaneControl', lamps: ['lamp.lane3'] },

    /* ===================== THE CRANE ===================== */
    //
    // ⚠️ THE ONE MOVING BODY, AND THE PICTURE ASKED FOR IT. A crane is the only thing in this bay that
    // is drawn mid-motion — its jib reaches in over the rocket — and `low-orbit`'s two drones record
    // what a mover has to be to be worth anything: "a MOVING body is met far less often than a static
    // one in the same place, since the ball has to be there at the same moment."
    //
    // ⚠️ SO IT CROSSES RATHER THAN LIES ALONG. The jib in the art runs down the right-hand edge, which
    // is where `low-orbit`'s first drone was and where sixty balls never met it. This one swings from
    // over the nest out to where the jib is drawn, on a diagonal — the same correction, made once
    // rather than three times.
    { name: 'crane', kind: 'rebounder', role: 'goal',
      bounds: { x: 104, y: 58, width: 44, height: 42 },
      scores: [3000], control: 'RebounderControl', lamps: ['lamp.crane'],
      mover: { from: { x: 110, y: 64 }, to: { x: 142, y: 94 }, seconds: 1.6, radius: 5 } },

    /* ===================== THE GANTRY RAMP ===================== */
    // Up the left side, on the walkway the picture draws climbing out of the flames.
    { name: 'ramp', kind: 'ramp', role: 'goal', bounds: { x: 16, y: 150, width: 40, height: 60 },
      scores: [7500], control: 'RampControl', lamps: ['lamp.ramp'],
      collision: [{ kind: 'line', from: { x: 16, y: 150 }, to: { x: 56, y: 210 } }] },

    /* ===================== THE PIPE STACK ===================== */
    //
    // ⚠️ NINE MORE SCORING PARTS, AND THE REASON IS A MEASUREMENT RATHER THAN A WISH. The first draft
    // of this table came out at 3.77 scoring components per ten thousand pixels against the 1995
    // playfield's 5.25, and `tests/table-density` refused it — the ledger it keeps is empty, because
    // the other six were each authored UP to the bar rather than the bar being moved. A seventh
    // arriving under it would be the first entry back on a list that took six tables to empty.
    //
    // So the picture was read again for what it already draws and nobody had used. It draws a good
    // deal: a stack of pipes down the left wall, a row of lamps under the head of the bay, the
    // rocket's own fins, and the two dark deflectors either side of the engines.
    //
    // Three targets against the pipes, faces on their RIGHT edge — written top to bottom so the normal
    // points at the play, which is the rule `normalOf` states and the one every first draft here has
    // got wrong at least once.
    { name: 'pipe1', kind: 'target', role: 'key', bounds: { x: 10, y: 96, width: 10, height: 12 },
      scores: [500, 5000], control: 'TargetControl', lamps: ['lamp.pipe1'],
      collision: [{ kind: 'line', from: { x: 20, y: 96 }, to: { x: 20, y: 108 } }] },
    { name: 'pipe2', kind: 'target', role: 'key', bounds: { x: 10, y: 114, width: 10, height: 12 },
      scores: [500, 5000], control: 'TargetControl', lamps: ['lamp.pipe2'],
      collision: [{ kind: 'line', from: { x: 20, y: 114 }, to: { x: 20, y: 126 } }] },
    { name: 'pipe3', kind: 'target', role: 'key', bounds: { x: 10, y: 132, width: 10, height: 12 },
      scores: [500, 5000], control: 'TargetControl', lamps: ['lamp.pipe3'],
      collision: [{ kind: 'line', from: { x: 20, y: 132 }, to: { x: 20, y: 144 } }] },

    /* ===================== THE SIGNAL LAMPS ===================== */
    //
    // The row of small lamps the picture draws under the head of the bay, on the beam. Rolled over
    // rather than struck: nothing collides with them, and `table/rollovers` polls the ball's position
    // for exactly this — a part of a table a ball passes ACROSS.
    { name: 'signal1', kind: 'lane', role: 'free', bounds: { x: 30, y: 68, width: 10, height: 10 },
      scores: [750], control: 'LaneControl', lamps: ['lamp.signal1'] },
    { name: 'signal2', kind: 'lane', role: 'free', bounds: { x: 44, y: 68, width: 10, height: 10 },
      scores: [750], control: 'LaneControl', lamps: ['lamp.signal2'] },
    { name: 'signal3', kind: 'lane', role: 'free', bounds: { x: 58, y: 68, width: 10, height: 10 },
      scores: [750], control: 'LaneControl', lamps: ['lamp.signal3'] },

    /* ===================== THE FINS ===================== */
    //
    // The rocket's two wings, which the picture draws spread either side of its body. Struck from
    // OUTSIDE, so the left fin's face is its left edge and the right fin's its right — each written so
    // the normal points away from the rocket, at the ball coming down the side of the bay.
    { name: 'finLeft', kind: 'target', role: 'goal', bounds: { x: 48, y: 196, width: 12, height: 18 },
      scores: [2500], control: 'TargetControl', lamps: ['lamp.finLeft'],
      collision: [{ kind: 'line', from: { x: 48, y: 214 }, to: { x: 48, y: 196 } }] },
    { name: 'finRight', kind: 'target', role: 'goal', bounds: { x: 118, y: 196, width: 12, height: 18 },
      scores: [2500], control: 'TargetControl', lamps: ['lamp.finRight'],
      collision: [{ kind: 'line', from: { x: 130, y: 196 }, to: { x: 130, y: 214 } }] },

    /* ===================== THE DEFLECTORS ===================== */
    //
    // The two dark wedges the picture stands either side of the engines — a slingshot in everything but
    // name, and the part of a real machine that keeps a ball off the outlanes for one more shot.
    { name: 'deflectorLeft', kind: 'rebounder', role: 'hazard',
      bounds: { x: 30, y: 222, width: 16, height: 16 },
      scores: [1200], control: 'RebounderControl', lamps: ['lamp.deflectorLeft'],
      collision: [{ kind: 'circle', at: { x: 38, y: 230 }, radius: 8 }] },
    { name: 'deflectorRight', kind: 'rebounder', role: 'hazard',
      bounds: { x: 128, y: 222, width: 16, height: 16 },
      scores: [1200], control: 'RebounderControl', lamps: ['lamp.deflectorRight'],
      collision: [{ kind: 'circle', at: { x: 136, y: 230 }, radius: 8 }] },

    /* ===================== THE LAUNCH BOARD ===================== */
    // The yellow bar between the red and green lamps at the head of the bay. Struck from the middle of
    // the table, so the face is its LEFT edge, written bottom to top.
    { name: 'flag', kind: 'flag', role: 'key', bounds: { x: 84, y: 40, width: 14, height: 16 },
      scores: [750, 7500], control: 'TargetControl', lamps: ['lamp.mission'],
      collision: [{ kind: 'line', from: { x: 84, y: 56 }, to: { x: 84, y: 40 } }] },
  ],
};
