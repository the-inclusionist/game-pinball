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
  TITLE_LINES, TITLE_SUBTITLE, TITLE_BYLINE, titleScreen, type Screen,
} from '../app/js/shell/title.js';
import { CATALOG, PLAYABLE_TABLES } from '../app/js/table/catalog.js';

describe('what the title says', () => {
  test('⚠️ SPACE and STUDENT on two lines, and PINBALL under them', () => {
    // Two lines rather than one string with a newline in it: the screen is 320 pixels wide and the
    // font is fixed-width, so where the break falls is a layout fact and not a typographic accident.
    expect(TITLE_LINES).toEqual(['SPACE', 'STUDENT']);
    expect(TITLE_SUBTITLE).toBe('PINBALL');
  });

  test('⚠️ and the byline names who made it, under PINBALL', () => {
    // The Dev asked for it by name: "adicione a linha «by Prof. José Rocha» abaixo da palavra PINBALL,
    // alinhado à direita". It is a credit rather than a caption, which is why it is right-aligned and
    // why it is smaller than everything above it — the eye reads the title and then finds the name.
    expect(TITLE_BYLINE).toBe('by Prof. José Rocha');
  });

  test('and none of it is a translated string, because a title is a name', () => {
    // Every other word on screen goes through `t()`. A game's title does not: it is the same in every
    // language, the way `PINBALL` was in 1995, and routing it through i18n would invite somebody to
    // translate it in one locale and not the others.
    for (const line of [...TITLE_LINES, TITLE_SUBTITLE]) {
      expect(line).not.toMatch(/^pinball\./);
      expect(line).toBe(line.toUpperCase());
    }
    // ⚠️ THE BYLINE IS EXEMPT FROM THE UPPERCASE HALF AND NOT FROM THE OTHER. It is a person's name,
    // and a name is written the way its owner writes it — but it is still not translated, for exactly
    // the reason above: "by" is not a word that should differ between locales while the name does not.
    expect(TITLE_BYLINE).not.toMatch(/^pinball\./);
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

  test('and choosing a table carries it through to the start', () => {
    /**
     * ⚠️ THIS USED TO SAY "choosing a table STARTS it", and the Dev's mission screen ended that:
     * "Após escolher a tela, a próxima tela é a da missão principal." What the assertion is really
     * for is that the table the player touched is the table that boots, so it now follows the choice
     * all the way through the number.
     */
    const started: string[] = [];
    const screen = titleScreen({ onStart: (name, times) => started.push(`${name}x${times}`) });
    screen.advance();

    screen.choose(CATALOG[1]!.name);
    screen.pick(6);

    expect(started).toEqual([`${CATALOG[1]!.name}x6`]);
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

  test('⚠️ the selector offers the PLAYABLE tables, and not the fixtures', () => {
    // This said "every table in the catalogue", and that was wrong the moment it was written: four of
    // the ten exist to give a gate a case to walk. `bare-minimum` is a ceiling, one flipper, a plunger
    // and a drain — the floor of the format — and offering it beside `low-orbit` tells a player they
    // are the same kind of thing.
    const screen = titleScreen();

    expect([...screen.tables].sort()).toEqual(PLAYABLE_TABLES.map((t) => t.name).sort());
    // ⚠️ AND THE TWO LISTS ARE DIFFERENT, or this is the old test under a new name.
    expect(screen.tables.length).toBeLessThan(CATALOG.length);
    expect([...screen.tables], 'no fixture is offered').not.toContain('bare-minimum');
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

/**
 * ⚠️ THERE WAS NO WAY BACK FROM `playing`, and until the pause menu existed nothing needed one.
 *
 * The three transitions this machine had are the ones the title screen itself offers: `advance` from
 * the title to the selector, `choose` from the selector into a game, `back` from the selector to the
 * title. Once a game started, the only exits were draining three balls or reloading the page — which
 * is exactly what the Dev asked the pause menu to fix: "voltar à tela inicial e escolher outras mesas".
 */
describe('⚠️ leaving a game', () => {
  const playing = () => {
    const screen = titleScreen();
    screen.advance();
    screen.choose(screen.tables[0]!);
    // ⚠️ AND THE NUMBER, or this helper stops on the mission screen and these three tests check that
    // a game can be left from a screen that is not a game.
    screen.pick(screen.numbers[0]!);
    return screen;
  };

  test('a game can be left for the selector', () => {
    const screen = playing();

    screen.show('select');

    expect(screen.current).toBe('select');
  });

  test('and for the title', () => {
    const screen = playing();

    screen.show('title');

    expect(screen.current).toBe('title');
  });

  test('⚠️ and `show` cannot start a game, which is what `choose` is for', () => {
    // A `show('playing')` would be a second way into a table that skips choosing one — so the type
    // refuses it, and this test is what says the refusal is deliberate rather than an oversight.
    const screen = titleScreen();

    // @ts-expect-error `playing` is not a screen anybody may be SHOWN; it is one they are put into.
    screen.show('playing');

    expect(screen.current, 'and nothing happened').toBe('title');
  });
});

/**
 * ⚠️ THE MISSION SCREEN, WHICH THE DEV PUT BETWEEN THE TABLE AND THE GAME.
 *
 * "Após escolher a tela, a próxima tela é a da missão principal. o jogador deve escolher um número de
 * 2 a 9."
 *
 * So `choose` no longer starts a game — it asks the question. The game starts when the NUMBER is
 * picked, and `onStart` is told both, because the caller needs the table and the drill together: one
 * without the other is a game that boots with no mission or a mission with no table.
 */
describe('⚠️ choosing the times table', () => {
  const atTheMission = () => {
    const screen = titleScreen();
    screen.advance();
    screen.choose(screen.tables[0]!);
    return screen;
  };

  test('choosing a table asks for the number instead of starting', () => {
    const started: string[] = [];
    const screen = titleScreen({ onStart: (table, times) => started.push(`${table}x${times}`) });
    screen.advance();

    screen.choose(screen.tables[0]!);

    expect(screen.current, 'the game started without asking for a number').toBe('mission');
    expect(started, 'and it told the caller to boot one').toEqual([]);
  });

  test('the numbers offered are two to nine', () => {
    expect(atTheMission().numbers).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('⚠️ picking one starts the game, with the table and the number together', () => {
    const started: string[] = [];
    const screen = titleScreen({ onStart: (table, times) => started.push(`${table}x${times}`) });
    screen.advance();
    const table = screen.tables[0]!;
    screen.choose(table);

    screen.pick(7);

    expect(screen.current).toBe('playing');
    expect(started, 'the caller was not told what to boot').toEqual([`${table}x7`]);
  });

  test('⚠️ a number that is not on offer starts nothing, and stays on the screen', () => {
    // It cannot happen through the buttons, which are built from this same list. It can happen through
    // a `?times=` that somebody typed — and booting a mission on a number nobody chose is a drill the
    // player is not doing, with nothing on screen to say so.
    const started: string[] = [];
    const screen = titleScreen({ onStart: (table, times) => started.push(`${table}x${times}`) });
    screen.advance();
    screen.choose(screen.tables[0]!);

    for (const bad of [0, 1, 10, 2.5, -3, Number.NaN]) screen.pick(bad);

    expect(screen.current, `${started.length} games started on a number nobody offered`).toBe('mission');
    expect(started).toEqual([]);
  });

  test('and the way back from it is the selector, not the title', () => {
    const screen = atTheMission();

    screen.back();

    expect(screen.current, 'the player who changed their mind about the table lost the table too')
      .toBe('select');
  });

  test('⚠️ and picking a number with no table chosen starts nothing', () => {
    const started: string[] = [];
    const screen = titleScreen({ onStart: (table, times) => started.push(`${table}x${times}`) });

    screen.pick(4);

    expect(screen.current, 'a number picked from the title screen started a game').toBe('title');
    expect(started).toEqual([]);
  });
});
