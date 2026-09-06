// SPDX-License-Identifier: AGPL-3.0-or-later
// table/ion-storm — the second table meant to be played.
//
// ========================= WHAT MAKES IT DIFFERENT FROM `low-orbit` =========================
// A second table that plays like the first is a reskin, and the Dev asked for five more "tão boas
// quanto essa" — as good as, not the same as. So the difference is structural rather than decorative:
//
//   · `low-orbit` puts its bumper nest at the TOP and its targets down the LEFT, so the two missions
//     pull the ball to opposite ends. `ion-storm` puts a single heavy bumper cluster in the MIDDLE of
//     the table, which the ball has to pass through to reach anything — every route crosses it, and
//     the bumpers scatter the ball rather than being a destination.
//   · Its scoring bank is a pair of REBOUNDERS low on the flanks. A rebounder throws the ball straight
//     back, so the risk of going for them is being sent somewhere unhelpful rather than draining —
//     which `low-orbit` never asks of a player. (They were drafted as kickers; the validator refused,
//     and it was right to. See the components.)
//   · And the ramp is on the LEFT, so the strong shot is the left flipper's — the mirror of
//     `low-orbit`, which is the cheapest way to make a player who has learned one table have to think
//     on the other.
//
// The cabinet — walls, lane, return bend, flippers, funnel, outlanes, drain — is `table/cabinet`'s,
// which is the geometry `low-orbit` proved by being played. See that module for the two defects it
// exists to stop anybody re-making.

import type { AuthoredTable } from './authored.js';
import { cabinet, CABINET_LAMPS } from './cabinet.js';

const WALL = 'structure' as const;
const BALL_RADIUS = 3;

const WIDTH = 183;
const HEIGHT = 250;

export const ION_STORM: AuthoredTable = {
  name: 'ion-storm',
  size: { width: WIDTH, height: HEIGHT },
  ballRadius: BALL_RADIUS,

  missions: [
    // The middle cluster first, because it is what the player will hit whether they aim at it or not:
    // a first mission that completes itself teaches the machine before it asks anything.
    { id: 'pinball.mission.ionStorm.cluster', targets: ['storm1', 'storm2', 'storm3'], award: 6000 },
    // Then the flanks, which have to be aimed at and which throw the ball back.
    { id: 'pinball.mission.ionStorm.flanks', targets: ['flank.left', 'flank.right'], award: 12000 },
    // Then the ramp, once, which is the hardest single shot on the table.
    { id: 'pinball.mission.ionStorm.ramp', targets: ['ramp'], award: 25000 },
  ],

  components: [
    ...cabinet({ width: WIDTH, height: HEIGHT }),

    /* ===================== THE STORM: THE CLUSTER IN THE MIDDLE ===================== */
    // Three bumpers in a triangle across the centre line. Anything travelling from the top of the
    // table to the flippers passes through them, which is what makes this table feel busy where
    // `low-orbit` feels open.
    { name: 'storm1', kind: 'bumper', role: WALL, bounds: { x: 60, y: 96, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.storm1'],
      collision: [{ kind: 'circle', at: { x: 69, y: 105 }, radius: 9 }] },
    { name: 'storm2', kind: 'bumper', role: WALL, bounds: { x: 88, y: 82, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.storm2'],
      collision: [{ kind: 'circle', at: { x: 97, y: 91 }, radius: 9 }] },
    { name: 'storm3', kind: 'bumper', role: WALL, bounds: { x: 88, y: 112, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.storm3'],
      collision: [{ kind: 'circle', at: { x: 97, y: 121 }, radius: 9 }] },

    /* ===================== THE FLANKS: TWO REBOUNDERS ===================== */
    // ⚠️ REBOUNDERS AND NOT KICKERS, and the validator is why. An authored table can name seven
    // controls and `KickoutControl` is not among them: a kickout holds a ball and releases it on a
    // timer, which needs state the authored format has no way to declare. The validator said so before
    // this table could open, which is the rule doing its job rather than getting in the way.
    //
    // A rebounder is the closer thing anyway — it throws the ball straight back — so the trade this
    // table offers still stands: aiming at the flanks risks being sent somewhere unhelpful rather than
    // draining, which `low-orbit` never asks of a player.
    { name: 'flank.left', kind: 'rebounder', role: 'goal',
      bounds: { x: 22, y: 128, width: 16, height: 16 },
      scores: [3000], control: 'RebounderControl', lamps: ['lamp.flankLeft'],
      collision: [{ kind: 'circle', at: { x: 30, y: 136 }, radius: 8 }] },
    { name: 'flank.right', kind: 'rebounder', role: 'goal',
      bounds: { x: 126, y: 128, width: 16, height: 16 },
      scores: [3000], control: 'RebounderControl', lamps: ['lamp.flankRight'],
      collision: [{ kind: 'circle', at: { x: 134, y: 136 }, radius: 8 }] },

    /* ===================== THE RAMP, ON THE LEFT ===================== */
    // The mirror of `low-orbit`'s: the strong shot belongs to the other hand.
    { name: 'ramp', kind: 'ramp', role: 'climb', bounds: { x: 24, y: 40, width: 70, height: 54 },
      scores: [8000], control: 'RampControl', lamps: ['lamp.ramp'],
      collision: [{ kind: 'line', from: { x: 24, y: 94 }, to: { x: 94, y: 40 } }] },

    /* ===================== THE HEAD OF THE TABLE ===================== */
    // Two rollovers across the top, reachable only by keeping the ball alive up there.
    { name: 'arc1', kind: 'lane', role: 'key', bounds: { x: 46, y: 16, width: 12, height: 14 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.arc1'] },
    { name: 'arc2', kind: 'lane', role: 'key', bounds: { x: 96, y: 16, width: 12, height: 14 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.arc2'] },
  ],

  lamps: [
    ...CABINET_LAMPS,
    'lamp.storm1', 'lamp.storm2', 'lamp.storm3',
    'lamp.flankLeft', 'lamp.flankRight',
    'lamp.ramp', 'lamp.arc1', 'lamp.arc2',
  ],
};
