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
    { name: 'landing1', kind: 'lane', role: 'free', bounds: { x: 4, y: 300, width: 172, height: 12 },
      scores: [1000], control: 'LaneControl', lamps: ['lamp.climb1'] },
    { name: 'landing2', kind: 'lane', role: 'free', bounds: { x: 90, y: 200, width: 30, height: 12 },
      scores: [2000], control: 'LaneControl', lamps: ['lamp.climb2'] },
    { name: 'landing3', kind: 'lane', role: 'free', bounds: { x: 50, y: 100, width: 30, height: 12 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.climb3'] },

    // Struck from BELOW by a ball that has climbed the whole tower, so the face is the bottom edge,
    // written right to left to put the solid side downward. It had none, which is why a five-thousand
    // frame run met walls and flippers and nothing else with the summit on screen throughout.
    { name: 'summit', kind: 'target', role: 'goal', bounds: { x: 80, y: 20, width: 20, height: 16 },
      scores: [25000], control: 'TargetControl', lamps: ['lamp.summit'],
      collision: [{ kind: 'line', from: { x: 100, y: 36 }, to: { x: 80, y: 36 } }] },

    { name: 'bumper.mid', kind: 'bumper', role: 'structure', bounds: { x: 81, y: 150, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl',
      collision: [{ kind: 'circle', at: { x: 90, y: 159 }, radius: 9 }] },

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
     */
    { name: 'guide.left', kind: 'wall', role: 'structure',
      bounds: { x: 4, y: 340, width: 46, height: 50 },
      collision: [{ kind: 'line', from: { x: 4, y: 340 }, to: { x: 50, y: 390 } }] },
    { name: 'guide.right', kind: 'wall', role: 'structure',
      bounds: { x: 120, y: 340, width: 56, height: 50 },
      collision: [{ kind: 'line', from: { x: 120, y: 390 }, to: { x: 176, y: 340 } }] },

    // ⚠️ LENGTHENED WITH THE REST OF THE CATALOGUE — see `wide-arc` for the arithmetic. Pivots
    // at 50 and 120 since the table widened, a reach of 33 of the 35 to the middle, leaving 4
    // between the raised tips.
    { name: 'flipper.left', kind: 'flipper', role: 'structure',
      bounds: { x: 90.6, y: 390, width: 29.4, height: 14.99 },
      flipper: {
        pivot: { x: 50, y: 390 }, tipAtRest: { x: 79.4, y: 404.99 }, sweepDegrees: -55,
        baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },
    { name: 'flipper.right', kind: 'flipper', role: 'structure',
      bounds: { x: 88.32, y: 390, width: 31.68, height: 9.24 },
      flipper: {
        pivot: { x: 120, y: 390 }, tipAtRest: { x: 90.6, y: 404.99 }, sweepDegrees: 55,
        baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },

    { name: 'drain', kind: 'drain', role: 'hazard', bounds: { x: 76, y: 410, width: 18, height: 8 },
      control: 'DrainControl' },
  ],
};
