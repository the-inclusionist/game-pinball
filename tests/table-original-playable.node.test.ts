// SPDX-License-Identifier: AGPL-3.0-or-later
// THE 1995 TABLE, PLAYED — the gate the authored catalogue has had for passes and this one never did.
//
// `tests/table-playable` asks four things of every authored table: the ball leaves the plunger lane, it
// touches something that SCORES, it is eventually lost and not through a hole in the geometry, and the
// player can change what happens. The 1995 table had none of that. Every gate on it asked about parsing,
// geometry, wiring or one component at a time; not one asked whether a game could be played.
//
// ⚠️ AND FOUR DEFECTS LIVED IN THAT GAP AT ONCE. Until the pass that added this file:
//
//   · the plunger was located as "the first group carrying record 601", which is `v_sink1` — so every
//     ball was born in a sink's mouth near the top of the table rather than on the plunger;
//   · every one-way had its two lines' windings exchanged and had lost the minus sign on the passing
//     offset, so all nine blocked the face they should have opened and no ball ever left the lane;
//   · the plunger's stuck-ball box was `boundsOfWall` of a LINE — 1.6 wide and ZERO high — so a ball
//     settling on the plunger was declared stuck and thrown back, over and over;
//   · and a finished game went on counting balls it had already lost, ending at minus six.
//
// Every one of them is a thing a player would meet in the first ten seconds. Every one of them survived
// a suite of more than seventeen hundred tests. This file is what that suite was missing.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createDemo } from '../app/js/shell/demo.js';

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';

/** Mulberry32, so a run asks about ONE path rather than a different one each time. */
function seeded(seed = 0x9e3779b9): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Played {
  readonly maxX: number;
  readonly minY: number;
  readonly drains: number;
  readonly scored: number;
  readonly leftTheTable: boolean;
  readonly gameOver: boolean;
  readonly ballActive: boolean;
  readonly touched: readonly string[];
}

/**
 * Forty seconds of a real game: launch, play out, launch the next ball when one comes back.
 *
 * ⚠️ THE HOLD VARIES, or a retry is not a retry. The plunger's release opens a window of 0.025 s and a
 * ball at rest on it touches every four frames, so a launch fires about a third of the time — and forty
 * press-release cycles of the SAME length miss forty times, because the cycle is a multiple of four and
 * every release lands in the same gap. Measured, and written up in `table/plunger`.
 */
function play(seed: number | undefined): Played | null {
  if (!existsSync(DAT)) return null;
  const file = readFileSync(DAT);
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const demo = createDemo(bytes, {
    textFor: (id) => id,
    random: seed === undefined ? seeded() : seeded(seed),
  });

  const at = demo.ball.position as { x: number; y: number };
  let phase = 0;
  const launch = (): void => {
    demo.plunge(true);
    demo.step(150 + (phase++ % 4));
    demo.plunge(false);
  };

  let waiting = 0;
  let maxX = -Infinity;
  let minY = Infinity;
  let leftTheTable = false;

  launch();
  for (let frame = 0; frame < 2400; frame++) {
    const before = { x: at.x, y: at.y };
    demo.step(1);
    if (at.x > maxX) maxX = at.x;
    if (at.y < minY) minY = at.y;
    // The table's own bounds are x -8..8 and y -14..15. A ball outside them is through the geometry.
    if (at.x < -9 || at.x > 9 || at.y < -15 || at.y > 16) leftTheTable = true;
    waiting = Math.abs(at.x - before.x) + Math.abs(at.y - before.y) < 0.01 ? waiting + 1 : 0;
    if (waiting > 40 && at.y > 8) { launch(); waiting = 0; }
  }

  return {
    maxX,
    minY,
    drains: demo.touched.filter((name) => name === 'drain').length,
    scored: demo.scored.length,
    leftTheTable,
    gameOver: demo.gameOver,
    ballActive: demo.ball.active,
    touched: demo.touched,
  };
}

const SEEDS = [undefined, 2, 6, 9, 11] as const;

describe.each(SEEDS.map((s) => [s === undefined ? 'default' : `seed ${s}`, s] as const))(
  'a game of the 1995 table (%s)',
  (_label, seed) => {
    test('⚠️ the ball LEAVES the launch lane and crosses the table', () => {
      // The lane is at x = -7. Until the one-ways were fixed the ball ran to the top of it, bounced off
      // the ceiling and came back down, three balls out of three, without ever entering the play — the
      // same defect `table-playable` was written to catch on the authored tables.
      const run = play(seed);
      if (!run) return expect(existsSync(DAT)).toBe(false);

      expect(run.maxX, 'past the middle of the table').toBeGreaterThan(0);
    });

    test('⚠️ and it climbs the lane first, which is what the plunger is for', () => {
      // A ball that starts on the plunger and is launched reaches the top of the lane at about y = -6.9.
      // A ball born at the top of the table — which is where `v_sink1`'s record 601 put every ball this
      // port ever spawned — is already there and has never been launched at all.
      const run = play(seed);
      if (!run) return expect(existsSync(DAT)).toBe(false);

      expect(run.minY, 'up the lane').toBeLessThan(-6);
    });

    test('⚠️ and it CROSSES the skill shot entry, which is what a one-way is for', () => {
      // `s_onewy1` sits across the top of the launch lane and the ball may pass it in one direction
      // only. What this asserts is that the gate is BUILT and REACHED — for eighteen lanes and nine
      // one-ways on this table, "installed as a plain wall the ball bounces off" was the defect, and a
      // component the ball never touches is one nothing here would notice was missing.
      //
      // ⚠️ AND IT DOES NOT CATCH THE SIGN. I wrote it believing it would, and the mutant says otherwise:
      // flipping the passing offset does not CLOSE the gate, it INVERTS it — the ball crosses from the
      // wrong face instead of the right one, and a list of touches cannot tell those apart. The sign is
      // guarded where it can be seen, by the geometry test in `table-original-oneways`. Two of the five
      // seeds here notice the inversion through "leaves the lane"; three do not, and that is the honest
      // strength of this file against that particular defect.
      const run = play(seed);
      if (!run) return expect(existsSync(DAT)).toBe(false);

      expect(run.touched, 'through the gate at the top of the lane').toContain('s_onewy1');
    });

    test('⚠️ it touches something worth SCORING, not just walls', () => {
      const run = play(seed);
      if (!run) return expect(existsSync(DAT)).toBe(false);

      expect(run.scored, 'the 1995 control functions paid something').toBeGreaterThan(0);
    });

    test('⚠️ every ball is lost through the DRAIN, and none through a hole in the geometry', () => {
      // `leftTheTable` means it went past an edge, which is a hole rather than a way to lose.
      const run = play(seed);
      if (!run) return expect(existsSync(DAT)).toBe(false);

      expect(run.leftTheTable, 'the ball stayed on the table').toBe(false);
      expect(run.drains, 'three balls, lost at the drain').toBeGreaterThanOrEqual(3);
    });

    test('⚠️ and the game ENDS, which no test could drive before this pass', () => {
      // It could not end because the shoot-again lamp lit by every feed was never cleared, and it was
      // never cleared because no ball ever crossed the skill shot's entry, and none did because the
      // ball was not on the plunger. Four fixes deep, a game of this table finishes.
      const run = play(seed);
      if (!run) return expect(existsSync(DAT)).toBe(false);

      expect(run.gameOver).toBe(true);
      // ⚠️ AND IT STAYS ENDED. A finished game that leaves its ball rolling goes on draining and goes
      // on counting, and finishes at minus six balls. `shell-demo` asserts the count directly; here the
      // cheap version is that the ball is off the table when the game is over.
      expect(run.ballActive, 'the ball is off the table').toBe(false);
    });
  },
);
