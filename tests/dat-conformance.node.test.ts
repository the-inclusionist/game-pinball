// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CONFORMANCE GATE: the parser against the real PINBALL.DAT.
//
// The numbers checked here were NOT produced by this code. They come from the upstream's
// `Doc/.dat dump.txt`, written by AdrienTD with a different tool, in a different language, years before
// this port existed. That is the difference between a test and a mirror: a golden file I generated
// myself would only confirm that the parser agrees with itself.
//
// It SKIPS when the data is not on the machine, and says how to get it. The files are Microsoft's and
// never enter the repository; a test depending on them without that guard would break on every clean
// clone.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAT_PATH = join(ROOT, 'game_resources', 'PINBALL.DAT');
const hasData = existsSync(DAT_PATH);

describe.skipIf(!hasData)('conformance — the real PINBALL.DAT against AdrienTD’s dump', () => {
  const file = hasData ? new Uint8Array(readFileSync(DAT_PATH)) : new Uint8Array(0);

  test('the header matches the dump', async () => {
    const { readHeader } = await import('../app/js/dat/partman.js');
    const h = readHeader(file);

    expect(h.signature).toBe('PARTOUT(4.0)RESOURCE');
    expect(h.appName).toBe('3D-Pinball');
    expect(h.description).toBe('Space Cadet Table');
    expect(h.groupCount).toBe(541);
    expect(file.byteLength).toBe(928700);
  });

  test('walks all 541 groups without losing sync', async () => {
    const { readGroups } = await import('../app/js/dat/partman.js');

    // The proof of sync is not the count: it is the CONTENT of the first and second groups, which the
    // dump transcribes. A desynchronized parser would still produce 541 objects, full of garbage.
    const groups = readGroups(file);

    expect(groups).toHaveLength(541);
    expect(new TextDecoder('latin1').decode(groups[0]!.entries[0]!.data!))
      .toContain('Copyright 1994, Cinematronics');
    expect(groups[1]!.name).toBe('table_size');
  });

  test('the table is 600x416 and the largest bitmap is 365x470', async () => {
    const { loadTable } = await import('../app/js/dat/loader.js');
    const { readBitmapHeader } = await import('../app/js/dat/bitmap8.js');
    const { EntryType } = await import('../app/js/dat/partman.js');

    const table = loadTable(file);
    expect(table.tableSize).toEqual({ width: 600, height: 416 });

    const bitmaps = table.groups.flatMap((g) => g.entries
      .filter((e) => e.type === EntryType.Bitmap8 && e.data)
      .map((e) => readBitmapHeader(e.data!)));

    expect(bitmaps).toHaveLength(318);
    const largest = bitmaps.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
    expect([largest.width, largest.height]).toEqual([365, 470]);
  });

  test('every non-spliced bitmap has size equal to height x indexed stride', async () => {
    // The assertion gdrv itself makes in its constructor. If it holds for all 318, the header was read
    // correctly.
    const { loadTable } = await import('../app/js/dat/loader.js');
    const { readBitmapHeader, BitmapType } = await import('../app/js/dat/bitmap8.js');
    const { EntryType } = await import('../app/js/dat/partman.js');

    const divergent = loadTable(file).groups.flatMap((g) => g.entries
      .filter((e) => e.type === EntryType.Bitmap8 && e.data)
      .map((e) => readBitmapHeader(e.data!))
      .filter((h) => h.type !== BitmapType.Spliced
        && h.dataSize !== h.height * (h.indexedStride ?? 0)));

    expect(divergent).toEqual([]);
  });

  test('3DPB uses neither spliced nor dib: all 318 bitmaps are RAW, at resolution 0', async () => {
    // MEASURED, not assumed. The first version of this test tried to decode the file's spliced bitmaps
    // and failed on its own guard: there are none. The spliced format belongs to Full Tilt! Pinball,
    // and the upstream's partman loads both games.
    //
    // THE CONSEQUENCE, stated here because nothing else would: `dat/spliced.ts` remains WITHOUT
    // validation against real data. Its tests are synthetic and transcribe the upstream algorithm line
    // by line, which is stronger than nothing and weaker than this gate. Only Full Tilt data closes
    // that gap.
    const { loadTable } = await import('../app/js/dat/loader.js');
    const { readBitmapHeader, BitmapType } = await import('../app/js/dat/bitmap8.js');
    const { EntryType } = await import('../app/js/dat/partman.js');

    const headers = loadTable(file).groups.flatMap((g) => g.entries
      .filter((e) => e.type === EntryType.Bitmap8 && e.data)
      .map((e) => readBitmapHeader(e.data!)));

    expect(headers.filter((h) => h.type !== BitmapType.Raw)).toEqual([]);
    expect(headers.filter((h) => h.resolution !== 0)).toEqual([]);
  });

  test('the file’s 302 z-maps are all legible', async () => {
    // partman.cpp warns that groups 497 and 498 carry a zeroed header. This test says how many fall in
    // that case: if one day there are more, something changed in the reading and not in the file.
    const { loadTable } = await import('../app/js/dat/loader.js');
    const { EntryType } = await import('../app/js/dat/partman.js');
    const { readZMap } = await import('../app/js/dat/zmap.js');

    const zmaps = loadTable(file).groups.flatMap((g) => g.entries
      .filter((e) => e.type === EntryType.ZMap && e.data)
      .map((e) => readZMap(e.data!)));

    expect(zmaps).toHaveLength(302);
    expect(zmaps.filter((z) => z.empty)).toHaveLength(2); // groups 497 and 498
  });
});

describe.skipIf(hasData)('conformance — data absent', () => {
  test('the gate is waiting for the original data', () => {
    // Not a failure: it is the normal state of a clean clone. This test exists so the absence shows up
    // in the output instead of the suite passing in silence and looking as though the gate had run.
    expect(hasData).toBe(false);
    console.log(`\n  [conformance gate SKIPPED] ${DAT_PATH} does not exist.`);
    console.log('  To enable it: npm run data:extract\n');
  });
});
