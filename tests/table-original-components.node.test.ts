// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { buildOriginalComponents, visualStatesOf } from '../app/js/table/original-components.js';
import { readGroups, type Group } from '../app/js/dat/partman.js';
import { loadTable } from '../app/js/dat/loader.js';

/**
 * ⚠️ THE FORTY `T*` PORTS, REACHED FROM THE ARCHIVE FOR THE FIRST TIME.
 *
 * `table/bumper` and `table/light` have been transcribed and tested since phase 4 and built from nothing
 * but fixtures. `dat/visual` was the blocker: a bumper needs an elasticity, a threshold and a boost, and
 * until something could read those from the file the components could only be invented.
 *
 * This builds the two that change what a player sees — the seven bumpers, which carry their own LEVEL
 * and therefore their own price, and the hundred and forty lights.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const archive = (): Group[] | null => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};
const manifest = (): ReturnType<typeof loadTable> | null => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

describe('how many states a group has', () => {
  test('⚠️ it is the second short of a `[100, n]` pair, and 1 when there is none', () => {
    // `a_bump1` opens with `100 8`: eight states, which is four LEVELS because the frames come in
    // pairs — `2 * level` idle and `2 * level + 1` lit. Reading eight as the level count would make a
    // bumper worth its top price after four hits instead of eight.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const bumper = groups.findIndex((g) => g.name === 'a_bump1');

    expect(visualStatesOf(groups, bumper)).toBe(8);
    expect(visualStatesOf(groups, 99999)).toBe(1);
  });
});

describe('the components, from the manifest', () => {
  test('seven bumpers and a hundred and forty lights, which is what the table declares', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);

    expect(built.bumpers.size).toBe(7);
    expect(built.lights.size).toBe(140);
  });

  test('⚠️ every bumper has a threshold it can actually cross', () => {
    // `default_vsi`'s 9e10 means "never fires". A bumper built without `dat/visual` would look correct
    // in every way and never once respond to a ball.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);

    // ⚠️ ASKED OF THE BUMPER, NOT OF A NUMBER I STORED BESIDE IT. My first version compared
    // `thresholdOf(name)`, which reports what this module recorded — so a mutation that passed the
    // 9e10 default to `createBumper` and left the record correct survived it untouched. The only
    // question that cannot be answered by bookkeeping is whether the thing RESPONDS.
    for (const [name, bumper] of built.bumpers) {
      expect(bumper.level, name).toBe(0);
      expect(built.thresholdOf(name), name).toBeLessThan(100);

      built.fire(name);
      expect(bumper.lit, `${name} did not answer a ball`).toBe(true);
      built.advance(1);
    }
  });

  test('⚠️ a bumper does NOT raise itself when struck, which I had wrong', () => {
    // My first version asserted that hitting a bumper works it up, and it failed. `BumperControl` reads
    // `BmpIndex` and scores; nothing in it advances the level, and neither does `TBumper::Collision`.
    // The LANES do it — a bumper lane sends `TBumperIncBmpIndex` to the bumper GROUP, which forwards it
    // to every bumper in the group.
    //
    // So working the bumpers up and cashing them in are two different acts, and a port that let a
    // bumper promote itself would have collapsed them and made the lanes pointless.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);
    const [name, bumper] = [...built.bumpers][0]!;

    built.fire(name);
    built.advance(1);

    expect(bumper.level).toBe(0);
  });

  test('⚠️ but a LANE raises it, and that is where its price comes from', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);
    const [name, bumper] = [...built.bumpers][0]!;

    built.raise(name);

    expect(bumper.level).toBe(1);
  });

  test('⚠️ and the level clamps at the frames the archive gave it, in PAIRS', () => {
    // `a_bump1` declares eight states, and the frames are `2 * level` idle and `2 * level + 1` lit — so
    // eight states is FOUR levels. Clamping on the frame instead of the pair would let a bumper reach
    // level seven and index a score array that has four entries, which `getScoring` answers with zero.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);
    const [name, bumper] = [...built.bumpers][0]!;

    for (let i = 0; i < 20; i++) built.raise(name);

    expect(bumper.level).toBeLessThanOrEqual(3);
    expect(bumper.level).toBeGreaterThan(0);
  });

  test('⚠️ the lights start dark, because a table that opens lit has already been played', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);

    expect([...built.lights.values()].filter((l) => l.on)).toEqual([]);
  });

  test('and one can be turned on by the name the control layer uses', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);
    const light = built.lights.get('lite8');

    expect(light).toBeDefined();
    light!.turnOn();
    expect(light!.on).toBe(true);
  });
});

describe('⚠️ the light GROUPS, which are what the lanes actually watch', () => {
  test('eighteen of them, which is what the manifest declares', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    expect(buildOriginalComponents(table).lightGroups.size).toBe(18);
  });

  test('⚠️ each one holds the lights record 1027 names, and they are the SAME objects', () => {
    // A group whose members were fresh copies would count its own lights on while the table's stayed
    // dark — and `BumperLaneControl` asks the group "are all of you on yet". Identity is the whole
    // mechanism, and a shallow copy would fail nothing that looks at counts.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);
    const [, group] = [...built.lightGroups].find(([, g]) => g.lightCount > 1)!;
    const before = group.onCount;

    // Turn on one of the table's own lights and ask the group.
    const member = [...built.lights.values()].find((l) => built.membersOf(group).includes(l))!;
    member.turnOn();

    expect(group.onCount).toBe(before + 1);
  });

  test('the group the bumper lanes watch is there, by the name the control layer uses', () => {
    // `bmpr_inc_lights` is what `BumperLaneControl` asks "are all of you on". It is a `simple_component`
    // whose tag is its own name — see `SIMPLE_TAGS`.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    expect(buildOriginalComponents(table).lightGroups.get('bmpr_inc_lights')).toBeDefined();
  });

  test('⚠️ and its period comes from record 903, not from a number here', () => {
    // `Timer1TimeDefault` is what every timed command falls back to. Inventing it changes how long
    // every animation in the table runs.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);

    expect(built.periodOf('bmpr_inc_lights')).toBeGreaterThan(0);
  });
});

describe('⚠️ the bumper GROUPS, which are what a lane raises', () => {
  test('two of them, holding four bumpers and three', () => {
    // `attack_bumpers` is a_bump1 to a_bump4 and `launch_bumpers` is a_bump5 to a_bump7. Their group
    // names are not the control layer's names — `attack_bump` is the variable, `attack_bumpers` is the
    // archive — which is the same tag mechanism `score-table` carries.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);

    expect(built.bumperGroups.get('attack_bumpers')).toHaveLength(4);
    expect(built.bumperGroups.get('launch_bumpers')).toHaveLength(3);
  });

  test('⚠️ raising the group raises EVERY bumper in it, not one', () => {
    // The message goes to the group. Raising a single bumper would leave three of them cheaper than
    // the table intends, and the score would be quietly wrong rather than visibly broken.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const built = buildOriginalComponents(table);
    built.raiseGroup('attack_bumpers');

    for (const name of built.bumperGroups.get('attack_bumpers')!) {
      expect(built.bumpers.get(name)!.level, name).toBe(1);
    }
    // And the other group is untouched.
    for (const name of built.bumperGroups.get('launch_bumpers')!) {
      expect(built.bumpers.get(name)!.level, name).toBe(0);
    }
  });
});
