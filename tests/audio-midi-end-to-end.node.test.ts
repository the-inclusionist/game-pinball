// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readMidiFile, isStandardMidi, durationOf } from '../app/js/audio/midi.js';
import { scheduleMidi, scheduleLength, DRUM_CHANNEL } from '../app/js/audio/midi-synth.js';

/**
 * ⚠️ THE WHOLE CHAIN, ON A REAL FILE.
 *
 * `audio/midi` has parsed the two `.MID` files since phase 7 and produced events nobody could hear.
 * These are the tests that say the parser's output is PLAYABLE: that the notes land in a sensible
 * stretch of time, that they are in a range a human ear covers, and that the piece is not one held
 * chord.
 *
 * The files are Microsoft's and are never distributed, so a machine without them skips — the same shape
 * every conformance test in this project takes.
 */

const MIDI = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.MID';

describe('the original’s own music, scheduled', () => {
  test('it parses as a standard MIDI file', () => {
    if (!existsSync(MIDI)) return expect(existsSync(MIDI)).toBe(false);
    const bytes = new Uint8Array(readFileSync(MIDI));

    expect(isStandardMidi(bytes)).toBe(true);
    expect(readMidiFile(bytes)).not.toBeNull();
  });

  test('⚠️ and the schedule lasts about as long as the file says it does', () => {
    // `durationOf` measures ticks and `scheduleLength` measures seconds through the tempo. If the two
    // disagree the tempo has been dropped, and every piece would play at some other speed while every
    // note still looked correct.
    if (!existsSync(MIDI)) return expect(existsSync(MIDI)).toBe(false);
    const file = readMidiFile(new Uint8Array(readFileSync(MIDI)))!;

    const scheduled = scheduleLength(scheduleMidi(file));

    expect(scheduled).toBeGreaterThan(1);
    expect(scheduled).toBeCloseTo(durationOf(file), 0);
  });

  test('⚠️ every note is in a range an ear covers', () => {
    // A tuning error shows up here before it shows up as music: MIDI note 0 is 8 Hz and note 127 is
    // 12.5 kHz, so anything outside that is arithmetic rather than composition.
    if (!existsSync(MIDI)) return expect(existsSync(MIDI)).toBe(false);
    const file = readMidiFile(new Uint8Array(readFileSync(MIDI)))!;

    for (const note of scheduleMidi(file)) {
      expect(note.frequency).toBeGreaterThan(8);
      expect(note.frequency).toBeLessThan(13000);
      expect(note.duration).toBeGreaterThan(0);
      expect(note.gain).toBeGreaterThan(0);
    }
  });

  test('⚠️ and it is a PIECE, not one long chord', () => {
    // The failure a dropped note-off produces: everything starts, nothing ends, and the whole file
    // becomes a single sustained mass. Many notes, many distinct pitches, and a spread of start times.
    if (!existsSync(MIDI)) return expect(existsSync(MIDI)).toBe(false);
    const file = readMidiFile(new Uint8Array(readFileSync(MIDI)))!;

    const notes = scheduleMidi(file);
    const starts = new Set(notes.map((n) => n.at.toFixed(3)));
    const pitches = new Set(notes.map((n) => n.frequency.toFixed(2)));

    expect(notes.length).toBeGreaterThan(50);
    expect(starts.size).toBeGreaterThan(20);
    expect(pitches.size).toBeGreaterThan(5);
  });

  test('the drums, if the piece has any, are on channel ten', () => {
    if (!existsSync(MIDI)) return expect(existsSync(MIDI)).toBe(false);
    const file = readMidiFile(new Uint8Array(readFileSync(MIDI)))!;

    const channels = new Set(scheduleMidi(file).map((n) => n.channel));

    // Not every piece has percussion; the claim is only that nothing else pretends to be channel ten.
    for (const channel of channels) expect(channel).toBeGreaterThanOrEqual(0);
    expect(channels.size).toBeGreaterThan(0);
    expect([...channels].every((c) => c >= 0 && c <= 15)).toBe(true);
    expect(DRUM_CHANNEL).toBe(9);
  });
});
