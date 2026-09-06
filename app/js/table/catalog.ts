// SPDX-License-Identifier: AGPL-3.0-or-later
// table/catalog — the authored tables, and what each one is for.
//
// ========================= FIVE, BECAUSE ONE PROVES ALMOST NOTHING =========================
// A single authored table would prove that `table/authored` can describe A table. Five different ones
// prove that it can describe DIFFERENT tables, and each of these was chosen to reach a part of the
// machine that no other reaches:
//
//   low-orbit     the conventional table: plunger lane, bumpers, ramp, targets, three wormhole wells.
//                 The one meant to be played, and the one every other is compared against.
//   wide-arc      WIDER than the 320 screen. The only table where the camera's horizontal axis has
//                 travel and the HUD reports `overlaying`, both of which were claims before this.
//   narrow-tower  240 pixels of vertical travel against low-orbit's 55. Where losing sight of the
//                 flippers is at its most extreme, which is where that decision should be judged.
//   four-flippers two pairs of flippers and TWO drains, which is the first table to contradict the
//                 assumption every module inherited from the 1995 one.
//   bare-minimum  exactly what the validator demands and nothing else. The floor of the format.
//
// ⚠️ THE VALIDATOR PASSES ALL FIVE, AND ONLY ONE OF THEM IS WORTH PLAYING. That is not a gap in the
// validator: it checks that a table can RUN, not that it is any good. The second question does not
// have a machine answer, and pretending otherwise would be the worse mistake.

import type { AuthoredTable } from './authored.js';
import { LOW_ORBIT } from './low-orbit.js';
import { ION_STORM } from './ion-storm.js';
import { SLIPSTREAM } from './slipstream.js';
import { RING_BELT } from './ring-belt.js';
import { LONG_CLIMB } from './long-climb.js';
import { CRATER_RUN } from './crater-run.js';
import { WIDE_ARC } from './wide-arc.js';
import { NARROW_TOWER } from './narrow-tower.js';
import { FOUR_FLIPPERS } from './four-flippers.js';
import { BARE_MINIMUM } from './bare-minimum.js';

export { LOW_ORBIT, ION_STORM, SLIPSTREAM, RING_BELT, LONG_CLIMB, CRATER_RUN, WIDE_ARC, NARROW_TOWER, FOUR_FLIPPERS, BARE_MINIMUM };

/** Every authored table. The first is the default. */
export const CATALOG: readonly AuthoredTable[] = [
  LOW_ORBIT, ION_STORM, SLIPSTREAM, RING_BELT, LONG_CLIMB, CRATER_RUN, WIDE_ARC, NARROW_TOWER, FOUR_FLIPPERS, BARE_MINIMUM,
];

/**
 * The tables offered to a player, as against the ones that exist to test the machine.
 *
 * ⚠️ THE SELECTOR WAS SHOWING ALL TEN, and four of them are fixtures. `bare-minimum` is the floor of
 * the format — a ceiling, one flipper, a plunger and a drain — and this file's own header says the
 * validator "checks that a table can RUN, not that it is any good". Offering them beside six tables
 * that were designed to be played tells a player they are the same kind of thing.
 *
 * They stay in `CATALOG` because every gate in the repository walks it, and their whole purpose is to
 * be walked: `wide-arc` gives the horizontal camera a case, `narrow-tower` the extreme of vertical
 * travel, `four-flippers` two drains, `bare-minimum` the minimum. What changes is only what the
 * SELECTOR lists.
 */
export const PLAYABLE_TABLES: readonly AuthoredTable[] = [
  LOW_ORBIT, ION_STORM, CRATER_RUN, LONG_CLIMB, RING_BELT, SLIPSTREAM,
];

/** The one the game opens with. */
export const DEFAULT_TABLE: AuthoredTable = LOW_ORBIT;

export function tableNamed(name: string): AuthoredTable | undefined {
  return CATALOG.find((t) => t.name === name);
}
