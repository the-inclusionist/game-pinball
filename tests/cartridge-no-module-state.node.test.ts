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

  test('⚠️ nothing at module scope CALLS anything, which is the third half of it', () => {
    /**
     * ⚠️ «NOTHING RUNS UNTIL `create(ctx)` IS CALLED. NO SIDE EFFECTS AT MODULE SCOPE» — and a `const`
     * is not automatically innocent. `const locale = cartridgeLocale()` ran on IMPORT: it asked the
     * engine what language had been chosen, at a moment the host may not have chosen one yet, and froze
     * the answer for the life of the module.
     *
     * 📌 IT IS NOT ABOUT MUTABILITY, WHICH IS WHY THE `let` CASE ABOVE DOES NOT CATCH IT. The value
     * never changes; what happens too early is the QUESTION. On the platform the host settles the
     * language before it creates a cartridge and after it has imported one, so an answer read at import
     * is an answer read from the wrong moment — and a wrong language is not a crash, it is a screen a
     * child cannot read.
     *
     * A literal at module scope is fine and stays fine: it computes nothing and asks nobody.
     */
    const callers = SOURCE
      .map((line, n) => ({ line, n }))
      .filter(({ line, n }) => n < opensAt && /^(?:const|let|var)\s+\w[^=]*=.*\(/.test(line))
      .map(({ line, n }) => `${n + 1}: ${line.trim()}`);

    expect(callers, 'these run when the cartridge is imported, before any host has asked for a game')
      .toEqual([]);
  });

  test('⚠️ and importing this file RUNS NOTHING, which is the other half of D14', () => {
    /**
     * ⚠️ "NOTHING RUNS UNTIL `create(ctx)` IS CALLED. No side effects at module scope" —
     * `cartridge-contract.md`, and it is the rule this case now measures rather than the one it used to.
     *
     * 📌 IT USED TO ASSERT THE OPPOSITE, ON PURPOSE. Slice A1 wrapped the body in a factory and left
     * `createPinball();` at the end, so that fifteen browser suites went on booting the file and the
     * claim of that slice — identical behaviour — had something to be checked against. The case said in
     * its own words that it was written to fail the day the call moved. It moved; this is that day.
     *
     * What breaks without it is not visible on a page with one game: the cartridge starts itself, so the
     * host's options are merged into an engine the game has already stopped waiting for.
     */
    expect(SOURCE.filter((line) => line.trim().startsWith('createPinball(')),
      'importing the cartridge still starts it — the host decides when a game begins')
      .toEqual([]);
  });

  test('⚠️ and the shell is what starts it', () => {
    // Without this, the case above is satisfied by DELETING the boot: a cartridge nobody starts passes
    // every structural claim in this file and draws nothing at all.
    const shell = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/standalone.ts'), 'utf8',
    );

    expect(shell, 'nothing starts the game').toMatch(/createPinball\(/);
  });
});
