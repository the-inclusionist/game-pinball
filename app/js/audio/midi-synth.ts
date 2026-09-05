// SPDX-License-Identifier: AGPL-3.0-or-later
// audio/midi-synth — playing a MIDI file without a SoundFont.
//
// ========================= THE PLAN CALLED THIS A RISK, AND IT WAS RIGHT ABOUT WHY =========================
// In its own words: the alula fork embeds a General MIDI SoundFont of about 3 MB inside its wasm, and
// 3 MB argues with a PWA's precache budget on a school machine. It also said the project might end
// without music and that I would say so rather than pretend.
//
// It does not have to end that way. A MIDI file is a few kilobytes of instructions and oscillators are
// already in the browser — `audio/web-audio` has been rendering the table's effects with them since the
// effects were written. What a SoundFont buys is orchestral timbre; what it costs is three megabytes.
//
// ⚠️ AND FOR CHIPTUNE THAT IS NOT A COMPROMISE. Square and triangle waves ARE the instrument, so
// nothing is being approximated and nothing sounds like a cheaper version of something else. The Dev
// chose chiptune, and the choice is what makes the synthesizer honest rather than thrifty.
//
// ========================= THE ARITHMETIC IS SEPARATE FROM THE SOUND =========================
// `scheduleMidi` decides when each note sounds, for how long, at what pitch and how loudly, and touches
// no Web Audio at all. That is the half worth testing: a speaker cannot be asserted against, and every
// way this can be wrong — the tempo, the tuning, a note that never stops — is arithmetic.

import { tempoOf, type MidiFile } from './midi.js';

/** A above middle C. The one number the whole scale is measured from. */
export const MIDDLE_A = 440;
/** The MIDI note number of that A. */
export const MIDDLE_A_NOTE = 69;
/** General MIDI's percussion channel, counted from zero. */
export const DRUM_CHANNEL = 9;

/**
 * ⚠️ A NOTE THAT IS NEVER TURNED OFF STILL ENDS. Missing note-offs are common in real files, and an
 * oscillator with no stop time plays for ever — the rest of the piece would be heard through a drone
 * that never lifts. Two seconds is long enough to be musical and short enough not to become the piece.
 */
export const DANGLING_NOTE_SECONDS = 2;

/** Peak gain of one voice. Low because a chord is several at once and the mixer allows many. */
export const NOTE_GAIN = 0.09;

export interface ScheduledNote {
  /** Seconds from the start of the piece. */
  readonly at: number;
  readonly duration: number;
  readonly frequency: number;
  /** 0 to 1, from the velocity. */
  readonly gain: number;
  readonly channel: number;
}

/**
 * Equal temperament: twelve semitones to an octave, and an octave is a doubling.
 *
 * Getting the base wrong gives a scale that is subtly out of tune everywhere and obviously wrong
 * nowhere, which is the hardest kind of musical bug to hear and the easiest to test.
 */
export function frequencyOf(note: number): number {
  return MIDDLE_A * 2 ** ((note - MIDDLE_A_NOTE) / 12);
}

export interface ChiptuneVoice {
  readonly wave: OscillatorType | 'noise';
  /** Multiplies the note's gain, so a bass line does not drown a melody. */
  readonly level: number;
}

/**
 * ⚠️ CHANNEL TEN IS PERCUSSION, and a drum played as a pitched square is the single most obvious way a
 * naive synthesizer announces itself. Everything else gets one of four waves by channel, which is the
 * chiptune convention: a handful of voices, told apart by timbre rather than by sample.
 */
const WAVES: readonly ChiptuneVoice[] = [
  { wave: 'square', level: 1 },
  { wave: 'triangle', level: 0.9 },
  { wave: 'sawtooth', level: 0.7 },
  { wave: 'sine', level: 0.8 },
];

export function voiceForChannel(channel: number): ChiptuneVoice {
  if (channel === DRUM_CHANNEL) return { wave: 'noise', level: 0.5 };
  return WAVES[channel % WAVES.length]!;
}

/** Every note in the file, in seconds. Tracks of format 1 play together, so they are merged. */
export function scheduleMidi(file: MidiFile): ScheduledNote[] {
  // ⚠️ TICKS ARE NOT TIME. 480 ticks is a quarter note and a quarter note is half a second at 120 beats
  // a minute, so the tempo has to come from the file or every piece plays at the wrong speed.
  const microsecondsPerBeat = tempoOf(file);
  const ticksPerBeat = file.header.division > 0 ? file.header.division : 480;
  const secondsPerTick = microsecondsPerBeat / 1e6 / ticksPerBeat;

  const notes: ScheduledNote[] = [];

  for (const track of file.tracks) {
    // Sounding notes, keyed by channel and note so two channels can hold the same pitch at once.
    const sounding = new Map<string, { tick: number; velocity: number }>();

    for (const event of track) {
      if (event.kind !== 'note') continue;
      const key = `${event.channel}:${event.note}`;

      // ⚠️ A NOTE-ON WITH VELOCITY ZERO IS A NOTE OFF. The specification allows both and running-status
      // files use this form because it is cheaper. Treating it as an on starts a voice nothing stops.
      const isOn = event.on && event.velocity > 0;

      if (isOn) {
        // A repeat on the same key retunes rather than stacking: the first is ended where the second
        // begins, which is what a monophonic channel does anyway.
        const already = sounding.get(key);
        if (already) push(already, event.tick, event.channel, event.note);
        sounding.set(key, { tick: event.tick, velocity: event.velocity });
        continue;
      }

      const started = sounding.get(key);
      if (!started) continue;
      sounding.delete(key);
      push(started, event.tick, event.channel, event.note);
    }

    // Whatever is still held when the track ends.
    for (const [key, started] of sounding) {
      const [channel, note] = key.split(':').map(Number);
      push(started, started.tick + DANGLING_NOTE_SECONDS / secondsPerTick, channel!, note!);
    }

    function push(
      started: { tick: number; velocity: number }, endTick: number, channel: number, note: number,
    ): void {
      const duration = Math.max(0, (endTick - started.tick) * secondsPerTick);
      if (duration === 0) return;
      notes.push({
        at: started.tick * secondsPerTick,
        duration,
        frequency: frequencyOf(note),
        gain: (started.velocity / 127) * NOTE_GAIN * voiceForChannel(channel).level,
        channel,
      });
    }
  }

  return notes.sort((a, b) => a.at - b.at);
}

/** How long the whole schedule lasts, so a caller can loop it. */
export function scheduleLength(notes: readonly ScheduledNote[]): number {
  return notes.reduce((end, note) => Math.max(end, note.at + note.duration), 0);
}
