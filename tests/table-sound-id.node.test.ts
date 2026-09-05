// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { playSoundId } from '../app/js/table/sound-id.js';
import { createGate } from '../app/js/table/gate.js';

describe('⚠️ an archive sound id of zero is SILENCE', () => {
  test('zero and below play nothing at all', () => {
    // `loader::play_sound` opens with `if (soundIndex <= 0) return 0.0`. Guarding only on `undefined`
    // asks the mixer for sound number zero, which it does not have — nothing is heard and nothing is
    // reported, so a component that should be quiet and one that is broken look identical.
    const played: number[] = [];
    const sound = { play: (id: number) => played.push(id) };

    playSoundId(sound, 0, null);
    playSoundId(sound, -1, null);
    playSoundId(sound, undefined, null);

    expect(played).toEqual([]);
  });

  test('and a real id is played', () => {
    const played: number[] = [];

    playSoundId({ play: (id: number) => played.push(id) }, 7, null);

    expect(played).toEqual([7]);
  });

  test('⚠️ a gate with no sound records stays silent, which both of the 1995 gates are', () => {
    // `v_gate1` and `v_gate2` carry neither record 1100 nor 1101, so `readVisual` answers zero for
    // both. The gates are meant to be quiet, and the file says so by omission.
    const played: number[] = [];
    const gate = createGate({
      edges: [], openSoundId: 0, shutSoundId: 0, sound: { play: (id: number) => played.push(id) },
    });

    gate.openGate();
    gate.shutGate();

    expect(played).toEqual([]);
  });
});
