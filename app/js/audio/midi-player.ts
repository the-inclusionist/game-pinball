// SPDX-License-Identifier: AGPL-3.0-or-later
// audio/midi-player — a schedule, played.
//
// ========================= THE THIN HALF, ON PURPOSE =========================
// `audio/midi-synth` decides when every note sounds and at what pitch, and touches no Web Audio at all;
// this puts those notes on oscillators. The split is the same one `shell/hud-view` and `shell/hud-dom`
// take, and for the same reason: the arithmetic is what can be wrong, and a speaker cannot be asserted
// against.
//
// ⚠️ EVERY NOTE IS SCHEDULED IN ADVANCE, NOT POLLED. Web Audio has its own clock and its own thread;
// asking `setTimeout` to start notes gives a piece that stutters whenever the page is busy — and a
// pinball's frame loop is busy by definition. `start(at)` and `stop(at)` hand the whole piece to the
// audio thread and the game never touches it again.
//
// ⚠️ AND PERCUSSION IS NOISE, NOT A PITCH. Channel ten in General MIDI is drums, and playing a drum as
// a square wave at the note's frequency is the single most obvious way a naive synthesizer announces
// itself. Noise needs a buffer rather than an oscillator, which is the only place these two paths
// differ.

import { voiceForChannel, scheduleLength, type ScheduledNote } from './midi-synth.js';

/** How long the noise buffer is. One second, reused for every drum, cropped by the note's own stop. */
export const NOISE_SECONDS = 1;

export interface PlayingMusic {
  /** Seconds of music scheduled. Zero when the file had no notes. */
  readonly length: number;
  /** How many voices were handed to the audio thread. */
  readonly voices: number;
  stop(): void;
}

/** White noise, made once and shared. A fresh buffer per drum hit would allocate on every beat. */
function noiseBuffer(context: BaseAudioContext): AudioBuffer {
  const frames = Math.floor(context.sampleRate * NOISE_SECONDS);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) samples[i] = Math.random() * 2 - 1;
  return buffer;
}

export interface PlayOptions {
  /** Where the piece starts on the audio clock. Defaults to now. */
  readonly startAt?: number;
  /** Everything is routed through this, so one call can stop or duck the music. */
  readonly destination?: AudioNode;
  /**
   * ⚠️ A WINDOW, BECAUSE THE REAL FILE HAS FOURTEEN THOUSAND NOTES.
   *
   * `PINBALL.MID` is 14 139 notes over 528 seconds. Handing all of them to the audio thread at once
   * builds fourteen thousand oscillators and fourteen thousand gains before a single note sounds —
   * which is not a stutter, it is a page that stops. I wrote the naive version first and the file said
   * so.
   *
   * So a caller schedules a SLICE and tops it up: `from` and `until` are seconds within the piece, and
   * everything outside them is skipped. The timing stays sample-accurate because each note still gets
   * its own `start(at)` on the audio clock — the look-ahead only decides WHEN THE SCHEDULING happens,
   * never when the sound does, which is the distinction a `setTimeout`-driven player loses.
   */
  readonly from?: number;
  readonly until?: number;
}

export function playSchedule(
  context: AudioContext, notes: readonly ScheduledNote[], o: PlayOptions = {},
): PlayingMusic {
  const master = context.createGain();
  master.gain.value = 1;
  master.connect(o.destination ?? context.destination);

  const begins = o.startAt ?? context.currentTime;
  let noise: AudioBuffer | null = null;
  let voices = 0;

  const from = o.from ?? 0;
  const until = o.until ?? Number.POSITIVE_INFINITY;

  for (const note of notes) {
    // Inclusive of `from`, exclusive of `until`, so consecutive windows neither drop a note nor play
    // one twice — an off-by-one here is a note missing every few seconds, which sounds like a bad file.
    if (note.at < from || note.at >= until) continue;
    const voice = voiceForChannel(note.channel);
    const at = begins + note.at;
    const ends = at + note.duration;

    const gain = context.createGain();
    gain.gain.setValueAtTime(note.gain, at);
    // ⚠️ NEVER TO ZERO: `exponentialRampToValueAtTime` refuses it. And a tone stopped at full amplitude
    // clicks, which over a whole piece is a percussion track nobody wrote.
    gain.gain.exponentialRampToValueAtTime(0.0001, ends);
    gain.connect(master);

    if (voice.wave === 'noise') {
      noise ??= noiseBuffer(context);
      const source = context.createBufferSource();
      source.buffer = noise;
      // A drum's pitch is its filter, not its rate — but rate is what a buffer source has, so a higher
      // note is a shorter, brighter hit. Cheap, and it keeps a drum line legible.
      source.playbackRate.value = Math.min(4, Math.max(0.25, note.frequency / 220));
      source.connect(gain);
      source.start(at);
      source.stop(ends);
    } else {
      const oscillator = context.createOscillator();
      oscillator.type = voice.wave;
      oscillator.frequency.setValueAtTime(note.frequency, at);
      oscillator.connect(gain);
      oscillator.start(at);
      // ⚠️ AN OSCILLATOR LEFT RUNNING NEVER STOPS. The same rule `audio/web-audio` learned: Web Audio
      // has no natural end, and a piece of two thousand notes would end as two thousand held tones.
      oscillator.stop(ends);
    }
    voices++;
  }

  return {
    length: scheduleLength(notes),
    voices,
    stop() {
      // Silencing the master is enough: every voice already has a stop time, so nothing outlives it.
      master.gain.setValueAtTime(0, context.currentTime);
      master.disconnect();
    },
  };
}
