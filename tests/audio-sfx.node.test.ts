// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  createSoundBoard, placeSound, releaseVoice,
  type SoundBoardOptions, type Voice,
} from '../app/js/audio/sfx.js';

const SOUNDS = [
  { name: 'drain', duration: 1.2 },
  { name: 'bumper', duration: 0.25 },
  { name: 'fanfare', duration: 3 },
  { name: 'silent', duration: 0 },
];

function board(over: Partial<SoundBoardOptions> = {}) {
  let clock = 0;
  const played: Voice[] = [];
  const stopped: number[] = [];
  const b = createSoundBoard({
    sounds: SOUNDS,
    channels: 3,
    now: () => clock,
    output: (v) => played.push(v),
    stop: (c) => stopped.push(c),
    ...over,
  });
  return { b, played, stopped, tick: () => { clock += 1; } };
}

describe('⚠️ a duration is GAME LOGIC here, not presentation', () => {
  test('playing a sound returns its length', () => {
    // Two control functions use this number as a timer: the gravity well holds the ball exactly as
    // long as its noise lasts, and the hyperspace kickout does the same.
    const { b } = board();

    expect(b.play('drain')).toBe(1.2);
    expect(b.play('fanfare')).toBe(3);
  });

  test('MUTING THE GAME DOES NOT CHANGE THE TIMING', () => {
    // The single most tempting simplification in this module — "not playing, so don't wait" — turns a
    // silent game into a DIFFERENT game: the ball would leave the gravity well early. In the original
    // the enabled flag is checked inside `Sound::PlaySound` while `play_sound` returns the duration
    // unconditionally, and that split is transcribed exactly.
    const { b, played } = board();
    b.enabled = false;

    expect(b.play('fanfare')).toBe(3);
    expect(played).toEqual([]);
    expect(b.voices).toEqual([]);
  });

  test('and unmuting starts making noise again without changing anything else', () => {
    const { b, played } = board();
    b.enabled = false;
    b.play('drain');
    b.enabled = true;

    expect(b.play('drain')).toBe(1.2);
    expect(played).toHaveLength(1);
  });

  test('a sound the table does not have is ZERO, not a guess', () => {
    // The safe failure, and the original's: `if (soundIndex <= 0) return 0.0`. A missing file makes
    // the game quiet, never stuck — a guessed duration could hold a ball forever.
    const { b, played } = board();

    expect(b.play('nothing-like-this')).toBe(0);
    expect(played).toEqual([]);
  });

  test('a sound with a genuine duration of zero still plays', () => {
    // Different from an unknown one: the table HAS it, so it makes its noise and holds nothing.
    const { b, played } = board();

    expect(b.play('silent')).toBe(0);
    expect(played).toHaveLength(1);
  });
});

describe('when every channel is busy the NEWEST sound wins', () => {
  test('three sounds fill three channels', () => {
    const { b, tick } = board();

    b.play('drain'); tick();
    b.play('bumper'); tick();
    b.play('fanfare');

    expect(b.voices.map((v) => v.name)).toEqual(['drain', 'bumper', 'fanfare']);
    expect(new Set(b.voices.map((v) => v.channel)).size).toBe(3);
  });

  test('a fourth halts the OLDEST and takes its channel', () => {
    // Not "drop the new one". In a pinball the newest sound is the one that just happened to the
    // ball, and the one being cut off is already most of the way through.
    const { b, stopped, tick } = board();
    b.play('drain'); tick();
    b.play('bumper'); tick();
    b.play('fanfare'); tick();

    b.play('bumper');

    expect(b.voices.map((v) => v.name)).toEqual(['bumper', 'fanfare', 'bumper']);
    expect(stopped).toEqual([0]);
  });

  test('the oldest is by TIMESTAMP, not by position in the list', () => {
    const { b } = board({ now: () => 0 });
    // All three start at the same instant, so the first found wins and nothing depends on ordering
    // beyond that.
    b.play('drain'); b.play('bumper'); b.play('fanfare');

    b.play('drain');

    expect(b.voices).toHaveLength(3);
  });

  test('a released channel is reused rather than a new one invented', () => {
    const { b, tick } = board();
    b.play('drain'); tick();
    b.play('bumper'); tick();

    releaseVoice(b, 0);
    b.play('fanfare');

    expect(b.voices.map((v) => v.channel).sort()).toEqual([0, 1]);
  });

  test('releasing a channel nobody holds is harmless', () => {
    const { b } = board();
    b.play('drain');

    releaseVoice(b, 7);

    expect(b.voices).toHaveLength(1);
  });

  test('a single-channel board is always stealing', () => {
    const { b, stopped, tick } = board({ channels: 1 });

    b.play('drain'); tick();
    b.play('bumper');

    expect(b.voices.map((v) => v.name)).toEqual(['bumper']);
    expect(stopped).toEqual([0]);
  });
});

describe('the listener sits at the bottom of the table', () => {
  test('a sound at the top centre is due NORTH', () => {
    // Angle 0 is north and it grows clockwise, which is SDL_mixer's convention rather than the usual
    // one — hence `atan2(x, y)` and not `atan2(y, x)`.
    expect(placeSound({ x: 0.5, y: 1 }).angle).toBe(0);
  });

  test('a sound on the right is EAST and one on the left is WEST', () => {
    expect(placeSound({ x: 1, y: 0 }).angle).toBe(90);
    expect(placeSound({ x: 0, y: 0 }).angle).toBe(270);
  });

  test('a sound with no source at all is treated as the top centre', () => {
    expect(placeSound(undefined)).toEqual(placeSound({ x: 0.5, y: 1 }));
  });

  test('distance grows with the sound’s distance from the listener', () => {
    const near = placeSound({ x: 0.5, y: 0.1 });
    const far = placeSound({ x: 0.5, y: 1 });

    expect(near.distance).toBeLessThan(far.distance);
  });

  test('even a sound at the listener’s own spot is half a table away', () => {
    // The listener stands at height 0.5, so nothing is ever at zero distance. Dropping the height
    // from the maths would put a drain sound right inside the player's head.
    expect(placeSound({ x: 0.5, y: 0 }).distance).toBe(50);
  });

  test('distance never runs past what the mixer accepts', () => {
    expect(placeSound({ x: 99, y: 99 }).distance).toBe(255);
  });

  test('with stereo off, nothing is placed anywhere', () => {
    const { b } = board({ stereo: false });

    b.play('drain', { x: 1, y: 1 });

    expect(b.voices[0]).toMatchObject({ angle: 0, distance: 0 });
  });

  test('with stereo on, the voice carries where it came from', () => {
    const { b } = board();

    b.play('drain', { x: 1, y: 0 });

    expect(b.voices[0]).toMatchObject({ angle: 90 });
  });
});
