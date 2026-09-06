// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/present — how big the canvas is on screen.
//
// ========================= A WHOLE NUMBER, AND NOTHING ELSE =========================
// ⚠️ THE DEV FOUND THIS IN THE RUNNING GAME. The canvas was styled `width: 100%` and stretched to
// whatever the page offered: a 320x180 buffer displayed at 470x264.38, a scale of 1.4688.
//
// A fractional scale with `image-rendering: pixelated` does not blur, which is worse than blurring. It
// makes SOME source pixels one screen pixel wide and others two: the grid goes uneven across the
// image, a one-pixel highlight on a ramp vanishes in one place and doubles in another, and the ball
// changes size as it crosses the table. Every decision in `gfx/scale` about keeping the hard pixel
// edge — and the whole of decision 4 of the plan, 320x180 honoured to the letter — is spent by the
// last step before a player sees it.
//
// The arithmetic lives here rather than in `main.ts` so it can be checked without a browser, which is
// the same split `shell/options` and `shell/title` make.

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * The largest whole number of times `screen` fits inside `available`.
 *
 * ⚠️ ROUNDED DOWN, AND NEVER BELOW ONE. Rounding up or to the nearest would crop the table; a fraction
 * would bring back the uneven grid this exists to prevent. In a window too small to hold one screen the
 * answer is still one — the picture then overflows, which is a layout problem and a visible one, rather
 * than an invisible canvas of no size.
 */
export function integerScale(available: Size, screen: Size): number {
  const fits = (space: number, size: number): number =>
    (Number.isFinite(space) && space > 0 && size > 0 ? Math.floor(space / size) : 1);
  return Math.max(1, Math.min(fits(available.width, screen.width), fits(available.height, screen.height)));
}
