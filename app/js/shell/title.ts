// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/title — the first screen, and the selector behind it.
//
// ========================= WHAT THE DEV ASKED FOR =========================
// "Crie uma tela inicial, com o nome SPACE\nSTUDENT escrito com a fonte Press Start 2P e a palavra
// PINBALL embaixo. Ao clicar nesta tela, uma tela com o seletor de mesas."
//
// Three screens and two doors between them, and that is the whole of this module: `title` → `select` →
// `playing`. It carries no DOM, for the reason `shell/options` carries none — this repository's tests
// run in node, and a decision inside a click handler is a decision nothing can check. The markup is
// `shell/title-dom`, which is thin because everything worth asking about is here.
//
// ⚠️ THE TITLE IS NOT TRANSLATED, AND THAT IS DELIBERATE. Every other word on screen goes through
// `t()`. A game's name does not: it is the same in every language — as `PINBALL` was on the 1995
// cabinet — and routing it through the dictionaries would invite somebody to translate it in one
// locale and not in the other two, which is a game with two names.
//
// ⚠️ AND IT IS NOT "SPACE CADET". That is Microsoft's title for Microsoft's table, and this ships
// neither. The Dev's name for the game is the Dev's.

import { PLAYABLE_TABLES } from '../table/catalog.js';

/** Two lines, because the screen is 320 wide and the font is fixed-width: the break is a layout fact. */
export const TITLE_LINES: readonly string[] = ['SPACE', 'STUDENT'];

export const TITLE_SUBTITLE = 'PINBALL';

/**
 * Who made it, under the subtitle and aligned to the right.
 *
 * ⚠️ ASKED FOR BY NAME: "adicione a linha «by Prof. José Rocha» abaixo da palavra PINBALL, alinhado à
 * direita". It is a CREDIT rather than a caption, which is what the alignment says — the eye reads the
 * title down the middle and then finds the name at the edge, the way a cover does.
 *
 * ⚠️ AND IT IS NOT TRANSLATED, for the reason the two lines above it are not: a name is written the
 * way its owner writes it, and routing "by" through `t()` would invite one locale to say it and
 * another not to, under a name that is the same in all three. It is exempt from the UPPERCASE rule
 * and from nothing else.
 */
export const TITLE_BYLINE = 'by Prof. José Rocha';

/**
 * Where the player is.
 *
 * `playing` is a screen here even though nothing in this module draws it: it is what the shell has to
 * stop showing the title for, and leaving it out would mean tracking "is a game running" twice.
 */
export type Screen = 'title' | 'select' | 'playing';

export interface TitleOptions {
  /** Called with the table the player picked. The caller boots it; this only reports the choice. */
  readonly onStart?: (table: string) => void;
}

export interface TitleScreen {
  readonly current: Screen;
  /** The tables the selector offers, which is the catalogue and never a subset of it. */
  readonly tables: readonly string[];
  /** The title's only action: go to the selector. */
  advance(): void;
  /** Pick a table. An unknown name does nothing at all — see below. */
  choose(table: string): void;
  /** The way out of the selector. On the title it is a no-op rather than an error. */
  back(): void;
  /**
   * Shows a screen outright, which is how a game is LEFT.
   *
   * ⚠️ THE ONLY TRANSITION THAT DOES NOT COME FROM THE TITLE SCREEN'S OWN BUTTONS, and it exists
   * because there was no way back from `playing`. `advance`, `choose` and `back` are the three moves
   * the title screen offers; once a game started the exits were draining three balls or reloading the
   * page. The Dev asked the pause menu to fix that — "voltar à tela inicial e escolher outras mesas".
   *
   * ⚠️ AND `playing` IS NOT A SCREEN ANYBODY MAY BE SHOWN. It is one they are PUT INTO, by choosing a
   * table, and a second way in that skipped the choosing would be a game with no table decided. The
   * type refuses it, and a test says the refusal is deliberate.
   */
  show(screen: Exclude<Screen, 'playing'>): void;
}

export function titleScreen(o: TitleOptions = {}): TitleScreen {
  let current: Screen = 'title';
  // ⚠️ THE PLAYABLE ONES, NOT THE WHOLE CATALOGUE. Four of the ten are fixtures that exist to give a
  // gate a case to walk — see `PLAYABLE_TABLES`. A selector that offers `bare-minimum` beside
  // `low-orbit` is telling the player they are the same kind of thing.
  const tables = PLAYABLE_TABLES.map((t) => t.name);

  return {
    get current() { return current; },
    get tables() { return tables; },

    advance() {
      if (current === 'title') current = 'select';
    },

    /**
     * ⚠️ AN UNKNOWN TABLE STARTS NOTHING, and stays on the selector.
     *
     * It cannot happen through the buttons, which are built from this same list. It can happen through
     * a stale remembered choice or a `?table=` that no longer names anything, and booting a table that
     * does not exist is a blank screen with no error on it — the failure this whole port keeps finding
     * under other names.
     */
    choose(table: string) {
      if (!tables.includes(table)) return;
      current = 'playing';
      o.onStart?.(table);
    },

    back() {
      if (current === 'select') current = 'title';
    },

    show(screen) {
      // ⚠️ AND THE GUARD IS REAL, NOT DECORATIVE. The type already refuses `playing`, and a type is not
      // a runtime guarantee: this game boots from a `<script>` and anything that reached this with the
      // wrong string would start a table nobody had chosen. A test presses on it with @ts-expect-error,
      // which is how the missing check was found — the type refused the call and the code ran it.
      if (screen === 'playing') return;
      current = screen;
    },
  };
}
