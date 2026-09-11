// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  BUMPER_LANE_BINDINGS, CONTROL_REACHES, SELF_CONTAINED_CONTROLS,
} from '../app/js/control/bindings.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';
import { RESOURCE_KEYS } from '../app/js/i18n/keys.js';
import { buildOriginalComponents } from '../app/js/table/original-components.js';
import { loadTable } from '../app/js/dat/loader.js';
import { readGroups } from '../app/js/dat/partman.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ DATA TRAPPED IN CODE.
 *
 * `score-table` says which control each component runs and `control/lanes` says what the controls do.
 * Neither says WHICH light, which group, which bumper — in the original that is not in a table at all,
 * it is named globals inside the function bodies. Getting it out is a transcription of its own, and it
 * is the last thing between this port and a 1995 table that plays rather than one that is shown.
 */

const DAT = resource('PINBALL.DAT');
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

describe('⚠️ every control is accounted for, one way or the other', () => {
  test('each one either reaches named components or is measured as reaching none', () => {
    // Written from the upstream rather than assumed: each function body was read and asked which tagged
    // globals it mentions. Nine reach nothing — `BumperControl` pays from the caller's own array,
    // `JackpotLightControl` clears a flag on the table, `ShootAgainLightControl` messages only the
    // caller — and that is not the same as lacking a binding. I first wrote two, and calling the other
    // seven "not done yet" overstated the remaining work by that much.
    const all = new Set(SCORE_COMPONENTS.map((r) => r.controlName));

    for (const name of all) {
      const reaches = CONTROL_REACHES[name];
      const free = SELF_CONTAINED_CONTROLS.includes(name);
      expect(Boolean(reaches) !== free, name).toBe(true);
    }
  });

  test('and nothing in either list is a control the table does not use', () => {
    const all = new Set(SCORE_COMPONENTS.map((r) => r.controlName));

    for (const name of Object.keys(CONTROL_REACHES)) expect(all.has(name), name).toBe(true);
    for (const name of SELF_CONTAINED_CONTROLS) expect(all.has(name), name).toBe(true);
  });

  test('⚠️ and EVERY name it reaches for is really a group in PINBALL.DAT', () => {
    // The claim that makes a transcription worth anything. Two hundred and eighty-eight references,
    // and one typo among them would read perfectly in the source and address nothing at run time.
    if (!existsSync(DAT)) return expect(existsSync(DAT)).toBe(false);
    const buf = readFileSync(DAT);
    const groups = readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    const names = new Set(groups.map((g) => g.name).filter(Boolean));

    const absent: string[] = [];
    for (const [control, reaches] of Object.entries(CONTROL_REACHES)) {
      for (const name of reaches) if (!names.has(name)) absent.push(`${control} -> ${name}`);
    }

    expect(absent).toEqual([]);
  });

  test('two lane chains carry ROLES as well as names, which the flat table cannot', () => {
    // `SpaceWarpRolloverControl` reaches lite27 and lite28 and the function itself says which is which.
    // A lane chain has to say which lane lights which lamp, so those keep a richer type rather than
    // being folded in — flattening them would have lost the mapping.
    expect(BUMPER_LANE_BINDINGS).toHaveLength(2);
    for (const binding of BUMPER_LANE_BINDINGS) {
      expect(CONTROL_REACHES[binding.control]).toBeDefined();
    }
  });
});
