// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createDemo } from '../app/js/shell/demo.js';
import { MUSIC_LOOKAHEAD, MUSIC_WINDOW } from '../app/js/shell/demo.js';

/**
 * ⚠️ THE SYNTHESIZER WAS WRITTEN AND IMPORTED BY NOTHING.
 *
 * The same shape as every other finding in this port: a module transcribed, tested, and reachable from
 * no runtime. Wiring it needs a MIDI file, and the only one that exists is Microsoft's — so the
 * demonstration asks for it exactly as it asks for the archive. No licensing act, no bytes in the
 * build, and a player who already owns the game already has the file.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const MID = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.MID';
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
    const notMidi = bytesOf('C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL2.MID');
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
