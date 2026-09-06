// SPDX-License-Identifier: AGPL-3.0-or-later
// HOW FAR A COLOUR MAY BE SHADED BEFORE ITS EDGE STARTS LYING.
//
// Phase 8 asks for art, and the first thing a flat shape wants is a lit edge: lighter along the top,
// darker along the bottom, so a bumper reads as raised rather than as a hole. The catch is that a
// highlight IS a colour, drawn on a table where every colour already means something.
//
// ⚠️ AND THE FIRST ATTEMPT AT THIS FAILED, at every amount tried. A single shade of 18% applied to
// every role put `free`'s highlight NEARER `structure` than `free` — because those two clear the
// palette's threshold by 0.2 and nothing else. Any modulation of lightness spends headroom that the
// neutrals do not have, which is also why the ground cannot have a gradient (see the same finding, the
// other way round, in the Dev's open question about `free`).
//
// So the amount is chosen PER ROLE: as much as that colour's neighbours allow and no more. The signals
// take a lot, the two neutrals take little, and the outcome is a rule nobody wrote down — the SIGNALS
// get depth and the WORLD stays flat.
//
// ⚠️ THE NUMBERS ARE STORED, NOT COMPUTED AT RUN TIME, and that is on purpose. A production module that
// derived them with the same distance function this test checks them with would be a test reading by
// the same link as the code: both would move together and the gate would never fail. The constants
// were solved offline; this is the independent check on them.
import { describe, test, expect } from 'vitest';
import { SHADE_HEADROOM, shade, SCENES, paletteFor, type Rgb } from '../app/js/gfx/table-palette.js';
import {
  fillRect, fillCircle, fillLitRect, fillLitCircle, litColors,
} from '../app/js/gfx/table-view.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';

function lab(c: Rgb): [number, number, number] {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(c.r), lin(c.g), lin(c.b)];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

describe('shading one colour', () => {
  test('a positive amount lightens, a negative one darkens, and neither leaves the range', () => {
    const body: Rgb = { r: 120, g: 130, b: 140 };

    expect(lab(shade(body, 0.3))[0]).toBeGreaterThan(lab(body)[0]);
    expect(lab(shade(body, -0.3))[0]).toBeLessThan(lab(body)[0]);

    for (const extreme of [shade({ r: 250, g: 250, b: 250 }, 1), shade({ r: 4, g: 4, b: 4 }, -1)]) {
      for (const channel of [extreme.r, extreme.g, extreme.b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });

  test('and nothing is shaded by zero, which would be a shape with no light on it at all', () => {
    for (const [role, amount] of Object.entries(SHADE_HEADROOM)) {
      expect(amount, `${role} takes some light`).toBeGreaterThan(0);
    }
  });
});

describe('⚠️ the headroom is honest', () => {
  test('every role’s own shade stays NEARER its body than any other colour on the table', () => {
    // The claim the constants exist to make. A highlight that reads as another role is a lie told in
    // the one place a player looks to tell things apart, and at this size a component is three pixels
    // wide — the edge is a third of it.
    const wrong: string[] = [];

    for (const scene of Object.keys(SCENES)) {
      for (const cbSafe of [false, true]) {
        const palette = paletteFor(scene, { cbSafe });
        const swatches: [string, Rgb][] = [
          ...Object.entries(palette.roles), ['the ground', palette.ground], ['the ball', palette.ball],
        ];

        for (const [role, body] of Object.entries(palette.roles)) {
          const amount = SHADE_HEADROOM[role as keyof typeof SHADE_HEADROOM]!;
          for (const variant of [shade(body, amount), shade(body, -amount)]) {
            const own = deltaE(variant, body);
            for (const [other, colour] of swatches) {
              if (other === role) continue;
              if (deltaE(variant, colour) <= own) {
                wrong.push(`${scene}/${cbSafe ? 'cbSafe' : 'normal'}: ${role}'s shade reads as ${other}`);
              }
            }
          }
        }
      }
    }

    expect([...new Set(wrong)]).toEqual([]);
  });

  test('⚠️ and it is not headroom bought by shading nothing', () => {
    // Every assertion above is satisfied by an amount of 0.001, which is the degenerate answer: no
    // colour ever reads as another because no colour ever changes. A shade has to be VISIBLE, and a
    // just-noticeable difference in CIE76 is about 2.3.
    for (const scene of Object.keys(SCENES)) {
      const palette = paletteFor(scene, { cbSafe: false });
      for (const [role, body] of Object.entries(palette.roles)) {
        const amount = SHADE_HEADROOM[role as keyof typeof SHADE_HEADROOM]!;

        expect(deltaE(shade(body, amount), body), `${role}'s highlight can be seen`)
          .toBeGreaterThan(4);
        expect(deltaE(shade(body, -amount), body), `${role}'s shadow can be seen`)
          .toBeGreaterThan(4);
      }
    }
  });

  test('⚠️ and the WORLD is shaded less than the SIGNALS, which is the finding and not a preference', () => {
    // `structure` and `free` are the table's two neutrals and they clear the palette's threshold
    // against each other by a fraction. That is why they take the least light — not because a flat
    // world was wanted, but because a lit one is not available at this palette. If a later change
    // gives them room, this test is what should be revisited rather than quietly left true.
    const quietest = Math.max(SHADE_HEADROOM.structure, SHADE_HEADROOM.free);
    const loudest = Math.min(
      SHADE_HEADROOM.hazard, SHADE_HEADROOM.goal, SHADE_HEADROOM.key, SHADE_HEADROOM.climb,
    );

    expect(quietest, 'the world takes less light than any signal').toBeLessThan(loudest);
  });
});

describe('⚠️ the light changes the COLOURS and never the SHAPE', () => {
  // The defect this exists for was on screen for one run: a highlight stamped half a pixel above a
  // two-pixel line covered the body and widened the stroke, so the walls and the ramp went pale AND
  // the drawing started claiming area the physics does not have. `tests/table-view-honesty` did not
  // catch it — half a pixel is inside its tolerance — and no assertion anywhere else moved. It was
  // found by opening the PNG.
  //
  // Lines are no longer lit at all: two pixels is the thinnest honest width for a wall, and there is
  // no room in it for a body and an edge. What IS lit must paint exactly the pixels it painted before.
  const painted = (fb: { pixels: Uint32Array }) => {
    const at: number[] = [];
    for (let i = 0; i < fb.pixels.length; i++) if (fb.pixels[i] !== 0) at.push(i);
    return at;
  };
  const lit = litColors({ r: 200, g: 120, b: 60 }, 'goal');

  test('a lit rectangle covers the same pixels as a plain one', () => {
    const plain = createFramebuffer(40, 40);
    const shaded = createFramebuffer(40, 40);
    const rect = { x: 6, y: 8, width: 17, height: 11 };

    fillRect(plain, rect, lit.body);
    fillLitRect(shaded, rect, lit);

    expect(painted(shaded)).toEqual(painted(plain));
    expect(painted(shaded).length, 'and it painted something').toBeGreaterThan(0);
  });

  test('and so does a lit circle, at the size a ball actually is', () => {
    for (const radius of [3, 5, 9]) {
      const plain = createFramebuffer(40, 40);
      const shaded = createFramebuffer(40, 40);

      fillCircle(plain, 20, 20, radius, lit.body);
      fillLitCircle(shaded, 20, 20, radius, lit);

      expect(painted(shaded), `radius ${radius}`).toEqual(painted(plain));
    }
  });

  test('⚠️ and the light is actually THERE, or this passes by drawing nothing new', () => {
    const shaded = createFramebuffer(40, 40);

    fillLitCircle(shaded, 20, 20, 9, lit);

    const colours = new Set(painted(shaded).map((i) => shaded.pixels[i]));
    expect(colours.size, 'a body, a top and a bottom').toBe(3);
    expect(colours.has(lit.top) && colours.has(lit.bottom) && colours.has(lit.body)).toBe(true);
  });

  test('and a shape too small to light keeps its one colour rather than becoming all edge', () => {
    // A three-pixel ball lit top and bottom is a three-pixel ball with no body left. Below the size
    // where an edge is a fraction of the shape, the shape stays flat.
    const tiny = createFramebuffer(20, 20);

    fillLitRect(tiny, { x: 8, y: 8, width: 4, height: 2 }, lit);

    expect(new Set(painted(tiny).map((i) => tiny.pixels[i]))).toEqual(new Set([lit.body]));
  });
});
