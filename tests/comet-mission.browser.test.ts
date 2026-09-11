// SPDX-License-Identifier: AGPL-3.0-or-later
// THE COMET MISSION, FROM THE SCREEN THAT ASKS FOR THE NUMBER TO PIXELS ON THE CANVAS.
//
// ⚠️ THE DEV: "Após escolher a tela, a próxima tela é a da missão principal. o jogador deve escolher um
// número de 2 a 9. Uma vez escolhido o número, aparecerá na fase cometas caindo do céu com um número
// dentro, no máximo 3 por vez."
//
// ========================= WHAT THIS FILE IS FOR, AND WHAT IT IS NOT =========================
// The RULES are `tests/comet-mission.node`: three at a time, ten seconds, always a multiple to aim at,
// a point for a right answer and one off for a wrong one, twenty to win. Twelve tests with a seeded
// generator, and the three that carry the design were each confirmed by mutation.
//
// None of that says the drill ever REACHES a player. What this file asks is the wiring: that choosing a
// table asks for a number, that picking one starts a game, that comets are on the canvas, and that the
// corner says how many points there are. Every one of those is a thing node cannot see — a screen, a
// click, a framebuffer that reached a canvas, and a DOM block.
import { describe, test, expect, beforeAll } from 'vitest';
import { userEvent } from 'vitest/browser';
import { COMET_BODY } from '../app/js/gfx/comet-view.js';
import { WINNING_POINTS, MISSION_NUMBERS, MAX_COMETS, type Comet }
  from '../app/js/control/comet-mission.js';
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';

interface PinballDebug {
  backdropLoaded: boolean;
  phase: string;
  comets: readonly Comet[];
  missionPoints: number | null;
}
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};

beforeAll(async () => {
  document.body.innerHTML = PAGE_MARKUP;
  pinLanguage();
  await import('../app/js/standalone.js');
  for (let i = 0; i < 600 && !debug().backdropLoaded; i++) await frames(1);
});

/** How many pixels of the canvas are exactly the comet's body colour. */
function cometPixels(): number {
  const canvas = document.querySelector('canvas')!;
  const context = canvas.getContext('2d')!;
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === COMET_BODY.r && data[i + 1] === COMET_BODY.g && data[i + 2] === COMET_BODY.b) {
      count++;
    }
  }
  return count;
}

describe('choosing a table asks for a times table, and then the comets fall', () => {
  /**
   * ⚠️ ONE WALK, for the reason `tests/screens-fit` and `tests/pause-before-the-launch` are one walk:
   * the suite shuffles tests as well as files, and every step here is the previous step's state. Split
   * into six, each would have had to navigate back to a known screen to ask one question.
   */
  test('⚠️ the screen, the number, the comets and the corner', async () => {
    // ---- the mission screen, which is new between the selector and the game ----
    document.querySelector<HTMLElement>('.pinball-title button')?.click();
    await frames(4);
    document.querySelector<HTMLElement>('[data-table]')?.click();
    await frames(5);

    const offered = [...document.querySelectorAll<HTMLElement>('[data-times]')]
      .filter((el) => el.getBoundingClientRect().height > 0)
      .map((el) => Number(el.dataset['times']));
    expect(offered, 'choosing a table went straight into a game instead of asking for the number')
      .toEqual([...MISSION_NUMBERS]);

    // ⚠️ AND IT SAYS WHAT THE NUMBER IS FOR. Eight bare digits is a screen a child has to guess at.
    const said = document.querySelector<HTMLElement>('.pinball-mission')?.textContent ?? '';
    expect(said.length, 'the mission screen offers eight numbers and explains nothing')
      .toBeGreaterThan(40);

    // ---- picking one starts the game ----
    document.querySelector<HTMLElement>('[data-times="7"]')?.click();
    await frames(6);
    expect(document.querySelector<HTMLElement>('.pinball-mission')?.style.display,
      'the mission screen is still up over the table').toBe('none');
    expect(debug().missionPoints, 'no drill was started').toBe(0);

    // ---- and the corner reports it, at nought out of twenty ----
    const corner = document.querySelector<HTMLElement>('[data-block="mission"]');
    expect(corner?.textContent, 'the mission total is not in the HUD').toContain(
      `0/${WINNING_POINTS}`,
    );

    // ---- nothing falls until a ball is in play ----
    /**
     * ⚠️ DELIBERATE, AND WORTH A GATE. Between balls the sky would go on filling and emptying with
     * nothing able to reach it, so a player watching their last ball drain would lose ten seconds of
     * comets they never had a shot at. The flippers keep moving without a ball because they are the
     * table being alive; a comet is a TARGET, and a target nobody can hit is a countdown against the
     * player.
     */
    await frames(30);
    expect(debug().comets, 'comets fell before the ball was launched').toEqual([]);

    // ---- launch, and they arrive ----
    await userEvent.keyboard('{u}');
    await frames(10);
    expect(debug().phase).toBe('playing');

    for (let i = 0; i < 240 && debug().comets.length === 0; i++) await frames(1);
    expect(debug().comets.length, 'no comet arrived in four seconds of play').toBeGreaterThan(0);
    expect(debug().comets.length, 'more than the three the Dev asked for')
      .toBeLessThanOrEqual(MAX_COMETS);

    // ---- and they are on the CANVAS, which is the claim nothing else here makes ----
    /**
     * ⚠️ THE PIXELS, NOT THE MODEL. Everything above this line would pass on a build where `drawComet`
     * was never called: the mission would advance, the corner would count, and the player would be
     * hitting things they cannot see. That is the exact shape of the four defects `CLAUDE.md` records
     * under "look at the output" — the flippers drawn at rest, the lamps drawn nowhere.
     *
     * Counted against the comet's own body colour, which is drawn at full alpha and appears nowhere
     * else: the playfield art is dimmed far below it and the ball is near-white.
     */
    let painted = 0;
    for (let i = 0; i < 180 && painted === 0; i++) {
      await frames(1);
      painted = cometPixels();
    }
    expect(painted, 'the comets exist in the model and are not drawn on the screen').toBeGreaterThan(0);
  });
});
