// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TITLE SCREEN, MEASURED IN LAYOUT RATHER THAN IN ATTRIBUTES.
//
// ⚠️ THIS FILE EXISTS BECAUSE THE FIRST BOOT OF THE TITLE SCREEN SHOWED BOTH SCREENS AT ONCE.
//
// `shell/title-dom` set `hidden` on the title and on the selector, which is how every other dialog in
// this port is put away. It marked them and hid nothing: `hidden` works by a user-agent stylesheet
// rule — `[hidden] { display: none }` — and both elements are laid out with an INLINE `display: flex`,
// which beats a stylesheet. The title, five table buttons and a back link drew on top of each other.
//
// `tests/shell-options-dialog.browser` already asks exactly this question of the palette dialog — "a
// closed dialog is really gone, not merely marked", measured with `getBoundingClientRect` — and that
// dialog passes because it sets no inline `display`. The lesson did not transfer because the test did
// not. This is the test transferring.
//
// ⚠️ AND `getBoundingClientRect` IS THE POINT. Asserting `style.display === 'none'` would pass on the
// broken version the moment somebody wrote `hidden` back, because the attribute would be set. Only
// layout knows whether a thing occupies the screen.
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mountTitle } from '../app/js/shell/title-dom.js';
import { titleScreen } from '../app/js/shell/title.js';
import { emptyTable, writeTable, type HighScoreStore } from '../app/js/control/high-score.js';

let host: HTMLElement;

const memoryStore = (): HighScoreStore & { held: Record<string, string> } => {
  const held: Record<string, string> = {};
  return { held, getItem: (k) => held[k] ?? null, setItem: (k, v) => { held[k] = v; } };
};

function build(store: HighScoreStore = memoryStore()) {
  const screen = titleScreen();
  const dom = mountTitle({ doc: document, host, screen, t: (k) => k, store });
  const at = (selector: string) => host.querySelector<HTMLElement>(selector)!;
  const shows = (el: HTMLElement) => el.getBoundingClientRect().height > 0;
  return { screen, dom, at, shows };
}

beforeEach(() => {
  host = document.createElement('div');
  // The real host is `#game-region`, which is positioned and sized. Without a size the absolutely
  // positioned screen has nothing to fill and every rectangle is zero — which would make the
  // assertions below pass for the wrong reason.
  Object.assign(host.style, { position: 'relative', width: '320px', height: '180px' });
  document.body.appendChild(host);
});

afterEach(() => host.remove());

describe('⚠️ one screen at a time, measured', () => {
  test('the title occupies the screen and the selector occupies nothing', () => {
    const { at, shows } = build();

    expect(shows(at('.pinball-title button')), 'the title is up').toBe(true);
    expect(shows(at('.pinball-select')), 'the selector is not').toBe(false);
  });

  test('and clicking swaps them, rather than adding to them', () => {
    // The defect in one assertion: on the broken version BOTH of these were true after the click.
    const { at, shows } = build();

    at('.pinball-title button').click();

    expect(shows(at('.pinball-select')), 'the selector is up').toBe(true);
    expect(shows(at('.pinball-title button')), 'and the title has gone').toBe(false);
  });

  test('going back swaps them again', () => {
    const { at, shows } = build();
    at('.pinball-title button').click();

    [...host.querySelectorAll('button')].find((b) => b.textContent === 'pinball.title.back')!.click();

    expect(shows(at('.pinball-title button'))).toBe(true);
    expect(shows(at('.pinball-select'))).toBe(false);
  });

  test('⚠️ and starting a game puts the WHOLE screen away, table and all', () => {
    const { at, shows, screen } = build();
    at('.pinball-title button').click();

    at('[data-table]').click();

    expect(screen.current).toBe('playing');
    expect(shows(at('.pinball-title')), 'nothing of it is left on the canvas').toBe(false);
  });
});

describe('the title fits the screen it is drawn on', () => {
  test('⚠️ no line runs off the edge, which is how SPACE lost its first letter', () => {
    // At 13cqw "STUDENT" needed 91% of the width before letter-spacing and overflowed. This is the
    // check that the numbers still fit — and it is a real measurement, not a recomputation of the
    // font size, so it survives a change to the face.
    const { at } = build();
    const box = host.getBoundingClientRect();

    for (const line of host.querySelectorAll<HTMLElement>('.pinball-title span')) {
      const r = line.getBoundingClientRect();
      expect(r.left, `"${line.textContent}" starts inside`).toBeGreaterThanOrEqual(box.left - 0.5);
      expect(r.right, `"${line.textContent}" ends inside`).toBeLessThanOrEqual(box.right + 0.5);
    }
    expect(at('.pinball-title').getBoundingClientRect().height,
      'and the screen does not grow taller than the canvas').toBeLessThanOrEqual(box.height + 0.5);
  });
});

describe('the scoreboard under the selector', () => {
  test('says so when nobody has played, rather than showing a gap', () => {
    const { at } = build();

    at('.pinball-title button').click();

    expect(at('.pinball-high-scores').textContent).toContain('pinball.title.noScores');
  });

  test('⚠️ and it is read when the selector OPENS, not when the page loaded', () => {
    // A game finished since the menu was last shown is exactly when this changed. A scoreboard read
    // once at boot would show the state before the player's own game for the rest of the session.
    const store = memoryStore();
    const { at } = build(store);

    writeTable(store, [{ name: 'ROCHA', score: 4242 }, ...emptyTable().slice(1)]);
    at('.pinball-title button').click();

    expect(at('.pinball-high-scores').textContent).toContain('ROCHA');
    expect(at('.pinball-high-scores').textContent).toContain('4242');
  });
});
