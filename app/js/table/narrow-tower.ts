// SPDX-License-Identifier: AGPL-3.0-or-later
// table/narrow-tower — a table far taller than the screen.
//
// ========================= WHAT THIS ONE IS FOR =========================
// `low-orbit` is 235 tall against a 180 view: 55 pixels of camera travel, the number the Dev specified.
// This one is 120x420, which is 240 pixels of travel — more than four times as much — and it is here to
// find out what the camera does when following the ball is most of the screen's job.
//
// It is the table where ADR-0001 § 5 bites hardest: with the ball at the top, the flippers are not
// merely off screen, they are 240 pixels off screen. If losing sight of them is going to feel wrong
// anywhere, it is here, and having the extreme available is what makes that judgement possible before
// the authored table is finished rather than after.
//
// It also has the widest margin the HUD will ever see: 140 pixels beside a 180-wide playfield, against
// the 137 of `low-orbit`.
//
// ⚠️ IT WAS 120 WIDE UNTIL 2026-09-07, AND NINE DEGREES IS WHY IT IS NOT. The Dev put every table on the
// same lean — "a inclinação de narrow-tower e bare-minimum devem ser 9 graus TAMBÉM" — and at 120 by 420
// the two walls CROSS 58 units before they reach the top: `table/perspective` needs
// `width >= 45 + 0.3168 x height`, which is 178 here. The instruction was not difficult at that size, it
// was impossible.
//
// ⚠️ AND IT GREW RATHER THAN SHRANK, which was his call between the two ways out: "o propósito dela é
// altura extrema para exercitar a câmera", and shortening it to the 236 that 120 allows is throwing that
// away to keep an adjective. It is still the narrowest table in the catalogue at 180 against 183.
//
// Everything moved with the middle: sixty units of new width, thirty of them on each side of the play,
// so the layout is the one that was tuned and not a stretched copy of it. The bottom assembly is sized
// against the BALL rather than against the table — `table/cabinet` argues that — so it slid whole.
//
// ========================= AND SINCE 2026-09-07 IT IS LAID OUT ON A PICTURE =========================
// ⚠️ THE DEV PAINTED ONE AND SAID WHAT TO DO WITH IT: "artes feitas, lembrando: elas não são fiéis e é
// preciso refazer os mapas em cima de cada arte." The geometry moved to the art and not the other way
// round — `gfx/backdrop`'s own rule, that the player aims at what they see and the ball meets what
// they do not. Coordinates were read off `shots/grid-narrow-tower.png`, the imported picture at four times with
// this table's own units drawn on it.
//
// ⚠️ AND THEY REST STEEPER THAN THE ART DRAWS THEM, BY MEASUREMENT. Painted, the tips sit ten apart at
// rest — and `tipRadius` is 2, so the channel between them is ten minus four, which is EXACTLY the
// ball's diameter. Measured: the ball wedged on the two tips at (89, 378) and sat there for four
// thousand frames, and "the ball is eventually lost" went red on a ball that was never lost at all. The
// reach is the art's 64; what changed is the rest angle, from a drop of 0.367 to 0.5, which opens the
// channel to sixteen and leaves the horizontal gap at two.
//
// ⚠️ AND THE ART DRAWS PADDLES THAT ALREADY OBEY THE DEV'S OWN RULE. Its pivots are 130 apart and its
// paddles 64 long, which closes the middle to four units at the horizontal — "elas não devem se tocar
// e o espaço entre elas deve ser menor que uma bolinha". The pair this replaces was 70 apart with a
// reach of 33. Nobody coordinated that; the picture and the rule agree because both are about a ball.

import type { AuthoredTable } from './authored.js';

export const NARROW_TOWER: AuthoredTable = {
  name: 'narrow-tower',
  size: { width: 180, height: 420 },
  ballRadius: 3,

  lamps: ['lamp.climb1', 'lamp.climb2', 'lamp.climb3', 'lamp.summit'],

  components: [
    { name: 'wall.left', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 4, height: 420 },
      collision: [{ kind: 'line', from: { x: 4, y: 0 }, to: { x: 4, y: 420 } }] },
    { name: 'wall.right', kind: 'wall', role: 'structure', bounds: { x: 176, y: 0, width: 4, height: 420 },
      collision: [{ kind: 'line', from: { x: 176, y: 420 }, to: { x: 176, y: 0 } }] },
    { name: 'wall.top', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 180, height: 4 },
      collision: [{ kind: 'line', from: { x: 180, y: 4 }, to: { x: 0, y: 4 } }] },

    // The return bend. See `low-orbit` for why a plunger lane needs one.
    { name: 'wall.laneReturn', kind: 'wall', role: 'structure',
      bounds: { x: 142, y: 6, width: 34, height: 22 },
      collision: [{ kind: 'line', from: { x: 176, y: 27 }, to: { x: 142, y: 9 } }] },

    { name: 'plunger', kind: 'plunger', role: 'structure', bounds: { x: 164, y: 384, width: 10, height: 32 } },

    /**
     * Three landings up the tower. A ball that reaches the top has crossed the whole camera range.
     *
     * ⚠️ THE FIRST ONE SPANS THE TOWER, AND IT USED TO BE THIRTY PIXELS WIDE LIKE THE OTHERS. Thirty
     * of a hundred and twenty is a one-in-four chance that a descending ball crosses it, and the gate
     * that asks whether this table scores at all was riding on that chance: it went red the day the
     * ball gained a radius and every trajectory shifted by three pixels. It had been passing on luck.
     *
     * A shelf everything falls past is also the truer thing for the LOWEST landing — the two above it
     * stay narrow, because those are shots rather than certainties.
     */
    { name: 'landing1', kind: 'lane', role: 'free', bounds: { x: 40, y: 292, width: 105, height: 10 },
      scores: [1000], control: 'LaneControl', lamps: ['lamp.climb1'] },
    { name: 'landing2', kind: 'lane', role: 'free', bounds: { x: 90, y: 200, width: 30, height: 12 },
      scores: [2000], control: 'LaneControl', lamps: ['lamp.climb2'] },
    { name: 'landing3', kind: 'lane', role: 'free', bounds: { x: 75, y: 136, width: 30, height: 8 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.climb3'] },

    // Struck from BELOW by a ball that has climbed the whole tower, so the face is the bottom edge,
    // written right to left to put the solid side downward. It had none, which is why a five-thousand
    // frame run met walls and flippers and nothing else with the summit on screen throughout.
    // The lit gate across the head of the tower, struck from below by a ball that has climbed it all.
    { name: 'summit', kind: 'target', role: 'goal', bounds: { x: 70, y: 22, width: 40, height: 20 },
      scores: [25000], control: 'TargetControl', lamps: ['lamp.summit'],
      collision: [{ kind: 'line', from: { x: 110, y: 42 }, to: { x: 70, y: 42 } }] },

    // The star at the middle of the shaft, which the art draws twenty-eight across.
    { name: 'bumper.mid', kind: 'bumper', role: 'structure', bounds: { x: 76, y: 146, width: 28, height: 28 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl',
      collision: [{ kind: 'circle', at: { x: 90, y: 160 }, radius: 14 }] },

    /**
     * ⚠️ THE FUNNEL, WHICH THIS TABLE NEVER HAD, and the gap it left is the one `wide-arc`'s own
     * funnel comment describes: the ball came down the outside of the right paddle, hit its BACK, and
     * went out of the bottom of the table. A run flapping the flippers came out identical to a run
     * touching nothing — because `flipperCollision`'s from-behind branch reads no motion at all, so a
     * ball on the wrong side of a paddle cannot tell whether the player is playing.
     *
     * Found when the ball gained a radius and every trajectory moved three pixels. The old path was
     * already outside the paddles; it merely used to end at the drain by luck rather than past it.
     *
     * Each guide runs from a side wall down to a flipper pivot, so the only way to the bottom is over
     * a paddle. Written to FACE the play, like every other one-sided edge here.
     *
     * ⚠️ AND THEY REACH THE WALLS, WHICH THE ART DOES NOT DRAW. Its triangles start sixteen units in,
     * with a channel outside each — an outlane, which is what the same shape is labelled on
     * `wide-arc`. Authored that way here the ball goes down the channel every time and never meets a
     * paddle at all: "flapping the flippers changes the ball's life" went red, which is
     * `tests/table-playable`'s definition of a table the player watches. This fixture exists to give
     * the camera 240 pixels of travel, and a fixture whose ball cannot be played does not give it
     * anything. The sixteen units are the liberty; the funnel is the reason.
     */
    { name: 'guide.left', kind: 'wall', role: 'structure',
      bounds: { x: 4, y: 305, width: 48, height: 51 },
      collision: [{ kind: 'line', from: { x: 4, y: 305 }, to: { x: 52, y: 356 } }] },
    { name: 'guide.right', kind: 'wall', role: 'structure',
      bounds: { x: 128, y: 305, width: 48, height: 51 },
      collision: [{ kind: 'line', from: { x: 128, y: 356 }, to: { x: 176, y: 305 } }] },

    // ⚠️ LENGTHENED WITH THE REST OF THE CATALOGUE — see `wide-arc` for the arithmetic. Pivots
    // at 50 and 120 since the table widened, a reach of 33 of the 35 to the middle, leaving 4
    // between the raised tips.
    { name: 'flipper.left', kind: 'flipper', role: 'structure',
      bounds: { x: 25, y: 358, width: 55.9, height: 28 },
      flipper: {
        pivot: { x: 25, y: 358 }, tipAtRest: { x: 80.9, y: 386 }, sweepDegrees: -55,
        baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },
    { name: 'flipper.right', kind: 'flipper', role: 'structure',
      bounds: { x: 99.1, y: 358, width: 55.9, height: 28 },
      flipper: {
        pivot: { x: 155, y: 358 }, tipAtRest: { x: 99.1, y: 386 }, sweepDegrees: 55,
        baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },

    // ⚠️ IT REACHES THE FLOOR, and the first version of this stopped ten units short of it. The ball
    // fell through the strip below and `drainedBy` answered `outside` — a hole in the geometry rather
    // than a way to lose, which is a distinction this project keeps precisely so a gate can tell them
    // apart. A drain that does not touch the bottom of the table is a drain with a gap under it.
    { name: 'drain', kind: 'drain', role: 'hazard', bounds: { x: 74, y: 404, width: 28, height: 16 },
      control: 'DrainControl' },
  ],
};
