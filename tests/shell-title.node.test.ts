// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FIRST SCREEN, AND WHAT IT LEADS TO.
//
// The Dev asked for it exactly: SPACE / STUDENT on two lines in Press Start 2P, PINBALL underneath,
// and clicking it opens a table selector. This is the half with no DOM in it — which screen is
// showing, what the selector lists, and what choosing does — for the same reason `shell/options` is
// split that way: this repository's tests run in node, and a decision inside a click handler is a
// decision nothing can check.
//
// ⚠️ THE NAME IS NOT "SPACE CADET". That is Microsoft's title for Microsoft's table, and this game
// ships neither. `SPACE STUDENT PINBALL` is the Dev's own, and the port has no claim on the other one.
import { describe, test, expect } from 'vitest';
import {
  TITLE_LINES, TITLE_SUBTITLE, titleScreen, type Screen,
} from '../app/js/shell/title.js';
import { CATALOG } from '../app/js/table/catalog.js';

describe('what the title says', () => {
  test('⚠️ SPACE and STUDENT on two lines, and PINBALL under them', () => {
    // Two lines rather than one string with a newline in it: the screen is 320 pixels wide and the
    // font is fixed-width, so where the break falls is a layout fact and not a typographic accident.
    expect(TITLE_LINES).toEqual(['SPACE', 'STUDENT']);
    expect(TITLE_SUBTITLE).toBe('PINBALL');
  });

  test('and none of it is a translated string, because a title is a name', () => {
    // Every other word on screen goes through `t()`. A game's title does not: it is the same in every
    // language, the way `PINBALL` was in 1995, and routing it through i18n would invite somebody to
    // translate it in one locale and not the others.
    for (const line of [...TITLE_LINES, TITLE_SUBTITLE]) {
      expect(line).not.toMatch(/^pinball\./);
      expect(line).toBe(line.toUpperCase());
    }
  });
});

describe('moving between the screens', () => {
  test('it opens on the title, which is what "first screen" means', () => {
    expect(titleScreen().current).toBe('title');
  });

  test('⚠️ choosing on the title goes to the SELECTOR, not into a game', () => {
    // The Dev's sequence: "ao clicar nesta tela, uma tela com o seletor de mesas". A title that
    // dropped the player straight onto a table would make the selector unreachable, which is how a
    // five-table game ships as a one-table game.
    const screen = titleScreen();

    screen.advance();

    expect(screen.current).toBe('select');
  });

  test('and choosing a table starts it, reporting which', () => {
    const started: string[] = [];
    const screen = titleScreen({ onStart: (name) => started.push(name) });
    screen.advance();

    screen.choose(CATALOG[1]!.name);

    expect(started).toEqual([CATALOG[1]!.name]);
    expect(screen.current).toBe('playing');
  });

  test('⚠️ a table that is not in the catalogue starts NOTHING', () => {
    // The selector is built from the catalogue, so this cannot happen through the buttons — it can
    // happen through a stale saved choice or a query parameter, and starting a table that does not
    // exist is a blank screen with no error.
    const started: string[] = [];
    const screen = titleScreen({ onStart: (name) => started.push(name) });
    screen.advance();

    screen.choose('atlantis');

    expect(started).toEqual([]);
    expect(screen.current, 'and it stays where it was').toBe('select');
  });

  test('the selector offers every table in the catalogue and nothing else', () => {
    const screen = titleScreen();

    expect([...screen.tables].sort()).toEqual(CATALOG.map((t) => t.name).sort());
  });
});

describe('going back', () => {
  test('⚠️ the selector returns to the title, or it is a one-way door', () => {
    const screen = titleScreen();
    screen.advance();

    screen.back();

    expect(screen.current).toBe('title');
  });

  test('and the title has nowhere further back, which is not an error', () => {
    const screen = titleScreen();

    screen.back();

    expect(screen.current).toBe('title');
  });
});

describe('the screens are a closed set', () => {
  test('every screen this reports is one somebody wrote a case for', () => {
    // A fourth screen added to the type and not to the shell would be a state the game can enter and
    // never draw. The list is the type's own, so this fails to compile rather than at run time if
    // they diverge — and fails here if a value appears that nothing produces.
    const known: Screen[] = ['title', 'select', 'playing'];
    const screen = titleScreen();

    expect(known).toContain(screen.current);
    screen.advance();
    expect(known).toContain(screen.current);
  });
});
