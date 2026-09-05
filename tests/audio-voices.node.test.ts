// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  VOICES, soundForKind, soundEntriesOf, SILENT_KINDS, type VoiceSpec,
} from '../app/js/audio/voices.js';
import { CATALOG } from '../app/js/table/catalog.js';
import { createSoundBoard } from '../app/js/audio/sfx.js';

/**
 * ⚠️ PHASE 7 IS PORTED AND SILENT, FOR A REASON NO OTHER PHASE HAD.
 *
 * `audio/sfx` is a MIXER: it allocates channels, steals the oldest voice, places the sound in stereo and
 * returns the duration two control functions use as a timer. What it does not do is make a noise —
 * `output(voice)` is the host's, and the host had none.
 *
 * And the authored table cannot borrow the original's: the ~60 WAV files are Microsoft's and are never
 * distributed (`docs/LICENSES.md` § 3). So an authored table's sound has to be GENERATED, which makes it
 * code rather than art, exactly as `gfx/table-view`'s eight colours are code rather than art.
 *
 * ⚠️ THESE TIMBRES ARE SCAFFOLDING AND SAY SO. They are one voice per component kind, chosen so the
 * table can be HEARD and judged before anybody decides what it should sound like — the same bargain
 * `ROLE_COLORS` struck, and open in the same way.
 */

describe('one voice per kind, and the table can be heard', () => {
  test('every kind a table declares either has a voice or is named as silent', () => {
    // ⚠️ MY FIRST VERSION OF THIS SAID "every kind has a name" AND CONTRADICTED THE TEST BELOW IT.
    // Silence has to be part of the claim, and it has to be a NAMED silence: "not in the map" and
    // "meant to be quiet" look identical from outside, and only one of them is a decision.
    const kinds = new Set(CATALOG.flatMap((t) => t.components.map((c) => c.kind)));

    for (const kind of kinds) {
      if (SILENT_KINDS.includes(kind)) {
        expect(soundForKind(kind), kind).toBeUndefined();
        continue;
      }
      expect(soundForKind(kind), kind).toBeTypeOf('string');
    }
  });

  test('⚠️ and a wall is one of the silent ones, on purpose', () => {
    // A ball resting against a wall collides many times a second. The original gives each wall a sound
    // id from its own data and an authored table has none, so guessing one would turn every long
    // bounce into a rattle. Silence here is a decision, not an omission.
    expect(soundForKind('wall')).toBeUndefined();
  });

  test('a kind and its voice are not the same thing, so two kinds may share one', () => {
    // The map is from kind to a NAME, and names index the voices. That indirection is what lets a table
    // later declare its own sound per component without changing any of this.
    for (const name of Object.values(VOICES)) {
      expect(name).toBeDefined();
    }
  });

  test('every named voice has a positive duration and a pitch', () => {
    for (const [name, voice] of Object.entries(VOICES) as [string, VoiceSpec][]) {
      expect(voice.duration, name).toBeGreaterThan(0);
      expect(voice.frequency, name).toBeGreaterThan(0);
      expect(voice.endFrequency, name).toBeGreaterThan(0);
    }
  });

  test('⚠️ and none of them outlasts a second', () => {
    // A pinball hits things several times a second. A voice long enough to overlap itself turns the
    // table into a drone, and the mixer's channel stealing would then cut sounds that matter.
    for (const [name, voice] of Object.entries(VOICES) as [string, VoiceSpec][]) {
      expect(voice.duration, name).toBeLessThanOrEqual(1);
    }
  });
});

describe('the mixer and the voices agree about how long a sound is', () => {
  test('⚠️ because `play` returns that number and two control functions use it as a TIMER', () => {
    // `sfx.play` answers with the duration whether or not the sound is audible, and the control layer
    // schedules on the answer. A board built from a different list than the one that makes the noise
    // would time the game against sounds that do not exist.
    const board = createSoundBoard({ sounds: soundEntriesOf(), channels: 8, now: () => 0 });

    for (const [name, voice] of Object.entries(VOICES) as [string, VoiceSpec][]) {
      expect(board.play(name), name).toBe(voice.duration);
    }
  });

  test('and a name the board does not know holds nothing for no time', () => {
    const board = createSoundBoard({ sounds: soundEntriesOf(), channels: 8, now: () => 0 });

    expect(board.play('no-such-sound')).toBe(0);
  });
});
