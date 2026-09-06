// SPDX-License-Identifier: AGPL-3.0-or-later
// table/low-orbit — the authored table. First draft, and a proposal rather than a decision.
//
// ========================= WHAT THIS IS =========================
// A complete, playable 183x235 table with nothing of Microsoft's in it: our geometry, our names, our
// lamps. It exists so that the machine ported in phases 1 to 7 has a table of its own to run, and so
// that the shape of `table/authored` is proved by something real rather than by a fixture.
//
// ⚠️ THE LAYOUT IS A PROPOSAL. Where the ramps go, how many bumpers there are and what the table is
// about are authoring decisions, not transcription, and they belong to the Dev the same way the
// camera's thresholds did. This draft is written to be argued with: every position is a number in one
// file, and moving one is a one-line diff whose effect a test will describe.
//
// ⚠️ AND IT IS NOT PLAYABLE YET. Running it says why: a launched ball goes straight up the plunger
// lane, bounces off the ceiling, comes straight back down the same lane and drains, three times out of
// three, without ever entering the play. THE LANE HAS NO RETURN CURVE. A real plunger lane ends in a
// bend that turns the ball left across the top of the table; this one ends at a wall.
//
// That is a geometry decision and not a defect in anything ported, which is exactly the sort of thing
// authoring a table was meant to expose. Fixing it means shaping the top of the lane — several angled
// segments — and it is left as the next authoring step rather than guessed at here.
//
// ========================= HOW IT IS LAID OUT =========================
// Coordinates are table pixels with y growing DOWNWARD, as everywhere else in this port: y=0 is the
// top of the table, y=235 the drain end, and "up the table" means toward zero.
//
//        0                                                                183
//    0   +--------------------------------------------------------------+
//        |  reentry lanes                                     |         |
//   40   |         ramp                                       | plunger |
//        |  bumpers                                           |  lane   |
//  100   |  targets        wormhole wells                     |         |
//        |                                                    |         |
//  200   |     outlane   flipper   flipper   outlane          |         |
//  226   |                     drain                                    |
//  235   +--------------------------------------------------------------+
//
// The plunger lane runs the full height on the right, separated by a wall, because that is the one
// piece of geometry a pinball cannot do without: a ball has to be able to reach the top without
// crossing the play.
//
// ========================= AND THE GAPS ARE THE DESIGN =========================
// A gap narrower than the ball is not a tight shot, it is a wall that looks like a gap. The ball is 3
// pixels in radius, so anything the ball is meant to pass through is at least 6 wide, and the tests
// check the ones that matter: between the flippers, and each outlane. The drain gap is deliberately
// the widest of the three — losing the ball down the middle should be the common way to lose it.

import type { AuthoredTable } from './authored.js';
import { cabinet, CABINET_LAMPS } from './cabinet.js';

/** Half the ball. Every passable gap on this table is at least twice this. */
export const BALL_RADIUS = 3;

const WIDTH = 183;
const HEIGHT = 235;

const WALL = 'structure' as const;

export const LOW_ORBIT: AuthoredTable = {
  name: 'low-orbit',
  size: { width: WIDTH, height: HEIGHT },
  ballRadius: BALL_RADIUS,

  /**
   * ⚠️ THREE, AND THEY ARE A ROUTE ROUND THE TABLE RATHER THAN A LIST OF THINGS.
   *
   * Each one sends the player somewhere different: the bumper nest at the top, the target bank down
   * the left, then the reentry lanes across the head of the table. A mission whose targets are all in
   * one place is a mission the ball satisfies by accident, and the sonar would point at a single spot
   * for the whole of it.
   *
   * The awards climb because the routes get harder, not because the last one is worth more in itself:
   * the lanes are at the top of the table, which is the furthest a ball has to be kept alive to reach.
   */
  /**
   * ⚠️ A DROP BANK ON THE RIGHT, AND IT IS HERE BECAUSE THE TABLE WAS MEASURABLY THIN.
   *
   * The 1995 playfield carries 90 components with a score row over 365x470 — 5.25 per ten thousand
   * pixels. This table measured 4.19, and `tests/table-density` is where that comparison lives. The
   * Dev asked why the authored tables are simpler than the original; four of the six are much thinner
   * than that and this one was the closest, which is why it is the first to be authored up.
   *
   * The bank sits UNDER THE BUMPER NEST, which is where every machine puts one: the ball falls out of
   * the bumpers onto it. The first attempt put it against the lane divider on the right and it was
   * unhittable — see the note beside the targets themselves.
   */
  banks: [{ name: 'bank.orbit', award: 12000 }],

  missions: [
    /**
     * ⚠️ EACH ONE IS TWO ACTS NOW, WHICH IS THE SHAPE THE 1995 CAMPAIGN HAS. Its missions read
     * "derrube os tres alvos da direita" and then "agora o ejetor da direita" — a route, then the shot
     * that cashes it. Three one-line checklists were what "the tables are simpler than the original"
     * meant, and this is the first table converted.
     *
     * The second act is always somewhere ELSE on the table, and always a single thing: the first act
     * is the work and the second is the aim. A second act in the same corner as the first would be a
     * longer checklist wearing a costume.
     */
    {
      award: 5000,
      stages: [
        { id: 'pinball.mission.lowOrbit.bumpers', targets: ['bumper1', 'bumper2', 'bumper3'] },
        { id: 'pinball.mission.lowOrbit.bumpers2', targets: ['ramp'] },
      ],
    },
    {
      award: 10000,
      stages: [
        { id: 'pinball.mission.lowOrbit.targets', targets: ['target1', 'target2', 'target3'] },
        { id: 'pinball.mission.lowOrbit.targets2', targets: ['kicker'] },
      ],
    },
    {
      award: 20000,
      stages: [
        { id: 'pinball.mission.lowOrbit.lanes', targets: ['lane1', 'lane2', 'lane3'] },
        { id: 'pinball.mission.lowOrbit.lanes2', targets: ['well1', 'well2', 'well3'] },
      ],
    },
  ],
  lamps: [
    ...CABINET_LAMPS,
    'lamp.mission', 'lamp.jackpot',
    'lamp.bumper1', 'lamp.bumper2', 'lamp.bumper3',
    'lamp.target1', 'lamp.target2', 'lamp.target3',
    'lamp.lane1', 'lamp.lane2', 'lamp.lane3',
    'lamp.well1', 'lamp.well2', 'lamp.well3',
    // ⚠️ AND NOT THE OUTLANES OR THE INLANES: `CABINET_LAMPS` above declares those, and this list held
    // them too until the cabinet arrived — four names declared twice, which the validator refuses. It
    // is the same drift the components were: written here first, then written again in the shared
    // module, and nobody reconciled the copies because nothing compared them.
    'lamp.ramp',
    'lamp.drop1', 'lamp.drop2', 'lamp.drop3',
    'lamp.droneHigh', 'lamp.droneLow',
  ],

  components: [
    /**
     * ⚠️ THE CABINET, AT LAST, AND THIS TABLE HAD BEEN WRITING ITS OWN FOR MONTHS.
     *
     * `table/cabinet` exists because five tables needed the same shell and copying it five times would
     * have been five chances to re-make the two defects its header records. This table is where that
     * shell was PROVED — its numbers are the ones the module was extracted from — and it was never
     * converted to use it. So every cabinet change since reached five tables and skipped the sixth:
     * the plunger's own collision face, the two inlanes, the ball-radius offset. Each had to be made
     * twice, and the second time was noticed only because a test named this table.
     *
     * ⚠️ AND THE BOTTOM ASSEMBLY MOVES SEVEN PIXELS LEFT, which is the drift made visible. This file
     * centred its flippers and drain on the TABLE — 183 / 2 — and `cabinet` centres them on the PLAY,
     * `(w - 16) / 2`, because sixteen pixels of the width are the plunger lane and a ball never plays
     * there. The cabinet's arithmetic is the right one; this file's was the first draft of it.
     */
    ...cabinet({ width: WIDTH, height: HEIGHT }),

    { name: 'bumper1', kind: 'bumper', role: WALL, bounds: { x: 48, y: 58, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.bumper1'],
      collision: [{ kind: 'circle', at: { x: 57, y: 67 }, radius: 9 }] },
    { name: 'bumper2', kind: 'bumper', role: WALL, bounds: { x: 78, y: 46, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.bumper2'],
      collision: [{ kind: 'circle', at: { x: 87, y: 55 }, radius: 9 }] },
    { name: 'bumper3', kind: 'bumper', role: WALL, bounds: { x: 108, y: 58, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.bumper3'],
      collision: [{ kind: 'circle', at: { x: 117, y: 67 }, radius: 9 }] },

    /* ===================== THE TARGET BANK ===================== */
    // Three targets whose fields sum to three, which is the shape `control/controls` ports.
    //
    // ⚠️ ALL THREE HAD A SCORE, A CONTROL, A LAMP AND NO COLLISION, so the ball passed through them and
    // `BoosterTargetControl` could never fire. They stand against the left wall, so the face is the
    // RIGHT edge, written top to bottom to put the normal on the side the ball arrives from.
    { name: 'target1', kind: 'target', role: 'key', bounds: { x: 12, y: 104, width: 10, height: 12 },
      scores: [500, 5000], control: 'TargetControl', lamps: ['lamp.target1'],
      collision: [{ kind: 'line', from: { x: 22, y: 104 }, to: { x: 22, y: 116 } }] },
    { name: 'target2', kind: 'target', role: 'key', bounds: { x: 12, y: 122, width: 10, height: 12 },
      scores: [500, 5000], control: 'TargetControl', lamps: ['lamp.target2'],
      collision: [{ kind: 'line', from: { x: 22, y: 122 }, to: { x: 22, y: 134 } }] },
    { name: 'target3', kind: 'target', role: 'key', bounds: { x: 12, y: 140, width: 10, height: 12 },
      scores: [500, 5000], control: 'TargetControl', lamps: ['lamp.target3'],
      collision: [{ kind: 'line', from: { x: 22, y: 140 }, to: { x: 22, y: 152 } }] },

    /* ===================== THE DRONES ===================== */
    //
    // ⚠️ THE FIRST BODIES ON ANY TABLE THAT MOVE WITHOUT THE PLAYER MOVING THEM. The Dev's theme for
    // this table: "satélites, estação espacial, com drones indo de satélite em satélite que interagem
    // com a bolinha."
    //
    // Two of them, crossing the open water between the bumper nest and the target wall — the part of
    // the table a ball falls through without meeting anything. They travel at right angles to each
    // other so the pair is never a single moving wall, and they are REBOUNDERS: a drone should throw a
    // ball somewhere, and a bumper that also moves would be two sources of speed in one body.
    //
    // ⚠️ AND A MOVER DECLARES NO `collision`. Its body is the disc it carries; a shape as well would be
    // geometry left standing where the drone used to be.
    { name: 'drone.high', kind: 'rebounder', role: 'goal',
      bounds: { x: 30, y: 82, width: 80, height: 12 },
      scores: [3000], control: 'RebounderControl', lamps: ['lamp.droneHigh'],
      mover: { from: { x: 36, y: 88 }, to: { x: 104, y: 88 }, seconds: 2.4, radius: 5 } },
    // ⚠️ AND THE SECOND ONE CROSSES THE MIDDLE, because its first path was decoration. It ran down the
    // right-hand edge and sixty balls never met it — a MOVING body is met far less often than a static
    // one in the same place, since the ball has to be there at the same moment, and the right-hand
    // edge was somewhere the ball rarely was at any moment.
    { name: 'drone.low', kind: 'rebounder', role: 'goal',
      //
      // ⚠️ AND CLEAR OF THE LEFT PADDLE'S SHOT COLUMN, which its second path was not. Crossing x 56 to
      // 104 put it directly above the pivot at 44.5, so the flipper's own gate — "the ball comes back
      // higher than it fell from" — failed: the shot met a drone instead of open air. The drop bank
      // taught the same lesson on this table and that gate has already been moved once for it; moving
      // it again would be tuning a test to the furniture rather than placing the furniture.
      //
      // ⚠️ AND A THIRD PATH, BECAUSE THE OUTLANES BECAME REAL. `table/cabinet`'s right-hand funnel
      // guide used to run to `divider - 4`, leaving a four-pixel gap against a six-pixel ball, and
      // widening it to a channel the ball can actually enter changed where the ball goes on this
      // table. Sixty balls stopped meeting this drone at x 76 to 124 — which is the moving body's own
      // rule, recorded above, arriving from a change made in another file.
      //
      // ⚠️ SO IT WAS MEASURED RATHER THAN GUESSED A THIRD TIME. Ball-time on this table, sixty balls,
      // in twenty-pixel cells: the band y 160-179 holds the three busiest cells of the whole playfield
      // — 3.6% at x 40-59, 2.7% at 60-79, 2.4% at 80-99 — against 1.0% where the old path ended.
      //
      // ⚠️ AND THE BUSIEST CELLS ARE THE PADDLE'S SHOT COLUMN, WHICH IS WHY THEY ARE BUSY. A horizontal
      // path across them, x 60 to 100 at y 160, was met by the ball and failed the flipper's own gate
      // in the same run — the two constraints are the same fact read from two ends, and no straight
      // line along that band satisfies both.
      //
      // A DIAGONAL DOES. It descends from the open middle into the busy band and leaves the launch
      // line free, because it crosses that column rather than lying along it. Four candidates were run
      // against reachability, the flipper's force and playability together, which is what the second
      // attempt should have done: the three horizontals each failed one of the three, and this passed
      // all of them.
      bounds: { x: 74, y: 124, width: 42, height: 46 },
      scores: [3000], control: 'RebounderControl', lamps: ['lamp.droneLow'],
      mover: { from: { x: 80, y: 130 }, to: { x: 110, y: 164 }, seconds: 1, radius: 5 } },

    /* ===================== THE DROP BANK ===================== */
    //
    // Three drop targets stacked against the lane divider, above the ramp's mouth. A hit sinks one and
    // the ball then passes over where it was; the last one standing pays the bank and stands all three
    // back up. See `table/target-bank` for why that is a route rather than a rattle.
    //
    // ⚠️ AND THE FIRST PLACEMENT WAS UNHITTABLE, WHICH LOOKING AT THE PICTURE IS WHAT SHOWED.
    //
    // They went in a column against the lane divider at x=138, faces pointing LEFT. The ball enters
    // the play from the return bend at the top RIGHT, travelling left — so it approaches that column
    // from behind and passes over three one-sided faces that answer nothing. Worse, a column there
    // that DID face the other way would have blocked the only way into the table.
    //
    // Under the bumper nest is where a drop bank belongs and where every machine puts one: the ball
    // falls out of the bumpers onto it. The faces run LEFT TO RIGHT, so the normal is `(dy, -dx)` with
    // dy = 0 and dx positive — pointing up the screen, at the thing falling onto them.
    { name: 'drop1', kind: 'target', role: 'key', bounds: { x: 40, y: 92, width: 16, height: 8 },
      scores: [1500], control: 'TargetBankControl', bank: 'bank.orbit', lamps: ['lamp.drop1'],
      collision: [{ kind: 'line', from: { x: 40, y: 92 }, to: { x: 56, y: 92 } }] },
    { name: 'drop2', kind: 'target', role: 'key', bounds: { x: 62, y: 92, width: 16, height: 8 },
      scores: [1500], control: 'TargetBankControl', bank: 'bank.orbit', lamps: ['lamp.drop2'],
      collision: [{ kind: 'line', from: { x: 62, y: 92 }, to: { x: 78, y: 92 } }] },
    { name: 'drop3', kind: 'target', role: 'key', bounds: { x: 84, y: 92, width: 16, height: 8 },
      scores: [1500], control: 'TargetBankControl', bank: 'bank.orbit', lamps: ['lamp.drop3'],
      collision: [{ kind: 'line', from: { x: 84, y: 92 }, to: { x: 100, y: 92 } }] },

    /* ===================== THE RETURN LANES ===================== */
    //
    // Inside each guide, where a ball that survives the funnel comes back down to the paddle. Every
    // pinball has these and this table had only the OUTLANES — so the lower third paid the player for
    // bad luck and nothing for good play, which is the wrong way round.
    { name: 'lane1', kind: 'lane', role: 'free', bounds: { x: 40, y: 16, width: 12, height: 14 },
      scores: [1000], control: 'LaneControl', lamps: ['lamp.lane1'] },
    { name: 'lane2', kind: 'lane', role: 'free', bounds: { x: 62, y: 16, width: 12, height: 14 },
      scores: [1000], control: 'LaneControl', lamps: ['lamp.lane2'] },
    { name: 'lane3', kind: 'lane', role: 'free', bounds: { x: 84, y: 16, width: 12, height: 14 },
      scores: [1000], control: 'LaneControl', lamps: ['lamp.lane3'] },

    /* ===================== THE RAMP ===================== */
    { name: 'ramp', kind: 'ramp', role: 'goal', bounds: { x: 112, y: 90, width: 40, height: 60 },
      scores: [7500], control: 'RampControl', lamps: ['lamp.ramp'],
      collision: [{ kind: 'line', from: { x: 112, y: 150 }, to: { x: 152, y: 90 } }] },

    /* ===================== THE WORMHOLE ===================== */
    // Three wells, which is what `control/wormhole` expects: the teleport is a choice among three.
    { name: 'well1', kind: 'well', role: 'gate', bounds: { x: 36, y: 168, width: 14, height: 14 },
      scores: [1000, 20000, 5000], control: 'LaneControl', lamps: ['lamp.well1'] },
    { name: 'well2', kind: 'well', role: 'gate', bounds: { x: 84, y: 168, width: 14, height: 14 },
      scores: [1000, 20000, 5000], control: 'LaneControl', lamps: ['lamp.well2'] },
    { name: 'well3', kind: 'well', role: 'gate', bounds: { x: 132, y: 168, width: 14, height: 14 },
      scores: [1000, 20000, 5000], control: 'LaneControl', lamps: ['lamp.well3'] },

    /* ===================== THE KICKER ===================== */
    { name: 'kicker', kind: 'kicker', role: 'gate', bounds: { x: 60, y: 128, width: 16, height: 16 },
      scores: [15000], control: 'LaneControl', lamps: ['lamp.jackpot'] },

    /* ===================== THE FLAG ===================== */
    // Struck from the middle of the table, so the face is its LEFT edge, written bottom to top.
    { name: 'flag', kind: 'flag', role: 'key', bounds: { x: 136, y: 40, width: 12, height: 20 },
      scores: [750, 7500], control: 'TargetControl', lamps: ['lamp.mission'],
      collision: [{ kind: 'line', from: { x: 136, y: 60 }, to: { x: 136, y: 40 } }] },
  ],
};
