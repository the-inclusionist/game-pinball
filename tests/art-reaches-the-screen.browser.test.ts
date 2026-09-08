// SPDX-License-Identifier: AGPL-3.0-or-later
// DOES THE ART THE REPOSITORY SHIPS ACTUALLY REACH THE RUNNING GAME?
//
// ========================= NOTHING ASKED, AND THE ANSWER CAN BE NO SILENTLY =========================
// ⚠️ `gfx/backdrop.loadBackdrop` NEVER THROWS, ON PURPOSE. A picture that fails to load, or arrives at
// the wrong size, is refused and the table falls back to its colour bands — which is the right
// behaviour, because a stretched playfield puts the art a few pixels from the geometry EVERYWHERE and
// a table that plays is worth more than one that looks right.
//
// The cost of that decision is that EVERY WAY THE ART CAN FAIL IS SILENT. A wrong path after a bundler
// change, a `?url` import that stops resolving, a fetch blocked by a policy, a size that drifts when a
// table grows. The game comes up, plays perfectly, and is wearing colour bands. `loadBackdrop` is
// asynchronous as well, so nothing measuring the first frame would see it either way.
//
// ⚠️ AND EVERY OTHER TEST WOULD STAY GREEN. `tests/gfx-backdrop` checks the FILES. `tests/gfx-surround`
// and the authoring sheets compose the art themselves, in Node, from `readFileSync`. The browser suite
// checks that the screen CHANGES when a flipper moves. Not one of them asks whether the picture the
// repository ships is the picture the player gets — and this session re-imported all six of them.
//
// ========================= WHY THE PREVIEW COULD NOT ANSWER IT =========================
// ⚠️ MEASURED, BECAUSE IT LOOKED LIKE A DEFECT. Booted in the Browser pane, the canvas reads as 57600
// pixels of pure black and `requestAnimationFrame` fires ZERO times in 800 ms, with
// `document.visibilityState === 'hidden'` — which stays hidden even after the tab is fronted. A hidden
// document has its animation frames throttled to nothing, so the draw loop never runs and the black
// canvas is the environment rather than the game. This project is the surface that can answer,
// because its chromium is real and visible.
//
// ========================= AND THREE STATISTICS WERE TRIED FIRST AND ALL THREE FAILED =========================
// ⚠️ WRITTEN DOWN BECAUSE THE FIRST ONE WAS GREEN AND COULD NOT FAIL, which is the exact shape
// `tests/gfx-authoring-sheet` records deleting a gate for.
//
//   · ROWS THAT VARY ACROSS THE WIDTH. The idea was that a band background is a vertical gradient and
//     therefore flat along every row, and a photograph is not. Measured on all six tables at five
//     thresholds: 99% of rows vary WITH the art and 99% WITHOUT it, because the components and the
//     lane rails cross nearly every row and they are what the measure was seeing. At the widest
//     threshold the BANDS scored higher than the art on two tables.
//   · DISTINCT COLOURS. It discriminates, but not cleanly and not portably: `slipstream` is 3.0x and
//     `crater-run` 2.3x, while `low-orbit` is 1.22x, because its sky gradient is itself thousands of
//     colours. Any threshold that catches `low-orbit` is a number fitted to one table.
//   · BEST ALIGNMENT OF THE ART AGAINST THE SCREEN. Only 6.7% of the canvas matches the art exactly at
//     the best offset — correct at dy=55, which is precisely `low-orbit`'s camera travel, so the
//     signal is real — but 6.7% is not a number to build a bound on. The canvas carries the HUD, the
//     ball and the flippers, and the composition has already darkened half the backdrop.
//
// ========================= WHAT IS EXACT, AND IT WAS AVAILABLE ALL ALONG =========================
// `__pinball.picture` IS the composed playfield, which `main` exposes with the comment "so the browser
// gate can look at the pixels rather than at a screenshot". Compare it, byte for byte, with the PNG
// loaded independently of the game's own loading path. Measured: 63.5% of the picture is EXACTLY the
// shipped art, and 0.0% is when the backdrop branch is disabled. There is nothing to fit.
//
// The 36.5% that differs is not slack — it is the components, their surrounds and the lights, and the
// pixel-level truth about those lives in `tests/gfx-surround` where it can be stated precisely.
import { describe, test, expect, beforeAll } from 'vitest';

interface PinballDebug {
  problems: readonly string[];
  table: string;
  picture: { bytes: Uint8ClampedArray; width: number; height: number };
  /** Whether `loadBackdrop` resolved with a usable picture. See `main`, where it says why. */
  backdropLoaded: boolean;
}

const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const canvas = (): HTMLCanvasElement =>
  document.querySelector<HTMLCanvasElement>('#game-region canvas')!;

/** Frames, actually rendered: the game's loop is made of `requestAnimationFrame`. */
const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};

/**
 * The shipped picture for a table, decoded WITHOUT going through `gfx/backdrop`.
 *
 * ⚠️ INDEPENDENTLY, WHICH IS THE WHOLE POINT. Reusing `loadBackdrop` here would put the thing under
 * suspicion on both sides of the gate: if it silently returns nothing, both sides get nothing and the
 * comparison passes. This is a different decoder reaching the same bytes.
 */
async function shippedArt(table: string): Promise<ImageData> {
  const urls = import.meta.glob('../app/assets/tables/*.png', {
    eager: true, query: '?url', import: 'default',
  }) as Record<string, string>;
  const entry = Object.entries(urls).find(([path]) => path.endsWith(`/${table}.png`));
  if (!entry) throw new Error(`no shipped art for ${table}`);

  const image = new Image();
  image.src = entry[1];
  await image.decode();
  const off = document.createElement('canvas');
  off.width = image.width;
  off.height = image.height;
  const context = off.getContext('2d')!;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, image.width, image.height);
}

beforeAll(async () => {
  // The page's own markup, as `app/index.html` writes it — a boot against different markup would be a
  // boot of a different program.
  document.body.innerHTML = `
    <main id="game-region" tabindex="-1"></main>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd-filters" width="0" height="0" aria-hidden="true" focusable="false"></svg>
  `;
  await import('../app/js/main.js');

  /**
   * ⚠️ WAITED FOR, NOT COUNTED. This was `await frames(30)`, and thirty frames is a bet on how busy
   * the machine is: green on its own and, about one run in twelve of the whole browser suite, reading
   * a playfield with NO ART IN IT and reporting 0.0% — the exact number the failure mode this file
   * exists for produces. A gate that cannot tell "the art never loaded" from "the art has not loaded
   * YET" is a gate that will one day be silenced as flaky, on the day it is right.
   *
   * The wait is on the LOADING, which is the asynchronous part. Whether the loaded picture then
   * reaches the composed playfield is the question below, and it is still asked of the pixels.
   */
  const deadline = 600;
  for (let i = 0; i < deadline && !debug().backdropLoaded; i++) await frames(1);
  expect(debug().backdropLoaded, `the art did not load within ${deadline} frames`).toBe(true);
  // And the composition that uses it happens on a later frame than the one that received it.
  await frames(4);
});

describe('the picture the repository ships is the picture the player gets', () => {
  test('the game came up with no problems, or nothing below means anything', () => {
    expect(debug().problems).toEqual([]);
  });

  test('⚠️ the canvas is not blank, which is the floor of this whole file', () => {
    // And the one thing the Browser pane could not tell me, for the reason in the header.
    const c = canvas();
    const image = c.getContext('2d', { willReadFrequently: true })!
      .getImageData(0, 0, c.width, c.height);

    const lit = image.data.some((v, i) => i % 4 !== 3 && v > 0);

    expect(lit, 'every pixel is black — the draw loop never ran').toBe(true);
  });

  test('⚠️ and the composed playfield IS the shipped art, byte for byte, over most of itself', async () => {
    const picture = debug().picture;
    const art = await shippedArt(debug().table);

    expect([art.width, art.height], 'the art is the playfield size')
      .toEqual([picture.width, picture.height]);

    let exact = 0;
    for (let i = 0; i < picture.width * picture.height; i++) {
      const at = i * 4;
      if (art.data[at] === picture.bytes[at] && art.data[at + 1] === picture.bytes[at + 1]
        && art.data[at + 2] === picture.bytes[at + 2]) exact++;
    }
    const share = exact / (picture.width * picture.height);

    /**
     * ⚠️ FORTY PER CENT, WITH THE MEASUREMENT ON BOTH SIDES OF IT. The picture reads 63.5% with the
     * art and 0.0% without — the header says how that was established — so this is not a number fitted
     * to a run. It is far enough below 63.5 to survive a table growing another bumper, and far enough
     * above nought that the fallback cannot creep past it.
     */
    expect(share, `${debug().table}: only ${(100 * share).toFixed(1)}% of the playfield is the art`)
      .toBeGreaterThan(0.4);
  });
});
