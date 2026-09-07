// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAUSE MENU, WHICH PAUSE HAS NEVER HAD.
//
// ⚠️ THE DEV: "menu de pausa deve permitir dar quit, voltar à tela inicial e escolher outras mesas."
//
// Pause has existed since the key was bound and it did exactly one thing: stopped the world and wrote
// "Paused" in the HUD's footer. A player who wanted to leave a game had no way out of it — the only
// exits from a table were draining three balls or reloading the page.
//
// ========================= WHAT "QUIT" CAN MEAN IN A PAGE =========================
// ⚠️ IT CANNOT MEAN CLOSING THE WINDOW. `window.close()` is refused for anything the script did not
// open, so a Quit that tried it would do nothing on most machines and would be worse than absent —
// a menu entry that lies is a defect with a label on it.
//
// So the four entries differ in TWO things, where they land and whether the game counts:
//
//   · CONTINUE   — closes the menu. The game is where it was.
//   · TABLES     — abandons this game and opens the selector.
//   · TITLE      — abandons this game and shows the title screen.
//   · QUIT       — ENDS this game: the score is final, the board is offered if it places, and then the
//                  title. It is "I am done", and it is the only one of the three exits that records
//                  what the player did.
//
// That distinction is the whole reason Quit and Title are not the same entry, and it is stated here
// because a reader will otherwise ask.
import { describe, test, expect } from 'vitest';
import { MENU_BINDINGS } from '../app/js/shell/controls.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountPauseMenu, PAUSE_MENU_ID, PAUSE_ENTRIES } from '../app/js/shell/pause-menu.js';
import { createTranslator } from '../app/js/i18n/index.js';

interface FakeElement {
  tag: string; id: string; className: string; textContent: string;
  attributes: Record<string, string>; style: Record<string, string>;
  children: FakeElement[]; clicks: (() => void)[]; focused: number;
  keys: ((e: { code: string; key: string; preventDefault(): void; stopPropagation(): void }) => void)[];
}

function fakeElement(tag: string): FakeElement {
  const el: FakeElement = {
    tag, id: '', className: '', textContent: '', attributes: {}, style: {},
    children: [], clicks: [], focused: 0, keys: [],
  };
  return Object.assign(el, {
    setAttribute(name: string, value: string) { el.attributes[name] = value; },
    appendChild(child: FakeElement) { el.children.push(child); return child; },
    focus() { el.focused++; },
    addEventListener(type: string, fn: never) {
      if (type === 'click') el.clicks.push(fn as () => void);
      if (type === 'keydown') el.keys.push(fn);
    },
  });
}

function harness() {
  const created: FakeElement[] = [];
  const host = fakeElement('div');
  const done: string[] = [];
  const menu = mountPauseMenu({
    doc: { createElement: (tag: string) => { const el = fakeElement(tag); created.push(el); return el; } } as never,
    host: host as never,
    t: (key) => key,
    onResume: () => done.push('resume'),
    onColours: () => done.push('colours'),
    onVision: () => done.push('vision'),
    onControls: () => done.push('controls'),
    onTables: () => done.push('tables'),
    onTitle: () => done.push('title'),
    onQuit: () => done.push('quit'),
  });
  const buttons = () => created.filter((e) => e.tag === 'button');
  const root = (): FakeElement => host.children[0]!;
  /** Whether a key pressed on the menu is taken off the game behind it. */
  const swallows = (code: string): boolean => {
    let stopped = false;
    for (const fn of root().keys) {
      fn({ code, key: code, preventDefault() {}, stopPropagation() { stopped = true; } } as never);
    }
    return stopped;
  };
  return { menu, host, done, buttons, swallows, root };
}

describe('what the menu offers', () => {
  test('⚠️ seven entries, and the Dev asked for six of them by name', () => {
    // "dar quit, voltar à tela inicial e escolher outras mesas" — plus resuming, which is what a pause
    // menu is for and which no list mentions because it is the obvious one.
    //
    // ⚠️ AND `colours`, WHICH HE ASKED FOR SEPARATELY AND LATER: "Cores da mesa deveria estar no menu
    // de pausa, não num rodapé que exige rolagem da tela." It had been a `<button>` under the canvas
    // since before this menu existed, justified by a comment saying the ENGINE's pause menu has no
    // entry to add one to — true, and irrelevant from the day this port grew a menu of its own.
    //
    // ⚠️ AND `vision`, WHICH HE ASKED FOR LATER STILL: "um menu com opções de voltar, editar
    // controle, modos de acessibilidade para visão etc." It is a SECOND entry rather than a tab of
    // `colours`, because the two answer different questions — `colours` changes which colours the
    // table is drawn in, `vision` changes what reaches the eye and leaves the artwork alone. See
    // `shell/vision`. And `controls`, which is the last of that list — see `shell/bindings` for why
    // the cabinet keeps a table of its own rather than using the engine's keyboard config.
    expect([...PAUSE_ENTRIES])
      .toEqual(['resume', 'colours', 'vision', 'controls', 'tables', 'title', 'quit']);
  });

  test('⚠️ and nothing outside this menu opens the palette any more', () => {
    // The other half of his complaint: a control in a footer is a control that needs the page
    // scrolled. `main.ts` built `pinball-options-open` and appended it to the game region; it is gone,
    // and this reads the source because no unit drives the entry point.
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');

    expect(source, 'the footer button is gone').not.toMatch(/pinball-options-open/);
    expect(source, 'and the menu opens the dialog instead').toMatch(/onColours: \(\) => \{ optionsDialog\.open\(\); \}/);
  });

  test('each entry is a button with its own translated label', () => {
    const h = harness();

    expect(h.buttons()).toHaveLength(PAUSE_ENTRIES.length);
    expect(h.buttons().map((b) => b.textContent))
      .toEqual(PAUSE_ENTRIES.map((e) => `pinball.pause.${e}`));
  });

  test('⚠️ and the four labels are four DIFFERENT words', () => {
    // The test that found a real collision. One entry is called `title` — the title SCREEN — and the
    // heading's key was `pinball.pause.title` too, so the button read "Paused". Every other test here
    // translates with `t = (key) => key` and compares KEYS, which agreed with the collision happily.
    // This one translates for real.
    const created: string[] = [];
    const host = fakeElement('div');
    mountPauseMenu({
      doc: { createElement: (tag: string) => fakeElement(tag) } as never,
      host: host as never,
      t: (key) => createTranslator('en')(key),
      onVision: () => {},
      onControls: () => {},
      onResume: () => {}, onColours: () => {}, onTables: () => {}, onTitle: () => {},
      onQuit: () => {},
    });
    for (const child of host.children[0]!.children) created.push(child.textContent);
    // The heading plus four entries, and every one of them a different string.
    expect(new Set(created).size, created.join(' | ')).toBe(created.length);
  });

  test('⚠️ and it opens CLOSED, or a paused game is not what the player left', () => {
    expect(harness().root().style.display).toBe('none');
  });
});

describe('using it', () => {
  test('opening it shows it and takes the focus', () => {
    const h = harness();

    h.menu.open();

    expect(h.root().style.display).toBe('flex');
    expect(h.buttons()[0]!.focused, 'the first entry has the focus').toBeGreaterThan(0);
  });

  test.each(PAUSE_ENTRIES.map((e, i) => [e, i] as const))('%s calls back and closes', (entry, index) => {
    const h = harness();
    h.menu.open();

    h.buttons()[index]!.clicks[0]!();

    expect(h.done).toEqual([entry]);
    expect(h.root().style.display, 'and the menu is gone').toBe('none');
  });

  test('closing it directly calls nothing', () => {
    // The frame loop closes it when the phase leaves `paused` — by the pause key being pressed again,
    // which has already resumed the game. A close that fired `onResume` would resume it twice.
    const h = harness();
    h.menu.open();

    h.menu.close();

    expect(h.done).toEqual([]);
    expect(h.root().style.display).toBe('none');
  });

  test('⚠️ and it has the id the engine addresses an overlay by', () => {
    // `overlays.register(id, ...)` and `closeById` both take the id, so it is exported rather than
    // written twice — the same arrangement `shell/options-dialog` records for the palette.
    expect(harness().root().id).toBe(PAUSE_MENU_ID);
  });
});

describe('⚠️ and it owns the cabinet while it is up', () => {
  /**
   * MEASURED IN A REAL BROWSER, NOT REASONED ABOUT. This menu lives inside `#game-region`, which is
   * where `bindPinballControls` binds, so every keydown on an entry bubbled into the game — and Enter
   * is START, which is `togglePause`.
   *
   * ⚠️ SO ENTER ON "CORES DA MESA" RESUMED THE GAME AND THEN OPENED THE PALETTE OVER IT. The ball
   * started moving behind a menu the player was reading. `Continuar` survived only by an accident of
   * ordering: Chromium's measured sequence for Enter on a button is keydown, then the click, then
   * keyup — so the pause toggled to playing on the way past and `onResume` set playing again, and
   * `enterPhase` is idempotent. Two wrongs in the one entry anybody presses.
   *
   * The flippers matter for the same reason and are less visible: a paddle flapping behind an open
   * menu is a table that is being played by somebody who is not looking at it.
   */
  /**
   * ⚠️ THE MENU'S OWN KEYS, WHICH ARE NO LONGER THE GAME'S. Until the Dev's remap these were the same
   * list — a menu asked `DEFAULT_BINDINGS` what "left" was bound to and got the key it wanted by
   * coincidence, because the paddles WERE the directions. `MENU_BINDINGS` is the table now, and the
   * launch key is not in it: J takes an entry, so U has nothing to do here and must reach the game.
   */
  const cabinetKeys = Object.values(MENU_BINDINGS).flat();

  test('every cabinet key is taken off the game behind it', () => {
    const h = harness();

    // ⚠️ REOPENED BEFORE EACH ONE, because the plunger and start now TAKE an entry rather than being
    // merely swallowed — the menu shuts behind them, and a menu that is shut owns nothing. Testing
    // them in one open menu measured the first key and then five keys against a closed one.
    const escaped = cabinetKeys.filter((code) => {
      h.menu.open();
      return !h.swallows(code);
    });

    expect(escaped, 'these reached the game underneath').toEqual([]);
  });

  test('⚠️ but blind mode and the palette pass straight through, and the sonar no longer can', () => {
    /**
     * Blind mode and the palette are on B and C. They are switches for how the game is PERCEIVED and
     * `shell/controls` has argued since it was written that they must work everywhere — a screen that
     * swallowed them would be the first place they did not.
     *
     * ⚠️ THE SONAR IS THE EXCEPTION NOW, AND IT IS A COLLISION RATHER THAN A CHANGE OF MIND. `KeyS` is
     * the sweep, and the Dev's remap makes the directions walk the menus — so S is also "down". While
     * a menu is up the menu wins, and the reason it should is that a sonar sweep describes THE TABLE,
     * which is not what the player is looking at. Named here so it is not discovered as a regression.
     */
    const h = harness();
    h.menu.open();

    const swallowed = ['KeyB', 'KeyC'].filter((code) => h.swallows(code));

    expect(swallowed, 'these were eaten by the menu').toEqual([]);
    expect(h.swallows('KeyS'), 'S must walk the menu rather than sweep the table behind it').toBe(true);
  });

  test('and a menu that is closed owns nothing at all', () => {
    // Otherwise the pause key that OPENS the menu would be swallowed by the menu it is opening.
    const h = harness();

    expect(h.swallows('Enter'), 'a put-away menu still ate a key').toBe(false);
  });
});
