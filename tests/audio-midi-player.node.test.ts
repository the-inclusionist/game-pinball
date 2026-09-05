// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { playSchedule, NOISE_SECONDS } from '../app/js/audio/midi-player.js';
import { DRUM_CHANNEL, type ScheduledNote } from '../app/js/audio/midi-synth.js';

/**
 * The thin half. A fake context, because the assertions are about the GRAPH — which nodes, scheduled
 * when — and none of those need a speaker to be true.
 */
function fakeContext() {
  const started: { kind: string; at: number; stop: number }[] = [];
  const buffers: number[] = [];
  const param = () => ({ calls: [] as string[], value: 0,
    setValueAtTime(v: number, t: number) { this.calls.push(`set ${v} @${t}`); },
    exponentialRampToValueAtTime(v: number, t: number) { this.calls.push(`exp ${v} @${t}`); } });
  const node = (kind: string, extra: Record<string, unknown> = {}) => ({
    kind, connect() {}, disconnect() {}, ...extra,
  });

  const context = {
    currentTime: 10,
    sampleRate: 48000,
    destination: node('destination'),
    createGain: () => node('gain', { gain: param() }),
    createOscillator: () => {
      const n = node('oscillator', { type: 'sine', frequency: param(),
        start(t: number) { (n as unknown as { at?: number }).at = t; },
        stop(t: number) { started.push({ kind: 'oscillator', at: (n as unknown as { at: number }).at, stop: t }); } });
      return n;
    },
    createBufferSource: () => {
      const n = node('buffer', { buffer: null, playbackRate: { value: 1 },
        start(t: number) { (n as unknown as { at?: number }).at = t; },
        stop(t: number) { started.push({ kind: 'buffer', at: (n as unknown as { at: number }).at, stop: t }); } });
      return n;
    },
    createBuffer: (_c: number, frames: number) => {
      buffers.push(frames);
      return { getChannelData: () => new Float32Array(frames) };
    },
  };
  return { context, started, buffers };
}

const note = (over: Partial<ScheduledNote> = {}): ScheduledNote =>
  ({ at: 0, duration: 0.5, frequency: 440, gain: 0.05, channel: 0, ...over });

describe('a schedule becomes voices', () => {
  test('one voice per note, and it says how many', () => {
    const { context, started } = fakeContext();

    const playing = playSchedule(context as never, [note(), note({ at: 1 })]);

    expect(playing.voices).toBe(2);
    expect(started).toHaveLength(2);
  });

  test('⚠️ every note is scheduled AHEAD, on the audio clock, not started by a timer', () => {
    // Web Audio has its own clock and its own thread. Starting notes with `setTimeout` gives a piece
    // that stutters whenever the page is busy — and a pinball's frame loop is busy by definition.
    const { context, started } = fakeContext();

    playSchedule(context as never, [note({ at: 2, duration: 0.25 })]);

    expect(started[0]!.at).toBe(context.currentTime + 2);
    expect(started[0]!.stop).toBeCloseTo(context.currentTime + 2.25, 6);
  });

  test('⚠️ and every voice STOPS, because an oscillator left running never does', () => {
    // The same rule `audio/web-audio` learned for the table's effects. A piece of two thousand notes
    // would otherwise end as two thousand held tones.
    const { context, started } = fakeContext();

    playSchedule(context as never, [note(), note({ at: 1 }), note({ at: 2 })]);

    for (const voice of started) expect(voice.stop).toBeGreaterThan(voice.at);
  });

  test('⚠️ percussion is NOISE, not a pitch', () => {
    // Channel ten is drums in General MIDI. A drum played as a square wave at the note's frequency is
    // the single most obvious way a naive synthesizer announces itself.
    const { context, started } = fakeContext();

    playSchedule(context as never, [note({ channel: DRUM_CHANNEL })]);

    expect(started[0]!.kind).toBe('buffer');
  });

  test('and the noise buffer is made ONCE, however many drums there are', () => {
    // A fresh buffer per hit allocates a second of samples on every beat.
    const { context, buffers } = fakeContext();

    playSchedule(context as never, [
      note({ channel: DRUM_CHANNEL }), note({ channel: DRUM_CHANNEL, at: 1 }),
      note({ channel: DRUM_CHANNEL, at: 2 }),
    ]);

    expect(buffers).toHaveLength(1);
    expect(buffers[0]).toBe(context.sampleRate * NOISE_SECONDS);
  });

  test('a schedule with no notes plays nothing and says so', () => {
    const { context } = fakeContext();

    const playing = playSchedule(context as never, []);

    expect(playing.voices).toBe(0);
    expect(playing.length).toBe(0);
  });

  test('stopping is safe on a piece that has already ended', () => {
    const { context } = fakeContext();

    const playing = playSchedule(context as never, [note()]);

    expect(() => { playing.stop(); playing.stop(); }).not.toThrow();
  });
});

describe('⚠️ the window, because the real file has fourteen thousand notes', () => {
  test('only the notes inside it are scheduled', () => {
    // `PINBALL.MID` is 14 139 notes over 528 seconds. Handing all of them to the audio thread at once
    // builds fourteen thousand oscillators before a single note sounds — not a stutter, a page that
    // stops. I wrote the naive version first and the file said so.
    const { context } = fakeContext();

    const playing = playSchedule(
      context as never,
      [note({ at: 0 }), note({ at: 1 }), note({ at: 2 }), note({ at: 3 })],
      { from: 1, until: 3 },
    );

    expect(playing.voices).toBe(2);
  });

  test('⚠️ and the window is half-open, so consecutive slices neither drop nor repeat a note', () => {
    // An off-by-one here is a note missing every few seconds, which sounds like a bad file rather than
    // a bad player.
    const { context } = fakeContext();
    const notes = [note({ at: 0 }), note({ at: 1 }), note({ at: 2 })];

    const first = playSchedule(context as never, notes, { from: 0, until: 1 });
    const second = playSchedule(context as never, notes, { from: 1, until: 2 });
    const third = playSchedule(context as never, notes, { from: 2, until: 3 });

    expect(first.voices + second.voices + third.voices).toBe(notes.length);
  });

  test('and without a window everything is scheduled, which is right for a short piece', () => {
    const { context } = fakeContext();

    expect(playSchedule(context as never, [note(), note({ at: 9 })]).voices).toBe(2);
  });

  test('⚠️ the timing stays on the AUDIO clock even inside a window', () => {
    // The look-ahead decides when the scheduling happens, never when the sound does. A player that
    // used `setTimeout` to start the notes themselves would lose that, and a pinball's frame loop is
    // busy by definition.
    const { context, started } = fakeContext();

    playSchedule(context as never, [note({ at: 5, duration: 0.5 })], { from: 4, until: 6 });

    expect(started[0]!.at).toBe(context.currentTime + 5);
  });
});
