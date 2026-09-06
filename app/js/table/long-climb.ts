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

  // Worth more than its four targets together: on a table this tall a column is four shots kept alive
  // at a height where the flippers are not even on screen.
  banks: [{ name: 'bank.ledge', award: 14000 }],

  missions: [
    // The rungs, in order. The first is low enough to reach on a poor launch, which is what makes the
    // mission teach the table rather than gate it.
    { award: 4000, stages: [{ id: 'pinball.mission.longClimb.first', targets: ['landing1'] }] },
    { award: 12000, stages: [{ id: 'pinball.mission.longClimb.gauntlet', targets: ['ice1', 'ice2', 'ice3'] }] },
    { award: 28000, stages: [{ id: 'pinball.mission.longClimb.summit', targets: ['landing2', 'landing3'] }] },
  ],

  /**
   * ⚠️ THE FLOODLIGHTS AND THE ENGINE, which is the Dev's theme made of light rather than of colour
   * stops: "guindaste vermelho, céu escuro no alto, holofotes" and "motor soltando fogo por toda a
   * base." The `pad` backdrop already runs dark at the head and hot at the foot; these are the two
   * SOURCES that explains, standing where the art puts them.
   */
  lights: [
    { at: { x: 30, y: 26 }, radius: 58, role: 'structure', intensity: 0.5 },
    { at: { x: 140, y: 26 }, radius: 58, role: 'structure', intensity: 0.5 },
    // The engine, across the whole base, and the brightest thing on any table here.
    { at: { x: 91, y: 296 }, radius: 78, role: 'hazard', intensity: 0.38 },
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

    /* ===================== THE SECOND GAUNTLET, HIGHER UP ===================== */
    //
    // Three more bumpers in the band between the second landing and the third, which was fifty-six
    // pixels of nothing on a table three hundred tall. A climb needs rungs and it also needs something
    // between them: a ball that gets past the ice and then falls sixty pixels unopposed has had the
    // hard part of the climb undone by geometry rather than by play.
    //
    // Authored up to the 1995 playfield's density — `tests/table-density`, where the Dev's "mesas tão
    // simples" is a number. This table measured 2.36 against the archive's 5.25, the second thinnest.
    //
    // ⚠️ ALL THREE WELL CLEAR OF BOTH WALLS. `ion-storm`'s fifth bumper sat nine pixels of body from
    // the lane divider and wedged the ball between the two: the touch list read bumper, divider,
    // bumper, divider, and every ball was spat into the outlane without reaching a paddle.
    { name: 'frost1', kind: 'bumper', role: WALL, bounds: { x: 48, y: 96, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.frost1'],
      collision: [{ kind: 'circle', at: { x: 56, y: 104 }, radius: 8 }] },
    { name: 'frost2', kind: 'bumper', role: WALL, bounds: { x: 82, y: 84, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.frost2'],
      collision: [{ kind: 'circle', at: { x: 90, y: 92 }, radius: 8 }] },
    { name: 'frost3', kind: 'bumper', role: WALL, bounds: { x: 116, y: 96, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.frost3'],
      collision: [{ kind: 'circle', at: { x: 124, y: 104 }, radius: 8 }] },

    /* ===================== THE LEDGE: A DROP COLUMN ON THE LEFT WALL ===================== */
    //
    // Four drop targets stacked up the left wall beside the second gauntlet. Each sinks when hit and
    // the ball passes over where it was, so the column opens as it is cleared — and on a table this
    // tall, a route that gets easier the more of it you have done is what keeps a long climb from
    // being the same shot repeated.
    //
    // ⚠️ VERTICAL, AGAINST A WALL, which is the rule two tables paid for this week. An up-facing row
    // is safe under a bumper nest — `low-orbit`'s bank lives there — and is a shelf the ball comes to
    // rest on anywhere else: `ion-storm` held a ball for four thousand frames on one. Here the frost
    // bumpers are beside the column rather than over it, so the column stands on its wall.
    { name: 'ledge1', kind: 'target', role: 'key', bounds: { x: 8, y: 84, width: 12, height: 14 },
      scores: [2500], control: 'TargetBankControl', bank: 'bank.ledge', lamps: ['lamp.ledge1'],
      collision: [{ kind: 'line', from: { x: 20, y: 84 }, to: { x: 20, y: 98 } }] },
    { name: 'ledge2', kind: 'target', role: 'key', bounds: { x: 8, y: 102, width: 12, height: 14 },
      scores: [2500], control: 'TargetBankControl', bank: 'bank.ledge', lamps: ['lamp.ledge2'],
      collision: [{ kind: 'line', from: { x: 20, y: 102 }, to: { x: 20, y: 116 } }] },
    { name: 'ledge3', kind: 'target', role: 'key', bounds: { x: 8, y: 120, width: 12, height: 14 },
      scores: [2500], control: 'TargetBankControl', bank: 'bank.ledge', lamps: ['lamp.ledge3'],
      collision: [{ kind: 'line', from: { x: 20, y: 120 }, to: { x: 20, y: 134 } }] },
    { name: 'ledge4', kind: 'target', role: 'key', bounds: { x: 8, y: 138, width: 12, height: 14 },
      scores: [2500], control: 'TargetBankControl', bank: 'bank.ledge', lamps: ['lamp.ledge4'],
      collision: [{ kind: 'line', from: { x: 20, y: 138 }, to: { x: 20, y: 152 } }] },

    /* ===================== THE CORNICES ===================== */
    // Two rebounders under the second gauntlet, throwing a stalling ball back up the table. On a climb
    // the worst outcome is not losing the ball; it is drifting down having achieved nothing.
    { name: 'cornice.left', kind: 'rebounder', role: 'goal',
      bounds: { x: 32, y: 116, width: 16, height: 16 },
      scores: [3200], control: 'RebounderControl', lamps: ['lamp.corniceLeft'],
      collision: [{ kind: 'circle', at: { x: 40, y: 124 }, radius: 8 }] },
    { name: 'cornice.right', kind: 'rebounder', role: 'goal',
      bounds: { x: 132, y: 116, width: 16, height: 16 },
      scores: [3200], control: 'RebounderControl', lamps: ['lamp.corniceRight'],
      collision: [{ kind: 'circle', at: { x: 140, y: 124 }, radius: 8 }] },

    /* ===================== THE STEPS AND THE TRAILS ===================== */
    // Rollovers, so they can sit anywhere: a lane declares no collision and the ball passes over it.
    // The steps flank the ice at the halfway mark; the trails run beside the funnel, where a ball that
    // failed the climb comes home.
    { name: 'step.left', kind: 'lane', role: 'free', bounds: { x: 14, y: 156, width: 14, height: 16 },
      scores: [1600], control: 'LaneControl', lamps: ['lamp.stepLeft'] },
    { name: 'step.right', kind: 'lane', role: 'free', bounds: { x: 141, y: 156, width: 14, height: 16 },
      scores: [1600], control: 'LaneControl', lamps: ['lamp.stepRight'] },
    { name: 'trail.left', kind: 'lane', role: 'free', bounds: { x: 8, y: 210, width: 12, height: 22 },
      scores: [1300], control: 'LaneControl', lamps: ['lamp.trailLeft'] },
    { name: 'trail.right', kind: 'lane', role: 'free', bounds: { x: 147, y: 210, width: 12, height: 22 },
      scores: [1300], control: 'LaneControl', lamps: ['lamp.trailRight'] },

    /* ===================== THE APPROACH ===================== */
    // Three rollovers across the head, crossed by the ball entering from the return bend. On a table
    // this tall the head is a long way from the flippers, and it scored nothing at all.
    // ⚠️ EVENLY SPACED FROM x = 62 AND NOT FROM 40, because 40 was never crossed. Surveyed over sixty
    // balls with varied launch power and drift: `approach1` at the far left was visited by NONE of
    // them, `approach2` by two. The ball enters from the return bend at the top RIGHT and sweeps left
    // losing height, so the far-left corner of the head is somewhere it arrives only by luck.
    { name: 'approach1', kind: 'lane', role: 'key', bounds: { x: 86, y: 16, width: 12, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.approach1'] },
    { name: 'approach2', kind: 'lane', role: 'key', bounds: { x: 62, y: 16, width: 12, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.approach2'] },
    { name: 'approach3', kind: 'lane', role: 'key', bounds: { x: 110, y: 16, width: 12, height: 14 },
      scores: [1800], control: 'LaneControl', lamps: ['lamp.approach3'] },

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
    'lamp.frost1', 'lamp.frost2', 'lamp.frost3',
    'lamp.ledge1', 'lamp.ledge2', 'lamp.ledge3', 'lamp.ledge4',
    'lamp.corniceLeft', 'lamp.corniceRight',
    'lamp.stepLeft', 'lamp.stepRight', 'lamp.trailLeft', 'lamp.trailRight',
    'lamp.approach1', 'lamp.approach2', 'lamp.approach3',
    'lamp.ice1', 'lamp.ice2', 'lamp.ice3', 'lamp.ramp', 'lamp.crest',
  ],
};
