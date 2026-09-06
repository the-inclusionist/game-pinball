// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY FILLED COMPONENT HAS A DARK RIM, SO IT READS AGAINST ANYTHING.
//
// ⚠️ THIS IS THE OPTION ADR-0007 WROTE OUT AND DID NOT TAKE, taken. The record says why it was coming:
//
//   · A cost already measured and recorded rather than fixed: `goal` is (242, 206, 84) and the flare's
//     fourth stop is (236, 186, 52), so a yellow rollover the storm's band is crossing at grip 0.8 is
//     nearly the colour of what is behind it. Both flank rollovers of `ion-storm` disappear into it,
//     which is visible in `shots/authored-ion-storm-flare.png`.
//   · And the Dev's bitmap art, which cannot be held under a lightness ceiling and still be the picture
//     he drew. ADR-0007 says in as many words that its arrival re-opens that decision and that the
//     answer is likely to be this one.
//
// ========================= WHY THE RIM IS INSIDE AND NOT OUTSIDE =========================
// ⚠️ AN OUTSIDE RIM WOULD BE A LIE ABOUT THE TABLE. `tests/table-view-honesty` holds this renderer to
// "no painted pixel sits where the ball would pass straight through", and a border drawn one pixel
// beyond a component's collision shape claims solidity exactly where there is none. The silhouette
// does not change: the outermost pixel of the shape BECOMES the rim.
//
// The cost is real and is worth stating: a 16-pixel bumper keeps 14 pixels of body, and the smallest
// shapes give up proportionally more. That is the price of being visible on a bright ground.
import { describe, test, expect } from 'vitest';
import { drawTable, paletteOf, packRgb, rimOf } from '../app/js/gfx/table-view.js';
import { shade, type Rgb } from '../app/js/gfx/table-palette.js';
import { ION_STORM } from '../app/js/table/ion-storm.js';
import type { AuthoredComponent } from '../app/js/table/authored.js';

const table = ION_STORM;
const palette = paletteOf(table, false);
const at = (fb: { pixels: Uint32Array }, x: number, y: number): number =>
  fb.pixels[y * table.size.width + x]!;
const named = (name: string): AuthoredComponent => table.components.find((c) => c.name === name)!;

function lightness(c: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
}

describe('a filled component is rimmed', () => {
  const picture = drawTable({ table });

  test('⚠️ a bumper’s outermost pixel is its rim, not its body', () => {
    const bumper = named('storm1').bounds;
    const midY = Math.floor(bumper.y + bumper.height / 2);
    const rim = packRgb(rimOf(palette.roles[named('storm1').role]));

    expect(at(picture, Math.floor(bumper.x), midY), 'the left edge').toBe(rim);
    expect(at(picture, Math.floor(bumper.x + bumper.width) - 1, midY), 'the right edge').toBe(rim);
  });

  test('and its middle is still its body', () => {
    const bumper = named('storm1').bounds;
    const midX = Math.floor(bumper.x + bumper.width / 2);
    const midY = Math.floor(bumper.y + bumper.height / 2);
    const rim = packRgb(rimOf(palette.roles[named('storm1').role]));

    expect(at(picture, midX, midY)).not.toBe(rim);
  });

  test('⚠️ and the silhouette did not GROW, which an outside rim would have done', () => {
    // The honesty gate's own claim, asserted here too because this is the change that would break it:
    // one pixel beyond the shape is still ground.
    const bumper = named('storm1').bounds;
    const midY = Math.floor(bumper.y + bumper.height / 2);
    const outside = at(picture, Math.floor(bumper.x) - 1, midY);
    const rim = packRgb(rimOf(palette.roles[named('storm1').role]));

    expect(outside).not.toBe(rim);
  });
});

describe('⚠️ the rim is dark enough to be a rim', () => {
  test('it is darker than the colour it belongs to, for every role in both palettes', () => {
    for (const cbSafe of [false, true]) {
      const p = paletteOf(table, cbSafe);
      for (const [role, colour] of Object.entries(p.roles)) {
        expect(lightness(rimOf(colour)), `${role}/${cbSafe}`).toBeLessThan(lightness(colour));
      }
    }
  });

  test('⚠️ and darker than the brightest thing that can be drawn BEHIND it', () => {
    // The claim this whole change exists for. The flare's peak is the lightest ground any table can
    // have — ADR-0007 caps it at 90.6 — and a rim that were not clearly under it would leave a
    // component with no edge exactly where it most needs one.
    const peak = shade({ r: 232, g: 228, b: 214 }, 0);
    const p = paletteOf(table, false);

    for (const [role, colour] of Object.entries(p.roles)) {
      expect(lightness(rimOf(colour)), `${role} against the flare's peak`)
        .toBeLessThan(lightness(peak) - 40);
    }
  });
});
