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

/**
 * Eight across the belt, evenly spread so no part of the width is empty.
 *
 * ⚠️ IT WAS FIVE, AND ON A TABLE 360 WIDE THAT IS ONE EVERY SEVENTY-TWO PIXELS. The header says the
 * belt spans the whole width "so the ball is never far from one, wherever the view happens to be" —
 * and with five it was, because a wide table needs more furniture than a narrow one to feel equally
 * full. This table measured 1.85 scoring components per ten thousand pixels against the archive's
 * 5.25: a THIRD of the density, the thinnest of the six by a distance. See `tests/table-density`.
 */
const BELT = [16, 46, 108, 170, 200, 232, 286, 320].map((x, i) => ({
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

  // One bank per far wall. Each is worth more than its three targets together, and on this table a
  // column is three shots taken at something the player cannot see when they take them.
  banks: [{ name: 'bank.west', award: 11000 }, { name: 'bank.east', award: 11000 }],

  missions: [
    // The belt first: it spans the table, so finishing it means having been everywhere once.
    { award: 14000, stages: [{ id: 'pinball.mission.ringBelt.belt', targets: BELT.map((b) => b.name) }] },
    // Then the two far ramps, which are the shots taken at something off screen.
    { award: 22000, stages: [{ id: 'pinball.mission.ringBelt.reach', targets: ['ramp.far', 'ramp.near'] }] },
    // Then the outer rollovers, at the two extremes of the width.
    { award: 30000, stages: [{ id: 'pinball.mission.ringBelt.edges', targets: ['edge.west', 'edge.east'] }] },
  ],

  /**
   * ⚠️ SATURN OFF THE EDGE OF THE TABLE. `ring-belt` is 360 wide against a 320 window and the camera
   * pans across it, so a light on one side gives the pan something to move against — the same reason
   * the `rings` bands were made alternating rather than a gradient.
   *
   * The second is wired to the belt probe's lamp: the rocks light as the probe works its way along.
   */
  lights: [
    { at: { x: 40, y: 60 }, radius: 90, role: 'goal', intensity: 0.29 },
    { at: { x: 265, y: 128 }, radius: 55, role: 'water', intensity: 0.36, lamp: 'lamp.probeBelt' },
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

    /* ===================== THE SCREE COLUMNS, ON BOTH OUTER WALLS ===================== */
    //
    // Three drop targets stacked against each far wall, in the band under the ramps. Each sinks when
    // hit and the ball passes over where it was, so a column opens as it is cleared.
    //
    // ⚠️ VERTICAL AND AGAINST A WALL, which is the rule three tables paid for this week: an up-facing
    // row is a shelf the ball comes to rest on unless a bumper nest puts speed into what lands there.
    // And they are at the EXTREMES, which is what this table is for — a column at x = 8 on a table 360
    // wide is a shot taken at something 150 pixels off the side of the screen.
    { name: 'scree.west1', kind: 'target', role: 'key', bounds: { x: 8, y: 122, width: 12, height: 14 },
      scores: [2400], control: 'TargetBankControl', bank: 'bank.west', lamps: ['lamp.screeWest1'],
      collision: [{ kind: 'line', from: { x: 20, y: 122 }, to: { x: 20, y: 136 } }] },
    { name: 'scree.west2', kind: 'target', role: 'key', bounds: { x: 8, y: 140, width: 12, height: 14 },
      scores: [2400], control: 'TargetBankControl', bank: 'bank.west', lamps: ['lamp.screeWest2'],
      collision: [{ kind: 'line', from: { x: 20, y: 140 }, to: { x: 20, y: 154 } }] },
    { name: 'scree.west3', kind: 'target', role: 'key', bounds: { x: 8, y: 158, width: 12, height: 14 },
      scores: [2400], control: 'TargetBankControl', bank: 'bank.west', lamps: ['lamp.screeWest3'],
      collision: [{ kind: 'line', from: { x: 20, y: 158 }, to: { x: 20, y: 172 } }] },
    // ⚠️ THE EAST COLUMN MOVED UP TWELVE PIXELS. Surveyed over sixty balls, `scree.east3` — its lowest
    // target — was visited by none of them: it sat where the funnel has already gathered the ball
    // toward the middle, so nothing came down that far out any more.
    { name: 'scree.east1', kind: 'target', role: 'key', bounds: { x: 323, y: 110, width: 12, height: 14 },
      scores: [2400], control: 'TargetBankControl', bank: 'bank.east', lamps: ['lamp.screeEast1'],
      collision: [{ kind: 'line', from: { x: 323, y: 124 }, to: { x: 323, y: 110 } }] },
    { name: 'scree.east2', kind: 'target', role: 'key', bounds: { x: 323, y: 128, width: 12, height: 14 },
      scores: [2400], control: 'TargetBankControl', bank: 'bank.east', lamps: ['lamp.screeEast2'],
      collision: [{ kind: 'line', from: { x: 323, y: 142 }, to: { x: 323, y: 128 } }] },
    { name: 'scree.east3', kind: 'target', role: 'key', bounds: { x: 323, y: 146, width: 12, height: 14 },
      scores: [2400], control: 'TargetBankControl', bank: 'bank.east', lamps: ['lamp.screeEast3'],
      collision: [{ kind: 'line', from: { x: 323, y: 160 }, to: { x: 323, y: 146 } }] },

    /* ===================== THE CORNICES ===================== */
    // Two rebounders flanking the core, throwing a ball that reached the middle back across the belt.
    // Clear of both walls by a hundred and thirty pixels, which is more than any table needs — the
    // wedge that cost `ion-storm` three placements was nine.
    { name: 'cornice.west', kind: 'rebounder', role: 'goal',
      bounds: { x: 132, y: 62, width: 16, height: 16 },
      scores: [3200], control: 'RebounderControl', lamps: ['lamp.corniceWest'],
      collision: [{ kind: 'circle', at: { x: 140, y: 70 }, radius: 8 }] },
    { name: 'cornice.east', kind: 'rebounder', role: 'goal',
      bounds: { x: 196, y: 62, width: 16, height: 16 },
      scores: [3200], control: 'RebounderControl', lamps: ['lamp.corniceEast'],
      collision: [{ kind: 'circle', at: { x: 204, y: 70 }, radius: 8 }] },

    /* ===================== THE ROLLOVERS ===================== */
    //
    // ⚠️ ALL LANES, WHICH IS WHY THERE ARE SO MANY OF THEM. A lane declares no collision: the ball
    // rolls over it and nothing about its path changes, so a rollover can go where a target may not —
    // in the funnel's own throat, across the belt's band, under the ramps. On a table this wide that
    // is how the empty thirds get something to pay for without turning the play into a maze.
    //
    // The RIDGE spans the belt's band; the CREST spans the head, where a ball entering from the return
    // bend sweeps across; the OUTER pair sits at the far top corners, which are the two places on this
    // table that are never on screen together; the INNER pair flanks the post; and the LAST two lie in
    // the guides' throats, where a ball coming home along a funnel crosses them.
    { name: 'ridge1', kind: 'lane', role: 'free', bounds: { x: 60, y: 140, width: 16, height: 18 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.ridge1'] },
    { name: 'ridge2', kind: 'lane', role: 'free', bounds: { x: 120, y: 140, width: 16, height: 18 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.ridge2'] },
    { name: 'ridge3', kind: 'lane', role: 'free', bounds: { x: 216, y: 140, width: 16, height: 18 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.ridge3'] },
    { name: 'ridge4', kind: 'lane', role: 'free', bounds: { x: 264, y: 140, width: 16, height: 18 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.ridge4'] },

    { name: 'crest1', kind: 'lane', role: 'key', bounds: { x: 60, y: 16, width: 14, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.crest1'] },
    { name: 'crest2', kind: 'lane', role: 'key', bounds: { x: 96, y: 16, width: 14, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.crest2'] },
    { name: 'crest3', kind: 'lane', role: 'key', bounds: { x: 132, y: 16, width: 14, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.crest3'] },
    { name: 'crest4', kind: 'lane', role: 'key', bounds: { x: 168, y: 16, width: 14, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.crest4'] },
    { name: 'crest5', kind: 'lane', role: 'key', bounds: { x: 204, y: 16, width: 14, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.crest5'] },
    { name: 'crest6', kind: 'lane', role: 'key', bounds: { x: 240, y: 16, width: 14, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.crest6'] },
    { name: 'crest7', kind: 'lane', role: 'key', bounds: { x: 276, y: 16, width: 14, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.crest7'] },
    { name: 'crest8', kind: 'lane', role: 'key', bounds: { x: 24, y: 16, width: 14, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.crest8'] },

    { name: 'outer.west', kind: 'lane', role: 'goal', bounds: { x: 6, y: 60, width: 14, height: 18 },
      scores: [4500], control: 'LaneControl', lamps: ['lamp.outerWest'] },
    { name: 'outer.east', kind: 'lane', role: 'goal', bounds: { x: 316, y: 60, width: 14, height: 18 },
      scores: [4500], control: 'LaneControl', lamps: ['lamp.outerEast'] },

    { name: 'inner.west', kind: 'lane', role: 'free', bounds: { x: 140, y: 158, width: 14, height: 16 },
      scores: [1400], control: 'LaneControl', lamps: ['lamp.innerWest'] },
    { name: 'inner.east', kind: 'lane', role: 'free', bounds: { x: 190, y: 158, width: 14, height: 16 },
      scores: [1400], control: 'LaneControl', lamps: ['lamp.innerEast'] },

    // ⚠️ AND THE HUB IS ONE COMPONENT ADDED FOR A ROUNDING HAIR, said plainly because `ion-storm` needed
    // the same and the reason is the same: a table has an integer number of components and a density
    // does not, so 45 gives 5.208 against a bar of 5.246 and 46 clears it. Widening the bar to swallow
    // a third of a component would be moving it.
    //
    // The middle earned it anyway. This table is named for a ring and a belt, and the belt spans the
    // width while the ring — the core, the post, the two cornices — was three components on a table of
    // forty-five. A ball that goes up the middle now crosses something on the way.
    { name: 'hub', kind: 'lane', role: 'goal', bounds: { x: 165, y: 78, width: 14, height: 16 },
      scores: [5000], control: 'LaneControl', lamps: ['lamp.hub'] },

    { name: 'throat.west', kind: 'lane', role: 'free', bounds: { x: 40, y: 176, width: 14, height: 16 },
      scores: [1700], control: 'LaneControl', lamps: ['lamp.throatWest'] },
    { name: 'throat.east', kind: 'lane', role: 'free', bounds: { x: 290, y: 176, width: 14, height: 16 },
      scores: [1700], control: 'LaneControl', lamps: ['lamp.throatEast'] },

    /* ===================== THE PROBES, METEOR TO METEOR ===================== */
    //
    // ⚠️ THE DEV'S THEME: "meteoros voando e sondas que interagem com a bolinha indo de meteoro em
    // meteoro." The belt's eight rocks are the meteors; these run between them.
    //
    // One crosses the whole width under the belt, which on a table 360 wide is a body the player meets
    // wherever the view happens to be — the same reasoning the belt itself was spread out for. The
    // other climbs the right-hand approach, where nothing has ever moved.
    //
    // ⚠️ AND BOTH PATHS WERE REWRITTEN AFTER SIXTY BALLS MET NEITHER. The first crossed 230 pixels in
    // six seconds — chosen so a body on the unseen third of a 360-wide table would not arrive at half
    // a plunger's speed — and the arithmetic was right about the speed and wrong about the mechanic: a
    // body that slow is somewhere the ball is not, essentially always. The second climbed the top
    // right, which is where the ball ENTERS and then leaves.
    //
    // A mover is met where the traffic is, and for no longer than the traffic takes to arrive.
    { name: 'probe.belt', kind: 'rebounder', role: 'goal',
      /**
       * ⚠️ ON THE RIGHT, WHICH IS WHERE THE BALL ACTUALLY IS, and three guesses said otherwise before
       * anybody counted. The band between the belt and the ridges was surveyed over sixty balls: the
       * ball spends 14% of its time there in x 260-279 and 2.8% on the centre line at 160-179, because
       * it ENTERS from the top right and this table is wide enough that it never has to leave that
       * side. "Put it where the funnel gathers everything" was reasoning about the bottom of the table
       * applied to the middle of it.
       *
       * A static component in a thin part of the table is merely rarely hit. A MOVING one is never
       * hit, because the ball has to be there at the same moment — which is why this needed measuring
       * and the ridges beside it did not.
       */
      bounds: { x: 235, y: 122, width: 60, height: 12 },
      scores: [3800], control: 'RebounderControl', lamps: ['lamp.probeBelt'],
      mover: { from: { x: 240, y: 128 }, to: { x: 290, y: 128 }, seconds: 1.5, radius: 5 } },
    { name: 'probe.rise', kind: 'rebounder', role: 'goal',
      bounds: { x: 55, y: 185, width: 80, height: 10 },
      scores: [3800], control: 'RebounderControl', lamps: ['lamp.probeRise'],
      mover: { from: { x: 60, y: 190 }, to: { x: 130, y: 190 }, seconds: 1.8, radius: 5 } },

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
    'lamp.screeWest1', 'lamp.screeWest2', 'lamp.screeWest3',
    'lamp.screeEast1', 'lamp.screeEast2', 'lamp.screeEast3',
    'lamp.corniceWest', 'lamp.corniceEast',
    'lamp.ridge1', 'lamp.ridge2', 'lamp.ridge3', 'lamp.ridge4',
    'lamp.crest1', 'lamp.crest2', 'lamp.crest3', 'lamp.crest4',
    'lamp.crest5', 'lamp.crest6', 'lamp.crest7', 'lamp.crest8',
    'lamp.outerWest', 'lamp.outerEast', 'lamp.innerWest', 'lamp.innerEast',
    'lamp.throatWest', 'lamp.throatEast', 'lamp.hub',
    'lamp.probeBelt', 'lamp.probeRise',
  ],
};
