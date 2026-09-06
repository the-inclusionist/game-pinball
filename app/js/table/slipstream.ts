// SPDX-License-Identifier: AGPL-3.0-or-later
// table/slipstream — the table where the way in is not the way out.
//
// ========================= THE SIXTH SHAPE OF PLAY =========================
// `low-orbit` is open, `ion-storm` chaotic, `crater-run` precise, `long-climb` vertical, `ring-belt`
// wider than the screen. All five are OPEN tables: any point can be reached from any other, and the
// difficulty is in aiming or in keeping the ball alive.
//
// This one has direction. Two one-way vanes across the middle let a ball fall through and refuse to let
// it climb back, so the upper chamber is somewhere the plunger DELIVERS you and you then lose: every
// visit after the first has to be earned by going round the outside. Nothing else in the catalogue
// asks a player to think about which way the table lets them travel.
//
// ⚠️ AND THE ONE-WAYS ARE NOT A NEW MECHANISM. `table/authored` documents it in capitals: "A LINE IS
// ONE-SIDED, AND ITS WINDING DECIDES WHICH SIDE." `maths/lineInit` computes the normal as (dy, -dx)
// and `rayIntersectLine` refuses a ray arriving at the back, so every wall in every table here is
// already a one-way surface — it is simply that on every other table both sides of a wall are places
// the ball has no business being. Here the far side is play.
//
// ⚠️ WHICH MAKES THE RISK A TRAP RATHER THAN A BUG, AND THE TRAP WAS REAL. Wound the other way — as
// floors, stopping a descent — the ball could not get down at all, because the plunger delivers it to
// the TOP. It never drained in four thousand frames. The vanes are short and the flanks either side of
// them are open, and open flanks turned out not to be enough when the one-way faces the only direction
// the ball is travelling.

import type { AuthoredTable } from './authored.js';
import { cabinet, CABINET_LAMPS } from './cabinet.js';

const WALL = 'structure' as const;
const BALL_RADIUS = 3;

const WIDTH = 183;
const HEIGHT = 245;

export const SLIPSTREAM: AuthoredTable = {
  name: 'slipstream',
  size: { width: WIDTH, height: HEIGHT },
  ballRadius: BALL_RADIUS,

  // Worth more than its three targets together: clearing the chamber's floor is a route, and on this
  // table it is a route the vanes only let you take from above.
  banks: [{ name: 'bank.drift', award: 9000 }],

  missions: [
    // Through the vanes first — the table teaching its own rule.
    { award: 8000, stages: [{ id: 'pinball.mission.slipstream.through', targets: ['vane.left', 'vane.right'] }] },
    // Then the upper chamber, which is only reachable through them.
    { award: 16000, stages: [{ id: 'pinball.mission.slipstream.upper', targets: ['eddy1', 'eddy2'] }] },
    // Then the return lanes, which are the only way down that scores.
    { award: 26000, stages: [{ id: 'pinball.mission.slipstream.return', targets: ['return.left', 'return.right'] }] },
  ],

  components: [
    ...cabinet({ width: WIDTH, height: HEIGHT }),

    /* ===================== THE VANES ===================== */
    /**
     * ⚠️ WOUND RIGHT TO LEFT, SO THE NORMAL POINTS DOWN AND THE VANE IS A CEILING.
     *
     * A ceiling is solid to a ball arriving from BELOW and thin air to one arriving from above. The
     * ball FALLS THROUGH and cannot climb back: the upper chamber is somewhere the plunger delivers you
     * and you then lose, and every visit after the first has to be earned by going round the outside.
     *
     * ⚠️ AND THIS FILE FIRST CLAIMED THE OPPOSITE — that a rising ball passed and a falling one was
     * stopped, with a paragraph explaining why. `tests/table-slipstream` measured it and the claim was
     * inverted. Nothing else noticed: the validator, all four playability gates and the stuck watch
     * passed a table whose entire identity was backwards.
     *
     * ⚠️ THEN THE CORRECTION WAS TRIED AND MADE IT WORSE. Wound as floors, the vanes stop a ball
     * DESCENDING — and descending is what the ball does first, because the plunger lane delivers it to
     * the top of the table. It never drained in four thousand frames: the table became a box with the
     * ball inside it, failing two gates the inverted version had passed.
     *
     * So the winding stays as it plays and the DESCRIPTION is what changed. The direction of the rule
     * was decided by the launch rather than by the prose — a table whose ball enters at the top is a
     * table whose one-ways point down — and that is worth knowing before authoring the next one.
     *
     * They score on the way through, which is what tells the player the rule exists. A silent one-way
     * is a table that behaves oddly.
     */
    { name: 'vane.left', kind: 'oneway', role: 'gate', bounds: { x: 34, y: 116, width: 46, height: 6 },
      scores: [3000], control: 'LaneControl', lamps: ['lamp.vaneLeft'],
      collision: [{ kind: 'line', from: { x: 80, y: 120 }, to: { x: 34, y: 120 } }] },
    { name: 'vane.right', kind: 'oneway', role: 'gate', bounds: { x: 103, y: 116, width: 46, height: 6 },
      scores: [3000], control: 'LaneControl', lamps: ['lamp.vaneRight'],
      collision: [{ kind: 'line', from: { x: 149, y: 120 }, to: { x: 103, y: 120 } }] },

    /* ===================== THE UPPER CHAMBER ===================== */
    // Two bumpers above the vanes: a ball that got through is kept up there a while, which is the
    // reward for making the shot and the reason the chamber feels like somewhere.
    { name: 'eddy1', kind: 'bumper', role: WALL, bounds: { x: 54, y: 62, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.eddy1'],
      collision: [{ kind: 'circle', at: { x: 62, y: 70 }, radius: 8 }] },
    { name: 'eddy2', kind: 'bumper', role: WALL, bounds: { x: 112, y: 62, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.eddy2'],
      collision: [{ kind: 'circle', at: { x: 120, y: 70 }, radius: 8 }] },

    // ⚠️ AND TWO MORE, MAKING FOUR, because the chamber is this table's whole reward and it was two
    // bumpers and a target. Authored up to the 1995 playfield's density — `tests/table-density`, where
    // the Dev's "mesas tão simples" is a number: this table measured 2.67 against the archive's 5.25.
    { name: 'eddy3', kind: 'bumper', role: WALL, bounds: { x: 83, y: 42, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.eddy3'],
      collision: [{ kind: 'circle', at: { x: 91, y: 50 }, radius: 8 }] },
    { name: 'eddy4', kind: 'bumper', role: WALL, bounds: { x: 83, y: 84, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.eddy4'],
      collision: [{ kind: 'circle', at: { x: 91, y: 92 }, radius: 8 }] },

    /* ===================== THE DRIFT: A DROP COLUMN ON THE CHAMBER WALL ===================== */
    //
    // Three drop targets stacked against the chamber's left wall. Each sinks when hit and the ball
    // passes over where it was, so the column opens as it is cleared.
    //
    // ⚠️ VERTICAL, AND ON THIS TABLE THAT IS THE ONLY SHAPE THAT WORKS. An up-facing row was tried in
    // both of the two places it could go and each was a different failure:
    //
    //   · ON THE CHAMBER'S FLOOR, at y = 106, it stood directly above the vanes — in the very column
    //     `tests/table-slipstream` drops a ball down to prove a falling ball gets THROUGH one. The
    //     bank was standing in front of the mechanism this whole table is named for.
    //   · BELOW THE VANES, at y = 134, it was a floor under a one-way CEILING. The ball fell through a
    //     vane, landed on the bank, and could go neither down nor back up: four thousand frames
    //     without a drain, which is the box this table's own header records having been built once
    //     already when the vanes were wound the other way.
    //
    // A vertical face has neither problem — nothing rests on it, and it stands beside the vanes rather
    // than across them. `ion-storm` reached the same shape from a different direction, which is worth
    // noticing: a drop bank wants a wall to stand against unless there is a bumper nest overhead.
    { name: 'drift1', kind: 'target', role: 'key', bounds: { x: 8, y: 60, width: 12, height: 14 },
      scores: [2200], control: 'TargetBankControl', bank: 'bank.drift', lamps: ['lamp.drift1'],
      collision: [{ kind: 'line', from: { x: 20, y: 60 }, to: { x: 20, y: 74 } }] },
    { name: 'drift2', kind: 'target', role: 'key', bounds: { x: 8, y: 78, width: 12, height: 14 },
      scores: [2200], control: 'TargetBankControl', bank: 'bank.drift', lamps: ['lamp.drift2'],
      collision: [{ kind: 'line', from: { x: 20, y: 78 }, to: { x: 20, y: 92 } }] },
    { name: 'drift3', kind: 'target', role: 'key', bounds: { x: 8, y: 96, width: 12, height: 14 },
      scores: [2200], control: 'TargetBankControl', bank: 'bank.drift', lamps: ['lamp.drift3'],
      collision: [{ kind: 'line', from: { x: 20, y: 96 }, to: { x: 20, y: 110 } }] },

    /* ===================== THE SPILLWAYS ===================== */
    // Rollovers in the chamber's top corners, where a ball that came up the outside arrives. They pay
    // for the hard way in — which is the route this table is about and the one it scored nothing for.
    { name: 'spill.left', kind: 'lane', role: 'goal', bounds: { x: 20, y: 44, width: 14, height: 20 },
      scores: [3500], control: 'LaneControl', lamps: ['lamp.spillLeft'] },
    { name: 'spill.right', kind: 'lane', role: 'goal', bounds: { x: 144, y: 44, width: 14, height: 20 },
      scores: [3500], control: 'LaneControl', lamps: ['lamp.spillRight'] },

    /* ===================== THE WAKE ===================== */
    // Three rollovers across the chamber's floor, where a ball on its way to the vanes crosses them.
    //
    // ⚠️ A LANE DECLARES NO COLLISION, which is why these can sit in the vanes' own column and the
    // drop bank could not. The ball rolls over a lane and bounces off a target, and this table is the
    // one place in the catalogue where the difference decides where a component may go at all.
    { name: 'wake1', kind: 'lane', role: 'free', bounds: { x: 50, y: 96, width: 14, height: 16 },
      scores: [1400], control: 'LaneControl', lamps: ['lamp.wake1'] },
    { name: 'wake2', kind: 'lane', role: 'free', bounds: { x: 80, y: 96, width: 14, height: 16 },
      scores: [1400], control: 'LaneControl', lamps: ['lamp.wake2'] },
    { name: 'wake3', kind: 'lane', role: 'free', bounds: { x: 110, y: 96, width: 14, height: 16 },
      scores: [1400], control: 'LaneControl', lamps: ['lamp.wake3'] },

    /* ===================== THE BACKWASH ===================== */
    // ⚠️ CLEAR OF BOTH WALLS BY THIRTY AND TWENTY PIXELS. `ion-storm`'s fifth bumper sat nine pixels of
    // body from the lane divider and wedged the ball: the touch list read bumper, divider, bumper,
    // divider, and every ball was spat into the outlane without ever reaching a paddle. A rebounder
    // near a wall is a funnel nobody designed.
    { name: 'back.left', kind: 'rebounder', role: 'goal', bounds: { x: 34, y: 150, width: 16, height: 16 },
      scores: [2800], control: 'RebounderControl', lamps: ['lamp.backLeft'],
      collision: [{ kind: 'circle', at: { x: 42, y: 158 }, radius: 8 }] },
    { name: 'back.right', kind: 'rebounder', role: 'goal', bounds: { x: 126, y: 150, width: 16, height: 16 },
      scores: [2800], control: 'RebounderControl', lamps: ['lamp.backRight'],
      collision: [{ kind: 'circle', at: { x: 134, y: 158 }, radius: 8 }] },

    /* ===================== THE WAY BACK DOWN ===================== */
    // ⚠️ OUTSIDE THE VANES, which is what stops the chamber being a trap: the flanks are open, so a
    // ball can always fall back down the sides whether or not it finds these.
    { name: 'return.left', kind: 'lane', role: 'goal', bounds: { x: 12, y: 128, width: 14, height: 20 },
      scores: [5000], control: 'LaneControl', lamps: ['lamp.returnLeft'] },
    { name: 'return.right', kind: 'lane', role: 'goal', bounds: { x: 157, y: 128, width: 14, height: 20 },
      scores: [5000], control: 'LaneControl', lamps: ['lamp.returnRight'] },

    /* ===================== THE CREST ===================== */
    { name: 'crown', kind: 'target', role: 'key', bounds: { x: 84, y: 24, width: 14, height: 14 },
      scores: [6000], control: 'TargetControl', lamps: ['lamp.crown'],
      collision: [{ kind: 'line', from: { x: 84, y: 38 }, to: { x: 98, y: 38 } }] },
  ],

  lamps: [
    ...CABINET_LAMPS,
    'lamp.vaneLeft', 'lamp.vaneRight', 'lamp.eddy1', 'lamp.eddy2', 'lamp.eddy3', 'lamp.eddy4',
    'lamp.drift1', 'lamp.drift2', 'lamp.drift3',
    'lamp.spillLeft', 'lamp.spillRight',
    'lamp.wake1', 'lamp.wake2', 'lamp.wake3',
    'lamp.backLeft', 'lamp.backRight',
    'lamp.returnLeft', 'lamp.returnRight', 'lamp.crown',
  ],
};
