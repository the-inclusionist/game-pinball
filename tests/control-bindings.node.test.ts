// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  REENTRY_LANES, BUMPER_LANE_BINDINGS, UNBOUND_CONTROLS, SELF_CONTAINED_CONTROLS,
} from '../app/js/control/bindings.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';
import { RESOURCE_KEYS } from '../app/js/i18n/keys.js';
import { buildOriginalComponents } from '../app/js/table/original-components.js';
import { loadTable } from '../app/js/dat/loader.js';

/**
 * ⚠️ DATA TRAPPED IN CODE.
 *
 * `score-table` says which control each component runs and `control/lanes` says what the controls do.
 * Neither says WHICH light, which group, which bumper — in the original that is not in a table at all,
 * it is named globals inside the function bodies. Getting it out is a transcription of its own, and it
 * is the last thing between this port and a 1995 table that plays rather than one that is shown.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

describe('the reentry lanes, transcribed', () => {
  test('⚠️ every name in it is an ARCHIVE name, because that is what a collision reports', () => {
    // `control.cpp` calls them `roll3` and `attack_bump`; the file calls them `a_roll3` and
    // `attack_bumpers`. Transcribing the variable names would produce a binding that reads correctly
    // and matches nothing.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);
    const names = new Set(table.groups.map((g) => g.name).filter(Boolean));

    for (const lane of REENTRY_LANES.lanes) {
      expect(names.has(lane.component), lane.component).toBe(true);
      expect(built.lights.has(lane.light), lane.light).toBe(true);
    }
    expect(built.lightGroups.has(REENTRY_LANES.lightGroup)).toBe(true);
    expect(built.bumperGroups.has(REENTRY_LANES.bumperGroup)).toBe(true);
    expect(built.bumpers.has(REENTRY_LANES.guardBumper)).toBe(true);
  });

  test('⚠️ and the light group really holds exactly the lanes’ lights', () => {
    // The claim that makes the mechanic true: the lanes are worth something because filling all three
    // completes the group. If `bmpr_inc_lights` held four lights the lanes could never finish it, and
    // the bumpers would never rise — silently, for ever.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);
    const group = built.lightGroups.get(REENTRY_LANES.lightGroup)!;
    const members = built.membersOf(group);

    expect(members).toHaveLength(REENTRY_LANES.lanes.length);
    for (const lane of REENTRY_LANES.lanes) {
      expect(members).toContain(built.lights.get(lane.light));
    }
  });

  test('the bumper group it raises is the one the archive says', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);

    expect(built.bumperGroups.get(REENTRY_LANES.bumperGroup)).toContain(REENTRY_LANES.guardBumper);
  });

  test('its completion line is a resource the game can actually show', () => {
    expect(RESOURCE_KEYS[REENTRY_LANES.completeTextId]).toBeTruthy();
  });
});

describe('⚠️ and the file says how much is NOT transcribed', () => {
  test('the bound and the unbound together are every control in the score table', () => {
    // Written rather than computed, so adding a binding means deleting a line and a reader can see the
    // size of what is left without running anything. A list that drifted from the score table would be
    // a map of a country that no longer exists.
    // ⚠️ AND THE ARITHMETIC FOUND TWO I HAD MISFILED. `BumperControl` and `RebounderControl` reach for
    // nothing — they read the caller's own level and pay from the caller's own array — so they are not
    // "unbound", they need no binding. Putting them in the not-done list would have overstated what is
    // left by two and misdescribed both.
    const bound = new Set(BUMPER_LANE_BINDINGS.map((b) => b.control));
    const all = new Set(SCORE_COMPONENTS.map((r) => r.controlName));

    for (const name of bound) expect(all.has(name), name).toBe(true);
    for (const name of UNBOUND_CONTROLS) expect(all.has(name), name).toBe(true);
    for (const name of SELF_CONTAINED_CONTROLS) expect(all.has(name), name).toBe(true);

    expect(bound.size + UNBOUND_CONTROLS.length + SELF_CONTAINED_CONTROLS.length).toBe(all.size);
  });

  test('and one chain is bound, which is where this stands today', () => {
    expect(BUMPER_LANE_BINDINGS).toHaveLength(1);
  });
});
