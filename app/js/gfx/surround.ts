// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/surround — the backdrop is darkened AROUND what stands on it, and nowhere else.
//
// ========================= WHAT THE DEV SAID =========================
// ⚠️ "As cores das mesas ficaram escuras demais, o contraste ficou altíssimo, mas o necessário e
// suficiente é 3:1." Two complaints and the answer to both in the same sentence: the tables came out
// too dark, the contrast came out far past what anything needs, and three to one is the requirement.
//
// He is right on every count, and the measurement says why.
//
// ========================= THE NUMBERS THAT FORCED THIS =========================
// Every shipped picture was multiplied down until its brightest pixel sat under ADR-0007's L* 32, so
// that no role could ever be washed out by the art behind it. Measured across all six tables:
//
//     median luminance Y 0.0079 (L* 7.1)   ·   95th percentile Y 0.0393   ·   brightest Y 0.0685
//
// A picture at seven per cent lightness. And what it bought, role by role, against that median:
//
//     free 2.41:1   hazard 3.99:1   gate 5.24:1   climb 5.70:1
//     structure 5.76:1   water 6.89:1   key 9.52:1   goal 12.42:1
//
// ⚠️ SO THE ONE ROLE THAT FAILED IS THE ONE THE DARKENING WAS FOR. `free` never reached 3:1 against
// any part of any picture — and could not have, at any dim: at Y 0.0833 its contrast against PURE
// BLACK is 2.67:1. Meanwhile `goal` sat at twelve to one, four times what it needs. The darkening was
// spending the whole picture on a rule it was not even delivering.
//
// ========================= AND THE MEASUREMENT THAT SAYS WHERE TO SPEND IT =========================
// ⚠️ COMPONENTS COVER BETWEEN 8.6% AND 12.5% OF A PLAYFIELD. Measured by drawing every table twice,
// once on a black backdrop and once on a white one, and counting the pixels that came out identical.
// `ring-belt` 8.6%, `crater-run` 10.1%, `long-climb` 11.4%, `slipstream` 11.5%, `low-orbit` and
// `ion-storm` 12.5%.
//
// So a global dim charges the whole picture for a ninth of it. Contrast is not a property of a
// picture: it is a property of a BOUNDARY, which is what WCAG 1.4.11 means by "adjacent colours". The
// only place a role's contrast can be read is where that role is drawn and just outside it. Nine
// pixels in ten are scenery that nothing ever stands on, and they were being blacked out for a rule
// that has nothing to say about them.
//
// ⚠️ AND "AROUND EACH COMPONENT" MEANS AROUND WHAT IT PAINTS, NOT AROUND ITS BOUNDS. The first
// version dilated the bounding rectangles and shadowed 76.2% OF `low-orbit` — six times the area the
// components cover — because a lane is a long diagonal rectangle whose interior it never draws:
// `drawLaneRails` paints only its rails. Nine tenths of that shadow was inside lanes, over art no
// component is anywhere near.
//
// So the footprint is ASKED OF THE RENDERER rather than restated here. `gfx/table-view.drawComponents`
// paints onto a scratch frame and the pixels it touched are the footprint, exactly. That is one rule
// with one copy, in a repository that has paid four times over for the alternative.
//
// ⚠️ THIS DARKENS AROUND EACH COMPONENT AND LEAVES THE REST ALONE. What comes out is not a compromise
// either: a dark surround under a lit thing is what a shadow looks like, so the components stop
// floating on the picture and start standing on the table.
//
// ========================= WHY THE CEILING IS PER ROLE =========================
// ⚠️ ONE NUMBER FOR EVERY ROLE IS WHAT PRODUCED THE PROBLEM ABOVE. `goal` at Y 0.6366 clears 3:1
// against a surround as bright as Y 0.1789 — L* 49, half way up the scale, a surround that barely
// looks dimmed at all. `free` at Y 0.1056 needs one at Y 0.0019, which is very nearly black. Holding
// both to the darker figure blacks out the ground under the gold for no reason; holding both to the
// lighter one loses the lane.
//
// So each component darkens by its own role's arithmetic, and the visible result is a rule nobody set
// out to write: THE DARK ROLES SIT IN DEEP SHADOW AND THE BRIGHT ONES BARELY CAST ONE. A lane is a
// groove; a jackpot lamp floats.
//
// ========================= WHAT THIS DOES NOT DO =========================
// It does not make the art brighter. That is `app/assets/tables/*.png`, which is dimmed on the way in
// and is a separate change on a separate day — this is the mechanism that lets that dim be lifted.
// Until it is, this module's effect is small and correct rather than large and correct.

import type { Framebuffer } from './framebuffer.js';

/**
 * The ratio a component must make against what is next to it. WCAG 2.2, 1.4.11 Non-text Contrast.
 *
 * ⚠️ AND THE DEV NAMED IT AS A CEILING AS WELL AS A FLOOR — "o necessário E SUFICIENTE é 3:1". So
 * nothing here darkens past what this needs, which is the whole reason the surround is computed from
 * the role rather than taken from a constant.
 */
export const REQUIRED_RATIO = 3;

/**
 * How far out the requirement itself holds, in table pixels.
 *
 * ⚠️ TWO, BECAUSE THAT IS WHAT "ADJACENT" MEANS. WCAG 1.4.11 is about a component against the colours
 * NEXT TO it, and at this scale that is one or two pixels: the edges this renderer strokes are two
 * pixels wide and the ball has a radius of three. A boundary is read where it is, not six pixels away.
 *
 * ⚠️ AND SEPARATING THIS FROM THE FADE IS THE WHOLE MECHANISM WORKING. The first version had one
 * number: the ceiling at the component, ramping to no-limit across six pixels. Measured, that ramp
 * left the requirement standing for about ONE pixel — a fade in L* from 0 to 100 over six steps is
 * already at L* 33 by the second, which is Y 0.077, brighter than anything in these pictures. The
 * shadow existed, cost a pass over half the table, and darkened almost nothing: `lane.launch` came out
 * at 1.44:1 with the surround fully applied, exactly the figure it had without it.
 */
export const SURROUND_ADJACENT = 2;

/**
 * How far the shadow then softens out, in table pixels.
 *
 * ⚠️ THIS PART IS COSMETIC AND SAYS SO. Nothing is proved past `SURROUND_ADJACENT`; the fade is there
 * because a ceiling that stopped dead would draw a hard rectangle of shadow around every component,
 * which reads as a second object rather than as a shadow. Six is twice the core, which is enough for
 * the edge to disappear at this size.
 */
export const SURROUND_MARGIN = 6;

const LINEAR = new Float64Array(256);
for (let v = 0; v < 256; v++) {
  const c = v / 255;
  LINEAR[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Linear light back to an sRGB byte, by table.
 *
 * ⚠️ A TABLE RATHER THAN THE FORMULA, because this runs on every pixel of the surround and the
 * formula is a `** (1 / 2.4)`. Four thousand entries put the error under half a byte everywhere,
 * which is below what an 8-bit channel can represent — so this is exact in the only sense that
 * matters, at the cost of 4 KB held once for the life of the process.
 *
 * ⚠️ AND IT ROUNDS DOWN, WHICH IS NOT A DETAIL. Rounding to nearest lands half the pixels a byte
 * ABOVE the ceiling they were computed for, and a ceiling overshot by one byte at these luminances is
 * a real shortfall: every table came out at 2.97:1 to 2.99:1 against a requirement of 3, with the
 * arithmetic correct throughout. A ceiling is a bound, so the encoder may only ever err darker.
 */
const ENCODE_STEPS = 4096;
const ENCODE = new Uint8ClampedArray(ENCODE_STEPS + 1);
for (let i = 0; i <= ENCODE_STEPS; i++) {
  const c = i / ENCODE_STEPS;
  ENCODE[i] = Math.floor(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
}

/** The brightest a surround may be for a colour of this luminance to clear the ratio against it. */
export function surroundCeiling(roleLuminance: number): number {
  return (roleLuminance + 0.05) / REQUIRED_RATIO - 0.05;
}

/** CIE L* of a relative luminance, and back — the falloff is perceptual, not linear in light. */
function toLstar(y: number): number {
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
}
function fromLstar(l: number): number {
  const f = (l + 16) / 116;
  return f ** 3 > 0.008856 ? f ** 3 : (f - 16 / 116) / 7.787;
}

/**
 * No limit at all, which is what most of a table is. Held as a luminance above white so that a
 * comparison against it is always false and no pixel outside a shadow is ever touched.
 */
const UNLIMITED = 2;

/**
 * ⚠️ WHAT THIS COSTS, MEASURED, because a per-pixel pass added to a composition deserves the same
 * treatment `gfx/lighting` gives its own — and because this module's first version claimed to be
 * affordable without anybody checking. Best of three runs, Node 24:
 *
 *                     pixels   build once   per composition   whole composition
 *     slipstream       44835      2.29 ms         0.115 ms            1.09 ms
 *     low-orbit        43005      2.73 ms         0.122 ms            1.75 ms
 *     ion-storm        45750      2.45 ms         0.127 ms            1.73 ms
 *     crater-run       47580      2.51 ms         0.118 ms            1.68 ms
 *     long-climb       54900      2.93 ms         0.144 ms            2.13 ms
 *     ring-belt        86400      3.85 ms         0.193 ms            2.47 ms
 *
 * ⚠️ THE BUILD IS THE EXPENSIVE HALF AND IT HAPPENS ONCE. Two to four milliseconds, at table load,
 * cached per table per palette — a player switching to the CB-Safe palette pays it a second time and
 * never again. It is expensive because it splats a thirteen-by-thirteen ramp from every painted pixel
 * of every role, which is the price of taking the footprint from the renderer instead of guessing at
 * it from geometry.
 *
 * ⚠️ AND THE PER-COMPOSITION HALF IS UNDER A FIFTH OF A MILLISECOND. `ion-storm` is the case that
 * matters, because its flare moves and the picture is therefore rebuilt about forty times a second:
 * 0.127 ms of that is five thousandths of a second per second, against the 1.34 ms `gfx/lighting`
 * measured for three lit lamps on the same table. This is not where the composition's time goes.
 *
 * If it ever has to come down, the lever is named: the pass visits every pixel to compare against
 * `UNLIMITED`, and the shadow touches roughly half a table. A list of the touched runs, built
 * alongside the ceilings, would skip the rest — and it has not been paid for, because nothing yet
 * needs it.
 */

/** One role's painted pixels, and the brightest a backdrop may be beside them. */
export interface SurroundLayer {
  /** Non-zero wherever a component of this role paints. Length is `width * height`. */
  readonly painted: Uint8Array;
  /** That role's own ceiling, from `surroundCeiling`. */
  readonly ceiling: number;
}

/**
 * The brightest the backdrop may be at every pixel, from what each role paints.
 *
 * ⚠️ DEPENDS ON THE GEOMETRY AND THE PALETTE AND ON NOTHING ELSE — not the lamps, not the flare, not
 * the camera, not the score. So it is computed once per table per palette and kept, which is what
 * makes per-pixel work affordable in a composition `ion-storm` rebuilds forty times a second.
 *
 * ⚠️ AND IT IS THE MINIMUM OVER EVERY LAYER IN REACH, not the nearest one's. Two components six
 * pixels apart have overlapping shadows and the DARKER requirement has to win: taking the nearest
 * would let a `goal` lamp beside a lane lift the lane's own surround into the light. `gfx/lighting`
 * records the same trap from the other side — its ceiling is applied after summing every light
 * rather than per light, because two lamps overlapping is what a row of floodlights is.
 */
export function buildSurround(
  width: number, height: number, layers: readonly SurroundLayer[],
): Float32Array {
  const out = new Float32Array(width * height).fill(UNLIMITED);
  const span = SURROUND_MARGIN;
  const side = span * 2 + 1;

  /**
   * How far through the fade each offset in the margin's square is, or -1 for outside it. Shared by
   * every layer, because it is geometry and nothing else.
   */
  const fade = new Float32Array(side * side);
  for (let dy = -span; dy <= span; dy++) {
    for (let dx = -span; dx <= span; dx++) {
      const d = Math.hypot(dx, dy);
      // Flat across the core, then the fade — see `SURROUND_ADJACENT` for why those are two numbers.
      fade[(dy + span) * side + (dx + span)] = d > span
        ? -1
        : Math.max(0, (d - SURROUND_ADJACENT) / (span - SURROUND_ADJACENT));
    }
  }

  for (const layer of layers) {
    /**
     * This layer's ramp, one entry per offset, so the inner loop is a lookup.
     *
     * ⚠️ THE FADE IS IN L*, NOT IN LUMINANCE. Ramping the luminance gives a shadow that is almost
     * entirely black and then stops: half way out of one whose floor is Y 0.002, a linear ramp is
     * already past anything the picture contains, so the shadow has no shape at all. L* is the scale
     * the eye reads brightness on, and a ramp along it comes out even.
     */
    const ceilingL = toLstar(Math.max(layer.ceiling, 0));
    const ramp = new Float32Array(side * side);
    for (let i = 0; i < ramp.length; i++) {
      ramp[i] = fade[i]! < 0 ? UNLIMITED : fromLstar(ceilingL + (100 - ceilingL) * fade[i]!);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (layer.painted[y * width + x] === 0) continue;
        const yl = Math.max(0, y - span);
        const yh = Math.min(height - 1, y + span);
        const xl = Math.max(0, x - span);
        const xh = Math.min(width - 1, x + span);
        for (let py = yl; py <= yh; py++) {
          const row = (py - y + span) * side + span - x;
          for (let px = xl; px <= xh; px++) {
            const v = ramp[row + px]!;
            if (v < out[py * width + px]!) out[py * width + px] = v;
          }
        }
      }
    }
  }
  return out;
}

/**
 * Darkens the framebuffer wherever it is brighter than the surround allows.
 *
 * ⚠️ SCALED IN LINEAR LIGHT, WHICH IS WHY THE HUE SURVIVES. Luminance is a linear combination of the
 * linear channels, so multiplying all three by the same factor multiplies the luminance by exactly
 * that factor and leaves every ratio between them — which is the colour — untouched. Scaling the
 * BYTES instead would be a gamma-space multiply: it darkens unevenly across the channels and walks a
 * warm grey toward blue, on a table whose whole identity is that colours mean things.
 *
 * Read and written through `bytes` rather than `pixels`, because the byte view is R,G,B,A on every
 * machine while a packed word's layout depends on the endianness probe in `gfx/framebuffer`.
 */
export function applySurround(fb: Framebuffer, surround: Float32Array): void {
  for (let i = 0; i < surround.length; i++) dimPixel(fb, i, surround[i]!);
}

/**
 * One pixel, brought under `limit` if it is over it. The primitive the walk above is made of.
 *
 * ⚠️ EXPORTED BECAUSE THE COMETS CANNOT USE A PRECOMPUTED MAP. Every other thing that needs a surround
 * is at a fixed place on a table, so its shadow is computed once per palette and cached — see
 * `surroundOf`. A comet is somewhere new every frame, so its shadow has to be laid down as it is
 * drawn, over the pixels that happen to be under it.
 *
 * The alternative was a second copy of this arithmetic in `gfx/comet-view`, and the arithmetic is the
 * part that has already been wrong twice: rounding to nearest put every table at 2.97:1, and scaling
 * the bytes instead of the light walked warm grey toward blue. One copy, one place to be right.
 */
export function dimPixel(fb: Framebuffer, index: number, limit: number): void {
  if (limit >= 1) return;

  const at = index * 4;
  const r = LINEAR[fb.bytes[at]!]!;
  const g = LINEAR[fb.bytes[at + 1]!]!;
  const b = LINEAR[fb.bytes[at + 2]!]!;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (y <= limit || y === 0) return;

  // Down, like the table itself: the product of two roundings up is what put the tables at 2.99:1.
  const k = limit / y;
  fb.bytes[at] = ENCODE[Math.floor(r * k * ENCODE_STEPS)]!;
  fb.bytes[at + 1] = ENCODE[Math.floor(g * k * ENCODE_STEPS)]!;
  fb.bytes[at + 2] = ENCODE[Math.floor(b * k * ENCODE_STEPS)]!;
}
