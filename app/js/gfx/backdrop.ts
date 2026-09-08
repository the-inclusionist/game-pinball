// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/backdrop — fetching a table's own picture and turning it into pixels the compositor can use.
//
// ========================= WHY THIS IS ASYNCHRONOUS AND THE GAME IS NOT =========================
// ⚠️ THE TABLE HAS TO OPEN WITHOUT IT. Decoding an image is a fetch and a decode, and `main.ts` boots
// synchronously by design — the player gets a table, a ball and working flippers in the first frame.
// So the backdrop arrives LATE: the first frames are the world's colour bands, the picture is
// recomposed when the image lands, and a decode that fails leaves a table that plays.
//
// That is not a graceful-degradation flourish. `art/*.jpg` are not versioned (see `.gitignore`), the
// derived assets are, and a build that shipped without one would otherwise be a black screen instead
// of a game with a plainer background.
//
// ========================= AND WHY IT DOES NOT USE THE PAGE'S CANVAS =========================
// `OffscreenCanvas` where it exists, a detached `<canvas>` where it does not. Either way the pixels
// come back as a `Uint32Array` in the framebuffer's own layout, so `gfx/table-view` can `set()` them
// in one call rather than walking them.
//
// ⚠️ THE SIZE IS CHECKED HERE AND AGAIN AT DRAW TIME. Here because a wrong size is worth reporting;
// there because `drawBackground` takes the array from anywhere and a stretched playfield puts the art
// a few pixels from the geometry everywhere — the player aims at what they see and the ball meets what
// they do not.

/**
 * Every table picture the build knows about, by table name.
 *
 * ⚠️ A GLOB RATHER THAN SIX IMPORTS, because the table is chosen at run time from the URL and from the
 * pause menu. Vite resolves this at build time into a map of hashed URLs, so a table with no art
 * simply has no entry and the lookup answers `undefined` — which is the same path as a failed decode
 * and needs no second branch.
 */
import { leanOf } from '../table/perspective.js';
import { plungerLaneOf } from '../table/cabinet.js';

const URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/tables/*.png', { eager: true, query: '?url', import: 'default' }),
  ).map(([path, url]) => [path.replace(/^.*\/(.+)\.png$/, '$1'), url as string]),
);

/**
 * Where a table's own picture lives, or `undefined` when it has none.
 *
 * ⚠️ EXPORTED SO THE SELECTOR SHOWS THE SAME FILE THE GAME WILL COMPOSE. The Dev asked for a
 * thumbnail per table, and the honest thumbnail of a table is the picture the player is about to be
 * looking at. Drawing a separate icon, or rendering the geometry into one, would be a second
 * depiction of the same thing to keep in step with the first — and the day the two disagreed, the
 * selector would be promising a table the game does not open.
 *
 * ⚠️ AND THE MAP IS NOT EXPORTED, only this lookup. A table with no art answers `undefined` here
 * exactly as it does inside `loadBackdrop`, so the caller has the one branch it already needed and
 * nothing can iterate the pictures as if they were the catalogue — `table/catalog` is the catalogue.
 */
export function backdropUrl(tableName: string): string | undefined {
  return URLS[tableName];
}

export interface BackdropSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The table's picture as packed pixels, or `null` if there is none, it will not decode, or it is the
 * wrong size.
 *
 * ⚠️ IT NEVER THROWS. Every caller is the game's boot path, and a background is the one thing on this
 * screen whose absence must not stop anything.
 */
export async function loadBackdrop(
  tableName: string, size: BackdropSize,
): Promise<Uint32Array | null> {
  const url = URLS[tableName];
  if (url === undefined) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    if (bitmap.width !== size.width || bitmap.height !== size.height) {
      bitmap.close();
      return null;
    }

    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(size.width, size.height)
      : Object.assign(document.createElement('canvas'), size);
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!context) {
      bitmap.close();
      return null;
    }

    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const data = context.getImageData(0, 0, size.width, size.height).data;
    /**
     * ⚠️ THE SAME BUFFER, READ AS WORDS. `getImageData` hands back R,G,B,A bytes and the compositor
     * wants one word per pixel; the framebuffer's own layout IS those bytes, so this is a view rather
     * than a conversion and there is no endianness question to get wrong.
     */
    return leanPicture(new Uint32Array(data.buffer.slice(0)), size);
  } catch {
    return null;
  }
}

/**
 * The picture put through the same lean the table's geometry is.
 *
 * ⚠️ THE DEV, LOOKING AT A TABLE IN PLAY: "Você deformou os artefatos que compõe a mesa mas não
 * deformou a arte?" He is right, and it is the worst kind of wrong this module has a rule about. Its
 * own header refuses a picture of the wrong SIZE — "a stretched playfield puts the art a few pixels
 * from the geometry everywhere, which is worse than having none: the player aims at what they see and
 * the ball meets what they do not" — and then let one through that was the right size and the wrong
 * SHAPE. `table/perspective` leans every component nine degrees and the bitmap was blitted upright, so
 * the walls converged over a picture that did not, by up to 47 units at the top of `factory`.
 *
 * ⚠️ AND IT IS THE INVERSE MAP, PIXEL BY PIXEL, BECAUSE A FORWARD ONE LEAVES HOLES. For each column of
 * the leaning table this asks which column of the painted rectangle belongs there; walking the source
 * instead would write some destination pixels twice and skip others, which at 183 across is a picture
 * with gaps in it.
 *
 * ⚠️ NEAREST, NOT INTERPOLATED, and `gfx/scale` already argues this exact choice for this exact art:
 * "nearest keeps the hard pixel-art edge and loses the one-pixel highlights on the ramps." A smoothed
 * warp would blur every edge in a picture drawn at 183 pixels wide.
 *
 * ⚠️ AND WHAT FALLS OUTSIDE THE TRAPEZIUM IS LEFT BLACK. The corners above the leaning walls are not
 * part of the table any more — nothing can be there and no ball can reach it — so stretching the art
 * into them would be painting playfield where there is none. `gfx/backdrop`'s caller composes over
 * this, and the surround dims what is left.
 */
export function leanPicture(source: Uint32Array, size: BackdropSize): Uint32Array {
  const { width: w, height: h } = size;
  const lean = leanOf({ size, ballRadius: 3 });
  const { divider } = plungerLaneOf(size);
  const out = new Uint32Array(source.length);

  for (let y = 0; y < h; y++) {
    const inset = lean * (h - y);
    const play = divider - 2 * inset;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      /**
       * The two pieces of `taperMap`, inverted. The join is at `divider - inset`, which is where the
       * lane starts on THIS row: right of it the picture has only slid, left of it it was squeezed
       * into what the leaning walls left.
       */
      const from = x >= divider - inset
        ? x + inset
        : play <= 0 ? -1 : ((x - inset) * divider) / play;
      if (from < 0 || from >= w) continue;
      out[row + x] = source[row + Math.round(from)]!;
    }
  }
  return out;
}
