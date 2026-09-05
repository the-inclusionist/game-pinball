// SPDX-License-Identifier: AGPL-3.0-or-later
// table/four-flippers — two pairs of flippers, and two ways to lose.
//
// ========================= WHAT THIS ONE IS FOR =========================
// Every other table has one pair of flippers and one drain, which is the arrangement the 1995 table
// has and therefore the only one the port has ever had to think about. This one has TWO pairs and TWO
// drains, and it exists to find out where that assumption is hiding.
//
// Two places it is known to matter, both already ported:
//
//   · `physics/stuck` treats a ball inside a flipper's bounds as legitimately still, and it takes a
//     LIST of control bounds rather than two named ones. Four flippers is the first table that puts
//     more than three entries in that list.
//   · `control/banks`' flipper trick steps the bumper-lane lamps when a flipper goes up. With two
//     pairs, either pair does it — which is a rule about flippers, not about the left one.
//
// It is also the table where the camera has the least to do: 210 tall against a 180 view is 30 pixels
// of travel, the smallest a table can have and still be required to have a camera at all.

import type { AuthoredTable } from './authored.js';

export const FOUR_FLIPPERS: AuthoredTable = {
  name: 'four-flippers',
  size: { width: 200, height: 210 },
  ballRadius: 3,

  lamps: ['lamp.upper', 'lamp.lower', 'lamp.left', 'lamp.right'],

  components: [
    { name: 'wall.left', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 4, height: 210 } },
    { name: 'wall.right', kind: 'wall', role: 'structure', bounds: { x: 196, y: 0, width: 4, height: 210 } },
    { name: 'wall.top', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 200, height: 4 } },

    { name: 'plunger', kind: 'plunger', role: 'structure', bounds: { x: 184, y: 176, width: 10, height: 30 } },

    // The UPPER pair, guarding the upper drain. A ball lost here never reaches the lower half.
    { name: 'flipper.upper.left', kind: 'flipper', role: 'structure',
      bounds: { x: 60, y: 96, width: 24, height: 6 },
      collision: [{ kind: 'line', from: { x: 60, y: 96 }, to: { x: 84, y: 102 } }] },
    { name: 'flipper.upper.right', kind: 'flipper', role: 'structure',
      bounds: { x: 116, y: 96, width: 24, height: 6 },
      collision: [{ kind: 'line', from: { x: 116, y: 102 }, to: { x: 140, y: 96 } }] },
    { name: 'drain.upper', kind: 'drain', role: 'hazard', bounds: { x: 88, y: 104, width: 24, height: 8 },
      control: 'BallDrainControl', lamps: ['lamp.upper'] },

    // The LOWER pair, guarding the ordinary drain.
    { name: 'flipper.lower.left', kind: 'flipper', role: 'structure',
      bounds: { x: 56, y: 186, width: 26, height: 6 },
      collision: [{ kind: 'line', from: { x: 56, y: 186 }, to: { x: 82, y: 192 } }] },
    { name: 'flipper.lower.right', kind: 'flipper', role: 'structure',
      bounds: { x: 118, y: 186, width: 26, height: 6 },
      collision: [{ kind: 'line', from: { x: 118, y: 192 }, to: { x: 144, y: 186 } }] },
    { name: 'drain.lower', kind: 'drain', role: 'hazard', bounds: { x: 86, y: 200, width: 28, height: 8 },
      control: 'BallDrainControl', lamps: ['lamp.lower'] },

    { name: 'bumper.left', kind: 'bumper', role: 'structure', bounds: { x: 40, y: 40, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.left'],
      collision: [{ kind: 'circle', at: { x: 49, y: 49 }, radius: 9 }] },
    { name: 'bumper.right', kind: 'bumper', role: 'structure', bounds: { x: 142, y: 40, width: 18, height: 18 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.right'],
      collision: [{ kind: 'circle', at: { x: 151, y: 49 }, radius: 9 }] },

    { name: 'target.centre', kind: 'target', role: 'goal', bounds: { x: 92, y: 40, width: 16, height: 14 },
      scores: [1000, 12000], control: 'BoosterTargetControl' },
  ],
};
