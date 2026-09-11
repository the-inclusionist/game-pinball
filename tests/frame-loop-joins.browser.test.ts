// SPDX-License-Identifier: AGPL-3.0-or-later
// THE JOINS ONLY `main.ts` OWNS, EXERCISED WHERE `main.ts` RUNS.
//
// ⚠️ THREE COMMITS THIS WEEK ENDED WITH THE SAME LINE: "NOT COVERED: `main.ts` advancing the flare
// each frame", "NOT COVERED: `main` advancing and resetting the tracker", and the movers before them.
// Every part had a node test and the frame loop that drives them had none, because the frame loop is
// the one thing that does not exist outside a browser.
//
// It was then checked by hand, once, in a live boot — which found that the flare moves and the picture
// follows it EVEN ON THE TITLE SCREEN, and that the secret door opens on the first lost ball. Checking
// by hand is how a claim gets made; a test is how it stays true. This is that.
//
// ========================= WHY `step` AND NOT `requestAnimationFrame` =========================
// The sibling browser tests wait on real animation frames, and they are right to: what they measure is
// whether a KEY reaches the loop, and only a real frame proves a real key arrived. What this file
// measures is whether the loop advances things nobody pressed, so it drives the loop directly and
// spends its time on the question instead of on the clock.
import { describe, test, expect, beforeAll } from 'vitest';
import { PAGE_MARKUP } from './helpers/page.js';

interface PinballDebug {
  problems: readonly string[];
  table: string;
  phase: string;
  picture: { pixels: Uint32Array; width: number; height: number };
  step(frames: number): void;
  setPhase(phase: string): void;
}

const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

/** A cheap fingerprint of the composed table. Every seventh pixel is plenty to see a band move. */
function pictureHash(): number {
  const { pixels } = debug().picture;
  let h = 0;
  for (let i = 0; i < pixels.length; i += 7) h = (h * 31 + pixels[i]!) >>> 0;
  return h;
}

beforeAll(async () => {
  /**
   * ⚠️ THE TABLE IS CHOSEN BEFORE `main.ts` IS IMPORTED, because it reads the query string once at
   * boot. `ion-storm` is the only table with a storm, and the storm is the only thing in this game
   * that changes the composed picture with nobody touching anything.
   */
  history.replaceState({}, '', '?table=ion-storm');
  document.body.innerHTML = PAGE_MARKUP;
  await import('../app/js/main.js');
});

describe('the frame loop moves what nobody pressed', () => {
  test('it booted the table with the storm on it, and cleanly', () => {
    // Everything below is a statement about `ion-storm`. If the query string stopped choosing the
    // table, each of them would be quietly measuring something else and passing.
    expect(debug().problems).toEqual([]);
    expect(debug().table).toBe('ion-storm');
  });

  test('⚠️ the flare moves the picture, and the picture follows it', () => {
    // The join three commits recorded as uncovered. `physics.flare.advance` is in the frame loop and
    // `refreshObjective` is what notices; a break in either leaves the storm frozen with every node
    // test green.
    const before = pictureHash();

    debug().step(30);

    expect(pictureHash(), 'half a second of flare').not.toBe(before);
  });

  test('⚠️ and it moves ON THE TITLE SCREEN, which is the whole reason it is where it is', () => {
    // The flare is the BACKGROUND. A storm that only moved while a ball was in play would freeze
    // mid-sweep the moment one drained, with the player looking straight at it — which is why the
    // advance sits outside the playing branch, and why this is asserted rather than assumed.
    debug().setPhase('title');
    const before = pictureHash();

    debug().step(30);

    expect(debug().phase, 'still on the title screen').toBe('title');
    expect(pictureHash(), 'and the storm kept moving').not.toBe(before);
  });

  test('⚠️ and it recomposes about FORTY times a second, not sixty', () => {
    /**
     * The other half of the design, and the half that keeps it affordable: the picture is keyed on the
     * flare's position ROUNDED TO A PIXEL, and the band travels about forty-two pixels a second. So
     * sixty frames produce about forty-two new pictures, not sixty, and a composition costs 1.34 ms.
     *
     * ⚠️ THE FIRST VERSION OF THIS TEST SAID "ONE FRAME CHANGES NOTHING", AND THAT IS FALSE ABOUT
     * SEVEN TIMES IN TEN. A frame advances the band seven tenths of a pixel, so whether it crosses a
     * boundary depends on where the previous test left the clock. It passed alone and failed in the
     * full suite, which is the shuffle doing exactly what `vite.config` turned it on for — and it is
     * the third time in this repository that a test has been written about a single step of something
     * that only means anything over many.
     */
    let changes = 0;
    let last = pictureHash();
    for (let i = 0; i < 60; i++) {
      debug().step(1);
      const now = pictureHash();
      if (now !== last) changes++;
      last = now;
    }

    expect(changes, `${changes} recompositions in 60 frames`).toBeGreaterThan(20);
    expect(changes, `${changes} recompositions in 60 frames`).toBeLessThan(55);
  });
});
