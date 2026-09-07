// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/digits — ten glyphs, three pixels by five, for numbers drawn INSIDE the world.
//
// ========================= WHY THERE IS A FONT IN THE FRAMEBUFFER AT ALL =========================
// Every number this game has ever shown a player is DOM: the score, the ball count, the mission line,
// the pause menu. That is the right place for all of them — it is selectable, it is readable by a
// screen reader, and it scales with the reader's own type setting.
//
// The comets are the first thing that cannot be. A comet's number has to be inside the comet, and the
// comet is at a table coordinate the camera is scrolling: putting it in DOM would mean a second copy
// of the camera transform, kept in step with the renderer's, and a number that lags the shape it
// belongs to by a frame. The Dev's rule settles it either way — "nada deve ser desenhado fora do
// canvas".
//
// ⚠️ AND THE SCREEN READER IS NOT LEFT OUT. The glyphs are what a SIGHTED player reads; the mission
// announces its comets through `sr-status` and the sonar the same way every other part of this game
// does. A picture that cannot be read aloud is a reason to add the words, not to skip the picture.
//
// ========================= THREE BY FIVE, WHICH IS NOT A STYLE CHOICE =========================
// The screen is 320x180 and a comet is eighteen pixels across. The widest room for text inside a disc
// of radius nine, two and a half rows either side of the middle, is seventeen pixels. Two digits and
// the gap between them is seven at this size and eleven at four wide, so four fits — and five rows is
// the least that tells 6, 8 and 9 apart at a glance.
import type { Framebuffer } from './framebuffer.js';

export const DIGIT_WIDTH = 3;
export const DIGIT_HEIGHT = 5;
/** One blank column between digits, so "11" is not a solid block. */
export const DIGIT_GAP = 1;

/**
 * The ten glyphs, written as pictures so a reader can see what they will look like.
 *
 * ⚠️ 6, 8 AND 9 ARE THE ONES THAT MATTER, and they are the reason this is five rows rather than four:
 * at four, 8 and 9 differ in one pixel and a child reading a falling comet has about a second. Here 6
 * closes at the bottom left, 9 closes at the top right, and 8 closes on both.
 */
export const GLYPHS: readonly (readonly string[])[] = [
  ['###', '#.#', '#.#', '#.#', '###'], // 0
  ['.#.', '##.', '.#.', '.#.', '###'], // 1
  ['###', '..#', '###', '#..', '###'], // 2
  ['###', '..#', '###', '..#', '###'], // 3
  ['#.#', '#.#', '###', '..#', '..#'], // 4
  ['###', '#..', '###', '..#', '###'], // 5
  ['###', '#..', '###', '#.#', '###'], // 6
  ['###', '..#', '..#', '..#', '..#'], // 7
  ['###', '#.#', '###', '#.#', '###'], // 8
  ['###', '#.#', '###', '..#', '###'], // 9
];

/** How wide a number comes out, in pixels, before it is drawn. */
export function numberWidth(value: number): number {
  const digits = Math.abs(Math.trunc(value)).toString().length;
  return digits * DIGIT_WIDTH + (digits - 1) * DIGIT_GAP;
}

/** A rectangle nothing may be drawn outside of. */
export interface DigitClip {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Draws a whole number centred on (cx, cy), in `color`, clipped to `clip`.
 *
 * ⚠️ CLIPPED BY THE CALLER'S RECTANGLE AND NOT ONLY BY THE BUFFER. This paints onto the SCREEN, after
 * the playfield has been blitted into its window, and the screen's other 137 columns are the HUD's.
 * ADR-0002 is what that rule is written down in, and `drawLitRect` takes the same argument for the
 * same reason: a comet at the edge of a narrow table would otherwise put its digits on the score.
 */
export function drawNumber(
  fb: Framebuffer, value: number, cx: number, cy: number, color: number, clip: DigitClip,
): void {
  const text = Math.abs(Math.trunc(value)).toString();
  let x = Math.round(cx - numberWidth(value) / 2);
  const y0 = Math.round(cy - DIGIT_HEIGHT / 2);

  for (const character of text) {
    const glyph = GLYPHS[Number(character)]!;
    for (let row = 0; row < DIGIT_HEIGHT; row++) {
      const line = glyph[row]!;
      const py = y0 + row;
      if (py < clip.y || py >= clip.y + clip.height || py < 0 || py >= fb.height) continue;
      for (let column = 0; column < DIGIT_WIDTH; column++) {
        if (line[column] !== '#') continue;
        const px = x + column;
        if (px < clip.x || px >= clip.x + clip.width || px < 0 || px >= fb.width) continue;
        fb.pixels[py * fb.width + px] = color;
      }
    }
    x += DIGIT_WIDTH + DIGIT_GAP;
  }
}
