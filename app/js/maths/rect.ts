// SPDX-License-Identifier: AGPL-3.0-or-later
// maths/rect — the two rectangle operations the compositor is built on. Port of
// `maths::rectangle_clip` and `maths::enclosing_box`.
//
// A width of -1 is the original's "empty". Not zero, and not null: the compositor stores rectangles by
// value in the sprite and needs a value that says "nothing here" without an extra flag.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const EMPTY_WIDTH = -1;

export const isEmpty = (r: Rect): boolean => r.width <= 0;

/**
 * The intersection. Returns false and leaves `out` alone when they do not meet.
 *
 * `out` may be omitted, in which case this is only a test — the original passes `nullptr` for exactly
 * that, when building the occlusion list.
 */
export function rectangleClip(a: Rect, b: Rect, out?: Rect): boolean {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= x || bottom <= y) return false;

  if (out) {
    out.x = x;
    out.y = y;
    out.width = right - x;
    out.height = bottom - y;
  }
  return true;
}

/** The smallest rectangle containing both. Writes into `out`. */
export function enclosingBox(a: Rect, b: Rect, out: Rect): void {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  out.x = x;
  out.y = y;
  out.width = right - x;
  out.height = bottom - y;
}
