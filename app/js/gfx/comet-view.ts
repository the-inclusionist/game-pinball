// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/comet-view — drawing a falling comet, its number, and the burst it goes out in.
//
// ⚠️ EVERY COMET LOOKS THE SAME, AND THAT IS THE WHOLE DESIGN. A multiple and a non-multiple are drawn
// in identical colours at identical sizes; the ONLY difference between them is the number written
// inside. Tinting the right answers would answer the question the mission exists to ask, and tinting
// them in a way a colour-blind player cannot see would answer it for some children and not others.
// `tests/gfx-comet-view` holds this: the two kinds must come out pixel-identical apart from the digits.
//
// ========================= THE COLOUR, AND WHY ONE COLOUR IS NOT ENOUGH =========================
// The comet has to be told apart from two things that sit at opposite ends:
//
//   the playfield art, which runs from black up to Y = 0.2615 (the ceiling `import-art.py` dims it to,
//     so that the near-white BALL clears 3:1 against it),
//   the ball itself, at Y = 0.8846.
//
// ⚠️ AND THERE IS NO SINGLE COLOUR THAT CLEARS 3:1 AGAINST BOTH, which is worth writing down because
// the first version of this file claimed there was and the gate caught it. Against art that can be as
// bright as 0.2615, WCAG 1.4.11 leaves only Y >= 0.8845 (as bright as the ball, so it fails against
// the ball) or Y <= 0.0538 (so dark it fails against the black parts of the art). The window is empty.
//
// So the comet does what every other component on these tables already does: it carries its own local
// darkening. `gfx/surround` computes, for a colour of luminance Y, the brightest a neighbouring pixel
// may be — and lays that ceiling over the ring of art immediately outside the shape. The difference is
// only that a comet is somewhere new every frame, so the shadow is laid down as it is drawn instead of
// being cached per palette.
//
// `COMET_BODY` is then chosen against the BALL alone, at Y = 0.2490: 3.13:1 against it, with the
// halo bringing whatever is behind under 0.0497, which is 3.00:1 the other way.
import { drawNumber, numberWidth, DIGIT_HEIGHT } from './digits.js';
import { pack, type Framebuffer } from './framebuffer.js';
import { packRgb, rimOf } from './table-view.js';
import { shade, type Rgb } from './table-palette.js';
import type { Rect } from '../shell/hud.js';
import { COMET_RADIUS, type Comet } from '../control/comet-mission.js';
import { dimPixel, surroundCeiling, SURROUND_ADJACENT } from './surround.js';

/** sRGB byte to linear light — the one place this file needs the transfer function. */
const LINEAR_CHANNEL = (byte: number): number => {
  const s = byte / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Measured: Y = 0.2490, which clears 3:1 against the ball. The halo below handles the ground. */
export const COMET_BODY: Rgb = { r: 183, g: 125, b: 42 };

/**
 * The digits.
 *
 * ⚠️ 4.5:1 AND NOT 3:1, because this is TEXT and not a shape. Against the body it measures 5.4:1. A
 * number a player has to read under time pressure is the one thing here that has to be easy.
 */
export const COMET_INK: Rgb = { r: 16, g: 14, b: 20 };

/** How much lighter the top of the disc is than its body — the same trick every component uses. */
const COMET_SHADE = 0.34;

const BODY = packRgb(COMET_BODY);
const TOP = packRgb(shade(COMET_BODY, COMET_SHADE));
const BOTTOM = packRgb(shade(COMET_BODY, -COMET_SHADE));
const RIM = packRgb(rimOf(COMET_BODY));
const INK = packRgb(COMET_INK);

/**
 * The brightest a pixel just outside a comet may be, so the comet clears 3:1 against it.
 *
 * ⚠️ COMPUTED FROM THE COLOUR RATHER THAN TYPED OUT. A number written here is right on the day it is
 * written and silently wrong the first time somebody adjusts `COMET_BODY` — which is the whole failure
 * `gfx/surround` was built to stop happening a table at a time.
 */
const HALO_CEILING = surroundCeiling(
  0.2126 * LINEAR_CHANNEL(COMET_BODY.r) + 0.7152 * LINEAR_CHANNEL(COMET_BODY.g)
  + 0.0722 * LINEAR_CHANNEL(COMET_BODY.b),
);

/** Below this many pixels across, the digits are left out rather than drawn as mush. */
const READABLE_DIAMETER = DIGIT_HEIGHT + 4;

/**
 * One pixel, mixed toward `color` by `alpha`.
 *
 * ⚠️ REAL BLENDING, BECAUSE "explode de forma suave" IS THE REQUEST. The framebuffer is opaque words,
 * so a burst that simply stopped being drawn would pop out of existence — which at sixty frames a
 * second is a flicker, not an explosion. Reading the destination and mixing is a few hundred pixels a
 * frame for three comets, which is nothing beside the composition it lands on.
 */
function blend(fb: Framebuffer, index: number, color: number, alpha: number): void {
  if (alpha >= 1) {
    fb.pixels[index] = color;
    return;
  }
  // ⚠️ READ AS BYTES, WRITTEN AS A WORD. `Framebuffer` keeps both views over one buffer precisely so
  // this needs no endianness reasoning: the bytes are R,G,B,A wherever the machine puts them.
  const at = index * 4;
  const sr = color & 0xff;
  const sg = (color >>> 8) & 0xff;
  const sb = (color >>> 16) & 0xff;
  const dr = fb.bytes[at]!;
  const dg = fb.bytes[at + 1]!;
  const db = fb.bytes[at + 2]!;
  fb.pixels[index] = pack(
    Math.round(dr + (sr - dr) * alpha),
    Math.round(dg + (sg - dg) * alpha),
    Math.round(db + (sb - db) * alpha),
    255,
  );
}

/** A disc, clipped to `clip`, with the rim as its outermost ring and the light on its face. */
function disc(
  fb: Framebuffer, cx: number, cy: number, radius: number, alpha: number, clip: Rect,
): void {
  const outer = radius * radius;
  const inner = (radius - 1) * (radius - 1);
  const y0 = Math.max(clip.y, 0, Math.floor(cy - radius));
  const y1 = Math.min(clip.y + clip.height, fb.height, Math.ceil(cy + radius) + 1);
  const x0 = Math.max(clip.x, 0, Math.floor(cx - radius));
  const x1 = Math.min(clip.x + clip.width, fb.width, Math.ceil(cx + radius) + 1);

  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    const row = y * fb.width;
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      const d2 = dx * dx + dy * dy;
      if (d2 > outer) continue;
      // The rim is the outermost ring and stays whole: it is what the shape reads by.
      const color = radius >= 3 && d2 > inner
        ? RIM
        : (dy < -radius * 0.45 ? TOP : (dy > radius * 0.55 ? BOTTOM : BODY));
      blend(fb, row + x, color, alpha);
    }
  }
}

/**
 * The ring of art immediately outside the comet, brought under the ceiling the comet needs.
 *
 * ⚠️ TWO PIXELS, WHICH IS `SURROUND_ADJACENT` AND NOT A GUESS. WCAG 1.4.11 is about ADJACENT colours,
 * so the ratio is owed where the shapes actually touch; `gfx/surround` settled the width once and this
 * is the same number for the same reason. Wider would be a drop shadow — a look nobody asked for, on
 * art the Dev drew.
 */
function halo(fb: Framebuffer, cx: number, cy: number, radius: number, clip: Rect): void {
  const outer = (radius + SURROUND_ADJACENT) * (radius + SURROUND_ADJACENT);
  const inner = radius * radius;
  const reach = radius + SURROUND_ADJACENT;
  const y0 = Math.max(clip.y, 0, Math.floor(cy - reach));
  const y1 = Math.min(clip.y + clip.height, fb.height, Math.ceil(cy + reach) + 1);
  const x0 = Math.max(clip.x, 0, Math.floor(cx - reach));
  const x1 = Math.min(clip.x + clip.width, fb.width, Math.ceil(cx + reach) + 1);

  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    const row = y * fb.width;
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      const d2 = dx * dx + dy * dy;
      if (d2 > outer || d2 <= inner) continue;
      dimPixel(fb, row + x, HALO_CEILING);
    }
  }
}

/** A ring, for the burst: the comet coming apart rather than a disc getting bigger. */
function ring(
  fb: Framebuffer, cx: number, cy: number, radius: number, alpha: number, clip: Rect,
): void {
  const outer = radius * radius;
  const hole = Math.max(0, radius - 2) * Math.max(0, radius - 2);
  const y0 = Math.max(clip.y, 0, Math.floor(cy - radius));
  const y1 = Math.min(clip.y + clip.height, fb.height, Math.ceil(cy + radius) + 1);
  const x0 = Math.max(clip.x, 0, Math.floor(cx - radius));
  const x1 = Math.min(clip.x + clip.width, fb.width, Math.ceil(cx + radius) + 1);

  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    const row = y * fb.width;
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      const d2 = dx * dx + dy * dy;
      if (d2 > outer || d2 <= hole) continue;
      blend(fb, row + x, BODY, alpha);
    }
  }
}

/**
 * Draws one comet where the camera says it is.
 *
 * The same shape as `drawBall` and `drawLitRect`: table coordinates in, screen pixels out, clipped to
 * the playfield window. Off the window is not an error — the camera gives up part of the table on
 * purpose, and a comet can be above the top of the view for its first few frames.
 */
export function drawComet(
  screen: Framebuffer, comet: Comet, into: Rect, offsetX: number, offsetY: number,
): void {
  const radius = COMET_RADIUS * comet.scale;
  if (radius < 1 || comet.alpha <= 0) return;

  const cx = into.x + comet.x - Math.floor(offsetX);
  const cy = into.y + comet.y - Math.floor(offsetY);
  if (cx + radius < into.x || cx - radius > into.x + into.width) return;
  if (cy + radius < into.y || cy - radius > into.y + into.height) return;

  if (comet.state === 'bursting') {
    // ⚠️ NO HALO ON A BURST. It is translucent and on its way out — darkening the art behind something
    // that is disappearing would leave a shadow of a thing that is no longer there.
    ring(screen, cx, cy, radius, comet.alpha, into);
    return;
  }

  halo(screen, cx, cy, radius, into);
  disc(screen, cx, cy, radius, comet.alpha, into);
  /**
   * ⚠️ THE NUMBER GOES ONLY WHILE IT CAN BE READ. A comet shrinking away passes through sizes where
   * three-by-five digits are a smear, and a smear where a number was reads as a rendering fault — the
   * player cannot tell "it is leaving" from "it is broken". Below the threshold the disc goes on
   * shrinking with nothing written in it, which is unmistakably a thing departing.
   */
  if (radius * 2 < READABLE_DIAMETER) return;
  if (numberWidth(comet.value) > radius * 1.9) return;
  drawNumber(screen, comet.value, cx, cy, INK, into);
}
