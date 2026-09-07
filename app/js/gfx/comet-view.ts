// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/comet-view — drawing a falling comet, its number, and the burst it goes out in.
//
// ⚠️ EVERY COMET LOOKS THE SAME, AND THAT IS THE WHOLE DESIGN. A multiple and a non-multiple are drawn
// in identical colours at identical sizes; the ONLY difference between them is the number written
// inside. Tinting the right answers would answer the question the mission exists to ask, and tinting
// them in a way a colour-blind player cannot see would answer it for some children and not others.
// `tests/gfx-comet-view` holds this: the two kinds must come out pixel-identical apart from the digits.
//
// ========================= THE COLOUR, AND WHY THE RIM CARRIES IT =========================
// ⚠️ THE DEV CHOSE IT: "Cometas devem ser azuis na borda e no número, brancos internamente, e terem
// cauda." So the body is white, the rim and the digits are blue, and the tail follows.
//
// White is the one fill that could not be picked freely before: the BALL is near-white, and two
// near-white things touching are one thing. What makes it work is that the boundary a player reads is
// no longer the fill — it is the RIM. Where the ball meets a comet the pair is white against blue, at
// 5.5:1; where a comet meets the table it is white against a ground held under a ceiling, at 3:1.
//
// ⚠️ AND THE HALO IS STILL WHAT HOLDS THE SECOND HALF. The art runs up to Y 0.2615 and white needs its
// neighbours under Y 0.2453 to clear 3:1, so the ring of art immediately outside every comet is
// brought down to that. It is a smaller correction than the amber needed — the two numbers are close —
// but "smaller" is not "none", and `tests/gfx-comet-view` measures it on real pixels.
//
// ========================= AND THE TAIL POINTS WHERE IT CAME FROM =========================
// A comet's tail is the part of it that is being left behind, so it trails UP from a falling one. Drawn
// as a few discs of shrinking size and fading alpha along the reverse of its travel — which is the
// cheapest thing that reads as motion at this resolution, and the only one that survives a shape six
// pixels across.

import { drawNumber, numberWidth, DIGIT_HEIGHT } from './digits.js';
import { pack, type Framebuffer } from './framebuffer.js';
import { packRgb } from './table-view.js';
import { shade, type Rgb } from './table-palette.js';
import type { Rect } from '../shell/hud.js';
import { COMET_RADIUS, type Comet } from '../control/comet-mission.js';
import { dimPixel, surroundCeiling, SURROUND_ADJACENT } from './surround.js';

/** sRGB byte to linear light — the one place this file needs the transfer function. */
const LINEAR_CHANNEL = (byte: number): number => {
  const s = byte / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/**
 * "brancos internamente" — the fill.
 *
 * ⚠️ COOLER THAN THE BALL ON PURPOSE, AND THAT IS NOT WHAT SEPARATES THEM. The ball is (238, 242, 248)
 * and this is (236, 242, 252); at a glance they are the same white, and they are meant to be — what
 * tells a comet from the ball is that a comet is six times across and has a blue ring and a number in
 * it. Making the fills far apart would have cost the white the Dev asked for to solve a problem the rim
 * already solves.
 */
export const COMET_BODY: Rgb = { r: 236, g: 242, b: 252 };

/**
 * "azuis na borda e no número" — the rim and the digits, one colour.
 *
 * Measured against the body at 5.5:1, which is what WCAG 1.4.3 wants of TEXT and more than 1.4.11 asks
 * of the ring. The digits are the thing a player has to read under time pressure, so they take the
 * stricter of the two.
 */
export const COMET_BLUE: Rgb = { r: 28, g: 86, b: 214 };

/**
 * How much darker the bottom of the disc is than its body.
 *
 * ⚠️ ONE-SIDED NOW, BECAUSE THE BODY IS WHITE. The old amber had a lit top and a shaded bottom, which
 * is how every component on these tables is drawn; a white face cannot have a lighter top — there is
 * nowhere above white to go — so the shading is all in the lower half and the top stays the fill.
 */
const COMET_SHADE = 0.16;

const BODY = packRgb(COMET_BODY);
const TOP = BODY;
const BOTTOM = packRgb(shade(COMET_BODY, -COMET_SHADE));
// ⚠️ THE RIM IS THE DEV'S BLUE RATHER THAN `rimOf(body)`. `rimOf` takes a colour 55% toward black,
// which on white is a grey — and he asked for blue. The blue is dark enough to do the same job.
const RIM = packRgb(COMET_BLUE);
const INK = packRgb(COMET_BLUE);

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

/**
 * How far the tail reaches behind a comet, as a multiple of its radius, and in how many steps.
 *
 * ⚠️ DISCS RATHER THAN A TAPERED SHAPE. At this resolution a comet is eighteen pixels across and a
 * drawn triangle would be four pixels wide at its base — an artefact rather than a tail. Four discs of
 * shrinking size, each fainter than the last, is what reads as a streak when every one of them is a
 * handful of pixels.
 */
const TAIL_REACH = 2.6;
const TAIL_STEPS = 4;

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
    // ⚠️ NO HALO AND NO TAIL ON A BURST. It is translucent and on its way out — darkening the art
    // behind something that is disappearing would leave a shadow of a thing that is no longer there,
    // and a tail on something that has stopped travelling is a streak going nowhere.
    ring(screen, cx, cy, radius, comet.alpha, into);
    return;
  }

  /**
   * ⚠️ THE TAIL GOES UP, WHICH IS WHERE THE COMET CAME FROM. It falls, so what it leaves behind is
   * above it. Drawn BEFORE the disc so the head sits on top of its own streak rather than under it.
   */
  for (let step = TAIL_STEPS; step >= 1; step--) {
    const along = (step / TAIL_STEPS) * TAIL_REACH * radius;
    const size = radius * (1 - 0.6 * (step / TAIL_STEPS));
    if (size < 1) continue;
    disc(screen, cx, cy - along, size, comet.alpha * 0.34 * (1 - step / (TAIL_STEPS + 1)), into);
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
