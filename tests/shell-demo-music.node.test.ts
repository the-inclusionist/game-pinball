// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createDemo } from '../app/js/shell/demo.js';
import { MUSIC_LOOKAHEAD, MUSIC_WINDOW } from '../app/js/shell/demo.js';
import { findSoundLinks, strandingRisks } from '../app/js/audio/sound-links.js';
import { readGroups } from '../app/js/dat/partman.js';
import { resource, RESOURCES } from './helpers/original-data.js';

/**
 * ⚠️ THE SYNTHESIZER WAS WRITTEN AND IMPORTED BY NOTHING.
 *
 * The same shape as every other finding in this port: a module transcribed, tested, and reachable from
 * no runtime. Wiring it needs a MIDI file, and the only one that exists is Microsoft's — so the
 * demonstration asks for it exactly as it asks for the archive. No licensing act, no bytes in the
 * build, and a player who already owns the game already has the file.
 */

const DAT = resource('PINBALL.DAT');
const MID = resource('PINBALL.MID');
const bytesOf = (path: string): ArrayBuffer | null => {
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

describe('the demonstration can be given music too', () => {
  test('it starts with none, because a table without a MIDI file is still a table', () => {
    const dat = bytesOf(DAT);
    if (!dat) return expect(existsSync(DAT)).toBe(false);

    expect(createDemo(dat).music).toBeNull();
  });

  test('⚠️ and a real file becomes a schedule of thousands of notes', () => {
    // `PINBALL.MID` is 14 139 notes over 528 seconds. The number is the point: it is what forced the
    // player's look-ahead window, because handing them all to the audio thread at once stops the page.
    const dat = bytesOf(DAT);
    const mid = bytesOf(MID);
    if (!dat || !mid) return expect(existsSync(DAT) && existsSync(MID)).toBe(false);

    const demo = createDemo(dat);
    demo.loadMusic(mid);

    expect(demo.music!.notes.length).toBeGreaterThan(1000);
    expect(demo.music!.length).toBeGreaterThan(60);
  });

  test('⚠️ a file that is not standard MIDI is refused rather than half-played', () => {
    // `PINBALL2.MID` is the other format the original ships, and `isStandardMidi` says so. A parser
    // that guessed would produce a schedule of noise from a file it did not understand.
    const dat = bytesOf(DAT);
    const notMidi = bytesOf(resource('PINBALL2.MID'));
    if (!dat || !notMidi) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(dat);

    expect(demo.loadMusic(notMidi)).toBe(false);
    expect(demo.music).toBeNull();
  });

  test('⚠️ the look-ahead is longer than the window, or a gap opens every time it tops up', () => {
    // The window is how much is scheduled at once; the look-ahead is how far ahead of the playhead the
    // scheduling runs. If the second is not larger than the first, the audio thread reaches the end of
    // what it has before the next slice arrives — a click every few seconds that sounds like the file.
    expect(MUSIC_LOOKAHEAD).toBeGreaterThan(MUSIC_WINDOW);
  });
});

/**
 * ⚠️ AND SOUNDS, WHICH ARE SIXTY FILES INSTEAD OF ONE.
 *
 * Every noise a component makes is an index into the archive's own groups, and that group's String
 * field is a WAV's file name. The files are Microsoft's like everything else, so the demonstration asks
 * for them the way it asks for the table and the music — and a player who owns the game owns them.
 */
describe('the demonstration can be given the real sounds', () => {
  test('it publishes the file each sound index wants, by name', () => {
    const dat = bytesOf(DAT);
    if (!dat) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(dat);

    expect(demo.soundFiles.size, 'the shipped table declares this many').toBeGreaterThan(30);
    // ⚠️ KEYED BY GROUP INDEX, which is what a component's record carries — not by a position in the
    // list of sounds. `soundwave7`'s record says 56, and there is no forty-eighth sound to be had.
    for (const [groupIndex, fileName] of demo.soundFiles) {
      expect(groupIndex).toBeGreaterThan(0);
      expect(fileName).toMatch(/\.wav$/i);
    }
  });

  test('⚠️ and the sentinel that is not a file is not among them', () => {
    // The first group the archive marks as a sound is named `...`, which is not a file name and never
    // could be: it is the null slot, spelled. A loader that tried to open every declared sound would
    // report it as a failure for ever.
    const dat = bytesOf(DAT);
    if (!dat) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(dat);

    expect([...demo.soundFiles.values()]).not.toContain('...');
  });

  test('⚠️ SIX OF THE FORTY-SEVEN ARE NOT ON THIS MACHINE, and none of them is a timer', () => {
    // The archive names forty-seven WAVs and this copy of the game has forty-one of them: `sound2`,
    // `sound37`, `sound44`, `sound52`, `sound59` and `sound62` are declared and absent. That is a fact
    // about the copy, not a defect in the port — the original answers a missing file with a duration
    // of MINUS ONE and plays nothing.
    //
    // ⚠️ AND MINUS ONE MEANS NEVER. Seven components hand their sound's DURATION straight to a kickout
    // timer, so a missing file among THOSE holds the ball for the rest of the game while a missing
    // file anywhere else only makes the table quieter. `stranding` is the list that would matter, and
    // it is the one that has to be empty.
    const dat = bytesOf(DAT);
    if (!dat) return expect(existsSync(DAT)).toBe(false);
    const here = RESOURCES;
    if (!existsSync(`${here}SOUND1.WAV`)) return expect(existsSync(`${here}SOUND1.WAV`)).toBe(false);

    const demo = createDemo(dat);
    const missing = [...demo.soundFiles.values()]
      .filter((name) => !existsSync(here + name) && !existsSync(here + name.toUpperCase()));
    const groups = readGroups(new Uint8Array(dat));
    const report = strandingRisks(
      findSoundLinks(groups),
      (group) => demo.soundFiles.get(group) ?? null,
      missing,
    );

    expect(missing.length, 'this copy is short of six').toBe(6);
    expect(report.stranding, 'and not one of them holds a ball').toEqual([]);
    expect(report.silent.length, 'they only make it quieter').toBeGreaterThan(0);
  });
});

/**
 * ⚠️ AND A MISSING SOUND CAN HOLD A BALL FOR EVER.
 *
 * `loader::load_sound` stores MINUS ONE for a file it cannot open, and minus one is this game's
 * "never" — the same value that switches a timer off. Seven components hand their sound's DURATION
 * straight to a kickout's release timer, so a missing file among THOSE is not a quieter table, it is a
 * ball that never comes back. The player has to be told which case they are in.
 */
describe('which missing sounds matter', () => {
  test('a table given every file strands nothing', () => {
    const dat = bytesOf(DAT);
    if (!dat) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(dat);

    const report = demo.soundReport([...demo.soundFiles.values()]);

    expect(report.stranding).toEqual([]);
    expect(report.silent).toEqual([]);
  });

  test('⚠️ a table given NONE of them says which seven would hold a ball', () => {
    const dat = bytesOf(DAT);
    if (!dat) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(dat);

    const report = demo.soundReport([]);

    expect(report.silent.length, 'everything with a sound goes quiet').toBeGreaterThan(20);
    expect(report.stranding.length, 'and these are the ones that stick').toBeGreaterThan(0);
    expect(report.stranding).toContain('soundwave7');
  });

  test('⚠️ and the six this machine lacks are all in the harmless list', () => {
    const dat = bytesOf(DAT);
    if (!dat) return expect(existsSync(DAT)).toBe(false);
    const here = RESOURCES;
    if (!existsSync(`${here}SOUND1.WAV`)) return expect(existsSync(`${here}SOUND1.WAV`)).toBe(false);
    const demo = createDemo(dat);
    const present = [...demo.soundFiles.values()]
      .filter((name) => existsSync(here + name) || existsSync(here + name.toUpperCase()));

    const report = demo.soundReport(present);

    expect(report.silent.length, 'some components go quiet').toBeGreaterThan(0);
    expect(report.stranding, 'and not one of them holds a ball').toEqual([]);
  });
});
