// SPDX-License-Identifier: AGPL-3.0-or-later
// audio/web-audio — where a voice actually becomes a sound.
//
// ========================= THE HOST HALF OF THE MIXER =========================
// `audio/sfx` allocates channels, steals the oldest voice when they run out, places the sound and
// returns its duration. `output(voice)` is the only place any of that is heard, and it belonged to
// nobody — which is why phase 7 was complete, tested against the real archive, and silent.
//
// The graph is three nodes: an oscillator that slides between two pitches, a gain that fades it out,
// and a panner that puts it where the mixer said. Small on purpose — `audio/voices` holds the taste,
// this holds the wiring, and a real sound bank later replaces the first without touching the second.
//
// ⚠️ AN OSCILLATOR LEFT RUNNING NEVER STOPS. Web Audio has no natural end: forty bumper hits would be
// forty permanent tones and the table would finish as a chord. Every voice is stopped explicitly.
//
// ⚠️ AND IT FADES RATHER THAN CUTTING. A tone stopped at full amplitude clicks, and forty clicks a ball
// is worse than no sound at all.
//
// ⚠️ THE PLACEMENT COMES FROM THE MIXER, NOT FROM HERE. `sfx.placeSound` already did the geometry, and
// recomputing it would be a second opinion about the same thing that the two would eventually disagree
// on.

import { VOICES } from './voices.js';
import type { Voice } from './sfx.js';

/** Peak amplitude of one voice. Low because several may overlap and the mixer allows eight. */
export const VOICE_GAIN = 0.18;

/** How far the mixer's 0..255 distance may pull a sound down. */
export const DISTANCE_ATTENUATION = 0.6;

export function createWebAudioOutput(context: AudioContext): (voice: Voice) => void {
  return (voice) => {
    const spec = VOICES[voice.name];
    // A name with no voice builds nothing. `sfx` will not send one, but a silent kind reaching here
    // must not throw and must not leave a node behind.
    if (!spec) return;

    const now = context.currentTime;
    const end = now + spec.duration;

    const oscillator = context.createOscillator();
    oscillator.type = spec.wave;
    oscillator.frequency.setValueAtTime(spec.frequency, now);
    if (spec.endFrequency !== spec.frequency) {
      oscillator.frequency.linearRampToValueAtTime(spec.endFrequency, end);
    }

    const gain = context.createGain();
    // Nearer is louder. The mixer's distance is 0 (near) to 255 (far).
    const near = 1 - (voice.distance / 255) * DISTANCE_ATTENUATION;
    gain.gain.setValueAtTime(VOICE_GAIN * near, now);
    // Exponential, because loudness is heard that way and a linear fade still ends with a step.
    // Never to zero: `exponentialRampToValueAtTime` refuses it.
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    const panner = context.createStereoPanner();
    // The mixer's angle is degrees clockwise from north, so due east is a full right pan.
    panner.pan.setValueAtTime(Math.sin((voice.angle * Math.PI) / 180), now);

    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(end);
  };
}
