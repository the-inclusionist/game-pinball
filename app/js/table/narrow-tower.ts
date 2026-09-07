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
// It also has the widest margin the HUD will ever see: 200 pixels beside a 120-wide playfield, against
// the 137 of `low-orbit`.

import type { AuthoredTable } from './authored.js';

export const NARROW_TOWER: AuthoredTable = {
  name: 'narrow-tower',
  size: { width: 120, height: 420 },
  ballRadius: 3,

  lamps: ['lamp.climb1', 'lamp.climb2', 'lamp.climb3', 'lamp.summit'],

  components: [
    { name: 'wall.left', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 4, height: 420 },
      collision: [{ kind: 'line', from: { x: 4, y: 0 }, to: { x: 4, y: 420 } }] },
    { name: 'wall.right', kind: 'wall', role: 'structure', bounds: { x: 116, y: 0, width: 4, height: 420 },
      collision: [{ kind: 'line', from: { x: 116, y: 420 }, to: { x: 116, y: 0 } }] },
    { name: 'wall.top', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 120, height: 4 },
      collision: [{ kind: 'line', from: { x: 120, y: 4 }, to: { x: 0, y: 4 } }] },

    // The return bend. See `low-orbit` for why a plunger lane needs one.
    { name: 'wall.laneReturn', kind: 'wall', role: 'structure',
      bounds: { x: 82, y: 6, width: 34, height: 22 },
      collision: [{ kind: 'line', from: { x: 116, y: 27 }, to: { x: 82, y: 9 } }] },

    { name: 'plunger', kind: 'plunger', role: 'structure', bounds: { x: 104, y: 384, width: 10, height: 32 } },

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
    { name: 'landing1', kind: 'lane', role: 'free', bounds: { x: 4, y: 300, width: 112, height: 12 },
      scores: [1000], control: 'LaneControl', lamps: ['lamp.climb1'] },
    { name: 'landing2', kind: 'lane', role: 'free', bounds: { x: 60, y: 200, width: 30, height: 12 },
      scores: [2000], control: 'LaneControl', lamps: ['lamp.climb2'] },
    { name: 'landing3', kind: 'lane', role: 'free', bounds: { x: 20, y: 100, width: 30, height: 12 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.climb3'] },

    // Struck from BELOW by a ball that has climbed the whole tower, so the face is the bottom edge,
    // written right to left to put the solid side downward. It had none, which is why a five-thousand
    // frame run met walls and flippers and nothing else with the summit on screen throughout.
    { name: 'summit', kind: 'target', role: 'goal', bounds: { x: 50, y: 20, width: 20, height: 16 },
      scores: [25000], control: 'TargetControl', lamps: ['lamp.summit'],
      collision: [{ kind: 'line', from: { x: 70, y: 36 }, to: { x: 50, y: 36 } }] },

    { name: 'bumper.mid', kind: 'bumper', role: 'structure', bounds: { x: 51, y: 150, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl',
      collision: [{ kind: 'circle', at: { x: 60, y: 159 }, radius: 9 }] },

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
      bounds: { x: 4, y: 340, width: 16, height: 50 },
      collision: [{ kind: 'line', from: { x: 4, y: 340 }, to: { x: 20, y: 390 } }] },
    { name: 'guide.right', kind: 'wall', role: 'structure',
      bounds: { x: 90, y: 340, width: 26, height: 50 },
      collision: [{ kind: 'line', from: { x: 90, y: 390 }, to: { x: 116, y: 340 } }] },

    // ⚠️ LENGTHENED WITH THE REST OF THE CATALOGUE — see `wide-arc` for the arithmetic. Pivots
    // unmoved at 20 and 90, a reach of 33 of the 35 to the middle, leaving 4 between the raised tips.
    { name: 'flipper.left', kind: 'flipper', role: 'structure',
      bounds: { x: 60.6, y: 390, width: 29.4, height: 14.99 },
      flipper: {
        pivot: { x: 20, y: 390 }, tipAtRest: { x: 49.4, y: 404.99 }, sweepDegrees: -55,
        baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },
    { name: 'flipper.right', kind: 'flipper', role: 'structure',
      bounds: { x: 58.32, y: 390, width: 31.68, height: 9.24 },
      flipper: {
        pivot: { x: 90, y: 390 }, tipAtRest: { x: 60.6, y: 404.99 }, sweepDegrees: 55,
        baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },

    { name: 'drain', kind: 'drain', role: 'hazard', bounds: { x: 46, y: 410, width: 18, height: 8 },
      control: 'DrainControl' },
  ],
};
