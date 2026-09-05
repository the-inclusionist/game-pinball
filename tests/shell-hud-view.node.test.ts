// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { hudView, hudPlacement } from '../app/js/shell/hud-view.js';
import { layoutHud, DEFAULT_HUD } from '../app/js/shell/hud.js';
import { createTranslator, AVAILABLE_LOCALES } from '../app/js/i18n/index.js';


/**
 * ⚠️ ADR-0002 LAID OUT FOUR BLOCKS AND NOTHING EVER DREW ONE.
 *
 * `layoutHud` has computed four rectangles since phase 6, a test has held that they do not overlap, and
 * the running game has shown none of them: no score, no ball count, no player name, no hint. The record
 * was applied to arithmetic and not to a screen. Fifth time in this port that something declared turned
 * out to be inert.
 *
 * ⚠️ AND THE TEXT GOES IN THE DOM, NOT IN THE CANVAS. That is the engine's own resolution of "AAA text
 * versus a 320x180 screen" (ADR-0010): four-pixel digits cannot meet a contrast-and-size requirement,
 * and a number painted into a framebuffer is invisible to a screen reader whatever its contrast. So the
 * pixels stay the table and the words stay words.
 *
 * This file is the part that touches no DOM: what the blocks SAY, and where they go as percentages.
 */

describe('what the blocks say', () => {
  const t = createTranslator('en');

  test('the score is a number with its own label, because a bare number says nothing aloud', () => {
    // The block shows digits; the accessible name has to say what they are. A screen reader on the old
    // side panel read the label off the printed word beside it; in a corner there is no room for one.
    const view = hudView({ score: 12500, ballCount: 3, playerNumber: 1, hint: '' }, t);

    expect(view.score.text).toContain('12');
    expect(view.score.label.toLowerCase()).toContain('score');
  });

  test('the score is grouped, because seven digits in a 62-pixel corner are unreadable', () => {
    const view = hudView({ score: 1234567, ballCount: 3, playerNumber: 1, hint: '' }, t);

    expect(view.score.text).not.toBe('1234567');
    expect(view.score.text.replace(/\D/g, '')).toBe('1234567');
  });

  test('the ball count and the player name come from i18n, not from a template here', () => {
    const view = hudView({ score: 0, ballCount: 2, playerNumber: 1, hint: '' }, t);

    expect(view.balls.text).toBe('Balls: 2');
    expect(view.player.text).toBe('Player 1');
  });

  test('and they say the same thing in all three languages', () => {
    for (const locale of AVAILABLE_LOCALES) {
      const view = hudView({ score: 0, ballCount: 2, playerNumber: 1, hint: '' }, createTranslator(locale));

      expect(view.balls.text, locale).toContain('2');
      expect(view.player.text, locale).toContain('1');
      // ⚠️ A missing key comes back as the key itself, which would put `pinball.hud.balls` on screen.
      expect(view.balls.text, locale).not.toContain('pinball.');
      expect(view.score.label, locale).not.toContain('pinball.');
    }
  });

  test('an empty hint is empty rather than a placeholder', () => {
    // A dash or a blank label in the corner is furniture that means nothing and still takes the space.
    expect(hudView({ score: 0, ballCount: 3, playerNumber: 1, hint: '' }, t).hint.text).toBe('');
  });
});

describe('where the blocks go', () => {
  const layout = layoutHud(DEFAULT_HUD);

  test('every block is placed in per-cent of the screen, so it scales with the canvas', () => {
    // The canvas is 320x180 and is stretched to whatever width the page gives it. Pixel offsets would
    // put the score in the middle of the table on any screen but one.
    const placed = hudPlacement(layout, DEFAULT_HUD);

    for (const [name, box] of Object.entries(placed)) {
      expect(box.left, name).toMatch(/%$/);
      expect(box.top, name).toMatch(/%$/);
      expect(box.width, name).toMatch(/%$/);
    }
  });

  test('the score sits in the RIGHT half and the ball count in the left', () => {
    // ADR-0002: score top-right, ball count top-left, player name above it, hint lower. Read off the
    // placement rather than the layout, because the placement is what the browser obeys.
    const placed = hudPlacement(layout, DEFAULT_HUD);

    expect(parseFloat(placed.score.left)).toBeGreaterThan(50);
    expect(parseFloat(placed.balls.left)).toBeLessThan(50);
  });

  test('and the hint is BELOW them all', () => {
    const placed = hudPlacement(layout, DEFAULT_HUD);

    expect(parseFloat(placed.hint.top)).toBeGreaterThan(parseFloat(placed.score.top));
    expect(parseFloat(placed.hint.top)).toBeGreaterThan(parseFloat(placed.balls.top));
  });
});
