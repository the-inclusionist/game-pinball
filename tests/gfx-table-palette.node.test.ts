// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A PLAYER CAN TELL APART, MEASURED RATHER THAN ASSERTED.
//
// The Dev asked for palettes drawn from the 1995 table's own worlds — blue for sky, black for space,
// earthy red for Mars — with the tables sharing one visual identity, and for a CB-Safe alternative
// beside the normal one. This is the half of that request that can be checked.
//
// ⚠️ IT DOES NOT CHECK A RULE OF THUMB. "Avoid red and green together" is satisfiable by a palette
// nobody can read, and violated by palettes that are perfectly legible. Instead every colour is run
// through the ENGINE'S OWN simulation matrices — Machado, Oliveira & Fernandes 2009 at full severity,
// the same numbers `render/cvd-matrices` feeds the screen filter — and the distance between the
// results is measured in CIE Lab. That is the colour a protanope actually sees, from the same source
// the game will show them.
//
// ⚠️ AND THE THRESHOLD IS NOT TUNED TO THE DATA. CIE76 places a just-noticeable difference at about
// 2.3; this asks for 20, which is far past "these are two colours" and is chosen for the size things
// are drawn at — a ball of radius 3 and edges 2 pixels wide on a 320x180 screen, where a colour has
// very few pixels to make its case. The palettes were made to meet the number, not the other way
// round, and where a scene could not meet it the shortfall is named in `gfx/table-palette` rather
// than being legislated away here.
import { describe, test, expect } from 'vitest';
import { CVD_MATRIX } from '@the-inclusionist/engine/render/cvd-matrices.js';
import {
  SCENES, sceneOf, paletteFor, backdropAt, type Rgb, type TablePalette,
} from '../app/js/gfx/table-palette.js';
import { CATALOG } from '../app/js/table/catalog.js';

/** The three things a person cannot see, as against the three corrections that help them. */
const SIMULATIONS = ['sim-protan', 'sim-deuter', 'sim-tritan'] as const;

/** CIE76 asks for a distance of about 2.3 to notice at all. Twenty is a different colour. */
const APART = 20;

function simulate(c: Rgb, key: (typeof SIMULATIONS)[number]): Rgb {
  const m = CVD_MATRIX[key];
  const at = (row: number) =>
    Math.max(0, Math.min(255, m[row * 5]! * c.r + m[row * 5 + 1]! * c.g + m[row * 5 + 2]! * c.b));
  return { r: at(0), g: at(1), b: at(2) };
}

/** sRGB to CIE Lab, D65. The gamma step matters: skipping it flatters dark colours badly. */
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

/** Every colour a player has to read on the table, by the name they would be told. */
function swatches(p: TablePalette): [string, Rgb][] {
  return [['the ground', p.ground], ['the ball', p.ball],
    ...Object.entries(p.roles).map(([role, rgb]) => [role, rgb] as [string, Rgb])];
}

/** Every pair, once, with the distance between them under one way of seeing. */
function pairs(p: TablePalette, see: (c: Rgb) => Rgb): { pair: string; apart: number }[] {
  const all = swatches(p);
  const out: { pair: string; apart: number }[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      out.push({ pair: `${all[i]![0]} / ${all[j]![0]}`, apart: deltaE(see(all[i]![1]), see(all[j]![1])) });
    }
  }
  return out;
}

const identity = (c: Rgb): Rgb => c;

describe('the scenes the authored tables are drawn in', () => {
  test('every table in the catalogue has one, and no table is left to a default', () => {
    // ⚠️ A DEFAULT WOULD HIDE THE OMISSION. A sixth table added tomorrow with no scene chosen for it
    // should stop this test, not quietly come out slate-grey and look finished.
    for (const table of CATALOG) {
      const scene = sceneOf(table.name);
      expect(scene, `${table.name} has a world chosen for it`).toBeDefined();
      expect(SCENES[scene!], `${table.name} names a scene that exists`).toBeDefined();
    }
  });

  test('⚠️ and every scene keeps the ground the DARKEST thing and the ball the LIGHTEST', () => {
    // This is the identity the Dev asked the tables to share. Not a hue — on Mars the world is red and
    // on the sky table it is blue, so no colour can be constant — but an ORDER: whatever the world is
    // made of, the ball is the brightest object on it and the floor is the dimmest. A player who
    // learns to find the ball on one table finds it on all five.
    for (const name of Object.keys(SCENES)) for (const cbSafe of [false, true]) {
      const p = paletteFor(name, { cbSafe });
      const lightness = (c: Rgb) => lab(c)[0];
      /**
       * ⚠️ THE BRIGHTEST BAND, NOT THE NOMINAL GROUND, and this test compared the nominal one until
       * `Scene.bands` existed. A world may be a gradient now — the Dev's four themes all are — and a
       * single band brighter than a role would make that role unreadable wherever the two met while
       * this gate went on passing, because `ground` is only the colour a flat world would use.
       *
       * The identity being protected is an ORDER: whatever the world is made of, the floor is the
       * dimmest thing on it. A gradient has to obey that everywhere, not on average.
       */
      const floor = (p.bands ?? [{ at: 0, color: p.ground }])
        .reduce((a, b) => (lightness(b.color) > lightness(a.color) ? b : a)).color;

      for (const [what, rgb] of swatches(p)) {
        if (what === 'the ground') continue;
        expect(lightness(rgb), `${name}/${cbSafe}: ${what} is lighter than the brightest ground band`)
          .toBeGreaterThan(lightness(floor));
        if (what === 'the ball') continue;
        expect(lightness(p.ball), `${name}/${cbSafe}: the ball is lighter than ${what}`)
          .toBeGreaterThan(lightness(rgb));
      }
    }
  });

  test('and in normal vision every pair of them is a different colour', () => {
    for (const name of Object.keys(SCENES)) for (const cbSafe of [false, true]) {
      const tooClose = pairs(paletteFor(name, { cbSafe }), identity).filter((p) => p.apart < APART);

      expect(tooClose.map((p) => `${name}/${cbSafe}: ${p.pair} (${p.apart.toFixed(1)})`)).toEqual([]);
    }
  });
});

describe('the CB-Safe alternative', () => {
  test('⚠️ HAZARD stays apart from everything else, under all three simulations', () => {
    // The strongest claim this palette makes, and the one worth the most: the drain is the only thing
    // on the table that ends a ball, and a player who cannot pick it out is playing a different game.
    // Every other role can afford to be confused with its neighbour for a moment; this one cannot.
    for (const name of Object.keys(SCENES)) {
      const p = paletteFor(name, { cbSafe: true });
      const hazard = p.roles.hazard;

      for (const key of SIMULATIONS) {
        const seen = swatches(p).filter(([what]) => what !== 'hazard')
          .map(([what, rgb]) => ({ what, apart: deltaE(simulate(hazard, key), simulate(rgb, key)) }))
          .filter((s) => s.apart < APART);

        expect(seen.map((s) => `${name}/${key}: hazard / ${s.what} (${s.apart.toFixed(1)})`)).toEqual([]);
      }
    }
  });

  test('⚠️ and it EARNS its place: the normal palette does not survive the same test', () => {
    // Without this the alternative could be a copy of the normal palette under another name, every
    // assertion above would still pass, and a menu entry would promise something it does not do.
    const failures: string[] = [];
    for (const name of Object.keys(SCENES)) {
      const p = paletteFor(name, { cbSafe: false });
      for (const key of SIMULATIONS) {
        for (const { pair, apart } of pairs(p, (c) => simulate(c, key))) {
          if (apart < APART) failures.push(`${name}/${key}: ${pair}`);
        }
      }
    }

    expect(failures.length, 'the normal palette loses pairs that the CB-Safe one keeps')
      .toBeGreaterThan(0);
  });

  test('⚠️ and NOTHING collapses: every pair survives all three simulations', () => {
    // The claim above is the one that matters most; this is the one that makes the mode worth
    // offering. The normal palette loses five pairs under simulation — the test below counts them —
    // and this says the alternative loses none, on any of the five worlds.
    for (const name of Object.keys(SCENES)) {
      const p = paletteFor(name, { cbSafe: true });
      for (const key of SIMULATIONS) {
        const lost = pairs(p, (c) => simulate(c, key)).filter((x) => x.apart < APART);

        expect(lost.map((x) => `${name}/${key}: ${x.pair} (${x.apart.toFixed(1)})`)).toEqual([]);
      }
    }
  });

  test('⚠️ and hazard is still WARM, because the switch must not change what a colour means', () => {
    // A palette optimised for separation alone will happily make the drain teal and the water gold —
    // it did, on the first run, and every distance test passed. Red for the thing that takes your
    // ball is the one convention a player brings with them, and an accessibility mode that spends it
    // has taken more than it gave.
    for (const name of Object.keys(SCENES)) {
      const { r, g, b } = paletteFor(name, { cbSafe: true }).roles.hazard;

      expect(r, `${name}: hazard is red-dominant`).toBeGreaterThan(g + 60);
      expect(r, `${name}: hazard is red-dominant`).toBeGreaterThan(b + 60);
    }
  });

  test('the two are different palettes, scene by scene, and not one palette twice', () => {
    for (const name of Object.keys(SCENES)) {
      const normal = paletteFor(name, { cbSafe: false });
      const safe = paletteFor(name, { cbSafe: true });

      expect(safe.roles, `${name} has a CB-Safe variant of its own`).not.toEqual(normal.roles);
      // ⚠️ AND IT IS STILL THE SAME WORLD. The Dev asked for an ADJUSTABLE alternative, not a second
      // game: switching it on must not move the player from Mars to somewhere else. The ground carries
      // the scene, so the ground is what has to survive the switch.
      expect(safe.ground, `${name} keeps its own ground`).toEqual(normal.ground);
    }
  });
});

/**
 * ⚠️ A WORLD IS ONE FLAT COLOUR, AND THE DEV ASKED FOR FOUR THAT ARE NOT.
 *
 * "low orbit deve ter desenhos que lembram a atmosfera azul da terra até a metade"; "crater-run deve
 * ter a temática da lua... com trilhos sob uma mina branca e sombras pretas"; "ion-storm deve ter um
 * fundo que varia de preto, marrom, vermelho, amarelo e branco"; "ring-belt deve ser ambientado nos
 * anéis de saturno". Every one of those is a background that CHANGES down the table, and a `Scene`
 * has had exactly one `ground` since it was written.
 *
 * ⚠️ BANDS RATHER THAN AN IMAGE, and that is the licence talking as much as the size. `docs/LICENSES`
 * § 4 keeps art under its author's terms and this repository has one asset in it, a font. A gradient
 * declared as colour stops is CODE — it is AGPL like everything around it, it costs no bytes, and it
 * scales to any table height without a second file.
 */
describe('⚠️ a world that changes down the table', () => {
  const stops = [
    { at: 0, color: { r: 0, g: 0, b: 0 } },
    { at: 1, color: { r: 100, g: 200, b: 40 } },
  ];

  test('at the top it is the first stop', () => {
    expect(backdropAt(stops, 0)).toEqual({ r: 0, g: 0, b: 0 });
  });

  test('at the bottom it is the last', () => {
    expect(backdropAt(stops, 1)).toEqual({ r: 100, g: 200, b: 40 });
  });

  test('⚠️ and between them it INTERPOLATES, which is the whole point of a stop', () => {
    expect(backdropAt(stops, 0.5)).toEqual({ r: 50, g: 100, b: 20 });
  });

  test('three stops give two segments, each interpolated on its own', () => {
    // The Dev's `low-orbit` is "the blue atmosphere to the HALFWAY line" and space above it, which is
    // two segments with a hard boundary in the middle rather than one wash.
    const three = [
      { at: 0, color: { r: 0, g: 0, b: 0 } },
      { at: 0.5, color: { r: 0, g: 0, b: 100 } },
      { at: 1, color: { r: 0, g: 0, b: 200 } },
    ];

    expect(backdropAt(three, 0.25)).toEqual({ r: 0, g: 0, b: 50 });
    expect(backdropAt(three, 0.75)).toEqual({ r: 0, g: 0, b: 150 });
  });

  test('⚠️ a single stop is a flat colour, so a world may still be one', () => {
    // Four of the five worlds want no gradient at all, and answering "then do not declare stops" is
    // better than making every scene carry a two-element list that says nothing.
    expect(backdropAt([{ at: 0, color: { r: 9, g: 9, b: 9 } }], 0.6)).toEqual({ r: 9, g: 9, b: 9 });
  });

  test('and outside the stops it holds the nearest one rather than running off', () => {
    expect(backdropAt(stops, -1)).toEqual({ r: 0, g: 0, b: 0 });
    expect(backdropAt(stops, 4)).toEqual({ r: 100, g: 200, b: 40 });
  });

  test('⚠️ every scene that declares bands starts and ends where the table does', () => {
    // A stop list that began at 0.2 would leave the top fifth of the table undefined, and "hold the
    // nearest" would paint it a colour nobody chose. The rule is checkable, so it is checked.
    for (const [name, scene] of Object.entries(SCENES)) {
      if (!scene.bands) continue;
      expect(scene.bands[0]!.at, `${name} starts at the top`).toBe(0);
      expect(scene.bands[scene.bands.length - 1]!.at, `${name} ends at the bottom`).toBe(1);
      const rising = scene.bands.every((s, i) => i === 0 || s.at > scene.bands![i - 1]!.at);
      expect(rising, `${name}'s stops are in order`).toBe(true);
    }
  });
});
