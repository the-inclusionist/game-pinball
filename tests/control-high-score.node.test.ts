// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FIVE NAMES THE ORIGINAL KEEPS, AND THE CHECKSUM IT KEEPS THEM WITH.
//
// `control/high-score.ts` is named in the plan's architecture — "control.ts (a máquina de missões) ·
// score.ts · high-score.ts" — and did not exist. It was missed because the audit that declared the
// plan finished walked the PHASES and the verification section, and never read the module list.
//
// ⚠️ TRANSCRIBED, NOT DESIGNED. `high_score.cpp` is forty lines of logic with three quirks that look
// like defects and are not, and this port's rule is to carry them across and say why:
//
//   · An empty slot scores -999, not 0. That is what makes "beat the lowest score" work on a table
//     nobody has played, and it is why a score of 0 needs a separate guard.
//   · A name is capped at THIRTY-ONE characters, not thirty-two. `Name[32]` with `Name[31] = 0` is a C
//     string, and the terminator costs a byte.
//   · The stored table carries a CHECKSUM, and a mismatch throws the whole table away rather than
//     keeping what can be read. It is the sum of the name bytes plus the scores, so it is trivially
//     forgeable and is not security: it is a corruption check on a file the game wrote itself.
import { describe, test, expect } from 'vitest';
import {
  HIGH_SCORE_SLOTS, EMPTY_SCORE, emptyTable, scorePosition, placeScore, readTable, writeTable,
  type HighScoreStore, type HighScoreTable,
} from '../app/js/control/high-score.js';

function fakeStore(initial: Record<string, string> = {}) {
  const held = { ...initial };
  return {
    held,
    getItem: (key: string) => held[key] ?? null,
    setItem: (key: string, value: string) => { held[key] = value; },
  };
}

/** The store a private window gives you: present, and throws the moment it is touched. */
const hostileStore: HighScoreStore = {
  getItem: () => { throw new Error('The operation is insecure.'); },
  setItem: () => { throw new Error('The operation is insecure.'); },
};

describe('an empty table', () => {
  test('⚠️ has five slots and they score -999, which is not the same as nought', () => {
    // A slot scoring 0 would refuse every score of 0 AND every score below it. -999 is what lets the
    // first player onto a table nobody has played, and the original chose it rather than a flag.
    const table = emptyTable();

    expect(table).toHaveLength(HIGH_SCORE_SLOTS);
    expect(HIGH_SCORE_SLOTS).toBe(5);
    expect(table.every((e) => e.score === EMPTY_SCORE && e.name === '')).toBe(true);
    expect(EMPTY_SCORE).toBe(-999);
  });

  test('and any real score goes straight to the top of it', () => {
    expect(scorePosition(emptyTable(), 1)).toBe(0);
  });
});

describe('where a score lands', () => {
  const table: HighScoreTable = [
    { name: 'ALPHA', score: 5000 },
    { name: 'BETA', score: 4000 },
    { name: 'GAMMA', score: 3000 },
    { name: 'DELTA', score: 2000 },
    { name: 'EPSILON', score: 1000 },
  ];

  test('the first slot it beats, which is the highest one it can take', () => {
    expect(scorePosition(table, 6000)).toBe(0);
    expect(scorePosition(table, 3500)).toBe(2);
    expect(scorePosition(table, 1001)).toBe(4);
  });

  test('⚠️ and a TIE does not displace the score it tied with', () => {
    // The original asks `Score < score`, not `<=`. Whoever got there first keeps the place, which is
    // the ordinary convention for a scoreboard and the sort of thing that inverts by accident.
    expect(scorePosition(table, 3000)).toBe(3);
  });

  test('a full table refuses a score below all five', () => {
    expect(scorePosition(table, 999)).toBe(-1);
  });

  test('⚠️ and NOUGHT is refused outright, even on an empty table', () => {
    // `if (score <= 0) return -1` comes before the search. Without it a score of 0 would beat -999 and
    // a player who launched and drained immediately would be asked for their name.
    expect(scorePosition(emptyTable(), 0)).toBe(-1);
    expect(scorePosition(emptyTable(), -5)).toBe(-1);
  });
});

describe('placing a score', () => {
  const table = (): HighScoreTable => [
    { name: 'ALPHA', score: 5000 },
    { name: 'BETA', score: 4000 },
    { name: 'GAMMA', score: 3000 },
    { name: 'DELTA', score: 2000 },
    { name: 'EPSILON', score: 1000 },
  ];

  test('pushes everything below it down, and the last one off the end', () => {
    const placed = placeScore(table(), { name: 'NEW', score: 3500 }, 2);

    expect(placed.map((e) => e.name)).toEqual(['ALPHA', 'BETA', 'NEW', 'GAMMA', 'DELTA']);
    expect(placed).toHaveLength(HIGH_SCORE_SLOTS);
  });

  test('a position outside the table changes nothing', () => {
    // `if (data.Position >= 0 && data.Position < 5)`. `scorePosition` returns -1 for a score that does
    // not place, and handing that straight to this must be safe.
    expect(placeScore(table(), { name: 'NEW', score: 1 }, -1)).toEqual(table());
    expect(placeScore(table(), { name: 'NEW', score: 1 }, 5)).toEqual(table());
  });

  test('⚠️ and a long name is cut to THIRTY-ONE characters, not thirty-two', () => {
    // `char Name[32]` with `Name[31] = 0`: the terminator costs a byte, so thirty-one is what survives.
    const placed = placeScore(table(), { name: 'X'.repeat(50), score: 9000 }, 0);

    expect(placed[0]!.name).toHaveLength(31);
  });
});

describe('keeping it between games', () => {
  test('what is written comes back', () => {
    const store = fakeStore();
    const table = placeScore(emptyTable(), { name: 'ROCHA', score: 12345 }, 0);

    writeTable(store, table);

    expect(readTable(store)).toEqual(table);
  });

  test('⚠️ and a table that does not match its checksum is thrown away WHOLE', () => {
    // The original's own behaviour, and it is worth keeping rather than salvaging what parses: a
    // scoreboard that is partly somebody's edit is a scoreboard nobody can believe.
    const store = fakeStore();
    writeTable(store, placeScore(emptyTable(), { name: 'ROCHA', score: 12345 }, 0));

    const key = Object.keys(store.held).find((k) => k.endsWith('0.score'))!;
    store.held[key] = '999999';

    expect(readTable(store)).toEqual(emptyTable());
  });

  test('a store with nothing in it reads as empty rather than as rubbish', () => {
    expect(readTable(fakeStore())).toEqual(emptyTable());
  });

  test('⚠️ and a browser that REFUSES to store still lets the game run', () => {
    // Same rule as `shell/options`: in a private window `localStorage` exists and throws on access. A
    // scoreboard is worth less than the game it is keeping score of.
    expect(() => readTable(hostileStore)).not.toThrow();
    expect(readTable(hostileStore)).toEqual(emptyTable());
    expect(() => writeTable(hostileStore, emptyTable())).not.toThrow();
  });
});
