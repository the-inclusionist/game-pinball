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

/** Half the ball. Every passable gap on this table is at least twice this. */
export const BALL_RADIUS = 3;

const WALL = 'structure' as const;

export const LOW_ORBIT: AuthoredTable = {
  name: 'low-orbit',
  size: { width: 183, height: 235 },
  ballRadius: BALL_RADIUS,

  lamps: [
    'lamp.mission', 'lamp.bonus', 'lamp.jackpot', 'lamp.shootAgain', 'lamp.spare',
    'lamp.bumper1', 'lamp.bumper2', 'lamp.bumper3',
    'lamp.target1', 'lamp.target2', 'lamp.target3',
    'lamp.lane1', 'lamp.lane2', 'lamp.lane3',
    'lamp.well1', 'lamp.well2', 'lamp.well3',
    'lamp.ramp', 'lamp.outlaneLeft', 'lamp.outlaneRight',
  ],

  components: [
    /* ===================== THE WALLS ===================== */
    // The outer shell, and the one that separates the plunger lane from the play.
    { name: 'wall.left', kind: 'wall', role: WALL, bounds: { x: 0, y: 0, width: 4, height: 235 },
      collision: [{ kind: 'line', from: { x: 4, y: 0 }, to: { x: 4, y: 235 } }] },
    { name: 'wall.right', kind: 'wall', role: WALL, bounds: { x: 179, y: 0, width: 4, height: 235 },
      collision: [{ kind: 'line', from: { x: 179, y: 235 }, to: { x: 179, y: 0 } }] },
    { name: 'wall.top', kind: 'wall', role: WALL, bounds: { x: 0, y: 0, width: 183, height: 4 },
      collision: [{ kind: 'line', from: { x: 183, y: 4 }, to: { x: 0, y: 4 } }] },
    // The lane divider stops 30 pixels short of the top: that opening is how a launched ball enters
    // the play, and it is the only way in.
    { name: 'wall.laneDivider', kind: 'wall', role: WALL,
      bounds: { x: 162, y: 34, width: 4, height: 201 },
      collision: [{ kind: 'line', from: { x: 162, y: 235 }, to: { x: 162, y: 34 } }] },

    // ⚠️ THE RETURN BEND, and the whole reason the table plays at all.
    //
    // Without it a launched ball goes straight up the lane, off the ceiling and straight back down the
    // same lane: three balls out of three drained without ever entering the play. A plunger lane has
    // to END IN A CURVE that turns the ball left across the top of the table, and this is the
    // cheapest thing that is one — a single slope, steep enough to redirect and shallow enough not to
    // stop the ball dead.
    //
    // It is wound right-to-left-and-up so its normal points DOWN into the lane, which is the side the
    // rising ball arrives from.
    { name: 'wall.laneReturn', kind: 'wall', role: WALL,
      bounds: { x: 148, y: 4, width: 32, height: 18 },
      collision: [{ kind: 'line', from: { x: 179, y: 21 }, to: { x: 148, y: 6 } }] },

    /* ===================== THE PLUNGER LANE ===================== */
    { name: 'plunger', kind: 'plunger', role: WALL, bounds: { x: 167, y: 200, width: 10, height: 32 } },
    { name: 'lane.launch', kind: 'lane', role: 'free', bounds: { x: 167, y: 40, width: 10, height: 158 },
      scores: [500], lamps: ['lamp.ramp'] },

    /* ===================== THE BOTTOM: FLIPPERS, OUTLANES, DRAIN ===================== */
    // The gap between the flipper tips is 22 pixels — comfortably more than the ball, because the
    // middle is where a ball is SUPPOSED to be losable.
    { name: 'flipper.left', kind: 'flipper', role: WALL,
      bounds: { x: 52, y: 206, width: 28, height: 7 },
      collision: [{ kind: 'line', from: { x: 52, y: 206 }, to: { x: 80, y: 213 } }] },
    { name: 'flipper.right', kind: 'flipper', role: WALL,
      bounds: { x: 102, y: 206, width: 28, height: 7 },
      collision: [{ kind: 'line', from: { x: 102, y: 213 }, to: { x: 130, y: 206 } }] },

    // Each outlane is 12 wide: passable, and punishing.
    { name: 'outlane.left', kind: 'lane', role: 'hazard',
      bounds: { x: 20, y: 196, width: 12, height: 30 }, scores: [2000], lamps: ['lamp.outlaneLeft'] },
    { name: 'outlane.right', kind: 'lane', role: 'hazard',
      bounds: { x: 150, y: 196, width: 12, height: 30 }, scores: [2000], lamps: ['lamp.outlaneRight'] },

    { name: 'drain', kind: 'drain', role: 'hazard', bounds: { x: 76, y: 226, width: 30, height: 8 },
      control: 'BallDrainControl' },

    /* ===================== THE BUMPERS ===================== */
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
    { name: 'target1', kind: 'target', role: 'key', bounds: { x: 12, y: 104, width: 10, height: 12 },
      scores: [500, 5000], control: 'BoosterTargetControl', lamps: ['lamp.target1'] },
    { name: 'target2', kind: 'target', role: 'key', bounds: { x: 12, y: 122, width: 10, height: 12 },
      scores: [500, 5000], control: 'BoosterTargetControl', lamps: ['lamp.target2'] },
    { name: 'target3', kind: 'target', role: 'key', bounds: { x: 12, y: 140, width: 10, height: 12 },
      scores: [500, 5000], control: 'BoosterTargetControl', lamps: ['lamp.target3'] },

    /* ===================== THE REENTRY LANES ===================== */
    { name: 'lane1', kind: 'lane', role: 'free', bounds: { x: 40, y: 16, width: 12, height: 14 },
      scores: [1000], control: 'ReentryLanesRolloverControl', lamps: ['lamp.lane1'] },
    { name: 'lane2', kind: 'lane', role: 'free', bounds: { x: 62, y: 16, width: 12, height: 14 },
      scores: [1000], control: 'ReentryLanesRolloverControl', lamps: ['lamp.lane2'] },
    { name: 'lane3', kind: 'lane', role: 'free', bounds: { x: 84, y: 16, width: 12, height: 14 },
      scores: [1000], control: 'ReentryLanesRolloverControl', lamps: ['lamp.lane3'] },

    /* ===================== THE RAMP ===================== */
    { name: 'ramp', kind: 'ramp', role: 'goal', bounds: { x: 112, y: 90, width: 40, height: 60 },
      scores: [7500], control: 'LaunchRampControl', lamps: ['lamp.ramp'],
      collision: [{ kind: 'line', from: { x: 112, y: 150 }, to: { x: 152, y: 90 } }] },

    /* ===================== THE WORMHOLE ===================== */
    // Three wells, which is what `control/wormhole` expects: the teleport is a choice among three.
    { name: 'well1', kind: 'well', role: 'gate', bounds: { x: 36, y: 168, width: 14, height: 14 },
      scores: [1000, 20000, 5000], control: 'WormHoleControl', lamps: ['lamp.well1'] },
    { name: 'well2', kind: 'well', role: 'gate', bounds: { x: 84, y: 168, width: 14, height: 14 },
      scores: [1000, 20000, 5000], control: 'WormHoleControl', lamps: ['lamp.well2'] },
    { name: 'well3', kind: 'well', role: 'gate', bounds: { x: 132, y: 168, width: 14, height: 14 },
      scores: [1000, 20000, 5000], control: 'WormHoleControl', lamps: ['lamp.well3'] },

    /* ===================== THE KICKER ===================== */
    { name: 'kicker', kind: 'kicker', role: 'gate', bounds: { x: 60, y: 128, width: 16, height: 16 },
      scores: [15000], control: 'BlackHoleKickoutControl', lamps: ['lamp.jackpot'] },

    /* ===================== THE FLAG ===================== */
    { name: 'flag', kind: 'flag', role: 'key', bounds: { x: 136, y: 40, width: 12, height: 20 },
      scores: [750, 7500], control: 'FlagControl', lamps: ['lamp.mission'] },
  ],
};
