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

  // The field is worth more than its four targets together: clearing it means all four were still
  // standing when the ball found them, which on a table this busy is a different achievement.
  banks: [{ name: 'bank.debris', award: 9000 }],

  /**
   * ⚠️ THE FLARE, AND IT IS WHAT GIVES THE TABLE ITS NAME BACK. `ion-storm` has been a bumper cluster
   * with a weather word on it since it was written; the Dev's theme is what makes the storm a thing
   * the player can feel — "o flare deixando a bolinha mais lenta durante sua incidência" — and the
   * same declaration is what paints the background cycling "de preto, marrom, vermelho, amarelo e
   * branco" and back. See `table/storm` for why those are one mechanic and not two.
   *
   * ⚠️ THE NUMBERS ARE MEASURED, NOT CHOSEN. Twenty balls of three thousand frames each, launched
   * across a range of powers, with the drag varied and everything else held:
   *
   *     drag 0   mean speed 464   5.4% of frames inside the band
   *     drag 2                404   10.1%
   *     drag 4                378   12.8%
   *     drag 6                307   16.3%
   *     drag 8                256   17.7%
   *
   * The second column is the mechanic showing itself: a ball that is slowed inside the band STAYS in
   * the band, so the flare holds what it catches, and at drag 4 the ball spends nearly two and a half
   * times as long in it as geometry alone would give. Four is where that is plainly felt — a fifth off
   * the table's mean speed — without the table becoming a place where nothing gets anywhere.
   *
   * The other half of fair is what `tests/table-reachable` measures: a drag strong enough to stop the
   * ball reaching the top of the table would make the flare a wall the player cannot see. Six seconds
   * a sweep puts two to five full cycles in a ball's life; forty-four pixels is under a fifth of the
   * table, so the flare is something the ball passes THROUGH rather than a condition the table is in.
   */
  storm: { seconds: 6, thickness: 44, drag: 4 },

  missions: [
    // The middle cluster first, because it is what the player will hit whether they aim at it or not:
    // a first mission that completes itself teaches the machine before it asks anything.
    { award: 6000, stages: [{ id: 'pinball.mission.ionStorm.cluster', targets: ['storm1', 'storm2', 'storm3'] }] },
    // Then the flanks, which have to be aimed at and which throw the ball back.
    { award: 12000, stages: [{ id: 'pinball.mission.ionStorm.flanks', targets: ['flank.left', 'flank.right'] }] },
    // Then the ramp, once, which is the hardest single shot on the table.
    { award: 25000, stages: [{ id: 'pinball.mission.ionStorm.ramp', targets: ['ramp'] }] },
  ],

  /**
   * ⚠️ THE STORM LIT BY ITSELF. Three lights on the middle cluster, each wired to one bumper's lamp,
   * so the cluster glows brighter the more of it the player has hit — and goes dark again when the
   * lamps do. It is the clearest case in the catalogue for wiring a light to a lamp: the thing the
   * table is named after is the thing that lights up.
   */
  lights: [
    { at: { x: 69, y: 105 }, radius: 44, role: 'climb', intensity: 0.42, lamp: 'lamp.storm1' },
    { at: { x: 114, y: 105 }, radius: 44, role: 'climb', intensity: 0.42, lamp: 'lamp.storm2' },
    { at: { x: 91, y: 140 }, radius: 40, role: 'climb', intensity: 0.16, lamp: 'lamp.storm3' },
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

    // ⚠️ AND TWO MORE, MAKING FIVE, because this table's whole idea is a cluster too heavy to cross
    // cleanly and three is a triangle the ball can slip past. Added while authoring it up to the 1995
    // playfield's density — see `tests/table-density`, where the Dev's "mesas tão simples" is a
    // number: this table measured 2.84 against the archive's 5.25.
    //
    // Both sit clear of the ramp's diagonal. At x = 69 that line is at y = 59, and this circle's top
    // is at 68 — the ramp passes over the storm rather than through it, which is the geometry that
    // makes the left shot worth taking.
    //
    // ⚠️ AND storm4 WAS AT x = 125 AND HAD TO MOVE, which the playability gate caught and a probe
    // explained. Nine pixels of bumper 28 from the lane divider is a WEDGE: the ball came down the
    // right side, rattled between the two — the touch list reads storm4, divider, storm4, divider —
    // and was spat into the right outlane every single time, never reaching a paddle at all. A run
    // flapping the flippers came out identical to a run touching nothing.
    //
    // The cluster belongs in the MIDDLE, which is this table's whole idea. A fifth bumper pushed out
    // to a wall is not a heavier storm; it is a funnel nobody designed.
    { name: 'storm4', kind: 'bumper', role: WALL, bounds: { x: 60, y: 124, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.storm4'],
      collision: [{ kind: 'circle', at: { x: 69, y: 133 }, radius: 9 }] },
    { name: 'storm5', kind: 'bumper', role: WALL, bounds: { x: 60, y: 68, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.storm5'],
      collision: [{ kind: 'circle', at: { x: 69, y: 77 }, radius: 9 }] },

    /* ===================== THE DEBRIS SHELVES ===================== */
    //
    // Four drop targets, two stacked on each flank, outside the storm. A drop target sinks when hit
    // and the ball then passes over where it was, so each pair OPENS as it is cleared.
    //
    // ⚠️ AND THEY WERE A ROW ACROSS THE MIDDLE FIRST, WHICH FAILED TWICE AND FOR TWO DIFFERENT
    // REASONS. Both were found by running the ball rather than by reading the file.
    //
    //   · FOUR IN A ROW IS A WALL. From x = 34 to x = 150 across a table 183 wide, a ball coming down
    //     the middle could not reach the flippers until the bank was cleared: a run flapping the
    //     paddles came out identical to a run touching nothing, which is the playability gate's
    //     definition of a table the player is a spectator on.
    //   · AND A HORIZONTAL FACE IN OPEN TABLE IS A SHELF THE BALL SITS ON. Narrowed and moved, the
    //     row caught the ball and held it: four thousand frames, `debris3` reported over and over,
    //     never drained. A face pointing UP under a bumper nest is fine — `low-orbit`'s bank lives
    //     there and the ball arrives with speed. In the open middle of a table it is furniture that
    //     collects balls.
    //
    // Vertical faces on the flanks have neither problem: nothing rests on them, and a ball can always
    // pass down the middle. The pairs also sit where this table paid nothing before — outside the
    // storm, on the routes a ball takes when it squeezes past the cluster along a wall.
    /**
     * ⚠️ MOVED INBOARD ONTO THE PICTURE, 2026-09-06, AND EACH BANK MOVED AS ONE. Eight pixels off
     * the wall and four down for the west pair, the mirror for the east. Structure under them, from
     * `art/ion-storm.jpg` reduced to this table's size:
     *
     *     west1  1.02x median -> 1.98x      east1  0.94x -> 1.61x
     *     west2  1.02x        -> 1.79x      east2  1.26x -> 1.56x
     *
     * ⚠️ RIGIDLY, BECAUSE A BANK IS A UNIT. The search that proposed this wanted west1 down four
     * and west2 UP four — which would have slid the two halves of one bank into each other, an
     * overlap no gate here refuses because two targets in the same place are both drawn and both
     * hit. The proposal was legal by every constraint it was given and wrong anyway; what caught
     * it was reading the numbers it produced rather than applying them.
     *
     * Gated before it was kept, against reachability, playability, the flipper's force and density.
     */
    { name: 'shelf.west1', kind: 'target', role: 'key', bounds: { x: 16, y: 144, width: 12, height: 14 },
      scores: [1800], control: 'TargetBankControl', bank: 'bank.debris', lamps: ['lamp.debris1'],
      collision: [{ kind: 'line', from: { x: 28, y: 144 }, to: { x: 28, y: 158 } }] },
    { name: 'shelf.west2', kind: 'target', role: 'key', bounds: { x: 16, y: 162, width: 12, height: 14 },
      scores: [1800], control: 'TargetBankControl', bank: 'bank.debris', lamps: ['lamp.debris2'],
      collision: [{ kind: 'line', from: { x: 28, y: 162 }, to: { x: 28, y: 176 } }] },
    { name: 'shelf.east1', kind: 'target', role: 'key', bounds: { x: 139, y: 144, width: 12, height: 14 },
      scores: [1800], control: 'TargetBankControl', bank: 'bank.debris', lamps: ['lamp.debris3'],
      collision: [{ kind: 'line', from: { x: 139, y: 158 }, to: { x: 139, y: 144 } }] },
    { name: 'shelf.east2', kind: 'target', role: 'key', bounds: { x: 139, y: 162, width: 12, height: 14 },
      scores: [1800], control: 'TargetBankControl', bank: 'bank.debris', lamps: ['lamp.debris4'],
      collision: [{ kind: 'line', from: { x: 139, y: 176 }, to: { x: 139, y: 162 } }] },

    /* ===================== THE ION TRAILS ===================== */
    //
    // A rollover down each flank, outside the storm. The ball that squeezes past the cluster along a
    // wall is the one route this table did not pay for, and a table whose only scoring lives where the
    // bumpers are is a table with one idea.
    // ⚠️ AND A THIRD, IN THE EYE, WHICH IS ONE COMPONENT AND WAS NEEDED FOR TWO REASONS. The table
    // measured 5.2459 against the bar's 5.2463 — short by four ten-thousandths, which is to say by one
    // component, because a table has an integer number of them and a density does not. Widening the
    // bar to swallow that would have been moving it; the honest answer to being one short is one more.
    //
    // And the middle deserved it. Every other route on this table pays — the flanks, the head, the
    // shelves — and the one that goes straight down through the cluster, which is the riskiest, paid
    // only what the bumpers happened to give. This is the eye of the storm.
    { name: 'eye', kind: 'lane', role: 'goal', bounds: { x: 88, y: 146, width: 14, height: 18 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.eye'] },

    { name: 'trail.left', kind: 'lane', role: 'free', bounds: { x: 8, y: 100, width: 12, height: 26 },
      scores: [1200], control: 'LaneControl', lamps: ['lamp.trailLeft'] },
    { name: 'trail.right', kind: 'lane', role: 'free', bounds: { x: 147, y: 100, width: 12, height: 26 },
      scores: [1200], control: 'LaneControl', lamps: ['lamp.trailRight'] },

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
    // Five across the head rather than two: the ball entering from the return bend sweeps left across
    // all of them, so every launch scores something before the storm decides where it goes.
    { name: 'arc3', kind: 'lane', role: 'key', bounds: { x: 26, y: 16, width: 12, height: 14 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.arc3'] },
    { name: 'arc4', kind: 'lane', role: 'key', bounds: { x: 66, y: 16, width: 12, height: 14 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.arc4'] },
    { name: 'arc5', kind: 'lane', role: 'key', bounds: { x: 116, y: 16, width: 12, height: 14 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.arc5'] },
  ],

  lamps: [
    ...CABINET_LAMPS,
    'lamp.storm1', 'lamp.storm2', 'lamp.storm3', 'lamp.storm4', 'lamp.storm5',
    'lamp.debris1', 'lamp.debris2', 'lamp.debris3', 'lamp.debris4',
    'lamp.trailLeft', 'lamp.trailRight', 'lamp.eye', 'lamp.arc3', 'lamp.arc4', 'lamp.arc5',
    'lamp.flankLeft', 'lamp.flankRight',
    'lamp.ramp', 'lamp.arc1', 'lamp.arc2',
  ],
};
