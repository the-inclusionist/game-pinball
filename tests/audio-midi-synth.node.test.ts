// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  scheduleMidi, frequencyOf, voiceForChannel, MIDDLE_A, DRUM_CHANNEL,
} from '../app/js/audio/midi-synth.js';
import type { MidiFile } from '../app/js/audio/midi.js';

/**
 * ⚠️ A SYNTHESIZER, BECAUSE THE ALTERNATIVE WAS THREE MEGABYTES.
 *
 * The plan named this as a risk in its own words: the alula fork embeds a General MIDI SoundFont of
 * about 3 MB inside its wasm, and 3 MB argues with a PWA's precache budget on a school machine. It also
 * said the project might end without music and that I would say so rather than pretend.
 *
 * It does not have to. A MIDI file is a few kilobytes of instructions, and oscillators are already in
 * the browser — `audio/web-audio` has been rendering the table's effects with them since the effects
 * were written. For CHIPTUNE that is not a compromise but the correct timbre: square and triangle waves
 * ARE the instrument, so nothing is being approximated.
 *
 * This module decides WHEN each note sounds and at what pitch. It touches no Web Audio, because the
 * arithmetic is the part worth testing and a speaker cannot be asserted against.
 */

/** Two notes on one channel, an octave apart, the second starting when the first ends. */
const twoNotes: MidiFile = {
  header: { format: 0, trackCount: 1, division: 480 },
  tracks: [[
    { kind: 'note', tick: 0, on: true, channel: 0, note: 69, velocity: 100 },
    { kind: 'note', tick: 480, on: false, channel: 0, note: 69, velocity: 0 },
    { kind: 'note', tick: 480, on: true, channel: 0, note: 81, velocity: 100 },
    { kind: 'note', tick: 960, on: false, channel: 0, note: 81, velocity: 0 },
  ]],
};

describe('what a note number means', () => {
  test('note 69 is A above middle C, at 440 hertz', () => {
    expect(frequencyOf(69)).toBeCloseTo(MIDDLE_A, 6);
  });

  test('and twelve semitones up is exactly double', () => {
    // The whole of equal temperament in one assertion. Getting the exponent's base wrong gives a scale
    // that is subtly out of tune everywhere and obviously wrong nowhere.
    expect(frequencyOf(81)).toBeCloseTo(MIDDLE_A * 2, 6);
    expect(frequencyOf(57)).toBeCloseTo(MIDDLE_A / 2, 6);
  });
});

describe('turning a file into a schedule', () => {
  test('every note becomes one entry with a start and a length', () => {
    const notes = scheduleMidi(twoNotes);

    expect(notes).toHaveLength(2);
    expect(notes[0]!.at).toBe(0);
    expect(notes[0]!.duration).toBeGreaterThan(0);
  });

  test('⚠️ the second note starts when the first ends, in SECONDS', () => {
    // Ticks are not time. 480 ticks is a quarter note, and a quarter note is only half a second at 120
    // beats a minute — the tempo has to come from the file or every piece plays at the wrong speed.
    const notes = scheduleMidi(twoNotes);

    expect(notes[1]!.at).toBeCloseTo(notes[0]!.at + notes[0]!.duration, 6);
    expect(notes[0]!.duration).toBeCloseTo(0.5, 3);
  });

  test('⚠️ a note that is never turned off still ends', () => {
    // A missing note-off is common in real files, and an oscillator with no stop time plays for ever.
    // The rest of the piece would then be heard through a drone that never lifts.
    const dangling: MidiFile = {
      header: { format: 0, trackCount: 1, division: 480 },
      tracks: [[{ kind: 'note', tick: 0, on: true, channel: 0, note: 60, velocity: 90 }]],
    };

    const notes = scheduleMidi(dangling);

    expect(notes).toHaveLength(1);
    expect(notes[0]!.duration).toBeGreaterThan(0);
    expect(Number.isFinite(notes[0]!.duration)).toBe(true);
  });

  test('⚠️ and a note-on with velocity zero is a note OFF, which is how half the files say it', () => {
    // The MIDI specification allows both, and running-status files use the velocity-zero form because
    // it is cheaper. Treating it as a note-on starts a voice nothing ever stops.
    const zeroVelocity: MidiFile = {
      header: { format: 0, trackCount: 1, division: 480 },
      tracks: [[
        { kind: 'note', tick: 0, on: true, channel: 0, note: 60, velocity: 90 },
        { kind: 'note', tick: 240, on: true, channel: 0, note: 60, velocity: 0 },
      ]],
    };

    const notes = scheduleMidi(zeroVelocity);

    expect(notes).toHaveLength(1);
    expect(notes[0]!.duration).toBeCloseTo(0.25, 3);
  });

  test('the loudness follows the velocity, because a flat piece is not a piece', () => {
    const loud = scheduleMidi(twoNotes)[0]!;
    const quiet = scheduleMidi({
      ...twoNotes,
      tracks: [twoNotes.tracks[0]!.map((e) => (e.kind === 'note' && e.on ? { ...e, velocity: 20 } : e))],
    })[0]!;

    expect(loud.gain).toBeGreaterThan(quiet.gain);
  });

  test('and tracks played together do not overwrite each other', () => {
    const two: MidiFile = {
      header: { format: 1, trackCount: 2, division: 480 },
      tracks: [twoNotes.tracks[0]!, twoNotes.tracks[0]!.map((e) => (
        e.kind === 'note' ? { ...e, channel: 1 } : e))],
    };

    expect(scheduleMidi(two)).toHaveLength(4);
  });
});

describe('⚠️ the voices are chiptune, and that is the point rather than a compromise', () => {
  test('a channel gets a wave, and channel ten gets noise', () => {
    // Channel 10 is percussion in General MIDI, and a drum played as a pitched square is the single
    // most obvious way a naive synthesizer announces itself.
    expect(voiceForChannel(0).wave).not.toBe('noise');
    expect(voiceForChannel(DRUM_CHANNEL).wave).toBe('noise');
  });

  test('and different channels do not all sound the same', () => {
    const waves = new Set([0, 1, 2, 3].map((c) => voiceForChannel(c).wave));

    expect(waves.size).toBeGreaterThan(1);
  });
});
