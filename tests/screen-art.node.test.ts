// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PHOTOGRAPHS BEHIND THE SCREENS, MEASURED ON THE FILES THAT SHIP.
//
// ⚠️ THE DEV: "Use background.jpg como fundo de todas as telas que não tenham mesa com exceção da
// primeira tela. Para a tela inicial, use start.jpg como background."
//
// A photograph behind text is a contrast problem before it is a decoration, and this repository has
// already paid for treating one as the other: the table art was dimmed by a rule nobody had written
// down and came out at seven per cent lightness, and the comets' first colour claimed a 3:1 window
// against the art that turned out to be 1.04:1. Both were found by measuring rather than by looking.
//
// So the two pictures are held to the numbers `shell/screen-art` derives, on the PNGs in the build —
// not on the masters, which are gitignored, and not on the importer's own arithmetic, which is a
// second copy of the same claim.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readPng } from './helpers/png.js';
import {
  SCREEN_ARTS, SCREEN_DIMMED, SCREEN_CEILING, TEXT_RATIO, PANEL_ALPHA, PANEL_UNDER,
  UI_INK, UI_DIM, CHERRY, NEON,
} from '../app/js/shell/screen-art.js';

const pathOf = (name: string): string => `app/assets/screens/${name}.png`;

const channel = (byte: number): number => {
  const s = byte / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (r: number, g: number, b: number): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** The picture as rows of bytes, from the file that is actually shipped. */
function pixelsOf(name: string): { width: number; height: number; rgb: number[][] } {
  const png = readPng(readFileSync(pathOf(name)));
  const rgb: number[][] = [];
  for (const word of png.pixels) {
    rgb.push([word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff]);
  }
  return { width: png.width, height: png.height, rgb };
}

describe.each(SCREEN_ARTS)('%s.png', (name) => {
  test('it is there, at the size the game is', () => {
    expect(existsSync(pathOf(name)), `${pathOf(name)} is missing — run scripts/import-art.py`)
      .toBe(true);
    const { width, height } = pixelsOf(name);
    // ⚠️ THE GAME'S OWN GRID. A photograph at the page's resolution behind pixel art at a sixth of it
    // would be the one sharp thing on the screen — and two megabytes on a game meant to run offline.
    expect([width, height], 'the picture is not 320x180').toEqual([320, 180]);
  });

  test('it is a photograph and not a dark rectangle', () => {
    /**
     * ⚠️ THE FAILURE THIS CATCHES HAS HAPPENED HERE BEFORE. "No pixel brighter than the ceiling"
     * applied to a whole picture put the table art at a median of Y 0.0079 — seven per cent lightness
     * — and the Dev's report was "as cores das mesas ficaram escuras demais". A ceiling is satisfied
     * perfectly by black.
     */
    const { rgb } = pixelsOf(name);
    const lit = rgb.map(([r, g, b]) => luminance(r!, g!, b!)).sort((a, b) => a - b);
    const median = lit[Math.floor(lit.length / 2)]!;
    const lstar = (y: number): number => 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;

    /**
     * ⚠️ THE MEDIAN BAR IS ONLY OWED BY A PICTURE THAT WAS AIMED AT ONE. `scripts/import-art.py` puts a
     * DIMMED picture's median on L* 30 deliberately, so a median far below that means the curve went
     * wrong — which is the failure that put the table art at seven per cent lightness. An UNDIMMED one
     * has whatever median the photograph has: `start.png` sits at L* 12.8 because most of it is space,
     * and that is the picture the Dev asked to be left alone rather than a fault.
     */
    if (SCREEN_DIMMED[name]) {
      expect(lstar(median), `the median is L* ${lstar(median).toFixed(1)}, which is a black rectangle`)
        .toBeGreaterThan(18);
    }
    /**
     * And it has SOME range: a flat field of one colour would pass a median check and be no picture.
     *
     * ⚠️ EIGHT POINTS, AND THE FIRST VERSION OF THIS LINE ASKED FOR TWENTY — a number I made up, which
     * `background.png` failed at 17.2. Two rounds of increasingly clever tone curves went into
     * satisfying it before the obvious question got asked: what is range FOR, on a picture whose whole
     * job is to sit behind menus? Nothing. Flat and dark is what a background should be. The master
     * itself has almost none — its first percentile is L* 7.2 and its ninety-fifth L* 26.6 — and the
     * two attempts to invent some produced a shadow-lifted picture and a noisy one.
     *
     * What this line is actually for is a picture that failed to import: a solid fill, or the ceiling
     * applied to something already black. Eight points is well under both photographs and well over
     * anything that is not a photograph at all.
     */
    expect(lstar(lit[Math.floor(lit.length * 0.95)]!) - lstar(lit[Math.floor(lit.length * 0.05)]!),
      'the picture is a flat field rather than a photograph').toBeGreaterThan(8);
  });
});

/**
 * ⚠️ THE CEILING IS ONLY OWED BY THE PICTURES THAT ARE DIMMED, which since the Dev's second look is
 * `background` alone: "Pirmeira tela: não use filtro para escurecer, deixe a imagem original."
 *
 * Splitting this out rather than skipping it inside the walk is the difference between a gate that
 * says "this one does not owe the ratio, and here is why" and a gate that quietly does not run. The
 * title owes a different thing, and the block after this one is where it is asked for.
 */
describe.each(SCREEN_ARTS.filter((n) => SCREEN_DIMMED[n]))('%s.png is held under the ceiling', (name) => {
  test('⚠️ no pixel is bright enough to swallow the text on it', () => {
    /**
     * The claim the whole import is built on: every word on these screens is `UI_INK`, and 4.5:1
     * against it is what `SCREEN_CEILING` means. Measured on the file rather than trusted from the
     * script, because the script rounds, quantises to 192 colours and writes a palette — three steps
     * after the arithmetic, each of which has moved a number before. `to_srgb` rounds DOWN for exactly
     * this reason, and this is what says the flooring is still there.
     */
    const { rgb } = pixelsOf(name);
    const ink = luminance(UI_INK.r, UI_INK.g, UI_INK.b);
    let worst = 0;
    let where = -1;
    for (const [i, [r, g, b]] of rgb.entries()) {
      const y = luminance(r!, g!, b!);
      if (y > worst) {
        worst = y;
        where = i;
      }
    }

    expect(worst, `the brightest pixel is at index ${where}, Y=${worst.toFixed(4)}`)
      .toBeLessThanOrEqual(SCREEN_CEILING);
    expect(ratio(ink, worst), 'the text does not clear 4.5:1 over its own background')
      .toBeGreaterThanOrEqual(TEXT_RATIO);
  });

  test('⚠️ and the panel makes it safe for the quieter text too', () => {
    /**
     * ⚠️ `UI_DIM` DOES NOT GET THE CEILING FOR FREE. It is Y 0.29027 against a picture allowed up to
     * 0.1469, which measures 1.73:1 — not a readable colour on a photograph, barely a visible one. The
     * legend, the scoreboard, the back links and the mission's explanation are all DIM on purpose, so
     * they sit on a panel instead of on the picture.
     *
     * ⚠️ COMPOSITED IN sRGB BYTES, WHICH IS WHAT A BROWSER DOES. CSS blends `rgba()` in the encoded
     * space by default, not in linear light — so this mixes the bytes and then converts, in that
     * order. Doing it the physically correct way here would report a DIFFERENT number from the one a
     * player sees, which is the only number that matters.
     */
    const { rgb } = pixelsOf(name);
    const dim = luminance(UI_DIM.r, UI_DIM.g, UI_DIM.b);
    const mix = (over: number, under: number): number =>
      (1 - PANEL_ALPHA) * over + PANEL_ALPHA * under;

    let worst = 0;
    for (const [r, g, b] of rgb) {
      const y = luminance(
        mix(r!, PANEL_UNDER.r), mix(g!, PANEL_UNDER.g), mix(b!, PANEL_UNDER.b),
      );
      if (y > worst) worst = y;
    }

    expect(ratio(dim, worst),
      `the quiet text measures ${ratio(dim, worst).toFixed(2)}:1 over the panel at alpha ${PANEL_ALPHA}`)
      .toBeGreaterThanOrEqual(TEXT_RATIO);
  });

});

/**
 * ⚠️ AND THE TITLE OWES THE SAME 4.5:1 THROUGH ITS OUTLINE INSTEAD.
 *
 * The photograph is untouched, so there is no bound on what is behind a letter: somewhere in a sunrise
 * there is a pixel that matches any fill you choose. What holds is the OUTLINE — white inside cherry,
 * cherry inside a neon halo — because the eye reads the edge between the two, and neither of them is
 * the photograph.
 *
 * So what a gate can check here is the pair, and it is the pair that has to clear the ratio. The rest
 * — that the outline is actually applied to the elements — is `tests/title.browser`, because a
 * `-webkit-text-stroke` that a browser ignores is a border nobody has.
 */
describe('the title carries its own contrast', () => {
  const parse = (css: string): { r: number; g: number; b: number } => {
    const [r, g, b] = css.match(/\d+/g)!.map(Number);
    return { r: r!, g: g!, b: b! };
  };

  test('⚠️ white on the cherry border clears 4.5:1 — the border IS the contrast', () => {
    const ink = luminance(UI_INK.r, UI_INK.g, UI_INK.b);
    const cherry = parse(CHERRY);
    const measured = ratio(ink, luminance(cherry.r, cherry.g, cherry.b));

    expect(measured, `SPACE STUDENT is white inside cherry, and that pair measures ${measured.toFixed(2)}:1`)
      .toBeGreaterThanOrEqual(TEXT_RATIO);
  });

  test('⚠️ and the neon is brighter than the cherry it surrounds, or it is a shadow', () => {
    /**
     * PINBALL is cherry with no outline — the Dev asked for exactly that — so the only thing standing
     * between it and the photograph is the glow. A halo DARKER than its letter is a drop shadow: it
     * would read as depth rather than as light, and on the dark half of the picture it would vanish
     * into the ground it is supposed to separate the letter from.
     */
    const cherry = parse(CHERRY);
    const neon = parse(NEON);
    const inside = luminance(cherry.r, cherry.g, cherry.b);
    const halo = luminance(neon.r, neon.g, neon.b);

    expect(halo, `the halo is Y ${halo.toFixed(4)} and the letter Y ${inside.toFixed(4)}`)
      .toBeGreaterThan(inside);
    expect(ratio(halo, inside), 'the halo is too close to the letter to be seen as a halo')
      .toBeGreaterThan(1.5);
  });
});

describe('the two are not the same picture', () => {
  test('⚠️ because a swapped import would be silent', () => {
    // `start` is the title and `background` is every screen between it and a table. Importing one file
    // twice would give a game that looks deliberate and is wrong, with nothing to notice it.
    const [a, b] = SCREEN_ARTS.map((name) => pixelsOf(name));
    const differing = a!.rgb.filter(([r, g, bl], i) =>
      r !== b!.rgb[i]![0] || g !== b!.rgb[i]![1] || bl !== b!.rgb[i]![2]).length;

    expect(differing / a!.rgb.length, 'the title and the other screens are the same photograph')
      .toBeGreaterThan(0.5);
  });
});
