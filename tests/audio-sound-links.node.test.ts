// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  findSoundLinks, strandingRisks, TIMER_SOUND_COMPONENTS, NULL_SOUND_INDEX,
  SOUND_RECORD, SOFT_HIT_RECORD, KICKER_HIT_RECORD,
} from '../app/js/audio/sound-links.js';
import { findSoundGroups, buildSoundTable } from '../app/js/audio/sound-table.js';
import { readGroups, EntryType, type Group } from '../app/js/dat/partman.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RESOURCES = join(ROOT, 'game_resources');
const DAT_PATH = join(RESOURCES, 'PINBALL.DAT');
const hasData = existsSync(DAT_PATH);

/** A group carrying `[record, value]` pairs in its Int16 array. */
function withRecords(name: string, pairs: readonly (readonly [number, number])[]): Group {
  const data = new Uint8Array(pairs.length * 4);
  const view = new DataView(data.buffer);
  pairs.forEach(([record, value], i) => {
    view.setInt16(i * 4, record, true);
    view.setInt16(i * 4 + 2, value, true);
  });
  return { name, entries: [{ type: EntryType.Int16s, data }] };
}

describe('a component points at a sound group', () => {
  test('record 1100 is the link', () => {
    const groups = [withRecords('soundwave7', [[SOUND_RECORD, 42]])];

    expect(findSoundLinks(groups)).toEqual([
      { component: 'soundwave7', soundGroup: 42, record: SOUND_RECORD },
    ]);
  });

  test('the soft hit and the kicker hit point at sounds too', () => {
    // Read here so that "which files does this table need" has one answer instead of four.
    const groups = [withRecords('bump1', [[SOFT_HIT_RECORD, 7], [KICKER_HIT_RECORD, 9]])];

    expect(findSoundLinks(groups).map((l) => l.soundGroup)).toEqual([7, 9]);
  });

  test('records that are not about sound are ignored', () => {
    const groups = [withRecords('wall1', [[602, 3], [1500, 0], [SOUND_RECORD, 11]])];

    expect(findSoundLinks(groups).map((l) => l.soundGroup)).toEqual([11]);
  });

  test('a group with no name contributes nothing, even carrying a sound record', () => {
    // Written with a REAL record on purpose: a nameless group full of zeroes would be skipped by the
    // record filter anyway, and would not tell the name guard apart from nothing at all.
    const nameless: Group = { ...withRecords('x', [[SOUND_RECORD, 42]]), name: null };
    const empty: Group = { name: 'thing', entries: [] };

    expect(findSoundLinks([nameless, empty])).toEqual([]);
  });

  test('a record is found wherever it sits, not only at even positions', () => {
    // The archive's records are variable length — `1500` advances the cursor by seven — so a sound
    // record can land at any offset. A scan that stepped record-by-record instead of position-by-
    // position would read past it, and the shipped table happens to be aligned so nothing would say
    // so.
    const data = new Uint8Array(10);
    const view = new DataView(data.buffer);
    view.setInt16(0, 1500, true);
    view.setInt16(2, 9, true);
    view.setInt16(4, 7, true);
    view.setInt16(6, SOUND_RECORD, true);
    view.setInt16(8, 33, true);

    const links = findSoundLinks([{ name: 'oddly', entries: [{ type: EntryType.Int16s, data }] }]);

    expect(links.map((l) => l.soundGroup)).toEqual([33]);
  });

  test('sound index zero can never be played', () => {
    // `get_sound_id` starts its search at 1 and `play_sound` rejects `<= 0`. The first declared sound
    // is a null slot that nothing can reach.
    expect(NULL_SOUND_INDEX).toBe(0);
  });
});

describe('⚠️ a missing file is silence, unless it is a TIMER', () => {
  const links = [
    { component: 'soundwave7', soundGroup: 1, record: SOUND_RECORD },
    { component: 'soundwave26', soundGroup: 2, record: SOUND_RECORD },
  ];
  const fileOf = (g: number) => (g === 1 ? 'sound7.wav' : 'sound26.wav');

  test('an ordinary sound going missing only makes the game quieter', () => {
    const report = strandingRisks(links, fileOf, ['sound26.wav']);

    expect(report.silent).toEqual(['soundwave26']);
    expect(report.stranding).toEqual([]);
  });

  test('but a TIMER sound going missing holds a ball forever', () => {
    // The gravity well's kickout timer is that sound's own length, and a missing file carries -1,
    // which is this game's "never".
    const report = strandingRisks(links, fileOf, ['sound7.wav']);

    expect(report.stranding).toEqual(['soundwave7']);
  });

  test('nothing missing means nothing to report', () => {
    expect(strandingRisks(links, fileOf, [])).toEqual({ silent: [], stranding: [] });
  });

  test('a component named twice is reported once', () => {
    const twice = [...links, { component: 'soundwave7', soundGroup: 1, record: SOFT_HIT_RECORD }];

    expect(strandingRisks(twice, fileOf, ['sound7.wav']).silent).toEqual(['soundwave7']);
  });

  test('the match ignores case, because the archive and the disk disagree about it', () => {
    // The archive spells them lower case and the extraction produced upper case.
    expect(strandingRisks(links, fileOf, ['SOUND7.WAV']).stranding).toEqual(['soundwave7']);
  });

  test('a link pointing at a group with no file at all is not a crash', () => {
    expect(strandingRisks(links, () => null, ['sound7.wav']).silent).toEqual([]);
  });

  test('the timer list names the seven the control layer actually times', () => {
    expect(TIMER_SOUND_COMPONENTS).toHaveLength(7);
    expect(TIMER_SOUND_COMPONENTS).toContain('soundwave7');
    expect(TIMER_SOUND_COMPONENTS).toContain('soundwave41');
  });
});

describe.skipIf(!hasData)('conformance — the real table against the real files', () => {
  const groups = hasData ? readGroups(new Uint8Array(readFileSync(DAT_PATH))) : [];
  const files = hasData ? new Set(readdirSync(RESOURCES)) : new Set<string>();
  const read = (name: string) => {
    for (const candidate of [name, name.toUpperCase(), name.toLowerCase()]) {
      if (files.has(candidate)) return new Uint8Array(readFileSync(join(RESOURCES, candidate)));
    }
    return null;
  };

  test('the first declared sound is the null slot, and it is spelled `...`', () => {
    // Which is why the loader reports it as unloadable forever, and why that is not a defect.
    expect(findSoundGroups(groups)[NULL_SOUND_INDEX]!.fileName).toBe('...');
  });

  test('FORTY-ONE components are wired to a sound, not just the sound-wave ones', () => {
    // The surprise here: only thirty of them are named `soundwave*`. Ordinary pieces of the table —
    // the plunger, the table itself — carry their own sound record, so "which files does this table
    // need" cannot be answered by looking at names.
    const wired = findSoundLinks(groups).filter((l) => l.record === SOUND_RECORD);

    expect(wired).toHaveLength(41);
    expect(wired.filter((l) => l.component.startsWith('soundwave'))).toHaveLength(30);
  });

  test('SIX components are silent with this extraction', () => {
    const soundGroups = findSoundGroups(groups);
    const fileOf = (g: number) => soundGroups.find((s) => s.groupIndex === g)?.fileName ?? null;
    const { missing } = buildSoundTable(groups, read);

    const report = strandingRisks(findSoundLinks(groups), fileOf, missing);

    expect([...report.silent].sort())
      .toEqual(['plunger', 'soundwave37', 'soundwave44', 'soundwave52', 'soundwave59', 'table']);
  });

  test('⚠️ AND NONE OF THEM IS A TIMER, so no ball is stranded', () => {
    // The question this module exists to answer, asked of the real data rather than assumed. It comes
    // out clean — but by which files happen to be missing, not by design. If a future extraction loses
    // `sound7.wav` instead, this test is what says so before a player finds out.
    const soundGroups = findSoundGroups(groups);
    const fileOf = (g: number) => soundGroups.find((s) => s.groupIndex === g)?.fileName ?? null;
    const { missing } = buildSoundTable(groups, read);

    const report = strandingRisks(findSoundLinks(groups), fileOf, missing);

    expect(report.stranding).toEqual([]);
  });

  test('every timer sound is present and has a real duration', () => {
    const soundGroups = findSoundGroups(groups);
    const byComponent = new Map(findSoundLinks(groups)
      .filter((l) => l.record === SOUND_RECORD)
      .map((l) => [l.component, soundGroups.find((s) => s.groupIndex === l.soundGroup)?.fileName]));
    const { sounds } = buildSoundTable(groups, read);
    const durationOfFile = new Map(sounds.map((s) => [s.name, s.duration]));

    for (const component of TIMER_SOUND_COMPONENTS) {
      const file = byComponent.get(component);
      expect(file, component).toBeDefined();
      expect(durationOfFile.get(file!), `${component} -> ${file}`).toBeGreaterThan(0);
    }
  });
});
