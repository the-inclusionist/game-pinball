// SPDX-License-Identifier: AGPL-3.0-or-later
// HOW BIG THE CANVAS IS ON SCREEN, AND WHY IT MUST BE A WHOLE NUMBER OF TIMES ITS BUFFER.
//
// ⚠️ THE DEV FOUND THIS BY LOOKING AT IT. The canvas was styled `width: 100%` and stretched to whatever
// the page gave it: measured in the running game, a 320x180 buffer was being displayed at 470x264.38 —
// a scale of 1.4688.
//
// With `image-rendering: pixelated` a fractional scale does not blur, which is worse: it makes SOME
// source pixels one screen pixel wide and others two. The grid goes uneven across the image, a
// one-pixel highlight on a ramp disappears in one place and doubles in another, and the ball is a
// different size depending where it is. Every decision in `gfx/scale` about keeping the hard pixel edge
// is spent by the last step before the player sees it.
//
// So the canvas is displayed at a WHOLE multiple of 320x180 and centred in whatever is left. The rule
// is arithmetic and belongs in a function that can be checked without a browser.
import { describe, test, expect } from 'vitest';
import { integerScale, MINIMUM_SCALE } from '../app/js/shell/present.js';

describe('fitting a 320x180 screen into a window', () => {
  test('an exact fit is exactly that many times', () => {
    expect(integerScale({ width: 640, height: 360 }, { width: 320, height: 180 })).toBe(2);
    expect(integerScale({ width: 1280, height: 720 }, { width: 320, height: 180 })).toBe(4);
  });

  test('⚠️ and anything between two multiples takes the SMALLER one', () => {
    // 470 wide is 1.47 screens. Rounding up would crop the table; rounding to the nearest would crop it
    // half the time. The whole point is that no source pixel is ever a different size from its
    // neighbour, and only rounding down keeps that AND keeps the picture whole.
    //
    // ⚠️ THE FIRST TWO USED TO EXPECT ONE, AND THE DEV MADE 640x360 A FLOOR: "obrigatório e não
    // negociável". Rounding down still decides which multiple; what changed is that there is a
    // multiple below which the answer never goes. The third line is untouched and is the one that
    // still shows the rounding — 959 wide is 2.99 screens and the answer is two.
    expect(integerScale({ width: 470, height: 264 }, { width: 320, height: 180 })).toBe(2);
    expect(integerScale({ width: 639, height: 359 }, { width: 320, height: 180 })).toBe(2);
    expect(integerScale({ width: 959, height: 539 }, { width: 320, height: 180 })).toBe(2);
  });

  test('the tighter axis decides, or the picture would not fit at all', () => {
    // A window twice as wide as it is tall is still limited by its height.
    //
    // ⚠️ BOTH OF THESE EXPECTED ONE UNTIL THE DEV MADE 640x360 A FLOOR. What the axis rule decides is
    // still which multiple; the floor is what it may not go under. `{ 1600, 200 }` fits five screens
    // across and one down, so the tighter axis says one and the floor says two — and the picture
    // overflows a 200-pixel window, which is a layout problem and a visible one.
    expect(integerScale({ width: 1600, height: 200 }, { width: 320, height: 180 })).toBe(2);
    expect(integerScale({ width: 400, height: 900 }, { width: 320, height: 180 })).toBe(2);
    // Still the tighter axis: 1280 across is four, 400 down is two, and two is the answer.
    expect(integerScale({ width: 1280, height: 400 }, { width: 320, height: 180 })).toBe(2);
  });

  test('⚠️ and it never goes below the FLOOR, even in a window too small to hold it', () => {
    // A phone in portrait, a split pane, a window somebody dragged narrow. Zero would mean a canvas of
    // no size — an invisible game — and a fraction would mean the uneven grid this exists to prevent.
    // The picture overflows and the page scrolls to it, which is a layout problem and not a rendering
    // one.
    //
    // ⚠️ AND THE FLOOR IS TWO NOW, NOT ONE. The Dev: "o tamanho mínimo é 640x360... obrigatório e não
    // negociável." A window that cannot hold it does not get a smaller game; it gets a scrollbar.
    expect(integerScale({ width: 100, height: 100 }, { width: 320, height: 180 })).toBe(MINIMUM_SCALE);
    expect(integerScale({ width: 0, height: 0 }, { width: 320, height: 180 })).toBe(MINIMUM_SCALE);
    expect(MINIMUM_SCALE, 'and the floor is what 640x360 asks for').toBe(2);
  });

  test('and a nonsensical window does not produce a nonsensical scale', () => {
    expect(integerScale({ width: Number.NaN, height: 500 }, { width: 320, height: 180 }))
      .toBe(MINIMUM_SCALE);
    expect(integerScale({ width: -50, height: -50 }, { width: 320, height: 180 }))
      .toBe(MINIMUM_SCALE);
  });
});

describe('⚠️ and the smallest the game is ever shown is 640x360', () => {
  /**
   * ⚠️ THE DEV, MAKING IT A REQUIREMENT: "Isso é obrigatório e não negociável, lembrando que o
   * tamanho mínimo é 640x360."
   *
   * The buffer stays 320x180 — decision 4 of the plan, honoured to the letter — and this is about
   * what a PLAYER sees. At one times, a ball six pixels across is six screen pixels and the HUD's
   * text is the smallest thing a font can draw; the game is legible on a monitor and unreadable on
   * the class of machine it was written for.
   *
   * ⚠️ AND IT DOES NOT LOOSEN THE WHOLE-NUMBER RULE, it tightens it. The floor is TWO, not "whatever
   * fills the window": a fractional scale with `image-rendering: pixelated` makes some source pixels
   * one screen pixel wide and others two, which is what this module exists to prevent.
   */
  test('a window too small for it still gets it', () => {
    expect(integerScale({ width: 400, height: 300 }, { width: 320, height: 180 })).toBe(2);
    expect(integerScale({ width: 100, height: 100 }, { width: 320, height: 180 })).toBe(2);
  });

  test('and a window that holds more gets more, in whole numbers', () => {
    expect(integerScale({ width: 1280, height: 800 }, { width: 320, height: 180 })).toBe(4);
    expect(integerScale({ width: 960, height: 600 }, { width: 320, height: 180 })).toBe(3);
  });

  test('⚠️ and a window exactly 640x360 gets exactly two, not one', () => {
    // The boundary the requirement names. Off by one here is a game that is half the size it must be
    // on the machine that most needs it to be right.
    expect(integerScale({ width: 640, height: 360 }, { width: 320, height: 180 })).toBe(2);
  });
});
