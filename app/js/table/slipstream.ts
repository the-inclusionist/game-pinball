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

  missions: [
    // Through the vanes first — the table teaching its own rule.
    { id: 'pinball.mission.slipstream.through', targets: ['vane.left', 'vane.right'], award: 8000 },
    // Then the upper chamber, which is only reachable through them.
    { id: 'pinball.mission.slipstream.upper', targets: ['eddy1', 'eddy2'], award: 16000 },
    // Then the return lanes, which are the only way down that scores.
    { id: 'pinball.mission.slipstream.return', targets: ['return.left', 'return.right'], award: 26000 },
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
    'lamp.vaneLeft', 'lamp.vaneRight', 'lamp.eddy1', 'lamp.eddy2',
    'lamp.returnLeft', 'lamp.returnRight', 'lamp.crown',
  ],
};
