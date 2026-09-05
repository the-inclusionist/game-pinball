// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readMidiFile, isStandardMidi, tempoOf, durationOf } from '../app/js/audio/midi.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RESOURCES = join(ROOT, 'game_resources');
const MUSIC = join(RESOURCES, 'PINBALL.MID');
const NOT_MUSIC = join(RESOURCES, 'PINBALL2.MID');
const hasData = existsSync(MUSIC);

/** Builds a one-track file from raw track bytes. */
function midi(trackBytes: readonly number[], division = 480): Uint8Array {
  const head = [
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (division >> 8) & 0xff, division & 0xff,
    0x4d, 0x54, 0x72, 0x6b,
    (trackBytes.length >>> 24) & 0xff, (trackBytes.length >>> 16) & 0xff,
    (trackBytes.length >>> 8) & 0xff, trackBytes.length & 0xff,
  ];
  return new Uint8Array([...head, ...trackBytes]);
}

const END_OF_TRACK = [0x00, 0xff, 0x2f, 0x00];

describe('what a MIDI file says about itself', () => {
  test('the header carries the format, the track count and the division', () => {
    const file = readMidiFile(midi(END_OF_TRACK, 96))!;

    expect(file.header).toEqual({ format: 0, trackCount: 1, division: 96 });
  });

  test('anything that is not a MIDI file is null, not an exception', () => {
    expect(isStandardMidi(new Uint8Array([2, 0, 15, 0]))).toBe(false);
    expect(readMidiFile(new Uint8Array([2, 0, 15, 0]))).toBeNull();
    expect(readMidiFile(new Uint8Array(0))).toBeNull();
  });

  test('a longer header is skipped, as the spec allows', () => {
    const bytes = midi(END_OF_TRACK);
    bytes[7] = 8; // header size 8 instead of 6
    const padded = new Uint8Array([...bytes.subarray(0, 14), 0, 0, ...bytes.subarray(14)]);

    expect(readMidiFile(padded)!.tracks).toHaveLength(1);
  });

  test('an unknown chunk is SKIPPED, not read as a track', () => {
    // Asserting the count alone would not catch a reader that treats the junk as the track and then
    // stops, having filled its quota: the answer is still one track, and it is the wrong one.
    const file = midi([0x00, 0x90, 0x3c, 0x64, ...END_OF_TRACK]);
    const junk = new Uint8Array([0x58, 0x59, 0x5a, 0x5a, 0, 0, 0, 2, 9, 9]);
    const withJunk = new Uint8Array([...file.subarray(0, 14), ...junk, ...file.subarray(14)]);

    const tracks = readMidiFile(withJunk)!.tracks;

    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.filter((e) => e.kind === 'note')).toHaveLength(1);
  });
});

describe('⚠️ running status, the trap in every MIDI parser', () => {
  test('an event that omits its status byte reuses the previous one', () => {
    // Two note-ons, the second written WITHOUT its status byte. A parser that does not carry the
    // status reads `0x40` as one and loses sync for the rest of the track — silently.
    const track = [
      0x00, 0x90, 0x3c, 0x64, // note on, C, velocity 100
      0x10, 0x40, 0x64, //       running status: note on, E, velocity 100
      ...END_OF_TRACK,
    ];

    const events = readMidiFile(midi(track))!.tracks[0]!;

    expect(events.filter((e) => e.kind === 'note')).toEqual([
      { kind: 'note', tick: 0, on: true, channel: 0, note: 0x3c, velocity: 100 },
      { kind: 'note', tick: 16, on: true, channel: 0, note: 0x40, velocity: 100 },
    ]);
  });

  test('a META event does NOT become the running status', () => {
    // The specific way this goes wrong in a real file: a text or tempo event between two notes.
    const track = [
      0x00, 0x90, 0x3c, 0x64,
      0x00, 0xff, 0x01, 0x02, 0x68, 0x69, // meta text "hi"
      0x10, 0x40, 0x64, //                   still note on, not meta
      ...END_OF_TRACK,
    ];

    const events = readMidiFile(midi(track))!.tracks[0]!;

    expect(events.filter((e) => e.kind === 'note')).toHaveLength(2);
    expect(events.filter((e) => e.kind === 'meta')).toHaveLength(2);
  });

  test('a program change carries ONE data byte, not two', () => {
    // Getting this wrong swallows the next event's delta time and every tick after it is wrong.
    const track = [
      0x00, 0xc0, 0x30, //       program change
      0x20, 0x90, 0x3c, 0x64, // note on at tick 32
      ...END_OF_TRACK,
    ];

    const events = readMidiFile(midi(track))!.tracks[0]!;

    expect(events.find((e) => e.kind === 'note')?.tick).toBe(32);
  });

  test('a note-on with velocity zero IS a note-off', () => {
    // Every MIDI file in existence relies on this, because it lets a whole passage run on running
    // status without ever sending a note-off status byte.
    const track = [0x00, 0x90, 0x3c, 0x64, 0x10, 0x3c, 0x00, ...END_OF_TRACK];

    const notes = readMidiFile(midi(track))!.tracks[0]!.filter((e) => e.kind === 'note');

    expect(notes.map((n) => (n as { on: boolean }).on)).toEqual([true, false]);
  });

  test('a variable-length delta of more than one byte is read whole', () => {
    // 0x81 0x00 is 128, not 1 and then 0.
    const track = [0x81, 0x00, 0x90, 0x3c, 0x64, ...END_OF_TRACK];

    expect(readMidiFile(midi(track))!.tracks[0]![0]!.tick).toBe(128);
  });

  test('a system-exclusive event is read by its length and skipped', () => {
    const track = [
      0x00, 0xf0, 0x03, 0x01, 0x02, 0x03,
      0x10, 0x90, 0x3c, 0x64,
      ...END_OF_TRACK,
    ];

    const events = readMidiFile(midi(track))!.tracks[0]!;

    expect(events.filter((e) => e.kind === 'sysex')).toHaveLength(1);
    expect(events.find((e) => e.kind === 'note')?.tick).toBe(16);
  });

  test('end of track stops the reading', () => {
    const track = [...END_OF_TRACK, 0x00, 0x90, 0x3c, 0x64];

    expect(readMidiFile(midi(track))!.tracks[0]!.filter((e) => e.kind === 'note')).toEqual([]);
  });
});

describe('tempo and length', () => {
  test('the first tempo in the file wins', () => {
    const track = [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, ...END_OF_TRACK];

    expect(tempoOf(readMidiFile(midi(track))!)).toBe(500000);
  });

  test('with no tempo at all it is the MIDI default of 120 bpm', () => {
    expect(tempoOf(readMidiFile(midi(END_OF_TRACK))!)).toBe(500000);
  });

  test('the length is ticks over division, times the tempo', () => {
    // One quarter note at 480 ticks and 500000 microseconds is half a second.
    const track = [0x00, 0x90, 0x3c, 0x64, 0x83, 0x60, 0x3c, 0x00, ...END_OF_TRACK];

    expect(durationOf(readMidiFile(midi(track, 480))!)).toBeCloseTo(0.5, 3);
  });
});

describe.skipIf(!hasData)('conformance — the real music, and the file that is not music', () => {
  test('PINBALL.MID is a format 1 file with five tracks at 480 ticks', () => {
    const file = readMidiFile(new Uint8Array(readFileSync(MUSIC)))!;

    expect(file.header).toEqual({ format: 1, trackCount: 5, division: 480 });
    expect(file.tracks).toHaveLength(5);
  });

  test('it has notes, a tempo and a sane length', () => {
    const file = readMidiFile(new Uint8Array(readFileSync(MUSIC)))!;
    const notes = file.tracks.flat().filter((e) => e.kind === 'note');

    expect(notes.length).toBeGreaterThan(500);
    expect(tempoOf(file)).toBeGreaterThan(0);
    expect(durationOf(file)).toBeGreaterThan(10);
    expect(durationOf(file)).toBeLessThan(600);
  });

  test('every track ends with an end-of-track meta event', () => {
    // The cheapest proof that the parser never lost sync: a track read wrongly does not end where the
    // file says it ends.
    const file = readMidiFile(new Uint8Array(readFileSync(MUSIC)))!;

    for (const track of file.tracks) {
      const last = track.at(-1)!;
      expect(last.kind === 'meta' && last.type === 0x2f).toBe(true);
    }
  });

  test('⚠️ PINBALL2.MID IS NOT MUSIC — it is a bitmap font', () => {
    // The upstream says so in a comment and the bytes agree: no `MThd`, no `RIFF`, no `MIDS`. The
    // plan claimed this game has two MIDIs; it has one. A file named `.MID` that is a font is what a
    // port finds by opening files instead of trusting extensions.
    const bytes = new Uint8Array(readFileSync(NOT_MUSIC));

    expect(isStandardMidi(bytes)).toBe(false);
    expect(readMidiFile(bytes)).toBeNull();
  });
});
