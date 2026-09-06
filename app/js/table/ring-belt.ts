// SPDX-License-Identifier: AGPL-3.0-or-later
// table/ring-belt — the table that does not fit on the screen sideways.
//
// ========================= THE FIFTH SHAPE OF PLAY =========================
// `low-orbit` is open, `ion-storm` chaotic, `crater-run` precise, `long-climb` vertical. Every one of
// them is 183 wide, which is the halved 1995 playfield, and every one fits across the screen with 137
// pixels to spare for the HUD.
//
// This one is 360 wide against a screen of 320. It is the first table MEANT TO BE PLAYED that the
// camera has to follow sideways — `wide-arc` has always been wider, but `wide-arc` is a fixture whose
// job is to give `stepAxis` a horizontal case, and the catalogue says outright that only one of the
// five was worth playing.
//
// ⚠️ WHAT THAT COSTS THE PLAYER, AND WHY IT IS THE POINT. At 360 wide the HUD stops having columns of
// its own and moves on top of the play — `layoutHud` reports `overlaying` and ADR-0002 anticipated
// exactly this table. Forty columns are off screen at any moment, so the far ramps are shots taken at
// something the player cannot see when they take them. That is a different kind of difficulty from
// aiming at a target bank, and it is the one the horizontal camera exists to make possible.
//
// ⚠️ AND THE BELT SPANS THE WHOLE WIDTH ON PURPOSE. Five bumpers in a shallow arc across the table
// means the ball is never far from one, wherever the view happens to be — a wide table whose furniture
// clusters in the middle would be a normal table with dead margins.
//
// The cabinet is `table/cabinet`'s, which scales its lane, walls and funnel to this width. The bottom
// assembly does not scale, because a flipper is sized against the ball.

import type { AuthoredTable } from './authored.js';
import { cabinet, CABINET_LAMPS } from './cabinet.js';

const WALL = 'structure' as const;
const BALL_RADIUS = 3;

const WIDTH = 360;
const HEIGHT = 240;

/** Five across the belt, evenly spread so no part of the width is empty. */
const BELT = [46, 108, 170, 232, 286].map((x, i) => ({
  name: `rock${i + 1}`,
  kind: 'bumper' as const,
  role: WALL,
  bounds: { x, y: 96 + (i % 2) * 18, width: 16, height: 16 },
  scores: [500, 1000, 1500, 2000],
  control: 'BumperControl',
  lamps: [`lamp.rock${i + 1}`],
  collision: [{ kind: 'circle' as const, at: { x: x + 8, y: 104 + (i % 2) * 18 }, radius: 8 }],
}));

export const RING_BELT: AuthoredTable = {
  name: 'ring-belt',
  size: { width: WIDTH, height: HEIGHT },
  ballRadius: BALL_RADIUS,

  missions: [
    // The belt first: it spans the table, so finishing it means having been everywhere once.
    { award: 14000, stages: [{ id: 'pinball.mission.ringBelt.belt', targets: BELT.map((b) => b.name) }] },
    // Then the two far ramps, which are the shots taken at something off screen.
    { award: 22000, stages: [{ id: 'pinball.mission.ringBelt.reach', targets: ['ramp.far', 'ramp.near'] }] },
    // Then the outer rollovers, at the two extremes of the width.
    { award: 30000, stages: [{ id: 'pinball.mission.ringBelt.edges', targets: ['edge.west', 'edge.east'] }] },
  ],

  components: [
    ...cabinet({ width: WIDTH, height: HEIGHT }),

    /* ===================== THE BELT ===================== */
    ...BELT,

    /* ===================== THE TWO RAMPS, AT THE EXTREMES ===================== */
    // ⚠️ FAR APART ON PURPOSE. With 320 of 360 visible, these two are never both on screen: the player
    // makes one shot while the other is out of view, which is what a wide table is for.
    { name: 'ramp.far', kind: 'ramp', role: 'climb', bounds: { x: 24, y: 40, width: 60, height: 44 },
      scores: [7000], control: 'RampControl', lamps: ['lamp.rampFar'],
      collision: [{ kind: 'line', from: { x: 24, y: 84 }, to: { x: 84, y: 40 } }] },
    { name: 'ramp.near', kind: 'ramp', role: 'climb', bounds: { x: 250, y: 40, width: 60, height: 44 },
      scores: [7000], control: 'RampControl', lamps: ['lamp.rampNear'],
      collision: [{ kind: 'line', from: { x: 310, y: 84 }, to: { x: 250, y: 40 } }] },

    /* ===================== THE EDGES ===================== */
    { name: 'edge.west', kind: 'lane', role: 'goal', bounds: { x: 18, y: 148, width: 14, height: 18 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.edgeWest'] },
    { name: 'edge.east', kind: 'lane', role: 'goal', bounds: { x: 300, y: 148, width: 14, height: 18 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.edgeEast'] },

    /* ===================== THE POST ABOVE THE GAP ===================== */
    /**
     * ⚠️ MEASURED, NOT DESIGNED IN. Without it this table failed the one gate that separates a game
     * from a demonstration: flapping the flippers changed nothing. The reason, measured the same way
     * the original defect was found — the ball crosses the flipper line at x = 175, and the gap between
     * the tips spans 161 to 183. It came down DEAD CENTRE, through the one place the paddles cannot
     * reach, on every run.
     *
     * The cabinet's funnel is what does it: on a table this wide the guides gather the whole 360 into
     * the middle, and the middle is the gap. A funnel that works too well delivers every ball to the
     * drain.
     *
     * So there is a post above the gap, which is what a real table puts there. A ball arriving centred
     * leaves off-centre, onto a paddle, and which side it takes stops being decided at the launch.
     */
    { name: 'post', kind: 'rebounder', role: WALL, bounds: { x: 167, y: 182, width: 10, height: 10 },
      scores: [250], control: 'RebounderControl', lamps: ['lamp.post'],
      collision: [{ kind: 'circle', at: { x: 172, y: 187 }, radius: 5 }] },

    /* ===================== THE CENTRE ===================== */
    // One target in the middle, so the ball that goes straight up still meets something.
    { name: 'core', kind: 'target', role: 'key', bounds: { x: 165, y: 52, width: 14, height: 14 },
      scores: [3000], control: 'TargetControl', lamps: ['lamp.core'],
      collision: [{ kind: 'line', from: { x: 165, y: 66 }, to: { x: 179, y: 66 } }] },
  ],

  lamps: [
    ...CABINET_LAMPS,
    ...BELT.flatMap((b) => b.lamps),
    'lamp.rampFar', 'lamp.rampNear', 'lamp.edgeWest', 'lamp.edgeEast', 'lamp.core', 'lamp.post',
  ],
};
