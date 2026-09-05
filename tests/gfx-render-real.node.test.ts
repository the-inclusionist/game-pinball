// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VISUAL GATE OF PHASE 2: the real table, decoded from PINBALL.DAT and written out as a PNG.
//
// The assertions here are objective (dimensions, opacity, colour variety), but the artefact exists to
// be LOOKED AT: numbers over a buffer cannot tell a correct table from a mirrored one, an upside-down
// one, or one with red and blue swapped — and those three are exactly what this path invites.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTable } from '../app/js/dat/loader.js';
import { readBitmapHeader, HEADER_SIZE } from '../app/js/dat/bitmap8.js';
import { EntryType } from '../app/js/dat/partman.js';
import { readPalette } from '../app/js/dat/palette.js';
import { unpackIndexed } from '../app/js/dat/indexed.js';
import { readZMap } from '../app/js/dat/zmap.js';
import { buildDisplayPalette, applyPalette } from '../app/js/gfx/gdrv.js';
import { halve, halveNearest } from '../app/js/gfx/scale.js';
import { createFramebuffer, pack } from '../app/js/gfx/framebuffer.js';
import { buildPng } from './helpers/png.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAT_PATH = join(ROOT, 'game_resources', 'PINBALL.DAT');
const OUT_DIR = join(ROOT, 'shots');

describe.skipIf(!existsSync(DAT_PATH))('render — the real table as a PNG', () => {
  test('the "table" group decodes at 365x470, the right way up and in the right colours', () => {
    const file = new Uint8Array(readFileSync(DAT_PATH));
    const table = loadTable(file);

    const paletteEntry = table.groups.flatMap((g) => g.entries)
      .find((e) => e.type === EntryType.Palette && e.data);
    expect(paletteEntry).toBeDefined();
    const palette = buildDisplayPalette(readPalette(paletteEntry!.data!));

    // BY NAME rather than by size: "the largest bitmap" is right today by accident and would stop being
    // right the day a sprite grew. The group is called `table`, and that is what it is.
    const backgroundIndex = table.groupIndex('table');
    expect(backgroundIndex).not.toBeNull();
    const backgroundEntry = table.groups[backgroundIndex!]!.entries
      .find((e) => e.type === EntryType.Bitmap8 && e.data)!;
    const header = readBitmapHeader(backgroundEntry.data!);

    const indices = unpackIndexed(backgroundEntry.data!.subarray(HEADER_SIZE), {
      width: header.width, height: header.height, indexedStride: header.indexedStride!,
    });
    const fb = applyPalette(indices, palette, header.width, header.height);

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'table-background.png'), buildPng(fb.bytes, fb.width, fb.height));

    expect([header.width, header.height]).toEqual([365, 470]);

    const opaqueInBand = (y0: number, y1: number): number => {
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < fb.width; x++) if (fb.bytes[(y * fb.width + x) * 4 + 3]! > 0) n++;
      }
      return n;
    };

    // IT IS NOT UPSIDE DOWN. The table is wide at the top and narrows to the pedestal at the bottom, so
    // the top band carries far more opaque pixels than the bottom one. Measured: 4494 against 3084.
    // Flipping the rows swaps the two, and nothing else in the game complains — the ball just falls up.
    expect(opaqueInBand(0, 20)).toBeGreaterThan(opaqueInBand(fb.height - 20, fb.height) * 1.2);

    // RED AND BLUE ARE NOT SWAPPED. The central disc is blue-green: measured r=58, g=78, b=92. Swapping
    // the channels would put red at 92 and blue at 58, and the table would still look "plausible" —
    // purple swapped is still purple. It is the disc that tells.
    let r = 0, b = 0, n = 0;
    for (let y = 230; y < 290; y++) {
      for (let x = 150; x < 215; x++) {
        const i = (y * fb.width + x) * 4;
        r += fb.bytes[i]!; b += fb.bytes[i + 2]!; n++;
      }
    }
    expect(b / n).toBeGreaterThan((r / n) * 1.3);

    // And it is colourful: an index defect collapsing everything into one colour would pass all the rest.
    expect(new Set(Array.from(fb.pixels)).size).toBeGreaterThan(100);

    // BOTH REDUCTIONS, side by side, so the aesthetic choice is made by looking rather than imagining.
    const boxed = halve(fb);
    const nearest = halveNearest(fb);
    writeFileSync(join(OUT_DIR, 'table-183-box.png'), buildPng(boxed.bytes, boxed.width, boxed.height));
    writeFileSync(join(OUT_DIR, 'table-183-nearest.png'), buildPng(nearest.bytes, nearest.width, nearest.height));

    // 183x235 is the plan's target, and it comes from rounding UP: 365/2 is 182.5.
    expect([boxed.width, boxed.height]).toEqual([183, 235]);
    expect([nearest.width, nearest.height]).toEqual([183, 235]);

    // The box average keeps more information than sampling — which is what makes it the proposed default.
    expect(new Set(Array.from(boxed.pixels)).size)
      .toBeGreaterThan(new Set(Array.from(nearest.pixels)).size);
  });

  test('the table z-map covers the same area and has real relief', () => {
    const file = new Uint8Array(readFileSync(DAT_PATH));
    const table = loadTable(file);
    const group = table.groups[table.groupIndex('table')!]!;

    const zEntry = group.entries.find((e) => e.type === EntryType.ZMap && e.data);
    expect(zEntry).toBeDefined();
    const z = readZMap(zEntry!.data!);

    expect(z.empty).toBe(false);
    expect([z.width, z.height]).toEqual([365, 470]);

    // A greyscale view, like `zdrv::CreatePreview`: near is light, far is dark.
    const fb = createFramebuffer(z.width, z.height);
    for (let y = 0; y < z.height; y++) {
      for (let x = 0; x < z.width; x++) {
        const t = Math.floor((0xffff - z.depthAt(x, y)) / 0xff);
        fb.pixels[y * fb.width + x] = pack(t, t, t, 255);
      }
    }
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'table-zmap.png'), buildPng(fb.bytes, fb.width, fb.height));

    // REAL RELIEF rather than a plane: if the z-map came back all one value, the ball would never
    // disappear behind anything and every depth test would still pass.
    const distinct = new Set(Array.from(z.depths));
    expect(distinct.size).toBeGreaterThan(10);
  });
});
