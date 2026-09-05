// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createWebAudioOutput } from '../app/js/audio/web-audio.js';
import { VOICES } from '../app/js/audio/voices.js';

/**
 * ⚠️ THE HOST HALF OF THE MIXER, WHICH IS WHERE A SOUND ACTUALLY BECOMES A SOUND.
 *
 * `sfx` hands out channels and returns durations; `output(voice)` is the only place anything is heard.
 * A fake context is used here because the assertions are about the GRAPH — which nodes, connected how,
 * scheduled when — and none of those need a speaker to be true.
 */

function fakeContext() {
  const built: Record<string, unknown>[] = [];
  const stopped: number[] = [];
  const node = (kind: string, extra: Record<string, unknown> = {}) => {
    const n = {
      kind,
      connectedTo: null as unknown,
      connect(target: unknown) { n.connectedTo = target; return target; },
      disconnect() {},
      ...extra,
    };
    built.push(n as unknown as Record<string, unknown>);
    return n;
  };
  const param = () => {
    const calls: string[] = [];
    return {
      calls,
      value: 0,
      setValueAtTime(v: number, t: number) { calls.push(`set ${v} @${t}`); },
      linearRampToValueAtTime(v: number, t: number) { calls.push(`lin ${v} @${t}`); },
      exponentialRampToValueAtTime(v: number, t: number) { calls.push(`exp ${v} @${t}`); },
    };
  };

  const ctx = {
    currentTime: 0,
    destination: { kind: 'destination' },
    state: 'running',
    createOscillator: () => node('oscillator', {
      type: 'sine', frequency: param(),
      start(t: number) { (this as { started?: number }).started = t; },
      stop(t: number) { stopped.push(t); },
    }),
    createGain: () => node('gain', { gain: param() }),
    createStereoPanner: () => node('panner', { pan: param() }),
    resume: () => Promise.resolve(),
  };
  return { ctx, built, stopped };
}

const voice = (name: string, over: Record<string, unknown> = {}) =>
  ({ channel: 0, name, startedAt: 0, angle: 0, distance: 0, ...over });

describe('a voice becomes a graph', () => {
  test('an oscillator, a gain and a panner, in that order, to the destination', () => {
    const { ctx, built } = fakeContext();

    createWebAudioOutput(ctx as never)(voice('bumper') as never);

    expect(built.map((n) => n.kind)).toEqual(['oscillator', 'gain', 'panner']);
    expect(built[2]!.connectedTo).toBe(ctx.destination);
  });

  test('the pitch slides from the voice’s start to its end', () => {
    const { ctx, built } = fakeContext();

    createWebAudioOutput(ctx as never)(voice('ramp') as never);

    const frequency = (built[0] as { frequency: { calls: string[] } }).frequency;
    expect(frequency.calls.join(' ')).toContain(`${VOICES.ramp!.frequency}`);
    expect(frequency.calls.join(' ')).toContain(`${VOICES.ramp!.endFrequency}`);
  });

  test('⚠️ and it STOPS, because an oscillator left running never stops', () => {
    // A Web Audio oscillator plays for ever unless told otherwise. Forty bumper hits would be forty
    // permanent tones, and the table would end as a chord.
    const { ctx, stopped } = fakeContext();

    createWebAudioOutput(ctx as never)(voice('bumper') as never);

    expect(stopped).toHaveLength(1);
    expect(stopped[0]).toBeCloseTo(VOICES.bumper!.duration, 6);
  });

  test('⚠️ the gain fades to silence rather than cutting', () => {
    // A tone stopped at full amplitude clicks, and forty clicks a ball is worse than no sound.
    const { ctx, built } = fakeContext();

    createWebAudioOutput(ctx as never)(voice('target') as never);

    expect((built[1] as { gain: { calls: string[] } }).gain.calls.join(' ')).toContain('exp');
  });

  test('a name with no voice builds nothing at all', () => {
    // `sfx` will not send one, but a silent kind reaching here must not throw or leave a node behind.
    const { ctx, built } = fakeContext();

    createWebAudioOutput(ctx as never)(voice('no-such-voice') as never);

    expect(built).toEqual([]);
  });

  test('the sound is placed by the angle the mixer computed', () => {
    // `sfx.placeSound` already did the geometry. Recomputing it here would be a second opinion about
    // the same thing, and the two would drift.
    const { ctx, built } = fakeContext();

    createWebAudioOutput(ctx as never)(voice('bumper', { angle: 90 }) as never);

    expect((built[2] as { pan: { calls: string[] } }).pan.calls.join(' ')).not.toBe('');
  });
});
