// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { ROLE_OF_KIND, roleOfComponent } from '../app/js/table/original-roles.js';
import { COMPONENT_KINDS, kindOf } from '../app/js/i18n/names.js';
import { readGroups } from '../app/js/dat/partman.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ THIS TABLE IS A DECISION AND THESE TESTS DO NOT DEFEND IT.
 *
 * Whether a bumper is a `goal` or a `key` cannot be proved by anything in the archive: it is a choice
 * about how the 1995 table is described to a blind player, and the Dev makes it. What is checked here
 * is the shape of the choice — that it covers every kind, that it never guesses, and that it reaches
 * the components the archive actually has — so that changing a line changes a description and nothing
 * else quietly breaks.
 */

const DAT = resource('PINBALL.DAT');

describe('the role of each kind of 1995 component', () => {
  test('⚠️ every kind has one, because a default would describe silently', () => {
    // `COMPONENT_KINDS` is the list `kindOf` reads the archive's names into. A kind missing from the
    // map would fall to `undefined` and be spoken as whatever the caller does with that.
    for (const kind of COMPONENT_KINDS) {
      expect(ROLE_OF_KIND[kind], `${kind} has a role`).toBeTruthy();
    }
    expect(Object.keys(ROLE_OF_KIND).sort()).toEqual([...COMPONENT_KINDS].sort());
  });

  test('⚠️ and a name the archive does not explain gets NULL, not furniture', () => {
    // Most of this table's geometry is anonymous — the archive names its components and not its walls
    // — and `kindOf` answers null for those. A component that cannot be placed must be left out of the
    // declaration rather than described as a wall: the declaration is what a player is told, and a
    // guess in it is a lie with a confident voice.
    expect(roleOfComponent('group-57', kindOf)).toBeNull();
    expect(roleOfComponent('font1', kindOf)).toBeNull();
    expect(roleOfComponent('a_bump1', kindOf)).toBe('goal');
  });

  test('⚠️ the drain is the only HAZARD, which is the one role that means "this ends something"', () => {
    const hazards = Object.entries(ROLE_OF_KIND)
      .filter(([, role]) => role === 'hazard')
      .map(([kind]) => kind);

    expect(hazards).toEqual(['drain']);
  });

  test('and the archive’s own named components resolve, or say plainly that they do not', () => {
    // The measurement rather than the hope: how much of the 1995 table this map can describe at all.
    // Every named group that `kindOf` recognises gets a role; the rest are the table's furniture and
    // its data, and they are counted so the number is visible when it changes.
    if (!existsSync(DAT)) return expect(existsSync(DAT)).toBe(false);
    const buf = readFileSync(DAT);
    const groups = readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));

    const named = groups.map((g) => g.name).filter((n): n is string => Boolean(n));
    const placed = named.filter((name) => roleOfComponent(name, kindOf) !== null);

    expect(named.length).toBe(291);
    // Two hundred and thirty of the two hundred and ninety-one named groups are components this can
    // describe. The rest are lamps' groups, sounds, fonts, the palette and the table's own metadata.
    expect(placed.length).toBeGreaterThan(200);
    expect(placed.length).toBeLessThan(named.length);
  });
});
