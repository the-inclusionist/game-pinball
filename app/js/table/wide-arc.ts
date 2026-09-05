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
      collision: [{ kind: 'line', from: { x: 0, y: 4 }, to: { x: 360, y: 4 } }] },
    { name: 'wall.left', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 4, height: 280 } },
    { name: 'wall.right', kind: 'wall', role: 'structure', bounds: { x: 356, y: 0, width: 4, height: 280 } },

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

    { name: 'ramp.long', kind: 'ramp', role: 'goal', bounds: { x: 60, y: 120, width: 240, height: 30 },
      scores: [10000], control: 'LaunchRampControl',
      collision: [{ kind: 'line', from: { x: 60, y: 150 }, to: { x: 300, y: 120 } }] },

    { name: 'flipper.left', kind: 'flipper', role: 'structure',
      bounds: { x: 140, y: 250, width: 28, height: 7 },
      collision: [{ kind: 'line', from: { x: 140, y: 250 }, to: { x: 168, y: 257 } }] },
    { name: 'flipper.right', kind: 'flipper', role: 'structure',
      bounds: { x: 192, y: 250, width: 28, height: 7 },
      collision: [{ kind: 'line', from: { x: 220, y: 250 }, to: { x: 192, y: 257 } }] },

    { name: 'drain', kind: 'drain', role: 'hazard', bounds: { x: 164, y: 270, width: 32, height: 8 },
      control: 'BallDrainControl' },
  ],
};
