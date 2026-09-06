// SPDX-License-Identifier: AGPL-3.0-or-later
// control/high-score — the five names the table remembers, transcribed from `high_score.cpp`.
//
// ========================= WHAT IS TRANSCRIBED AND WHAT IS PORTED =========================
// The LOGIC is the original's, line for line: five slots, an empty slot scoring -999, the first slot a
// score beats, a shift downwards that pushes the last one off the end, and a checksum that throws the
// whole table away when it does not match. None of it is improved, because none of it is broken — it
// is a scoreboard, and the original's rules are the ones a player of the original expects.
//
// What is PORTED rather than transcribed is where it lives. `high_score.cpp` reads and writes through
// `options::GetSetting`, which is the Windows registry; the browser's equivalent is `localStorage`, and
// it is handed in rather than reached for so that a test can supply one and a hostile one can be
// simulated. The key names keep the original's shape — `0.name`, `0.score`, `verification` — so
// somebody comparing the two can see they are the same five slots.
//
// ========================= THREE THINGS THAT LOOK LIKE DEFECTS =========================
// ⚠️ AN EMPTY SLOT SCORES -999, NOT NOUGHT. That is what lets the first player onto a table nobody has
// played: every real score beats it. It also means a score of 0 would beat an empty slot, which is why
// `scorePosition` refuses anything at or below nought BEFORE it looks at the table.
//
// ⚠️ A NAME IS CAPPED AT THIRTY-ONE CHARACTERS. `char Name[32]` with an explicit `Name[31] = 0`: the
// terminator costs a byte. Thirty-two would be the number somebody guesses and it would be wrong.
//
// ⚠️ AND THE CHECKSUM IS NOT SECURITY. It is the sum of the name bytes plus the scores, which anybody
// can recompute — the original is guarding against a half-written file, not against a player editing
// one. Transcribed as it is, and said plainly here so nobody later mistakes it for a lock and builds
// on it.

/** Five, and the original hard-codes it in four places. */
export const HIGH_SCORE_SLOTS = 5;

/** What an unplayed slot scores. See this module's header: not nought, and deliberately so. */
export const EMPTY_SCORE = -999;

/** `char Name[32]` less the terminator the original writes into it. */
export const MAX_NAME = 31;

/** The two methods this module uses, so a test can supply them and a private window can be simulated. */
export interface HighScoreStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface HighScoreEntry {
  readonly name: string;
  readonly score: number;
}

export type HighScoreTable = readonly HighScoreEntry[];

/** Namespaced like every other stored key in this port: a colon, because a dot means a text id. */
const KEY = (suffix: string): string => `pinball:highscore:${suffix}`;

export function emptyTable(): HighScoreTable {
  return Array.from({ length: HIGH_SCORE_SLOTS }, () => ({ name: '', score: EMPTY_SCORE }));
}

/**
 * Where a score belongs, or -1 if it does not belong anywhere.
 *
 * ⚠️ THE COMPARISON IS `<`, NOT `<=`, so a tie does not displace the score it tied with. Whoever got
 * there first keeps the place — the ordinary convention, and exactly the sort of thing that inverts by
 * accident when somebody rewrites the loop.
 */
export function scorePosition(table: HighScoreTable, score: number): number {
  if (score <= 0) return -1;
  for (let position = 0; position < HIGH_SCORE_SLOTS; position++) {
    if (table[position]!.score < score) return position;
  }
  return -1;
}

/**
 * Puts an entry in at `position`, pushing everything below it down and the last one off the end.
 *
 * A position outside the table changes nothing, which is what makes it safe to hand `scorePosition`'s
 * -1 straight to this.
 */
export function placeScore(
  table: HighScoreTable, entry: HighScoreEntry, position: number,
): HighScoreTable {
  if (position < 0 || position >= HIGH_SCORE_SLOTS) return table;
  const next = [...table];
  for (let i = HIGH_SCORE_SLOTS - 1; i > position; i--) next[i] = next[i - 1]!;
  next[position] = { name: entry.name.slice(0, MAX_NAME), score: entry.score };
  return next;
}

/** The original's own sum: every byte of every name, plus every score. See the header. */
function checksum(table: HighScoreTable): number {
  let sum = 0;
  for (const { name, score } of table) {
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    sum += score;
  }
  return sum;
}

/**
 * Reads the table back, or an empty one.
 *
 * ⚠️ A MISMATCHED CHECKSUM THROWS THE WHOLE TABLE AWAY rather than keeping the slots that parsed. That
 * is the original's behaviour and it is the right one: a scoreboard that is partly somebody else's
 * edit is a scoreboard nobody can believe, and half of one is worse than none.
 *
 * A store that throws — a private window, blocked site data — is the same case as one that is empty.
 * A scoreboard is worth less than the game it keeps score of.
 */
export function readTable(store: HighScoreStore): HighScoreTable {
  try {
    const read = Array.from({ length: HIGH_SCORE_SLOTS }, (_, position) => ({
      name: store.getItem(KEY(`${position}.name`)) ?? '',
      score: Number(store.getItem(KEY(`${position}.score`)) ?? EMPTY_SCORE),
    }));
    if (read.some((e) => !Number.isFinite(e.score))) return emptyTable();

    const stored = Number(store.getItem(KEY('verification')));
    return checksum(read) === stored ? read : emptyTable();
  } catch {
    return emptyTable();
  }
}

export function writeTable(store: HighScoreStore, table: HighScoreTable): void {
  try {
    table.forEach((entry, position) => {
      store.setItem(KEY(`${position}.name`), entry.name);
      store.setItem(KEY(`${position}.score`), String(entry.score));
    });
    store.setItem(KEY('verification'), String(checksum(table)));
  } catch {
    // Nothing to tell the player: they scored, the score stands for this session, and it is the
    // remembering that failed. Reporting a browser setting as a game fault would be the worse lie.
  }
}
