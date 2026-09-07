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
//   factory       the Dev's assembly bay, laid out on his own picture: a rocket in a gantry with its
//                 engines already lit. The first table here whose subject is a MACHINE rather than a
//                 place, and the first authored straight onto the art rather than fitted to it after.
//   bare-minimum  exactly what the validator demands and nothing else. The floor of the format.
//
// ⚠️ THE VALIDATOR PASSES ALL FIVE, AND ONLY ONE OF THEM IS WORTH PLAYING. That is not a gap in the
// validator: it checks that a table can RUN, not that it is any good. The second question does not
// have a machine answer, and pretending otherwise would be the worse mistake.

import type { AuthoredTable } from './authored.js';
import { LOW_ORBIT as FLAT_LOW_ORBIT } from './low-orbit.js';
import { ION_STORM as FLAT_ION_STORM } from './ion-storm.js';
import { SLIPSTREAM as FLAT_SLIPSTREAM } from './slipstream.js';
import { RING_BELT as FLAT_RING_BELT } from './ring-belt.js';
import { LONG_CLIMB as FLAT_LONG_CLIMB } from './long-climb.js';
import { CRATER_RUN as FLAT_CRATER_RUN } from './crater-run.js';
import { WIDE_ARC as FLAT_WIDE_ARC } from './wide-arc.js';
import { NARROW_TOWER as FLAT_NARROW_TOWER } from './narrow-tower.js';
import { FOUR_FLIPPERS as FLAT_FOUR_FLIPPERS } from './four-flippers.js';
import { BARE_MINIMUM as FLAT_BARE_MINIMUM } from './bare-minimum.js';
import { FACTORY as FLAT_FACTORY } from './factory.js';
import { taper } from './perspective.js';

/**
 * ⚠️ EVERY TABLE LEANS, AND THIS IS THE ONE PLACE THAT SAYS SO. The Dev asked for nine degrees on every
 * table — "transformando todas as mesas em trapézios com angulos internos de 81 graus na base" — and
 * `table/perspective` argues why that is a transform over the finished table rather than an edit to
 * four walls in `table/cabinet`.
 *
 * ⚠️ AND IT HAS TO BE HERE RATHER THAN IN THE CABINET, because three tables never call the cabinet.
 * `low-orbit` is the flagship and was authored before that module existed; `narrow-tower` and
 * `bare-minimum` are fixtures with their own hand-written shells. A shared change made in the cabinet
 * has reached eight tables and skipped three every time it has been made, which those files record.
 * This is the only join every table passes through.
 *
 * The authored files keep their upright coordinates. That is what makes them readable — an author
 * writes "the bumper is thirty from the wall" and does not do trigonometry — and it is the same
 * arrangement the 1995 table has, where the lean is in the geometry and not in the numbers a designer
 * typed.
 */
const LOW_ORBIT = taper(FLAT_LOW_ORBIT);
const ION_STORM = taper(FLAT_ION_STORM);
const SLIPSTREAM = taper(FLAT_SLIPSTREAM);
const RING_BELT = taper(FLAT_RING_BELT);
const LONG_CLIMB = taper(FLAT_LONG_CLIMB);
const CRATER_RUN = taper(FLAT_CRATER_RUN);
const WIDE_ARC = taper(FLAT_WIDE_ARC);
const NARROW_TOWER = taper(FLAT_NARROW_TOWER);
const FOUR_FLIPPERS = taper(FLAT_FOUR_FLIPPERS);
const BARE_MINIMUM = taper(FLAT_BARE_MINIMUM);
const FACTORY = taper(FLAT_FACTORY);

export { LOW_ORBIT, ION_STORM, SLIPSTREAM, RING_BELT, LONG_CLIMB, CRATER_RUN, FACTORY, WIDE_ARC, NARROW_TOWER, FOUR_FLIPPERS, BARE_MINIMUM };

/**
 * The tables AS THEY WERE WRITTEN, upright, before the lean.
 *
 * ⚠️ NOT FOR PLAYING, AND THE NAME SAYS SO. Everything the game touches — the physics, the renderer,
 * the selector, the camera — must use `CATALOG`, whose tables are the leaning ones. This exists for the
 * gates that ask what an AUTHOR wrote rather than what a player sees: `tests/table-catalog` compares
 * every table's shell against `table/cabinet` to catch a table that has quietly re-authored one, and
 * that question lives in the upright space both sides were written in.
 */
export const AUTHORED_TABLES: readonly AuthoredTable[] = [
  FLAT_LOW_ORBIT, FLAT_ION_STORM, FLAT_SLIPSTREAM, FLAT_RING_BELT, FLAT_LONG_CLIMB, FLAT_CRATER_RUN,
  FLAT_FACTORY, FLAT_WIDE_ARC, FLAT_NARROW_TOWER, FLAT_FOUR_FLIPPERS, FLAT_BARE_MINIMUM,
];

/** Every authored table. The first is the default. */
export const CATALOG: readonly AuthoredTable[] = [
  LOW_ORBIT, ION_STORM, SLIPSTREAM, RING_BELT, LONG_CLIMB, CRATER_RUN, FACTORY,
  WIDE_ARC, NARROW_TOWER, FOUR_FLIPPERS, BARE_MINIMUM,
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
  LOW_ORBIT, ION_STORM, CRATER_RUN, LONG_CLIMB, RING_BELT, SLIPSTREAM, FACTORY,
];

/** The one the game opens with. */
export const DEFAULT_TABLE: AuthoredTable = LOW_ORBIT;

export function tableNamed(name: string): AuthoredTable | undefined {
  return CATALOG.find((t) => t.name === name);
}
