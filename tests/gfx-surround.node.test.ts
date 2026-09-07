// SPDX-License-Identifier: AGPL-3.0-or-later
// THREE TO ONE, MEASURED WHERE IT IS READ.
//
// ⚠️ THE DEV: "As cores das mesas ficaram escuras demais, o contraste ficou altíssimo, mas o
// necessário e suficiente é 3:1." `gfx/surround`'s header holds the measurements that produced this
// file; what is here is the claim itself, on the tables as they ship.
//
// ========================= WHY THE ASSERTION IS SHAPED LIKE THIS =========================
// The old rule was "the ground is darker than every role", which is an ORDERING and not a ratio. It is
// possible to satisfy it completely and still fail 3:1 everywhere — which is exactly what happened:
// `free` was under the ground by a comfortable margin of lightness and at 2.41:1 against it.
//
// So this asks the question the Dev asked. For every table, in both palettes, at every pixel where a
// component is drawn: does that component clear three to one against the backdrop next to it?
import { describe, test, expect } from 'vitest';
import { REQUIRED_RATIO, SURROUND_ADJACENT, surroundCeiling, applySurround }
  from '../app/js/gfx/surround.js';
import { drawBackground, drawComponents, surroundOf } from '../app/js/gfx/table-view.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';
import { paletteFor, sceneOf } from '../app/js/gfx/table-palette.js';
import { PLAYABLE_TABLES } from '../app/js/table/catalog.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

const LINEAR = new Float64Array(256);
for (let v = 0; v < 256; v++) {
  const c = v / 255;
  LINEAR[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const luminance = (r: number, g: number, b: number): number =>
  0.2126 * LINEAR[r]! + 0.7152 * LINEAR[g]! + 0.0722 * LINEAR[b]!;
const ratio = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** The backdrop of one table, composed exactly as the game composes it. */
function backdrop(table: AuthoredTable, cbSafe: boolean): { luma: Float64Array; width: number } {
  const palette = paletteFor(sceneOf(table.name) ?? 'slate', { cbSafe });
  const fb = createFramebuffer(table.size.width, table.size.height);
  drawBackground(fb, table, palette, { table, litLamps: table.lamps });
  const luma = new Float64Array(table.size.width * table.size.height);
  for (let i = 0; i < luma.length; i++) {
    luma[i] = luminance(fb.bytes[i * 4]!, fb.bytes[i * 4 + 1]!, fb.bytes[i * 4 + 2]!);
  }
  return { luma, width: table.size.width };
}

const cases = PLAYABLE_TABLES.flatMap((t) => [false, true].map((cb) => [t.name, cb, t] as const));

/**
 * The pixels one component actually paints.
 *
 * ⚠️ NOT ITS BOUNDS, and the difference is the whole reason this file exists in the shape it does. A
 * lane's bounding rectangle is long and diagonal and `drawLaneRails` paints only its two rails: asking
 * about every pixel in that rectangle asks about the picture INSIDE the lane, which the rails are not
 * adjacent to and which nothing has any reason to darken. Measured that way, `lane.launch` reads
 * 1.44:1 on a table where its rails are at 3.6:1 — a failure invented by the question.
 */
function footprint(table: AuthoredTable, cbSafe: boolean, name: string): Uint8Array {
  const fb = createFramebuffer(table.size.width, table.size.height);
  drawComponents(fb, table, paletteFor(sceneOf(table.name) ?? 'slate', { cbSafe }), { table },
    (c) => c.name === name);
  const out = new Uint8Array(table.size.width * table.size.height);
  for (let i = 0; i < out.length; i++) out[i] = fb.bytes[i * 4 + 3]! === 0 ? 0 : 1;
  return out;
}

describe('every component clears 3:1 against the backdrop beside it', () => {
  test.each(cases)('%s, cbSafe=%s', (name, cbSafe, table) => {
    const palette = paletteFor(sceneOf(table.name) ?? 'slate', { cbSafe });
    const { luma, width } = backdrop(table, cbSafe);
    const height = table.size.height;

    /**
     * ⚠️ READ OFF THE COMPOSED PICTURE, NOT OFF THE SURROUND ARRAY. Asserting that `surroundOf`
     * returns what `surroundOf` computed would be one function on both sides of the gate — it would
     * pass with the darkening never applied, which is precisely the state this test was born in.
     */
    const worst: string[] = [];
    for (const component of table.components) {
      const painted = footprint(table, cbSafe, component.name);
      // Nothing drawn into the composition: a flipper, a plunger, a mover. Those are stroked per
      // frame from live geometry and are not what this rule is about.
      if (!painted.some((v) => v === 1)) continue;

      const c = palette.roles[component.role];
      const role = luminance(c.r, c.g, c.b);
      let lowest = Infinity;

      /**
       * Outward FROM the painted pixels rather than over the whole table. The same answer, and the
       * difference is a minute per table: a component covers a few hundred pixels and the table has
       * forty thousand.
       */
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (painted[y * width + x] === 0) continue;
          for (let dy = -SURROUND_ADJACENT; dy <= SURROUND_ADJACENT; dy++) {
            const py = y + dy;
            if (py < 0 || py >= height) continue;
            for (let dx = -SURROUND_ADJACENT; dx <= SURROUND_ADJACENT; dx++) {
              const px = x + dx;
              if (px < 0 || px >= width) continue;
              // Only the BACKDROP counts. A component's own pixels are what is being read, not what
              // it is read against, and a wall's own rim would otherwise be its worst neighbour.
              if (painted[py * width + px] === 1) continue;
              if (Math.hypot(dx, dy) > SURROUND_ADJACENT) continue;
              lowest = Math.min(lowest, ratio(role, luma[py * width + px]!));
            }
          }
        }
      }
      // A component with no backdrop anywhere near it — buried inside another — has nothing to clear.
      if (lowest === Infinity) continue;

      // Rounded to two places: the ceiling is computed in floating point and stored in 8-bit
      // channels, so the last hundredth is the encoder's and not a real shortfall.
      if (Math.round(lowest * 100) / 100 < REQUIRED_RATIO) {
        worst.push(`${component.name} (${component.role}) ${lowest.toFixed(2)}:1`);
      }
    }

    expect(worst, `${name}/${cbSafe ? 'cbSafe' : 'normal'}: under ${REQUIRED_RATIO}:1`).toEqual([]);
  });
});

describe('and necessary is not the same as sufficient', () => {
  test('⚠️ the backdrop is left alone everywhere no component stands', () => {
    // The Dev's complaint was that the tables were too DARK, and a fix that darkened everything to be
    // safe would satisfy the test above completely. This is the other half of his sentence:
    // "o necessário e suficiente é 3:1" — the darkening is a debt, and it is paid only where owed.
    //
    // ⚠️ COUNTED ON THE PICTURE, NOT ON THE MASK. The mask marks every pixel the shadow REACHES,
    // including the far end of the fade where the limit is above anything the backdrop contains and
    // not one channel moves. Counting that reported 55% of `ion-storm` darkened when the true figure
    // is a fraction of it — a measure that would have made the fade look expensive and pushed it
    // narrower for no reason at all.
    for (const table of PLAYABLE_TABLES) {
      const palette = paletteFor(sceneOf(table.name) ?? 'slate', { cbSafe: false });
      const before = createFramebuffer(table.size.width, table.size.height);
      drawBackground(before, table, palette, { table, litLamps: table.lamps });
      const after = Uint8ClampedArray.from(before.bytes);
      applySurround({ ...before, bytes: after } as unknown as typeof before,
        surroundOf(table, palette));

      let moved = 0;
      for (let i = 0; i < before.bytes.length; i += 4) {
        if (before.bytes[i] !== after[i] || before.bytes[i + 1] !== after[i + 1]
          || before.bytes[i + 2] !== after[i + 2]) moved++;
      }
      const share = moved / (table.size.width * table.size.height);

      expect(share, `${table.name}: the shadow moves ${(100 * share).toFixed(1)}% of the table`)
        .toBeLessThan(0.3);
    }
  });

  test('⚠️ and a bright role casts a shallower shadow than a dark one', () => {
    // The reason the ceiling is per role rather than one number. `goal` clears 3:1 against a surround
    // half way up the lightness scale; `free` needs one that is very nearly black. A single ceiling
    // for both is what blacked out six pictures.
    expect(surroundCeiling(0.6366), 'goal').toBeGreaterThan(0.17);
    expect(surroundCeiling(0.1056), 'free').toBeLessThan(0.01);
  });

  test('⚠️ and EVERY role can reach 3:1 against a black surround, which is what free could not', () => {
    // The defect underneath all of this: `free` was at Y 0.0833, and a colour that dark cannot make
    // three to one against ANYTHING — its contrast against pure black is 2.67:1. No amount of
    // darkening the picture could have fixed it, and the darkening was there for it.
    for (const cbSafe of [false, true]) {
      const roles = paletteFor('space', { cbSafe }).roles;
      const short = Object.entries(roles)
        .map(([role, c]) => ({ role, against: ratio(luminance(c.r, c.g, c.b), 0) }))
        .filter((r) => r.against < REQUIRED_RATIO);

      expect(short.map((r) => `${r.role} ${r.against.toFixed(2)}:1 against black`)).toEqual([]);
    }
  });
});

describe('the darkening itself', () => {
  test('⚠️ keeps the colour and moves only the light', () => {
    // Scaling the BYTES is a gamma-space multiply and walks a warm grey toward blue. This scales in
    // LINEAR light, where the three channels keep their ratios and the hue is exactly preserved.
    const fb = createFramebuffer(1, 1);
    fb.bytes[0] = 200; fb.bytes[1] = 120; fb.bytes[2] = 40; fb.bytes[3] = 255;
    const limit = 0.08;

    applySurround(fb, Float32Array.from([limit]));

    // At or under the ceiling, never over: the encoder rounds down for exactly this reason.
    const got = luminance(fb.bytes[0]!, fb.bytes[1]!, fb.bytes[2]!);
    expect(got, 'brought to the ceiling').toBeGreaterThan(limit * 0.97);
    expect(got, 'and not past it').toBeLessThanOrEqual(limit);

    /**
     * ⚠️ AGAINST THE ARITHMETIC, NOT AGAINST A RATIO OF THE RESULT. The first version of this compared
     * the output channels' linear ratios with the input's and asked them to agree to two decimals. At
     * a ceiling this dark the blue channel lands on byte 22, where one step of quantisation moves its
     * ratio against green by eight per cent — so the test failed while the implementation was exactly
     * right, and it was measuring the 8-bit grid rather than the scaling. What the claim actually says
     * is that every channel is the SAME multiple of its own linear value, and that is checkable
     * directly: compute it, encode it, allow the one byte the encoder's downward rounding can take.
     */
    const k = limit / (0.2126 * LINEAR[200]! + 0.7152 * LINEAR[120]! + 0.0722 * LINEAR[40]!);
    const encode = (v: number): number =>
      255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
    for (const [i, from] of [[0, 200], [1, 120], [2, 40]] as const) {
      const ideal = encode(LINEAR[from]! * k);
      expect(fb.bytes[i], `channel ${i} is the same multiple in linear light`)
        .toBeGreaterThanOrEqual(Math.floor(ideal) - 1);
      expect(fb.bytes[i], `channel ${i} never rounds up past it`).toBeLessThanOrEqual(Math.ceil(ideal));
    }
  });

  test('⚠️ and never brightens anything', () => {
    // A ceiling is a ceiling. A pixel already under it is not lifted to meet it, or the shadow would
    // become a light and the table's darkest places would be the ones next to its components.
    const fb = createFramebuffer(1, 1);
    fb.bytes[0] = 4; fb.bytes[1] = 5; fb.bytes[2] = 6; fb.bytes[3] = 255;

    applySurround(fb, Float32Array.from([0.5]));

    expect([fb.bytes[0], fb.bytes[1], fb.bytes[2]]).toEqual([4, 5, 6]);
  });
});
