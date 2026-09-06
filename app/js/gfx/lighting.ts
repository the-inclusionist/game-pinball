// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/lighting — lights standing on the playfield, and the ceiling they may not go through.
//
// ========================= WHY THIS EXISTS =========================
// ⚠️ THE DEV'S FIRST ITEM, and the oldest one still open: "Coloque luzes e recursos de iluminação
// pelos cenários." His art makes it concrete — floodlights over the launch pad, rails glowing green
// through the mine, neon around the storm.
//
// ========================= A LIGHT IS A THING ON THE TABLE =========================
// It has a place, a reach and a colour, and it brightens the GROUND around it. Not the components:
// those are drawn on top and carry their own lit state through `litLamps`, which answers a different
// question — "this bumper is counting" rather than "this corner of the table is lit".
//
// ⚠️ AND IT MAY BE WIRED TO A LAMP, which is what makes it a lighting FEATURE and not decoration. A
// light naming a lamp is dark until that lamp is lit, so the table's own scoring turns the scenery on.
// The picture already recomposes when a lamp changes — that seam was built for drawing the lamps
// themselves — so nothing new has to watch anything.
//
// ========================= THE CEILING IS THE WHOLE DIFFICULTY =========================
// ⚠️ ADR-0004's MECHANISM IS THAT THE GROUND IS THE DARKEST THING ON THE TABLE, EVERYWHERE, and a
// light is the one feature that can walk straight through it. The headroom is NARROW and it was
// measured rather than assumed: the darkest role is `free` at a CIE lightness of 34.7 and the
// brightest ground band is `sky`'s at 24.6. Twenty per channel on that band reaches 33.2 — inside the
// rule by a pixel and a half. Thirty reaches 37.4 and is outside it.
//
// So the result is capped in LAB rather than per channel, and the cap is applied AFTER every light in
// reach has been summed. A per-light limit would be defeated by two lights overlapping, which is
// exactly what a row of floodlights is.

import type { Rgb } from './table-palette.js';

/**
 * The lightest the ground may be made, in CIE L*.
 *
 * ⚠️ THIRTY-TWO BECAUSE THE DARKEST ROLE IS 34.7. `free` is the dimmest thing ever drawn on top of the
 * ground, and a ground that reached it would make a lane invisible wherever the two met. Two and a
 * half units of headroom, so that changing a role's colour fails a gate rather than drifting across
 * the line unnoticed — `tests/gfx-lighting` checks this number against the palette itself.
 */
export const GLOW_CEILING = 32;

/**
 * ⚠️ WHAT THIS COSTS, MEASURED, because it is the only per-pixel work in a composition otherwise made
 * of `fillRect` calls. Best of three runs of six hundred compositions each:
 *
 *     `ion-storm`, three lights lit          1.34 ms
 *     `ion-storm`, the same lights dark      0.22 ms
 *     `low-orbit`, two lights always on      1.48 ms
 *
 * `ion-storm` is the case that matters, because its flare moves and the picture is therefore rebuilt
 * about forty times a second: 1.34 ms of that is FIVE PER CENT of a fast machine's second, and this
 * game is for school laptops where it will be more.
 *
 * ⚠️ AND THE FIRST VERSION WAS 8.75 ms, which would not have run at all. Three things took it down:
 * a 256-entry table instead of `** 2.4`, comparing luminance instead of taking a cube root, and
 * removing every allocation from the inner loop. The arithmetic was never the cost.
 *
 * If it has to come down further, the lever is NOT here: the lights' contribution to a pixel does not
 * depend on the flare, so it could be computed once per lit-lamp change and kept. That is a cache
 * inside a pure function and it has not been paid for yet.
 */

/**
 * A light with its colour already resolved from the palette.
 *
 * ⚠️ THE TABLE DECLARES A ROLE, NOT A COLOUR — see `AuthoredLight` in `table/authored`. Every colour
 * in this game comes from the palette so that the CB-Safe variant moves with it, and a light holding
 * its own triple would be the one thing on the table that did not change when the player asked for
 * colours they can tell apart. `gfx/table-view` resolves the role and hands the result here.
 */
export interface Light {
  readonly at: { readonly x: number; readonly y: number };
  /** How far it reaches, in table pixels. Nothing outside this is touched at all. */
  readonly radius: number;
  /** What it adds at its centre, before the ceiling. */
  readonly color: Rgb;
  /**
   * The lamp that switches it on. Absent means always on.
   *
   * This is the join that makes a light part of the game rather than part of the wallpaper: the table
   * lights its own scenery by being played.
   */
  readonly lamp?: string;
}

/**
 * sRGB to linear, for all 256 values a channel can hold.
 *
 * ⚠️ A TABLE BECAUSE THE FIRST VERSION WAS TOO SLOW TO SHIP, and it was measured rather than
 * suspected. `ion-storm` with three lights and its flare composed in 8.75 ms — and its flare moves,
 * so the picture is rebuilt about forty times a second, which is THIRTY-FIVE PER CENT of a fast
 * machine's frame budget spent on scenery. On the school laptops this game is for it would not have
 * run at all.
 *
 * The cost was `** 2.4` and `Math.cbrt` in the innermost loop. Every channel that reaches this
 * function has already been rounded to an integer, so the exponent is one of 256 answers and the
 * table is exact rather than approximate.
 */
const LINEAR = new Float64Array(256);
for (let v = 0; v < 256; v++) {
  const c = v / 255;
  LINEAR[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * The ceiling as a relative luminance rather than as a lightness.
 *
 * ⚠️ THE CUBE ROOT IS THE OTHER HALF OF THE COST, and it is not needed at all: L* is monotone in Y, so
 * "is this brighter than L* 32" and "is this brighter than the Y that L* 32 corresponds to" are the
 * same question, and the second one is three multiplies. Inverting it once here rather than computing
 * a cube root per pixel is the whole of that saving.
 */
const CEILING_Y = ((GLOW_CEILING + 16) / 116) ** 3;

function overCeiling(r: number, g: number, b: number): boolean {
  return 0.2126 * LINEAR[r]! + 0.7152 * LINEAR[g]! + 0.0722 * LINEAR[b]! > CEILING_Y;
}

/**
 * The ground at (x, y) with every light that reaches it.
 *
 * ⚠️ QUADRATIC FALLOFF, NOT LINEAR. A linear ramp reads as a cone with a visible rim; the square of
 * the remaining reach puts most of the brightness near the middle and lets the edge disappear, which
 * is what stops a light looking like a disc somebody drew.
 */
export function glowAt(
  base: Rgb, lights: readonly Light[], x: number, y: number, lit: ReadonlySet<string>,
): Rgb {
  const out = { r: 0, g: 0, b: 0 };
  return glowInto(base, lights, x, y, lit, out) ? out : base;
}

/**
 * The same thing, writing into a colour the caller owns.
 *
 * ⚠️ BECAUSE THE ALLOCATION WAS THE COST. `gfx/table-view` calls this once per lit pixel — eighteen
 * thousand of them on `ion-storm`, forty times a second because its flare moves — and returning a
 * fresh object each time was most of the 1.8 ms a composition took. Returns FALSE when no light
 * reached the pixel, which is the caller's signal to use the base colour it already has and touch
 * nothing.
 */
export function glowInto(
  base: Rgb, lights: readonly Light[], x: number, y: number, lit: ReadonlySet<string>,
  out: { r: number; g: number; b: number },
): boolean {
  let addR = 0;
  let addG = 0;
  let addB = 0;

  for (const light of lights) {
    if (light.lamp !== undefined && !lit.has(light.lamp)) continue;
    // Squared, so the square root is only paid inside the reach — most pixels are outside every light.
    const dx = x - light.at.x;
    const dy = y - light.at.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq >= light.radius * light.radius) continue;
    const t = 1 - Math.sqrt(distanceSq) / light.radius;
    const fall = t * t;
    addR += light.color.r * fall;
    addG += light.color.g * fall;
    addB += light.color.b * fall;
  }

  if (addR === 0 && addG === 0 && addB === 0) return false;

  /**
   * ⚠️ THE CEILING, ON THE SUM. Scaled back along the line from the base colour to the lit one rather
   * than clamped per channel: clamping would change the light's HUE as it brightened, so a warm
   * floodlight would go white before it went bright and the table would gain a colour nobody chose.
   *
   * ⚠️ AND THE WHOLE OF THIS RUNS WITHOUT ALLOCATING, which was worth 2.3 ms a composition. The first
   * version built a colour object per bisection step — eleven per lit pixel, eighteen thousand lit
   * pixels on `ion-storm`, forty compositions a second because its flare moves. The arithmetic was
   * never the cost; the objects were.
   */
  let low = 0;
  let high = 1;
  if (overCeiling(clamp(base.r + addR), clamp(base.g + addG), clamp(base.b + addB))) {
    // Ten steps: the answer is an eight-bit colour, so a thousandth of the scale is already finer
    // than anything that can be drawn.
    for (let i = 0; i < 10; i++) {
      const mid = (low + high) / 2;
      if (overCeiling(
        clamp(base.r + addR * mid), clamp(base.g + addG * mid), clamp(base.b + addB * mid),
      )) high = mid;
      else low = mid;
    }
  } else {
    low = 1;
  }

  out.r = clamp(base.r + addR * low);
  out.g = clamp(base.g + addG * low);
  out.b = clamp(base.b + addB * low);
  return true;
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}
