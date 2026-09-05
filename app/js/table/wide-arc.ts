// SPDX-License-Identifier: AGPL-3.0-or-later
// table/wide-arc — a table WIDER than the screen.
//
// ========================= WHAT THIS ONE IS FOR =========================
// The plan says a table wider than 320 scrolls horizontally through the same camera. Nothing had ever
// proved it, because every table so far was 183 wide and the horizontal axis had no travel at all.
//
// This one is 360x280. It makes two things happen that no other table does:
//
//   · `shell/camera`'s axis solver gets a second axis with real travel — 40 pixels of it — driven by
//     exactly the same function, which is the claim ADR-0001 § 7 made and never tested against a table.
//   · `shell/hud` reports `overlaying: true`, because there is no margin left beside the playfield and
//     the four blocks have to sit on top of the play. That path existed and had only ever been
//     exercised by a fixture.
//
// It is deliberately sparse. A wide table is here to test the geometry the screen imposes, not to be
// the most interesting one to play.

import type { AuthoredTable } from './authored.js';

export const WIDE_ARC: AuthoredTable = {
  name: 'wide-arc',
  size: { width: 360, height: 280 },
  ballRadius: 3,

  lamps: ['lamp.left', 'lamp.right', 'lamp.arc'],

  components: [
    { name: 'wall.top', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 360, height: 4 },
      collision: [{ kind: 'line', from: { x: 360, y: 4 }, to: { x: 0, y: 4 } }] },
    // ⚠️ THESE HAD NO COLLISION AT ALL. They were bounds and a colour: the ball left the table
    // sideways and `drainedBy` reported `outside`. A wall that is only drawn is not a wall.
    { name: 'wall.left', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 4, height: 280 },
      collision: [{ kind: 'line', from: { x: 4, y: 0 }, to: { x: 4, y: 280 } }] },
    { name: 'wall.right', kind: 'wall', role: 'structure', bounds: { x: 356, y: 0, width: 4, height: 280 },
      collision: [{ kind: 'line', from: { x: 356, y: 280 }, to: { x: 356, y: 0 } }] },

    // The return bend. See `low-orbit` for why a plunger lane needs one.
    { name: 'wall.laneReturn', kind: 'wall', role: 'structure',
      bounds: { x: 316, y: 4, width: 42, height: 22 },
      collision: [{ kind: 'line', from: { x: 356, y: 25 }, to: { x: 316, y: 7 } }] },

    { name: 'plunger', kind: 'plunger', role: 'structure', bounds: { x: 344, y: 244, width: 10, height: 32 } },

    // The arc: two long banks of bumpers spread across the full width, which is the point of a wide
    // table — the ball can be a long way from the flippers HORIZONTALLY, not only vertically.
    { name: 'bumper.far.left', kind: 'bumper', role: 'structure',
      bounds: { x: 30, y: 60, width: 18, height: 18 }, scores: [500, 1000, 1500, 2000],
      control: 'BumperControl', lamps: ['lamp.left'],
      collision: [{ kind: 'circle', at: { x: 39, y: 69 }, radius: 9 }] },
    { name: 'bumper.far.right', kind: 'bumper', role: 'structure',
      bounds: { x: 300, y: 60, width: 18, height: 18 }, scores: [500, 1000, 1500, 2000],
      control: 'BumperControl', lamps: ['lamp.right'],
      collision: [{ kind: 'circle', at: { x: 309, y: 69 }, radius: 9 }] },
    { name: 'bumper.middle', kind: 'bumper', role: 'structure',
      bounds: { x: 168, y: 40, width: 18, height: 18 }, scores: [500, 1000, 1500, 2000],
      control: 'BumperControl', lamps: ['lamp.arc'],
      collision: [{ kind: 'circle', at: { x: 177, y: 49 }, radius: 9 }] },

    // ⚠️ IT USED TO BE A 280-PIXEL SHELF AT SEVEN DEGREES, AND THE BALL WENT TO SLEEP ON IT.
    // Two runs found two different faults in the same component. The first: it stopped at x = 300, the
    // ball came down the right-hand side past its end, and met nothing at all the whole way to the
    // bottom. Extending it to x = 340 fixed that and created the second, which is worse and much
    // quieter — a line that shallow does not deflect a ball, it CATCHES one. The probe shows the ball
    // arriving with speed 112, losing it to four bounces, and then creeping down the slope at a steady
    // 2.5: x = 208 after 400 frames, x = 168 after 4000, still going. It would have reached the low end
    // in about fifteen thousand frames, four minutes of sitting and watching.
    //
    // `physics/stuck` cannot help, and is right not to: 2.5 is well above its 0.8 threshold, so the ball
    // IS moving and the detector says so. The fault is not in the physics and not in the detector. A
    // long, nearly flat, one-sided line in the middle of a playfield is a bed.
    //
    // So the ramp is now a CHUTE: 45 degrees, 80 pixels, on the right where the bend delivers the ball.
    // At that angle gravity's pull along the surface is as large as the pull into it, and a ball cannot
    // settle — it is thrown back across the table towards the far bumper, which is what a ramp is for.
    { name: 'ramp.long', kind: 'ramp', role: 'goal', bounds: { x: 248, y: 88, width: 84, height: 84 },
      scores: [10000], control: 'LaunchRampControl',
      collision: [{ kind: 'line', from: { x: 250, y: 170 }, to: { x: 330, y: 90 } }] },

    { name: 'flipper.left', kind: 'flipper', role: 'structure',
      bounds: { x: 140, y: 250, width: 28, height: 7 },
      collision: [{ kind: 'line', from: { x: 140, y: 250 }, to: { x: 168, y: 257 } }] },
    { name: 'flipper.right', kind: 'flipper', role: 'structure',
      bounds: { x: 192, y: 250, width: 28, height: 7 },
      collision: [{ kind: 'line', from: { x: 192, y: 257 }, to: { x: 220, y: 250 } }] },

    { name: 'drain', kind: 'drain', role: 'hazard', bounds: { x: 164, y: 270, width: 32, height: 8 },
      control: 'BallDrainControl' },
  ],
};
