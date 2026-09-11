// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAUSE MENU, DRIVEN BY THE MACHINE, IN A REAL BROWSER.
//
// ⚠️ THE DEV: "O jogo não tem pause com h/enter ainda, para acessar um menu com opções de voltar,
// editar controle, modos de acessibilidade para visão etc."
//
// He was right, and what was wrong took three separate defects to produce. Every one of them is
// invisible to a node test, because every one is about a real key reaching a real element:
//
//   1. ⚠️ THE ENGINE WAS EATING THE KEYS. `ui/menu-nav` attaches a WINDOW-CAPTURE keydown listener
//      whose first act is `if (!ctx.isNavigable()) return;` — and `shell/boot` answered `true` while
//      paused, so the engine consumed Enter, A, D, J, K and H before they reached anything at all.
//      Instrumented: the codes arrived at `window` and never reached `#game-region`. `KeyU` survived,
//      which is why the plunger alone worked and the failure looked arbitrary. What that bought was
//      nothing: this port draws its OWN pause menu, so the engine had nothing on screen to navigate.
//   2. ⚠️ `preventDefault` WAS CANCELLING THE PLATFORM'S OWN BUTTON PRESS. `ownCabinetKeys` cancelled
//      the default of every cabinet key it took, including on a screen that had no handler for it —
//      so `Enter` on a focused "Continuar" was swallowed before the game could toggle the pause AND
//      cancelled before the browser could click the button. It now cancels only what it handles.
//   3. ⚠️ AND THE MENU RE-FOCUSED ITSELF SIXTY TIMES A SECOND. `main`'s frame loop runs
//      `phase === 'paused' ? open() : close()` every frame, deliberately — and `open()` took the
//      focus every time. Measured: focusing the third entry moved the focus and a `focusin` put it
//      straight back on the first within the same frame. Every flipper press, every Tab and every
//      click on another entry was undone before a player could see it.
//
// ========================= AND THIS IS WHY IT IS A BROWSER TEST =========================
// `tests/shell-pause-menu.node.test.ts` drives this menu through a fake and checks far more of it.
// None of the three above is visible there: the first is a listener in another package on the real
// `window`, the second is the browser's own activation behaviour, and the third needs a frame loop
// and a live `document.activeElement`. The node suite was green throughout.
import { describe, test, expect, beforeAll } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';

interface PinballDebug { phase: string; score: number }
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};
const menu = (): HTMLElement => document.getElementById('pinball-pause')!;
const shown = (el: HTMLElement): boolean => getComputedStyle(el).display !== 'none';
const under = (): string => document.activeElement?.textContent?.trim() ?? '';

/** The real sequence a player performs: title, table, launch. */
async function play(): Promise<void> {
  document.querySelector<HTMLElement>('.pinball-title button')?.click();
  await frames(3);
  document.querySelector<HTMLElement>('[data-table]')?.click();
  await frames(5);
  // ⚠️ AND THE NUMBER. The Dev put a screen between the table and the game — "Após escolher a tela, a
  // próxima tela é a da missão principal" — so a click on a table now lands on the mission screen and
  // a test that stops there is a test looking at a menu.
  document.querySelector<HTMLElement>('[data-times]')?.click();
  await frames(5);
  await userEvent.keyboard('{u}');
  await frames(6);
}

/**
 * ⚠️ EVERY TEST HERE PUTS THE GAME BACK IN PLAY FIRST, because the suite shuffles tests as well as
 * files and these four all move the phase. Written in order they passed; shuffled, the third started
 * on a paused game and read the pause menu's own entries as the flipper walk. `vite.config.ts` turned
 * shuffling on for exactly this, and this file was the next thing it caught.
 */
async function playing(): Promise<void> {
  /**
   * ⚠️ ESCAPE FIRST, BECAUSE A DIALOG LEFT OPEN SWALLOWS THE START KEY. Once `main`'s loop stopped
   * reopening the pause menu over its own dialogs, a test that ended with the palette or the vision
   * correction up left the NEXT one pressing Enter into that dialog for ever — "could not get the
   * game back into play". Escape is the way out of every one of them, and it is the one key this
   * game will never let a player rebind.
   */
  for (let i = 0; i < 3 && debug().phase !== 'playing'; i++) {
    await userEvent.keyboard('{Escape}');
    await frames(3);
    await userEvent.keyboard('{Enter}');
    await frames(4);
  }
  expect(debug().phase, 'could not get the game back into play').toBe('playing');
}

beforeAll(async () => {
  document.body.innerHTML = PAGE_MARKUP;
  pinLanguage();
  await import('../app/js/main.js');
  await frames(10);
  await play();
});

describe('start opens the pause menu and start closes it', () => {
  test.each(['{Enter}', '{h}'])('⚠️ %s pauses, and pressing it again comes back', async (key) => {
    await playing();

    await userEvent.keyboard(key);
    await frames(4);
    expect(debug().phase, `${key} paused it`).toBe('paused');
    expect(shown(menu()), 'and the menu is on screen').toBe(true);
    expect(under(), 'with the cursor on the first entry').toBe('Continuar');

    await userEvent.keyboard(key);
    await frames(4);

    // ⚠️ THE HALF THAT WAS BROKEN. The game paused and could not be un-paused.
    expect(debug().phase, `${key} did not come back`).toBe('playing');
    expect(shown(menu()), 'and the menu is put away').toBe(false);
  });
});

describe('the directions walk it and confirm takes an entry', () => {
  test('⚠️ the cursor moves, and stays where it was put', async () => {
    await playing();
    await userEvent.keyboard('{Enter}');
    await frames(4);
    const walk: string[] = [under()];

    // Down, down, up — `wasd`, which is what walks a menu now that the paddles are off the
    // directions. This list was `{d}{d}{a}` and meant the right flipper twice and the left once.
    for (const key of ['{s}', '{s}', '{w}']) {
      await userEvent.keyboard(key);
      // Several frames on purpose: the loop reopens the menu on every one of them, and the defect
      // this catches is the focus being taken back between two of them.
      await frames(4);
      walk.push(under());
    }

    expect(walk).toEqual(['Continuar', 'Cores da mesa', 'Acessibilidade visual', 'Cores da mesa']);

    /**
     * 🔴 THIS EPILOGUE USED TO EXPECT THE GAME TO RESUME, AND IT WAS ENCODING A DEFECT.
     *
     * The cursor is on «Cores da mesa». Enter resumed the game anyway, because `Enter` is bound to BOTH
     * `confirm` and `pause` in this cabinet and the pause toggle bubbled past the button — `shell/controls`
     * measured that sequence once and wrote it down: "keydown (which bubbled and toggled the pause on),
     * then the click, then keyup". A player pointing at one entry and pressing confirm got a different
     * entry's effect, and this line called it "back out, so the next test starts where this one found the
     * game".
     *
     * 📏 MEASURED 2026-09-11, with the engine's menu layer switched on: `{ paletteOpen: true, phase:
     * 'paused' }`. The engine consumes the key at window capture and activates the item the cursor is
     * ACTUALLY ON, which is what a menu does. The game stays paused, because opening a palette is not
     * leaving a pause.
     *
     * ⚠️ AND NOTHING NEEDS TO PUT THE GAME BACK: `playing()` at the top of every case in this file does
     * it, which is what this file's own header says it is for.
     */
    await userEvent.keyboard('{Enter}');
    await frames(4);

    const palette = document.getElementById('pinball-options')!;
    expect(palette.hidden, 'confirm on «Cores da mesa» did not open the palette').toBe(false);
    expect(debug().phase, 'and opening a palette is not leaving the pause').toBe('paused');
  });

  test('⚠️ and the plunger takes the entry under the cursor', async () => {
    // The palette, which is the entry the Dev asked to be reachable from here rather than from a
    // footer — and the one whose old behaviour resumed the game behind it.
    await playing();
    await userEvent.keyboard('{h}');
    await frames(4);
    // ⚠️ `{s}` WALKS AND `{j}` CHOOSES. The Dev took the paddles off the directions and gave them
    // the menus; `{u}` is the plunger and has nothing to do on a menu any more.
    await userEvent.keyboard('{s}');
    await frames(3);
    expect(under(), 'the cursor reached the palette entry').toBe('Cores da mesa');

    await userEvent.keyboard('{j}');
    await frames(5);

    expect(shown(document.getElementById('pinball-options')!), 'the palette opened').toBe(true);
    expect(debug().phase, '⚠️ and the game did NOT resume behind it').toBe('paused');
    /**
     * ⚠️ AND THE MENU IS OUT OF THE WAY, WHICH IT WAS NOT. `main`'s frame loop runs
     * `phase === 'paused' ? open() : close()` every frame, and the phase is still `paused` while a
     * dialog opened FROM the menu is up — so the menu reopened on the very next frame, on top of the
     * dialog it had just opened. Found by screenshotting the vision dialog and seeing the pause menu
     * over it, with the dialog's edges showing either side.
     *
     * `onColours` in `main` has carried a comment since it was written saying "the loop is told to
     * leave the menu alone while the dialog is up". Nothing told it. The comment described a fix that
     * was never there, and the palette was invisible for an unrelated reason, so nobody could see it.
     */
    expect(shown(menu()), 'the pause menu is covering the dialog it opened').toBe(false);
  });
});

describe('⚠️ and the vision correction the plan promised actually reaches the screen', () => {
  /**
   * The plan: "o pinball herda de graça os filtros de daltonismo (`render/cvd-matrices`), o alto
   * contraste, o CRT e o pipeline multi-tela — nada disso precisa ser escrito." It was never
   * collected: `createGame` returns `aplicarFiltroDeVisao` and this port referenced it nowhere, so
   * the six filters went into `<svg id="cvd-filters">` at every boot and nothing ever asked for one.
   *
   * ⚠️ AND THIS IS THE ONLY PLACE THAT CAN ASK. `shell/vision` is pure and its node tests check the
   * catalogue, the CSS strings and the storage. Whether the engine then puts that string on the
   * element the player is looking at is a fact about a real document.
   */
  test('choosing a correction puts a filter on the world, and none takes it off', async () => {
    await playing();
    await userEvent.keyboard('{Enter}');
    await frames(4);
    await userEvent.keyboard('{s}{s}');
    await frames(4);
    expect(under(), 'the cursor reached the vision entry').toBe('Acessibilidade visual');

    await userEvent.keyboard('{j}');
    await frames(4);
    const dialog = document.getElementById('pinball-vision')!;
    expect(shown(dialog), 'the vision dialog opened').toBe(true);

    const choose = (label: string): void => {
      const button = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
      expect(button, `no choice called ${label}`).toBeDefined();
      button!.click();
    };
    const world = document.querySelector<HTMLElement>('#game-region canvas')!.parentElement!;

    /**
     * ⚠️ AND THE FILTER IT NAMES REALLY EXISTS, which nothing else here asks. The rest of this test
     * checks that the STRING `url(#cvd-fix-deuter)` reaches the element — and a `url()` pointing at
     * nothing applies cleanly and does nothing at all, which is this repository's most frequent defect
     * wearing a filter's name. `createGame` installs the six matrices into `<svg id="cvd-filters">`
     * and reports "sem host de filtros" when it cannot find one; this is the other end of that, in
     * the page, which is the only place the two can be compared.
     */
    const host = document.getElementById('cvd-filters');
    const installed = [...(host?.querySelectorAll('filter') ?? [])].map((f) => f.id);
    expect(installed, 'the engine installed no colour-vision filters')
      .toEqual(expect.arrayContaining(['cvd-fix-protan', 'cvd-fix-deuter', 'cvd-fix-tritan']));

    choose('deuteranopia');
    await frames(3);
    // ⚠️ THE ENGINE'S OWN url(), NOT A COLOUR THIS GAME COMPUTED. The filter is an SVG matrix the
    // engine installed; this game only names it.
    expect(world.style.filter || document.getElementById('game-region')!.style.filter)
      .toContain('cvd-fix-deuter');

    choose('Sem correção');
    await frames(3);
    expect(world.style.filter || document.getElementById('game-region')!.style.filter)
      .not.toContain('cvd-fix');
  });
});

describe('⚠️ and it FITS, because the screen is 320x180 and nothing here may scroll', () => {
  /**
   * ⚠️ THE DEV REFUSED SCROLLING BY NAME once already: "Cores da mesa deveria estar no menu de pausa,
   * não num rodapé que exige rolagem da tela." A pause menu that has to be scrolled is the same
   * complaint one screen further in — and it is what happened, because entries were added to this
   * list three times without anybody measuring the list.
   *
   * Found by screenshotting the menu at the real size and looking: the seventh entry was clipped by
   * the bottom edge. Every test in this file passed, because they all ask about behaviour and a
   * button that is off the screen still takes the focus and still fires.
   *
   * ⚠️ AND `scrollHeight > clientHeight` IS THE WHOLE QUESTION, which is why this is not a pixel
   * count fitted to seven entries: it stays true when an eighth is added, and it is what "does not
   * scroll" means.
   */
  test('every entry is inside the screen', async () => {
    await playing();
    await userEvent.keyboard('{Enter}');
    await frames(4);

    const root = menu();
    expect(root.scrollHeight, `the menu is ${root.scrollHeight}px in a ${root.clientHeight}px screen`)
      .toBeLessThanOrEqual(root.clientHeight);

    const bottom = root.getBoundingClientRect().bottom;
    const spilled = [...root.querySelectorAll('button')]
      .filter((b) => b.getBoundingClientRect().bottom > bottom + 0.5)
      .map((b) => b.textContent?.trim());

    expect(spilled, 'these entries are past the bottom edge').toEqual([]);

    await userEvent.keyboard('{Enter}');
    await frames(4);
  });
});

describe('⚠️ and the menu appears WITHOUT waiting for an animation frame', () => {
  /**
   * ⚠️ THE DEV, FOR THE THIRD TIME: "botão H e Enter devem pausar o jogo, fazendo aparecer o menu de
   * pausa... Perdi a conta de quantas vezes pedi para implementar o pause e ainda não funciona."
   *
   * The key worked every time it was measured: press it and `phase` becomes `paused`. What did not
   * happen was the MENU. Opening it was the frame loop's job — `phase === 'paused' ? open() : close()`
   * once per frame — so the menu existed only for as long as animation frames kept arriving.
   * Measured in a browser tab that is not compositing: `H -> phase=paused menu=none`. The game pauses
   * and shows nothing, which from the outside is a pause key that does not work.
   *
   * ⚠️ AND EVERY TEST IN THIS FILE WAS GREEN THROUGHOUT, because every one of them presses the key AND
   * drives the frames — `await frames(4)` right after the keystroke, in all of them. The dependency
   * was invisible precisely to the tests written to check the thing that depended on it.
   *
   * So this one presses the key and asks IMMEDIATELY, with no frame in between. It is the only test
   * here that must not await anything after the keystroke, and that is the whole point of it.
   */
  test.each(['{Enter}', '{h}'])('%s shows it on the spot', async (key) => {
    await playing();

    /**
     * ⚠️ THE FRAMES ARE HELD, WHICH IS THE ONLY WAY TO SEE THIS. Simply not awaiting a frame is not
     * enough: `userEvent.keyboard` awaits internally and the browser paints in between, so the loop
     * opens the menu anyway and the gate passes against the broken code — measured, on the mutation
     * that puts the menu back in the loop.
     *
     * A tab that is not compositing is where this bites, so the test makes one: `requestAnimationFrame`
     * queues and never fires while the key is pressed. Restored in `finally`, or every test after this
     * would run in a game that cannot draw.
     */
    const realRaf = window.requestAnimationFrame.bind(window);
    const held: FrameRequestCallback[] = [];
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      held.push(cb);
      return held.length;
    }) as typeof window.requestAnimationFrame;

    try {
      /**
       * ⚠️ AND THE FRAME ALREADY IN FLIGHT HAS TO DRAIN FIRST. The game's loop calls
       * `requestAnimationFrame(frame)` at the end of every frame, so when the stub goes in there is
       * one callback already registered with the REAL one. It fires, the loop runs once more, and
       * that single frame is enough to open the menu — measured: the mutation stayed green until this
       * wait was added. After it, the loop's next request is held by the stub and no frame can run.
       */
      await new Promise((r) => setTimeout(r, 60));
      expect(held.length, 'the loop did not come back for another frame').toBeGreaterThan(0);

      await userEvent.keyboard(key);

      expect(debug().phase, `${key} did not pause`).toBe('paused');
      expect(shown(menu()), 'the phase changed and the menu did not appear').toBe(true);
    } finally {
      window.requestAnimationFrame = realRaf;
      // Hand the loop back the callback it is waiting on, or the game never draws again.
      for (const cb of held.splice(0)) realRaf(cb);
    }

    await userEvent.keyboard(key);
    await frames(4);
  });
});

describe('⚠️ and it shows the score and the keys, which the Dev asked for', () => {
  /**
   * "pontuação também deve aparecer no menu de pausa" and "os controles devem aparecer no menu de
   * pausa, acessado via H ou ENTER."
   *
   * ⚠️ AND BOTH ARE READ LIVE, WHICH IS THE HALF A TEST HAS TO ASK ABOUT. The menu is built once and
   * opened many times: a score captured at mount is the score of whatever game was running when the
   * page loaded, and a key list captured at mount is the cabinet as it shipped — on a screen that can
   * edit the cabinet two entries further down.
   */
  test('the score is the running one, and the keys are the ones in force', async () => {
    await playing();
    await userEvent.keyboard('{Enter}');
    await frames(4);

    const score = menu().querySelector('[data-pause="score"]')!.textContent!.trim();
    const keys = menu().querySelector('[data-pause="controls"]')!.textContent!;

    expect(Number(score), `the score reads "${score}"`).toBeGreaterThan(0);
    expect(score, 'and it is the running score, not a placeholder')
      .toBe(String(debug().score));
    // ⚠️ THE DEV'S NEW CABINET: three keys a paddle, and the directions on neither of them.
    for (const key of ['J · 7 · Y', 'K · 8 · O', 'U']) {
      expect(keys, `${key} is missing from the pause menu`).toContain(key);
    }

    await userEvent.keyboard('{Enter}');
    await frames(4);
  });
});
