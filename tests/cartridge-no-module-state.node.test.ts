// SPDX-License-Identifier: AGPL-3.0-or-later
// NOTHING IN THE ENTRY POINT SURVIVES A TEARDOWN.
//
// ⚠️ SPEC D14, AND THE ENGINE'S OWN USER STORY BEHIND IT: "state at module scope survives `teardown()` and
// leaks into the next game on the same page" — «I want the engine to carry no game state, so that two games
// on one page do not collide». `main.ts` had TWENTY-FOUR `let` at module scope and ran the whole game by
// being imported.
//
// ========================= WHY THIS IS A TEST AND NOT A GREP =========================
// 🔴 BECAUSE THE OBVIOUS GREP NOW LIES. The body was wrapped in `createPinball()` WITHOUT being re-indented
// — two thousand two hundred lines shifted by two spaces is a diff nobody can review, and this file writes
// markup with template literals, where indenting changes the text a player reads. So every one of those
// twenty-four `let` is still at column 0 and every one of them is now function-scoped.
//
// `grep '^let '` answers 24 either way. It is measuring INDENTATION and the question is SCOPE, and anybody
// checking this claim with the obvious command would conclude that nothing moved.
//
// ⚠️ SO THE MEASUREMENT IS POSITION RELATIVE TO THE FUNCTION, which is what the scope boundary actually is:
// a declaration after the opening line of `createPinball` is inside it, whatever column it sits in.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8',
).split('\n');

/** The line the cartridge's scope opens on. Everything after it belongs to one instance. */
const opensAt = SOURCE.findIndex((line) => line.startsWith('export function createPinball('));

describe('the entry point carries no state of its own', () => {
  test('⚠️ the factory exists, and it is what the rest of this file is inside', () => {
    // Without this, every case below passes over a file that has no factory at all — `findIndex` answers
    // -1 and "after line -1" is every line there is.
    expect(opensAt, 'there is no `createPinball` to be inside of').toBeGreaterThan(0);
  });

  test('⚠️ every mutable binding is INSIDE it', () => {
    /**
     * A `let` before the factory is state that outlives an instance: the next game mounted on the same page
     * inherits this one's palette, its phase, its ball count and its audio handle. That is the whole of D14,
     * and it fails silently — the second game simply behaves as though the first had already been played.
     */
    const outside = SOURCE
      .map((line, n) => ({ line, n }))
      .filter(({ line, n }) => n < opensAt && /^let\s/.test(line))
      .map(({ line, n }) => `${n + 1}: ${line.trim()}`);

    expect(outside, 'these outlive an instance').toEqual([]);
  });

  test('⚠️ and the scan can see one, which the grep that lies could not', () => {
    /**
     * The half that matters more than usual here. This file's whole reason for existing is that the obvious
     * measurement stopped working, so a scan that matched nothing would be the SAME failure in a new place:
     * a green case over a file whose twenty-four declarations it never looked at.
     */
    const inside = SOURCE.filter((line, n) => n > opensAt && /^let\s/.test(line));

    expect(inside.length, 'the scan found no declarations at all, so it is measuring nothing')
      .toBeGreaterThan(20);
  });

  test('⚠️ and importing this file no longer RUNS the game, which is the other half of D14', () => {
    /**
     * The call is still here — slice A1 claims identical behaviour and fifteen browser suites boot this
     * file — but it is one line at the end rather than two thousand at the top. Slice A2 moves it into
     * `src/standalone.ts`, and this case is what will fail when it does, which is the point: it is the
     * line that says importing the cartridge must stop doing anything.
     */
    const calls = SOURCE.filter((line) => line.trim() === 'createPinball();');

    expect(calls.length, 'the boot is not a single line any more').toBe(1);
    expect(SOURCE.indexOf(calls[0]!), 'and it is not at the top').toBeGreaterThan(opensAt);
  });
});
