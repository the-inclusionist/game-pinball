// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT THE ENGINE THINKS IS ON SCREEN HAS TO BE WHAT IS ON SCREEN.
//
// ⚠️ THREE OF THIS GAME'S FOUR OVERLAYS HIDE THEMSELVES WITH `display` AND NEVER TOUCH `hidden`. The
// engine's only visibility test is `!o.hidden`, over `#game-region .overlay`
// (`ui/settings-panel.topVisibleOverlay`), and all four of these carry `class="overlay"` and are mounted
// in `#game-region`. So `sharedDialogOpen()` answers with one of them AT EVERY INSTANT OF THE GAME'S LIFE
// — on the title screen, and with a ball in play.
//
// `shell/choice-dialog` is the one that gets it right, and its own comment says why both have to move
// together: "an inline `display` beats `[hidden]`… so the two are kept in step in `open` and `close`."
// The other three were written before that was learnt, and nothing checked them.
//
// ========================= WHY THIS MATTERS MORE THAN IT LOOKS =========================
// Nothing is broken TODAY, because `shell/boot` answers `isNavigable: () => false` and the engine's
// keyboard returns before it ever asks what is open. That is the whole reason this defect is invisible:
// the game switched the engine's menu layer off, so the engine's wrong answer costs nothing.
//
// ⚠️ AND IT IS ALSO WHY THE LAYER WAS SWITCHED OFF. With `isNavigable` true, `menuNavKey` reached
// `sharedDialogOpen()`, got a `display:none` element whose `menuItems()` is empty, CONSUMED the key and
// navigated nothing — which is exactly the measured symptom: "the engine consumed Enter, A, D, J, K and H
// before they reached anything at all". The predicate was set to `false` to stop the bleeding; this is the
// wound. Reopening the menus (§8 of the plan) is not safe until this is true, which is why this file is
// written first and has to be RED before anything is changed.
import { describe, test, expect, beforeAll } from 'vitest';
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';

interface PinballDebug {
  phase: string;
  setPhase(next: string): void;
  engineSeesOpen: HTMLElement | null;
  engineItemsIn(element: HTMLElement): HTMLElement[];
}
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};

/** Every screen this game draws into `#game-region`, by the id each one mounts itself with. */
const OVERLAYS = ['pinball-pause', 'pinball-options', 'pinball-vision', 'pinball-keymap', 'pinball-high-score'];

const byId = (id: string): HTMLElement | null => document.getElementById(id);

beforeAll(async () => {
  document.body.innerHTML = PAGE_MARKUP;
  pinLanguage();
  await import('../app/js/main.js');
  await frames(10);
});

describe('the engine and this game agree about what is open', () => {
  test('⚠️ with nothing on screen, the engine sees NO menu open', async () => {
    /**
     * ⚠️ THE WHOLE FILE IN ONE ASSERTION, and it needs no driving at all: this runs on the title screen,
     * before a game has started, where this port draws no overlay whatsoever. Anything but `null` here is
     * the engine holding a menu that a player cannot see and cannot close.
     */
    debug().setPhase('title');
    await frames(3);

    const seen = debug().engineSeesOpen;

    expect(seen, `the engine is holding a screen nobody opened: #${seen?.id}`).toBeNull();
  });

  test('⚠️ and every one of our screens is invisible to it while it is shut — a ledger, not a sample', () => {
    /**
     * ⚠️ A LEDGER BECAUSE THE DEFECT WAS IN THREE FILES AND THE TEST ABOVE ONLY SEES THE TOPMOST. The
     * engine picks the highest `z-index` among the visible ones, so fixing one screen would move the
     * failure to the next and the case above would go on failing with a different id — or, worse, pass
     * while two remained.
     */
    const open = OVERLAYS.filter((id) => {
      const element = byId(id);
      return element !== null && !element.hidden;
    });

    expect(open, 'these are shut and the engine cannot tell').toEqual([]);
  });

  test('⚠️ every one of them is IN the scope the engine scans, which is what makes the rest true', () => {
    // If a screen were mounted outside `#game-region`, or lost its `overlay` class, the two cases above
    // would pass by being invisible rather than by being correct — the shape of green that proves nothing.
    const scope = document.querySelectorAll('#game-region .overlay');
    const ids = [...scope].map((element) => element.id).filter(Boolean);

    for (const id of OVERLAYS) expect(ids, `${id} is not where the engine looks`).toContain(id);
  });

  test('⚠️ and when one IS open, the engine finds that one and can walk it', async () => {
    /**
     * The mirror, and it is not optional: a game that hid every screen from the engine would satisfy the
     * cases above perfectly and leave §8 with nothing to navigate. `menuItems` keeps what is enabled AND
     * visible (`offsetParent !== null`), so an empty list here would mean the engine can see the menu and
     * cannot reach a single control in it.
     */
    debug().setPhase('paused');
    await frames(4);

    const menu = byId('pinball-pause')!;
    const seen = debug().engineSeesOpen;

    expect(seen, 'the engine did not find the menu that is actually up').toBe(menu);
    expect(debug().engineItemsIn(menu).length, 'it found the menu and no control inside it')
      .toBeGreaterThan(0);

    debug().setPhase('playing');
    await frames(4);
    expect(debug().engineSeesOpen, 'and it lets go when the menu closes').toBeNull();
  });
});
