// SPDX-License-Identifier: AGPL-3.0-or-later
// LIGHTS ON THE PLAYFIELD, AND A CEILING THEY MAY NOT GO THROUGH.
//
// ⚠️ THE DEV'S FIRST ITEM, WHICH HAS BEEN THE OLDEST OPEN ONE FOR DAYS: "Coloque luzes e recursos de
// iluminação pelos cenários." His art makes it concrete — floodlights over the launch pad, rails
// glowing green through the mine, neon around the storm.
//
// ========================= A LIGHT IS A THING ON THE TABLE, NOT A FILTER ON IT =========================
// A light has a place, a reach and a colour, and it brightens the GROUND around it. Not the components:
// they are drawn on top and carry their own lit state through `litLamps`, which is a different
// mechanism for a different fact — "this bumper is counting" versus "this corner of the table is lit".
//
// ⚠️ AND IT MAY BE WIRED TO A LAMP, which is what makes it a lighting FEATURE rather than decoration.
// A light naming a lamp is dark until that lamp is lit, so the table's own scoring turns the scenery
// on. The picture already recomposes when a lamp changes — that seam was built for drawing the lamps
// themselves — so nothing new has to watch anything.
//
// ========================= THE CEILING IS THE WHOLE DIFFICULTY =========================
// ⚠️ ADR-0004's MECHANISM IS THAT THE GROUND IS THE DARKEST THING ON THE TABLE, EVERYWHERE. A light
// brightens the ground, so a light is the one feature that can walk straight through that rule, and
// the headroom is NARROW: the darkest role is `free` at a CIE lightness of 34.7 and the brightest
// ground band is `sky`'s at 24.6. Adding twenty to each channel of that band reaches 33.2 — inside the
// rule by a pixel and a half; adding thirty reaches 37.4 and is outside it.
//
// So the brightness is capped in Lab rather than per channel, at a ceiling below the darkest role, and
// the cap is applied to the RESULT — after every light in reach has been summed. A per-light limit
// would be defeated by two lights overlapping, which is exactly what a row of floodlights is.
import { describe, test, expect } from 'vitest';
import { glowAt, GLOW_CEILING, type Light } from '../app/js/gfx/lighting.js';
import { paletteFor, type Rgb } from '../app/js/gfx/table-palette.js';
import { drawTable, drawBackground, paletteOf } from '../app/js/gfx/table-view.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';
import { PLAYABLE_TABLES } from '../app/js/table/catalog.js';
import { ION_STORM } from '../app/js/table/ion-storm.js';
import { LONG_CLIMB } from '../app/js/table/long-climb.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

function lightness(c: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
}

const GROUND: Rgb = { r: 10, g: 16, b: 34 };
const LAMP: Light = { at: { x: 100, y: 100 }, radius: 40, color: { r: 40, g: 30, b: 10 } };

describe('what a light does to the ground', () => {
  test('outside its reach, nothing at all', () => {
    expect(glowAt(GROUND, [LAMP], 100, 141, new Set())).toEqual(GROUND);
    expect(glowAt(GROUND, [LAMP], 20, 20, new Set())).toEqual(GROUND);
  });

  test('at its centre the ground is brighter', () => {
    expect(lightness(glowAt(GROUND, [LAMP], 100, 100, new Set())))
      .toBeGreaterThan(lightness(GROUND));
  });

  test('⚠️ and it FALLS OFF, which is what makes it a light rather than a disc', () => {
    // A flat disc of colour is a component. Light has an edge you cannot point at.
    // ⚠️ SAMPLED AT 0, 15 AND 30 OF A REACH OF 40, not out at 38. The falloff is quadratic, so the
    // last two pixels of any light add a fifth of one eight-bit step and round to nothing — which is
    // the light disappearing properly rather than a defect, and a test standing there is measuring
    // `Math.round`.
    const centre = lightness(glowAt(GROUND, [LAMP], 100, 100, new Set()));
    const middle = lightness(glowAt(GROUND, [LAMP], 100, 115, new Set()));
    const edge = lightness(glowAt(GROUND, [LAMP], 100, 130, new Set()));

    expect(centre).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(edge);
    expect(edge).toBeGreaterThan(lightness(GROUND));
  });

  test('and a table with no lights is untouched', () => {
    expect(glowAt(GROUND, [], 100, 100, new Set())).toEqual(GROUND);
  });
});

describe('⚠️ the ceiling, which is ADR-0004 surviving contact with a light', () => {
  const blinding: Light = {
    at: { x: 100, y: 100 }, radius: 40, color: { r: 255, g: 255, b: 255 },
  };

  test('a light that would blow the ground out is held below the ceiling', () => {
    const lit = glowAt(GROUND, [blinding], 100, 100, new Set());

    expect(lightness(lit), `lit ground came out at ${lightness(lit).toFixed(1)}`)
      .toBeLessThanOrEqual(GLOW_CEILING + 0.001);
  });

  test('⚠️ and the ceiling is below the darkest ROLE, or the rule it protects is gone', () => {
    // The claim the number has to satisfy. `free` is the dimmest thing that is ever drawn on top of
    // the ground; a ground that reached it would make a lane invisible wherever the two met.
    const darkest = Math.min(
      ...Object.values(paletteFor('sky', { cbSafe: false }).roles).map(lightness),
      ...Object.values(paletteFor('sky', { cbSafe: true }).roles).map(lightness),
    );

    expect(GLOW_CEILING, `ceiling ${GLOW_CEILING} vs darkest role ${darkest.toFixed(1)}`)
      .toBeLessThan(darkest);
  });

  test('⚠️ and TWO lights on the same spot do not add their way through it', () => {
    // The reason the cap is on the result and not on each light. A row of floodlights overlaps by
    // construction, and a per-light limit would be defeated by the second one.
    const two = glowAt(GROUND, [blinding, { ...blinding }], 100, 100, new Set());

    expect(lightness(two)).toBeLessThanOrEqual(GLOW_CEILING + 0.001);
  });
});

describe('⚠️ a light wired to a lamp is a lighting FEATURE, not scenery', () => {
  const wired: Light = { ...LAMP, lamp: 'lamp.pad' };

  test('with its lamp dark, the light is dark', () => {
    expect(glowAt(GROUND, [wired], 100, 100, new Set())).toEqual(GROUND);
  });

  test('with its lamp lit, the light is on', () => {
    expect(lightness(glowAt(GROUND, [wired], 100, 100, new Set(['lamp.pad']))))
      .toBeGreaterThan(lightness(GROUND));
  });

  test('and a light naming no lamp is always on', () => {
    expect(lightness(glowAt(GROUND, [LAMP], 100, 100, new Set())))
      .toBeGreaterThan(lightness(GROUND));
  });
});

/**
 * ⚠️ AND THE LIGHTS HAVE TO REACH A REAL TABLE, which the arithmetic above cannot say.
 *
 * Every gate in this file so far would pass with no table in the catalogue declaring a single light —
 * the module would be correct and unused, which is the shape of defect this repository has found six
 * times. And the lamp-wired half would pass with the wiring cut, because a light that is never on
 * looks exactly like a light that is off.
 */
describe('⚠️ the lights on the tables that declare them', () => {
  const lit = (table: AuthoredTable, lamps: readonly string[]): number => {
    const fb = drawTable({ table, litLamps: lamps });
    const dark = drawTable({ table, litLamps: [] });
    let changed = 0;
    for (let i = 0; i < fb.pixels.length; i++) if (fb.pixels[i] !== dark.pixels[i]) changed++;
    return changed;
  };

  test('⚠️ every playable table has at least one light on it', () => {
    // The Dev asked for lights "pelos cenários" — through the scenes, plural. A module with one user
    // is a module nobody has to keep working.
    const without = PLAYABLE_TABLES.filter((t) => (t.lights?.length ?? 0) === 0).map((t) => t.name);

    expect(without, 'these tables have no lights at all').toEqual([]);
  });

  test('⚠️ and lighting `ion-storm`’s storm lamps changes the picture', () => {
    // The join. Three lights on the middle cluster, each wired to one bumper's lamp: hitting the
    // cluster is what turns them on, and that is the whole difference between a lighting FEATURE and
    // a painted glow.
    const changed = lit(ION_STORM, ['lamp.storm1', 'lamp.storm2', 'lamp.storm3']);

    expect(changed, `${changed} pixels changed`).toBeGreaterThan(500);
  });

  test('⚠️ and a light naming no lamp does not flicker with the lamps', () => {
    // `long-climb`'s floodlights and its engine are always on. Asked of the whole PICTURE this would
    // be false and not because of the lights — lamps brighten COMPONENTS too, which is a different
    // mechanism — so it is asked of the background, which is the part lights own.
    const background = (lamps: readonly string[]) => {
      const fb = createFramebuffer(LONG_CLIMB.size.width, LONG_CLIMB.size.height);
      drawBackground(fb, LONG_CLIMB, paletteOf(LONG_CLIMB, false), { table: LONG_CLIMB, litLamps: lamps });
      return [...fb.pixels];
    };

    expect(background(LONG_CLIMB.lamps)).toEqual(background([]));
  });
});
