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
    return new Uint32Array(data.buffer.slice(0));
  } catch {
    return null;
  }
}
