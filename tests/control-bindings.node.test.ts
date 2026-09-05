// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  BUMPER_LANE_BINDINGS, UNBOUND_CONTROLS, SELF_CONTAINED_CONTROLS,
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

describe.each(BUMPER_LANE_BINDINGS.map((b) => [b.control, b] as const))('%s, transcribed', (_name, BINDING) => {
  test('⚠️ every name in it is an ARCHIVE name, because that is what a collision reports', () => {
    // `control.cpp` calls them `roll3` and `attack_bump`; the file calls them `a_roll3` and
    // `attack_bumpers`. Transcribing the variable names would produce a binding that reads correctly
    // and matches nothing.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);
    const names = new Set(table.groups.map((g) => g.name).filter(Boolean));

    for (const lane of BINDING.lanes) {
      expect(names.has(lane.component), lane.component).toBe(true);
      expect(built.lights.has(lane.light), lane.light).toBe(true);
    }
    expect(built.lightGroups.has(BINDING.lightGroup)).toBe(true);
    expect(built.bumperGroups.has(BINDING.bumperGroup)).toBe(true);
    expect(built.bumpers.has(BINDING.guardBumper)).toBe(true);
  });

  test('⚠️ and the light group really holds exactly the lanes’ lights', () => {
    // The claim that makes the mechanic true: the lanes are worth something because filling all three
    // completes the group. If `bmpr_inc_lights` held four lights the lanes could never finish it, and
    // the bumpers would never rise — silently, for ever.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);
    const group = built.lightGroups.get(BINDING.lightGroup)!;
    const members = built.membersOf(group);

    expect(members).toHaveLength(BINDING.lanes.length);
    for (const lane of BINDING.lanes) {
      expect(members).toContain(built.lights.get(lane.light));
    }
  });

  test('the bumper group it raises is the one the archive says', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);

    expect(built.bumperGroups.get(BINDING.bumperGroup)).toContain(BINDING.guardBumper);
  });

  test('its completion line is a resource the game can actually show', () => {
    expect(RESOURCE_KEYS[BINDING.completeTextId]).toBeTruthy();
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

  test('two chains are bound, which is where this stands today', () => {
    // ⚠️ THE COUNT IS THE POINT. Every test above runs over the whole list, so transcribing a third
    // chain costs nothing but the transcription — and this line is what makes growing the list a thing
    // somebody decides rather than something that drifts.
    expect(BUMPER_LANE_BINDINGS).toHaveLength(2);
  });
});
