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
import { integerScale } from '../app/js/shell/present.js';

describe('fitting a 320x180 screen into a window', () => {
  test('an exact fit is exactly that many times', () => {
    expect(integerScale({ width: 640, height: 360 }, { width: 320, height: 180 })).toBe(2);
    expect(integerScale({ width: 1280, height: 720 }, { width: 320, height: 180 })).toBe(4);
  });

  test('⚠️ and anything between two multiples takes the SMALLER one', () => {
    // 470 wide is 1.47 screens. Rounding up would crop the table; rounding to the nearest would crop it
    // half the time. The whole point is that no source pixel is ever a different size from its
    // neighbour, and only rounding down keeps that AND keeps the picture whole.
    expect(integerScale({ width: 470, height: 264 }, { width: 320, height: 180 })).toBe(1);
    expect(integerScale({ width: 639, height: 359 }, { width: 320, height: 180 })).toBe(1);
    expect(integerScale({ width: 959, height: 539 }, { width: 320, height: 180 })).toBe(2);
  });

  test('the tighter axis decides, or the picture would not fit at all', () => {
    // A window twice as wide as it is tall still only fits one screen if the height allows one.
    expect(integerScale({ width: 1600, height: 200 }, { width: 320, height: 180 })).toBe(1);
    expect(integerScale({ width: 400, height: 900 }, { width: 320, height: 180 })).toBe(1);
  });

  test('⚠️ and it never goes below ONE, even in a window too small to hold the screen', () => {
    // A phone in portrait, a split pane, a window somebody dragged narrow. Zero would mean a canvas of
    // no size — an invisible game — and a fraction would mean the uneven grid this exists to prevent.
    // At one the picture overflows and can be scrolled or letterboxed, which is a layout problem and
    // not a rendering one.
    expect(integerScale({ width: 100, height: 100 }, { width: 320, height: 180 })).toBe(1);
    expect(integerScale({ width: 0, height: 0 }, { width: 320, height: 180 })).toBe(1);
  });

  test('and a nonsensical window does not produce a nonsensical scale', () => {
    expect(integerScale({ width: Number.NaN, height: 500 }, { width: 320, height: 180 })).toBe(1);
    expect(integerScale({ width: -50, height: -50 }, { width: 320, height: 180 })).toBe(1);
  });
});
