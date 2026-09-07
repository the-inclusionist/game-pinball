// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FLARE ON SCREEN — the other half of the Dev's `ion-storm`, and the half a player can see.
//
// ⚠️ HIS WORDS: "um fundo que varia de preto, marrom, vermelho, amarelo e branco" — and back. The
// mechanic is already built: `table/storm` sweeps a band down the table and `physics-build` drags the
// ball inside it. This is the same band PAINTED, so that the thing slowing the ball is the thing on
// screen rather than an invisible field the player has to infer.
//
// ========================= WHY A POINT SEES THE WHOLE CYCLE =========================
// The colours are keyed on the GRIP — how deep into the band a row is — and the grip at a fixed row
// rises from nought to one and falls back as the band passes over it. So that row is painted the
// scene's own black, then brown, red, yellow, white, and the same in reverse. The Dev's list, in his
// order, with the "e volta" for free, and it comes out of the mechanic rather than being animated
// beside it.
//
// ========================= AND THE ONE PLACE THIS BREAKS A RULE =========================
// ⚠️ `tests/gfx-table-palette` HOLDS THE GROUND DARKER THAN EVERY ROLE, EVERYWHERE. That is ADR-0004's
// mechanism for telling the worlds apart without relying on hue, and a band that goes white breaks it
// for as long as it is passing — knowingly, because the Dev asked for the background to vary through
// to white and a flare that stopped at grey would not be the thing he asked for.
//
// What is NOT given up is the half of the identity that carries the game: THE BALL IS THE LIGHTEST
// THING ON THE TABLE. A peak at pure white would swallow it — the ball is (238, 242, 248) — so the
// peak is the brightest white that stays under the ball in CIE lightness. It reads as white against a
// sky whose brightest band is 74, and the ball stays findable in the one place the player most needs
// to find it, which is the place where the table has just taken hold of it.
//
// ========================= AND WHAT LOOKING AT IT SHOWED =========================
// ⚠️ `shots/authored-ion-storm-flare.png` IS FIVE PHASES OF ONE SWEEP, STACKED, and it was looked at
// rather than only asserted. The band reads as the Dev asked — black, brown, red, yellow, white, and
// the same back — and the components stay legible over the dark part of the table.
//
// The one place they do not: a GOAL sits at (242, 206, 84) and the flare's fourth stop at
// (236, 186, 52), so a yellow rollover the band happens to be crossing at grip 0.8 is nearly the
// colour of what is behind it. It is there in the third strip, on both flank rollovers.
//
// That is the ground/role inversion above, arriving in the one place it costs something, and it is
// left rather than quietly fixed because each alternative gives up something the Dev asked for: moving
// the flare's yellow toward orange stops it being "amarelo", and narrowing the band stops the cycle
// being legible. The fix that costs nothing he asked for is a dark rim on every component, which is a
// change to every table and is not this one. Recorded here for him to choose.
import { describe, test, expect } from 'vitest';
import { drawTable, packRgb } from '../app/js/gfx/table-view.js';
import { flareColor, FLARE_PEAK, paletteFor, type Rgb } from '../app/js/gfx/table-palette.js';
import { ION_STORM } from '../app/js/table/ion-storm.js';

/** sRGB to CIE Lab lightness, D65. The gamma step matters: skipping it flatters dark colours badly. */
function lightness(c: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
}

const GROUND: Rgb = { r: 10, g: 16, b: 34 };

describe('the colours the flare paints', () => {
  test('where it does not reach, the world is its own colour', () => {
    expect(flareColor(GROUND, 0)).toEqual(GROUND);
  });

  test('at the core it is the flare and nothing of the world is left', () => {
    expect(flareColor(GROUND, 1)).toEqual(FLARE_PEAK);
  });

  test('⚠️ and it gets brighter the whole way, which is what makes it read as a flare', () => {
    // The Dev's list is an order as much as a set: preto, marrom, vermelho, amarelo, branco. A ramp
    // that dipped anywhere would be a band with a dark ring in it, which is a hole rather than a
    // flare, and no assertion about the individual colours would notice.
    let last = -1;
    for (let grip = 0; grip <= 1.0001; grip += 0.05) {
      const l = lightness(flareColor(GROUND, Math.min(grip, 1)));
      expect(l, `grip ${grip.toFixed(2)} is brighter than the step before it`).toBeGreaterThan(last);
      last = l;
    }
  });

  test('it passes through a brown, a red and a yellow on the way', () => {
    // Read as hue rather than as exact triples, so the colours can be tuned without rewriting a test
    // that is really about the Dev's list being honoured.
    const brown = flareColor(GROUND, 0.3);
    const red = flareColor(GROUND, 0.55);
    const yellow = flareColor(GROUND, 0.8);

    expect(brown.r, 'the brown is warm').toBeGreaterThan(brown.b);
    expect(red.r, 'the red is dominated by red').toBeGreaterThan(red.g * 1.5);
    expect(yellow.g, 'the yellow has green as well as red').toBeGreaterThan(yellow.b * 2);
    expect(lightness(yellow), 'and the yellow is brighter than the red').toBeGreaterThan(lightness(red));
  });

  test('⚠️ AND THE PEAK STAYS DARKER THAN THE BALL, which is the half of the identity that is kept', () => {
    // See this file's header. The ground/role ordering is knowingly given up while the band passes;
    // this one is not, because a ball the player cannot see is a game they cannot play — and the
    // flare's core is exactly where the table has just slowed the ball down and asked them to look.
    const ball = paletteFor('sky', { cbSafe: false }).ball;

    expect(lightness(FLARE_PEAK), `peak ${lightness(FLARE_PEAK).toFixed(1)} vs ball ${lightness(ball).toFixed(1)}`)
      .toBeLessThan(lightness(ball));
  });
});

describe('the flare painted into a table', () => {
  const rowColor = (flareAt: number | undefined, y: number): number => {
    const fb = drawTable({ table: ION_STORM, ...(flareAt === undefined ? {} : { flareAt }) });
    /**
     * ⚠️ COLUMN 20, AND IT USED TO BE 8. The comment here said "the wall is at x 0..3 and the lane
     * divider is far to the right; x = 8 at y = 60 is open ground", which was true about the WALL and
     * stopped being enough: `gfx/surround` darkens the backdrop for six pixels around whatever stands
     * on it, so x = 8 is inside the left wall's shadow and is no longer ground the flare owns.
     *
     * Measured rather than nudged — the untouched columns at y = 60 are 10..55 and 79..91, and 20 is
     * in the middle of the first run. This is the surround being visible in a test that is about
     * something else, which is the cheapest possible way to find out that it works.
     */
    return fb.pixels[y * ION_STORM.size.width + 20]!;
  };

  test('a row at the centre of the band is painted the flare\'s core', () => {
    expect(rowColor(60, 60)).toBe(packRgb(FLARE_PEAK));
  });

  test('⚠️ and a row outside the band is exactly what a table with no flare gives', () => {
    // Without this the flare could be a wash over the whole picture and every other test here passes.
    expect(rowColor(60, 200)).toBe(rowColor(undefined, 200));
  });

  test('the band reaches as far as the storm says and no further', () => {
    const reach = ION_STORM.storm!.thickness / 2;

    expect(rowColor(60, 60 - reach + 1), 'just inside the top edge is lit').not.toBe(rowColor(undefined, 60 - reach + 1));
    expect(rowColor(60, 60 - reach), 'the top edge itself is not').toBe(rowColor(undefined, 60 - reach));
    expect(rowColor(60, 60 + reach), 'nor the bottom').toBe(rowColor(undefined, 60 + reach));
  });

  test('⚠️ and a table that declares no storm is untouched by the argument', () => {
    // `flareAt` is a position, not a permission. A picture that painted a flare because the caller
    // named a height would put one on every table in the catalogue the first time the frame loop was
    // tidied, and the storm is `ion-storm`'s alone.
    const calm = { ...ION_STORM, storm: undefined };
    const lit = drawTable({ table: calm, flareAt: 60 });
    const plain = drawTable({ table: calm });

    expect([...lit.pixels]).toEqual([...plain.pixels]);
  });
});
