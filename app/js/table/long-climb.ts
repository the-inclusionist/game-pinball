// SPDX-License-Identifier: AGPL-3.0-or-later
// table/long-climb — the table the camera was built for.
//
// ========================= THE FOURTH SHAPE OF PLAY =========================
// `low-orbit` is open, `ion-storm` is chaotic, `crater-run` asks the player to aim. All three fit in
// roughly one and a half screens, so the camera moves a little and the whole table is nearly always
// in mind.
//
// This one is three hundred pixels tall against a window of a hundred and eighty. ADR-0001 decided
// that a player LOSES SIGHT OF THE FLIPPERS when the ball climbs, and called that part of the game
// rather than a defect — but on every table so far the loss lasts a moment. Here it is the point: the
// ball spends real time at a height where the bottom of the table is not visible, and coming back down
// is a thing that happens to you rather than a thing you watch.
//
// ⚠️ AND THE LANDINGS ARE STAGED SO THE CLIMB HAS RUNGS. Three rollovers at rising heights, each worth
// more than the last. A tall table with everything at the top is one long shot repeated; a tall table
// with rungs is a climb, and the difference is whether a ball that got halfway achieved anything.
//
// ⚠️ AND THE SUMMIT'S REACHABILITY IS NOT PROVEN, WHICH IS SAID HERE RATHER THAN ASSUMED.
//
// A table can be authored taller than the plunger can throw a ball, and NOTHING would say so: the
// validator checks geometry, and the playability gates ask whether the ball leaves the lane, touches
// something that scores, is lost properly, and responds to the flippers. A summit the ball can never
// reach passes all four and holds a mission that can never complete.
//
// ⚠️ IT IS REACHABLE, AND THAT IS NOW MEASURED RATHER THAN HOPED. An earlier draft of this comment
// claimed the height "was measured, not chosen" and cited a test that did not exist; it was corrected
// to say the opposite, and then the measurement was actually made. Launched at `launchSpeedFor` and
// flapped at five different rates, the ball reaches y = 4 on this table — the ceiling. `landing3` is at
// 62 and `crest` at 30, so both are below the highest point a ball gets to.
//
// ⚠️ AND THE GATE THAT MEASURED IT WAS DELETED, which is worth knowing before somebody writes it again.
// A standing reachability test cannot fail on a well-formed table: `validateTable` already refuses a
// component outside the bounds, and the ball reaches the ceiling of every table in the catalogue, so
// nothing can ever be above it. The failure it was meant to catch — a ball that cannot climb — is
// caught by `tests/table-playable`: winding the cabinet's return bend backwards fails eight of its
// checks and none of the reachability one's.
//
// The mission ORDER is still the mitigation for a table that turns out to play badly rather than
// wrongly: the first mission asks only for `landing1`, low enough to reach on a poor launch, and the
// summit is the last of three.

import type { AuthoredTable } from './authored.js';
import { cabinet, CABINET_LAMPS } from './cabinet.js';

const WALL = 'structure' as const;
const BALL_RADIUS = 3;

const WIDTH = 183;
const HEIGHT = 300;

export const LONG_CLIMB: AuthoredTable = {
  name: 'long-climb',
  size: { width: WIDTH, height: HEIGHT },
  ballRadius: BALL_RADIUS,

  missions: [
    // The rungs, in order. The first is low enough to reach on a poor launch, which is what makes the
    // mission teach the table rather than gate it.
    { award: 4000, stages: [{ id: 'pinball.mission.longClimb.first', targets: ['landing1'] }] },
    { award: 12000, stages: [{ id: 'pinball.mission.longClimb.gauntlet', targets: ['ice1', 'ice2', 'ice3'] }] },
    { award: 28000, stages: [{ id: 'pinball.mission.longClimb.summit', targets: ['landing2', 'landing3'] }] },
  ],

  components: [
    ...cabinet({ width: WIDTH, height: HEIGHT }),

    /* ===================== THE RUNGS ===================== */
    // Alternating sides, so a climb is a zig-zag rather than a single straight shot.
    { name: 'landing1', kind: 'lane', role: 'key', bounds: { x: 30, y: 196, width: 26, height: 14 },
      scores: [2000], control: 'LaneControl', lamps: ['lamp.landing1'] },
    { name: 'landing2', kind: 'lane', role: 'key', bounds: { x: 112, y: 132, width: 26, height: 14 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.landing2'] },
    { name: 'landing3', kind: 'lane', role: 'goal', bounds: { x: 34, y: 62, width: 26, height: 14 },
      scores: [8000], control: 'LaneControl', lamps: ['lamp.landing3'] },

    /* ===================== THE GAUNTLET, HALFWAY UP ===================== */
    // ⚠️ IN THE MIDDLE OF THE CLIMB RATHER THAN AT THE TOP. A ball that stalls here is thrown back
    // upward as often as down, which is what keeps a long table from being one slow fall.
    { name: 'ice1', kind: 'bumper', role: WALL, bounds: { x: 56, y: 152, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.ice1'],
      collision: [{ kind: 'circle', at: { x: 64, y: 160 }, radius: 8 }] },
    { name: 'ice2', kind: 'bumper', role: WALL, bounds: { x: 82, y: 168, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.ice2'],
      collision: [{ kind: 'circle', at: { x: 90, y: 176 }, radius: 8 }] },
    { name: 'ice3', kind: 'bumper', role: WALL, bounds: { x: 108, y: 152, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.ice3'],
      collision: [{ kind: 'circle', at: { x: 116, y: 160 }, radius: 8 }] },

    /* ===================== THE SHELF ===================== */
    // A ramp low on the right, angled to throw the ball leftward and up: the shot that starts a climb.
    { name: 'ramp', kind: 'ramp', role: 'climb', bounds: { x: 96, y: 208, width: 56, height: 40 },
      scores: [6000], control: 'RampControl', lamps: ['lamp.ramp'],
      collision: [{ kind: 'line', from: { x: 152, y: 208 }, to: { x: 96, y: 248 } }] },

    /* ===================== THE CREST ===================== */
    { name: 'crest', kind: 'target', role: 'goal', bounds: { x: 86, y: 30, width: 14, height: 14 },
      scores: [10000], control: 'TargetControl', lamps: ['lamp.crest'],
      collision: [{ kind: 'line', from: { x: 86, y: 44 }, to: { x: 100, y: 44 } }] },
  ],

  lamps: [
    ...CABINET_LAMPS,
    'lamp.landing1', 'lamp.landing2', 'lamp.landing3',
    'lamp.ice1', 'lamp.ice2', 'lamp.ice3', 'lamp.ramp', 'lamp.crest',
  ],
};
