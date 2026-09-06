// SPDX-License-Identifier: AGPL-3.0-or-later
// HOW MUCH THERE IS TO HIT, MEASURED AGAINST THE TABLE THIS PORT EXISTS TO REBUILD.
//
// ⚠️ THE DEV: "por que o resultado são mesas tão 'simples' ao invés de ser tão complexas quanto o
// original? O que tem jogável são demos que qualquer LLM forte atual faria em um único prompt."
//
// The first answer given to that was "seventy-two components across six tables against ninety on the
// 1995 one", and that comparison was wrong in the port's own favour and against it at the same time:
// it added six tables together and set the total against ONE table, while ignoring that the authored
// tables are a quarter of the original's area. The honest measure is DENSITY.
//
//     1995 playfield   365 x 470 = 171,550 px, 90 components carrying a score row
//                      = 5.25 scoring components per 10,000 px
//
// Measured, the day this file was written:
//
//     low-orbit    4.19    crater-run   3.36    ion-storm    2.40
//     slipstream   2.23    long-climb   2.00    ring-belt    1.62
//
// So "all six are thin" was also wrong. `low-orbit` is within a fifth of the original and `ring-belt`
// is at a third of it. The complaint is right about four tables and nearly wrong about one, and that
// distinction is only visible because somebody counted.
//
// ========================= WHY THIS IS A LEDGER AND NOT ONE NUMBER =========================
// A gate that simply demanded the 1995 density would be red on every table for as long as the
// authoring took, and a suite that is red is a suite nobody reads. So the tables that do not meet the
// bar are NAMED, with what they measure today, and two things are checked: a table not on the list
// meets the bar, and a table on it may not get any thinner. The list shrinks as tables are authored
// and it cannot grow without somebody writing a name in it.
//
// That is the same shape as the orphan ledger and the basename-clash ledger in this repository, and
// for the same reason: a known shortfall that is written down is a decision, and one that is not is a
// surprise waiting for whoever plays the game next.
import { describe, test, expect } from 'vitest';
import { PLAYABLE_TABLES } from '../app/js/table/catalog.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/** The 1995 playfield, from `Doc/.dat dump.txt`: the largest bitmap is 365x470. */
const ORIGINAL_AREA = 365 * 470;
/** Components carrying a score row in `control/score-table`, which is transcribed from the archive. */
const ORIGINAL_SCORING = 90;
const ORIGINAL_DENSITY = (ORIGINAL_SCORING / ORIGINAL_AREA) * 10000;

/** Scoring components per 10,000 table pixels. */
function density(table: AuthoredTable): number {
  const scoring = table.components.filter((c) => (c.scores?.length ?? 0) > 0).length;
  return (scoring / (table.size.width * table.size.height)) * 10000;
}

/**
 * ⚠️ THE TABLES STILL BELOW THE BAR, AND WHAT THEY MEASURED WHEN THEY WERE PUT HERE.
 *
 * Delete a line when the table is authored up to the 1995 density. Do not edit a number downward:
 * that is the one edit this file exists to make somebody argue for.
 */
const THIN: Readonly<Record<string, number>> = {
  'ion-storm': 2.40,
  'crater-run': 3.36,
  'long-climb': 2.00,
  'ring-belt': 1.62,
  slipstream: 2.23,
};

describe('⚠️ how much there is to hit', () => {
  test('the 1995 table is the bar, and it is 5.25 per ten thousand pixels', () => {
    // Pinned so the bar cannot drift when somebody edits the constants above. Both numbers are
    // measurements of the archive rather than choices.
    expect(ORIGINAL_DENSITY).toBeCloseTo(5.25, 2);
  });

  test.each(PLAYABLE_TABLES.map((t) => [t.name, t] as const))(
    '%s', (name, table) => {
    const now = density(table);
    const floor = THIN[name];

    if (floor === undefined) {
      expect(now, `${now.toFixed(2)} per 10k against the 1995 table's ${ORIGINAL_DENSITY.toFixed(2)}`)
        .toBeGreaterThanOrEqual(ORIGINAL_DENSITY);
      return;
    }
    // ⚠️ A LISTED TABLE MAY NOT GET THINNER. It is allowed to be below the bar because somebody wrote
    // it down; it is not allowed to drift further from it while nobody is looking.
    expect(now, `${name} was ${floor.toFixed(2)} per 10k and is now ${now.toFixed(2)}`)
      .toBeGreaterThanOrEqual(floor - 0.005);
  });

  test('⚠️ and the list names only tables that exist', () => {
    // A ledger with a stale name in it excuses a table nobody has. The commonest way this rots.
    const playable = new Set(PLAYABLE_TABLES.map((t) => t.name));

    for (const name of Object.keys(THIN)) {
      expect(playable.has(name), `${name} is on the thin list and is not a playable table`).toBe(true);
    }
  });

  test('⚠️ and a table on the list is really below the bar, or it should be off it', () => {
    // The other direction: a table authored up to the bar and left on the list is a shortfall the
    // repository goes on claiming after it has been paid off, which is how a ledger stops being read.
    for (const [name, floor] of Object.entries(THIN)) {
      expect(floor, `${name} is listed as thin at ${floor} but the bar is ${ORIGINAL_DENSITY.toFixed(2)}`)
        .toBeLessThan(ORIGINAL_DENSITY);
    }
  });
});
