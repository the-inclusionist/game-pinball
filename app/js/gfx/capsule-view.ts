// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/capsule-view — drawing the power-up capsules.
//
// ⚠️ EACH KIND IS A SHAPE FIRST AND A COLOUR SECOND, which is the rule this whole project is built on:
// `render/cvd-matrices` exists because a signal carried only in hue is a signal some children never
// receive. So the four capsules differ by a mark that survives being turned to grey — a minus, a plus,
// three dots and a ring — and the hue is a second cue for everyone else.
//
// ========================= AND THE MARKS ARE FIVE BY FIVE =========================
// A capsule is ten pixels across. `gfx/digits` is three by five and is the right size for a number in a
// comet twice this big; here the mark has the whole face, so five by five is what fits and what can be
// told apart at a glance. They are written as pictures for the reason the digits are: so a reader can
// see what they will look like without running anything.
import { pack, type Framebuffer } from './framebuffer.js';
import { packRgb } from './table-view.js';
import type { Rgb } from './table-palette.js';
import type { Rect } from '../shell/hud.js';
import { CAPSULE_RADIUS, type Capsule, type PowerUpKind } from '../control/power-ups.js';

/**
 * The capsule's shell, which is the same for all four.
 *
 * ⚠️ ONE BODY COLOUR, SO THE MARK IS THE ONLY DIFFERENCE. Four coloured discs would be four things to
 * learn; one disc with four marks on it is one thing with a face. The hue that varies is the MARK's.
 */
export const CAPSULE_BODY: Rgb = { r: 24, g: 28, b: 38 };
export const CAPSULE_EDGE: Rgb = { r: 236, g: 242, b: 252 };

/**
 * What each kind is marked with.
 *
 * ⚠️ THE COLOURS ARE THE SECOND CUE AND NEVER THE ONLY ONE. Read as grey — which is what a monochrome
 * screen, a strong CVD filter or a bad projector gives — the four marks are still a minus, a plus,
 * three dots and a ring.
 */
export const CAPSULE_MARK: Readonly<Record<PowerUpKind, Rgb>> = {
  // Three balls: three dots.
  multiball: { r: 120, g: 216, b: 255 },
  // Slower: a minus.
  slow: { r: 130, g: 190, b: 255 },
  // Faster: a plus.
  fast: { r: 255, g: 178, b: 96 },
  // The wrong comets go: a ring, which is what is left when something is taken out of the middle.
  clear: { r: 168, g: 240, b: 168 },
};

const MARKS: Readonly<Record<PowerUpKind, readonly string[]>> = {
  slow: [
    '.....',
    '.....',
    '#####',
    '.....',
    '.....',
  ],
  fast: [
    '..#..',
    '..#..',
    '#####',
    '..#..',
    '..#..',
  ],
  multiball: [
    '.....',
    '.....',
    '#.#.#',
    '.....',
    '.....',
  ],
  clear: [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
};

const BODY = packRgb(CAPSULE_BODY);
const EDGE = packRgb(CAPSULE_EDGE);
const MARK = Object.fromEntries(
  (Object.keys(CAPSULE_MARK) as PowerUpKind[]).map((k) => [k, packRgb(CAPSULE_MARK[k])]),
) as Readonly<Record<PowerUpKind, number>>;

/** Mixes one pixel toward `color`, clipped by the caller's rectangle. See `gfx/comet-view.blend`. */
function put(fb: Framebuffer, index: number, color: number, alpha: number): void {
  if (alpha >= 1) {
    fb.pixels[index] = color;
    return;
  }
  const at = index * 4;
  fb.pixels[index] = pack(
    Math.round(fb.bytes[at]! + ((color & 0xff) - fb.bytes[at]!) * alpha),
    Math.round(fb.bytes[at + 1]! + (((color >>> 8) & 0xff) - fb.bytes[at + 1]!) * alpha),
    Math.round(fb.bytes[at + 2]! + (((color >>> 16) & 0xff) - fb.bytes[at + 2]!) * alpha),
    255,
  );
}

/**
 * Draws one capsule where the camera says it is.
 *
 * The same shape as `drawBall`, `drawLitRect` and `drawComet`: table coordinates in, screen pixels out,
 * clipped to the playfield window, and off the window is not an error.
 */
export function drawCapsule(
  screen: Framebuffer, capsule: Capsule, into: Rect, offsetX: number, offsetY: number,
): void {
  const radius = CAPSULE_RADIUS * capsule.scale;
  if (radius < 1) return;

  const cx = into.x + capsule.x - Math.floor(offsetX);
  const cy = into.y + capsule.y - Math.floor(offsetY);
  if (cx + radius < into.x || cx - radius > into.x + into.width) return;
  if (cy + radius < into.y || cy - radius > into.y + into.height) return;

  const outer = radius * radius;
  const inner = (radius - 1) * (radius - 1);
  const y0 = Math.max(into.y, 0, Math.floor(cy - radius));
  const y1 = Math.min(into.y + into.height, screen.height, Math.ceil(cy + radius) + 1);
  const x0 = Math.max(into.x, 0, Math.floor(cx - radius));
  const x1 = Math.min(into.x + into.width, screen.width, Math.ceil(cx + radius) + 1);

  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    const row = y * screen.width;
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      const d2 = dx * dx + dy * dy;
      if (d2 > outer) continue;
      // ⚠️ THE EDGE IS THE OUTERMOST RING AND IT IS NEARLY WHITE. A capsule is half a comet's size and
      // falls over whatever the table is doing there; a dark body would need a halo of its own, and a
      // bright ring is the cheaper answer at this size.
      put(screen, row + x, radius >= 3 && d2 > inner ? EDGE : BODY, 1);
    }
  }

  // ⚠️ THE MARK GOES ON ONLY WHILE THERE IS ROOM FOR IT. Below five pixels across it is a smear, and a
  // smear where a symbol was reads as a rendering fault rather than as something leaving.
  if (radius * 2 < 7) return;
  const glyph = MARKS[capsule.kind];
  const left = Math.round(cx - 2.5);
  const top = Math.round(cy - 2.5);
  for (let row = 0; row < 5; row++) {
    const line = glyph[row]!;
    const py = top + row;
    if (py < into.y || py >= into.y + into.height || py < 0 || py >= screen.height) continue;
    for (let column = 0; column < 5; column++) {
      if (line[column] !== '#') continue;
      const px = left + column;
      if (px < into.x || px >= into.x + into.width || px < 0 || px >= screen.width) continue;
      put(screen, py * screen.width + px, MARK[capsule.kind], 1);
    }
  }
}
