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

import { CATALOG } from '../table/catalog.js';

/** Two lines, because the screen is 320 wide and the font is fixed-width: the break is a layout fact. */
export const TITLE_LINES: readonly string[] = ['SPACE', 'STUDENT'];

export const TITLE_SUBTITLE = 'PINBALL';

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
}

export function titleScreen(o: TitleOptions = {}): TitleScreen {
  let current: Screen = 'title';
  const tables = CATALOG.map((t) => t.name);

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
  };
}
