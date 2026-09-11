// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY TABLE IN THE SELECTOR SHOWS A PICTURE OF ITSELF.
//
// ⚠️ THE DEV: "No menu de seleção de mesas, eu gostaria de um thumbnail para cada mesa, e não somente
// os nomes." — "e não somente", so the name stays and the picture joins it.
//
// ========================= WHY THE PICTURE IS THE TABLE'S OWN ART =========================
// `app/assets/tables/*.png` is what the player is about to be looking at: `gfx/backdrop` composes that
// same file behind the playfield. A drawn icon, or a render of the geometry, would be a second
// depiction to keep in step with the first — and the day they disagreed, the selector would be
// promising a table the game does not open.
//
// ========================= AND WHY IT IS CHECKED IN A BROWSER =========================
// Three of the four claims below need a real one. That the `<img>` is there is markup and node could
// see it; that the file DECODES, that it is laid out with a size, and that the six are TELLABLE APART
// are a network fetch, a layout and a canvas read.
//
// ⚠️ THE LAST OF THOSE IS THE ONE THAT MAKES IT A THUMBNAIL. Six elements that all resolve, all lay
// out and all show the same dark rectangle satisfy every other assertion here and are not thumbnails —
// they are decoration with a name under it. The art is deliberately dimmed to L*25 on the way in
// (`scripts/import-art.py`, so the ball clears 3:1 against it), which is exactly the treatment that
// could flatten six playfields into one grey smudge. This measures whether it did.
import { describe, test, expect, beforeAll } from 'vitest';
import { PLAYABLE_TABLES } from '../app/js/table/catalog.js';
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';

interface PinballDebug { backdropLoaded: boolean }
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};

/**
 * A picture reduced to a 4x4 grid of average colours — twelve numbers per row, forty-eight per table.
 *
 * ⚠️ A GRID AND NOT ONE MEAN, because one mean is a colour and two different tables can share one.
 * Four by four keeps the coarse LAYOUT — where the light parts are — which is the thing a player
 * actually recognises a table by at this size.
 */
async function signature(img: HTMLImageElement): Promise<number[]> {
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const context = canvas.getContext('2d')!;
  context.drawImage(img, 0, 0, 4, 4);
  const { data } = context.getImageData(0, 0, 4, 4);
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 4) out.push(data[i]!, data[i + 1]!, data[i + 2]!);
  return out;
}

/** The largest per-channel gap between two signatures: how unlike each other they look. */
const apart = (a: number[], b: number[]): number =>
  a.reduce((worst, value, i) => Math.max(worst, Math.abs(value - b[i]!)), 0);

beforeAll(async () => {
  document.body.innerHTML = PAGE_MARKUP;
  pinLanguage();
  await import('../app/js/standalone.js');
  for (let i = 0; i < 600 && !debug().backdropLoaded; i++) await frames(1);
  document.querySelector<HTMLElement>('.pinball-title button')?.click();
  await frames(5);
});

const buttons = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-table]')];

describe('the table selector shows each table, not only its name', () => {
  test('⚠️ every offered table carries a picture that loaded and has a size', async () => {
    const offered = PLAYABLE_TABLES.map((t) => t.name);
    expect(buttons().map((b) => b.dataset['table']), 'the selector offers the playable tables')
      .toEqual(offered);

    const missing: string[] = [];
    const blank: string[] = [];
    const flat: string[] = [];

    for (const button of buttons()) {
      const name = button.dataset['table']!;
      const img = button.querySelector('img');
      if (!img) {
        missing.push(name);
        continue;
      }
      // ⚠️ AND THE NAME IS STILL THERE. The Dev asked for a thumbnail as well as the name, not instead
      // of it: a grid of six dark rectangles is not something you can pick a table out of by reading.
      expect(button.textContent?.trim(), `the name disappeared from ${name}'s button`).toBe(name);

      await img.decode().catch(() => {});
      if (img.naturalWidth === 0) blank.push(name);
      const box = img.getBoundingClientRect();
      // Big enough to be a picture rather than a hairline. The screen is 320 wide and this runs at
      // whatever scale `fitCanvas` chose, so the floor is expressed against the button that holds it.
      if (box.width < 6 || box.height < 6) flat.push(`${name} ${box.width}x${box.height}`);
    }

    expect(missing, 'these tables are offered with a name and no picture').toEqual([]);
    expect(blank, 'these pictures did not decode — the URL does not resolve to an image').toEqual([]);
    expect(flat, 'these pictures are laid out too small to be one').toEqual([]);
  });

  test('⚠️ and the six are tellable apart, which is the whole point of a thumbnail', async () => {
    const signatures = new Map<string, number[]>();
    for (const button of buttons()) {
      const img = button.querySelector('img');
      if (img) signatures.set(button.dataset['table']!, await signature(img));
    }
    expect(signatures.size, 'there were no pictures to compare').toBe(PLAYABLE_TABLES.length);

    const names = [...signatures.keys()];
    const pairs = names.flatMap((a, i) => names.slice(i + 1).map((b) => ({
      pair: `${a} vs ${b}`, distance: apart(signatures.get(a)!, signatures.get(b)!),
    })));
    const closest = pairs.reduce((worst, p) => (p.distance < worst.distance ? p : worst));

    expect(closest.distance, `${closest.pair} look the same at thumbnail size`
      + ` — the art is dimmed to L*25 on the way in, and this is where that flattens six tables`
      + ` into one grey smudge`).toBeGreaterThan(24);
  });
});
