// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  findSoundGroups, readWaveHeader, durationOf, buildSoundTable,
  SOUND_MARKER, MAX_SOUNDS, MISSING_FILE_DURATION,
} from '../app/js/audio/sound-table.js';
import { EntryType, readGroups, type Group } from '../app/js/dat/partman.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RESOURCES = join(ROOT, 'game_resources');
const DAT_PATH = join(RESOURCES, 'PINBALL.DAT');
const hasData = existsSync(DAT_PATH);

/** A canonical 8-bit mono WAV: 44-byte header, then `dataSize` bytes. */
function wav(o: { channels?: number; rate?: number; bits?: number; dataSize?: number } = {}): Uint8Array {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  const tag = (at: number, text: string) => {
    for (let i = 0; i < 4; i++) bytes[at + i] = text.charCodeAt(i);
  };
  tag(0, 'RIFF'); tag(8, 'WAVE'); tag(12, 'fmt '); tag(36, 'data');
  view.setUint32(16, 16, true);
  view.setUint16(22, o.channels ?? 1, true);
  view.setUint32(24, o.rate ?? 11025, true);
  view.setUint16(34, o.bits ?? 8, true);
  view.setUint32(40, o.dataSize ?? 11025, true);
  return bytes;
}

const group = (value: number | null, name?: string): Group => ({
  name: null,
  entries: [
    ...(value === null ? [] : [{ type: EntryType.Value16, value }]),
    ...(name === undefined ? [] : [{ type: EntryType.String, data: new TextEncoder().encode(name + '\0') }]),
  ],
});

describe('a sound is a group marked 202', () => {
  test('only the marked groups count', () => {
    // The whole registry. There is no sound directory and no manifest: a group with a 202 is a sound.
    const groups = [group(200, 'ignored'), group(202, 'SOUND1.WAV'), group(null), group(202, 'SOUND2.WAV')];

    expect(findSoundGroups(groups)).toEqual([
      { groupIndex: 1, fileName: 'SOUND1.WAV' },
      { groupIndex: 3, fileName: 'SOUND2.WAV' },
    ]);
    expect(SOUND_MARKER).toBe(202);
  });

  test('the group INDEX is kept, not the position among sounds', () => {
    const groups = [group(1), group(1), group(202, 'A.WAV')];

    expect(findSoundGroups(groups)[0]!.groupIndex).toBe(2);
  });

  test('the sixty-sixth sound is dropped, in silence, as upstream drops it', () => {
    const groups = Array.from({ length: 70 }, (_, i) => group(202, `S${i}.WAV`));

    expect(findSoundGroups(groups)).toHaveLength(MAX_SOUNDS);
    expect(MAX_SOUNDS).toBe(65);
  });

  test('a marked group with no name is still a sound, with an empty one', () => {
    expect(findSoundGroups([group(202)])).toEqual([{ groupIndex: 0, fileName: '' }]);
  });

  test('the name stops at the first NUL', () => {
    const padded: Group = {
      name: null,
      entries: [
        { type: EntryType.Value16, value: 202 },
        { type: EntryType.String, data: new TextEncoder().encode('SOUND9.WAV\0\0\0junk') },
      ],
    };

    expect(findSoundGroups([padded])[0]!.fileName).toBe('SOUND9.WAV');
  });
});

describe('the duration comes from the WAV header', () => {
  test('one second of 11025 Hz 8-bit mono is one second', () => {
    expect(durationOf(readWaveHeader(wav({ dataSize: 11025 }))!)).toBeCloseTo(1, 6);
  });

  test('stereo halves it, and sixteen bits halves it again', () => {
    expect(durationOf(readWaveHeader(wav({ dataSize: 11025, channels: 2 }))!)).toBeCloseTo(0.5, 6);
    expect(durationOf(readWaveHeader(wav({ dataSize: 11025, bits: 16 }))!)).toBeCloseTo(0.5, 6);
  });

  test('a header shorter than the struct is no header at all', () => {
    expect(readWaveHeader(new Uint8Array(20))).toBeNull();
  });

  test('a header with impossible fields yields the MISSING value, not a division by zero', () => {
    const broken = readWaveHeader(wav({ channels: 0 }))!;

    expect(durationOf(broken)).toBe(MISSING_FILE_DURATION);
  });

  test('the reader reports whether the fixed offsets are actually right', () => {
    // Upstream reads the header as one struct, so it ASSUMES `data` follows a 16-byte `fmt `. This
    // flag is how a caller can tell that assumption held.
    const good = readWaveHeader(wav())!;
    const withExtraChunk = wav();
    withExtraChunk[36] = 'L'.charCodeAt(0);

    expect(good.canonical).toBe(true);
    expect(readWaveHeader(withExtraChunk)!.canonical).toBe(false);
  });
});

describe('⚠️ a missing file is MINUS ONE, and minus one means never', () => {
  test('a sound whose file does not open carries -1', () => {
    // Not zero. Minus one is this game's "never": the escape chute holds a ball with it, the disabled
    // multiplier stops its clock with it. Handed to the gravity well's kickout timer, THE BALL IS HELD
    // FOREVER — which is why the missing list exists at all.
    const groups = [group(202, 'GONE.WAV')];

    const { sounds, missing } = buildSoundTable(groups, () => null);

    expect(sounds).toEqual([{ name: 'GONE.WAV', duration: -1 }]);
    expect(missing).toEqual(['GONE.WAV']);
    expect(MISSING_FILE_DURATION).toBe(-1);
  });

  test('a file that opens but is not a WAV counts as missing too', () => {
    const { missing } = buildSoundTable([group(202, 'JUNK.WAV')], () => new Uint8Array(10));

    expect(missing).toEqual(['JUNK.WAV']);
  });

  test('a table where everything loads reports nothing missing', () => {
    const groups = [group(202, 'A.WAV'), group(202, 'B.WAV')];

    const { sounds, missing } = buildSoundTable(groups, () => wav({ dataSize: 22050 }));

    expect(missing).toEqual([]);
    expect(sounds.every((s) => s.duration > 0)).toBe(true);
  });

  test('one bad file among good ones is reported alone', () => {
    const groups = [group(202, 'A.WAV'), group(202, 'GONE.WAV'), group(202, 'B.WAV')];

    const { missing } = buildSoundTable(groups, (n) => (n === 'GONE.WAV' ? null : wav()));

    expect(missing).toEqual(['GONE.WAV']);
  });
});

describe.skipIf(!hasData)('conformance — the real archive and the real WAVs', () => {
  test('the archive declares 48 sounds, well inside the hard cap of 65', () => {
    const groups = readGroups(new Uint8Array(readFileSync(DAT_PATH)));

    expect(findSoundGroups(groups)).toHaveLength(48);
    expect(MAX_SOUNDS).toBe(65);
  });

  test('one declared "sound" is not a file name at all', () => {
    // The archive contains a group marked 202 whose String field is `...`. It is not a WAV and never
    // will be, so it is permanently a -1 — the clearest possible reason this table reports what it
    // could not load instead of assuming it loaded everything.
    const groups = readGroups(new Uint8Array(readFileSync(DAT_PATH)));

    expect(findSoundGroups(groups).map((s) => s.fileName)).toContain('...');
  });

  test('⚠️ SEVEN declared sounds have no file in this extraction', () => {
    // A fact about the data on this machine, not about the port. Each one carries -1, and -1 handed
    // to a kickout timer holds the ball forever — so this is pinned rather than tolerated quietly. If
    // a later extraction fixes it, this test changes and somebody has to notice.
    const groups = readGroups(new Uint8Array(readFileSync(DAT_PATH)));
    const files = new Set(readdirSync(RESOURCES));
    const read = (name: string) => {
      for (const candidate of [name, name.toUpperCase(), name.toLowerCase()]) {
        if (files.has(candidate)) return new Uint8Array(readFileSync(join(RESOURCES, candidate)));
      }
      return null;
    };

    const { sounds, missing } = buildSoundTable(groups, read);

    expect(missing).toHaveLength(7);
    expect(sounds.filter((s) => s.duration === MISSING_FILE_DURATION)).toHaveLength(7);
  });

  test('and the other 41 all have real, positive durations', () => {
    const groups = readGroups(new Uint8Array(readFileSync(DAT_PATH)));
    const files = new Set(readdirSync(RESOURCES));
    const read = (name: string) => {
      for (const candidate of [name, name.toUpperCase(), name.toLowerCase()]) {
        if (files.has(candidate)) return new Uint8Array(readFileSync(join(RESOURCES, candidate)));
      }
      return null;
    };

    const loaded = buildSoundTable(groups, read).sounds
      .filter((s) => s.duration !== MISSING_FILE_DURATION);

    expect(loaded).toHaveLength(41);
    expect(loaded.every((s) => s.duration > 0 && s.duration < 60)).toBe(true);
  });

  test('EVERY real WAV has the layout the fixed read assumes', () => {
    // The claim upstream makes implicitly by reading a struct. If one of these were not canonical,
    // BOTH implementations would compute a wrong duration — and a wrong duration here is a wrong
    // timer, not a wrong noise.
    const files = readdirSync(RESOURCES).filter((f) => /\.wav$/i.test(f));

    const notCanonical = files.filter((f) => {
      const header = readWaveHeader(new Uint8Array(readFileSync(join(RESOURCES, f))));
      return !header?.canonical;
    });

    expect(notCanonical).toEqual([]);
  });

  test('and every one of them has a sane duration', () => {
    const files = readdirSync(RESOURCES).filter((f) => /\.wav$/i.test(f));

    const durations = files.map((f) =>
      durationOf(readWaveHeader(new Uint8Array(readFileSync(join(RESOURCES, f))))!));

    expect(durations.every((d) => d > 0 && d < 60)).toBe(true);
  });
});
