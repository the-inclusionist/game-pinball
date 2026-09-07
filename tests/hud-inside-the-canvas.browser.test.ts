// SPDX-License-Identifier: AGPL-3.0-or-later
// NOTHING THE HUD DRAWS MAY LEAVE THE CANVAS.
//
// ⚠️ THE DEV: "você está desenhando artefatos fora da tela do canvas. Nada deve ser desenhado fora do
// canvas." Asked what he saw: "O HUD, em dimensão menor, mostra texto no canto inferior esquerdo fora
// do canvas."
//
// Measured in the built page, at the smallest size the game is ever shown: the hint block runs to
// `bottom = 473` against a canvas whose bottom is 441. THIRTY-TWO PIXELS of text below the game.
//
// ========================= WHY IT GREW DOWNWARD =========================
// `shell/hud-dom` places every block by `top` and gives it `min-height` rather than `height` — "the
// height is a floor rather than a cap: a hint that wraps to a fifth line should be readable, not
// clipped". That reasoning is right and is kept: clipping accessible text to protect a layout is the
// wrong way round.
//
// What was wrong is the ANCHOR. The hint sits at the bottom-left, and a block anchored by its top
// grows away from its anchor — so the fifth line, and every line after it, goes off the bottom of the
// canvas. Anchored by its BOTTOM it grows the other way, into the left column, which is empty from
// just under the ball count all the way down: about twenty-seven lines of room before it could reach
// anything.
//
// ========================= AND THIS IS A BROWSER TEST BECAUSE WRAPPING IS =========================
// `tests/shell-hud` checks the arithmetic of the boxes and `tests/shell-hud-dom` checks that they
// reach the elements. Neither can know how many lines a string takes: that is a font, a width and a
// language, and it is the only thing that decides whether this happens.
import { describe, test, expect, beforeAll } from 'vitest';

interface PinballDebug { backdropLoaded: boolean }
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};

/**
 * The longest thing that can land in the hint.
 *
 * ⚠️ FROM THE DICTIONARY, NOT INVENTED. `pinball.demo.caveat` is 208 characters and is the longest
 * string this game ships; the mission lines are shorter but the same shape. A test that made up its
 * own text would be measuring a case the game cannot produce, and would miss the day a real string
 * grows past it.
 */
const LONGEST = 'A mesa de 1995: a física, as lâmpadas, as rampas, os sprites e as vinte e três '
  + 'missões. O painel lateral saiu de propósito — a pontuação e o resto ficam nos cantos. O guia '
  + 'sonoro ainda não descreve esta mesa.';

beforeAll(async () => {
  document.head.innerHTML = '';
  document.body.innerHTML = `
    <main id="game-region" tabindex="-1"></main>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd-filters" width="0" height="0" aria-hidden="true" focusable="false"></svg>
  `;
  await import('../app/js/main.js');
  for (let i = 0; i < 600 && !debug().backdropLoaded; i++) await frames(1);
  // Into a game, which is the only state the HUD is shown in.
  document.querySelector<HTMLElement>('.pinball-title button')?.click();
  await frames(4);
  document.querySelector<HTMLElement>('[data-table]')?.click();
  await frames(6);
});

const canvas = (): DOMRect => document.querySelector('canvas')!.getBoundingClientRect();

describe('every HUD block stays inside the canvas', () => {
  test('with the text each of them normally carries', () => {
    const box = canvas();
    const outside = [...document.querySelectorAll<HTMLElement>('[data-block]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5
        || r.left < box.left - 0.5 || r.right > box.right + 0.5)
      .map(({ el, r }) => `${el.dataset['block']} bottom=${Math.round(r.bottom)}`);

    expect(outside, `the canvas ends at ${Math.round(box.bottom)}`).toEqual([]);
  });

  test('⚠️ and with the longest string this game can put in the hint', () => {
    // The case the Dev saw. Thirty-two pixels of text below the game before the anchor was fixed.
    const hint = document.querySelector<HTMLElement>('[data-block="hint"]')!;
    const was = hint.textContent;
    hint.textContent = LONGEST;
    const r = hint.getBoundingClientRect();
    const box = canvas();
    hint.textContent = was;

    expect(r.height, 'the long text did not actually wrap, so this proves nothing')
      .toBeGreaterThan(box.height / 6);
    expect(Math.round(r.bottom), `the hint ends ${Math.round(r.bottom - box.bottom)}px below the canvas`)
      .toBeLessThanOrEqual(Math.round(box.bottom));
    expect(Math.round(r.top), 'and it grew up out of the top instead').toBeGreaterThanOrEqual(
      Math.round(box.top),
    );
  });
});
