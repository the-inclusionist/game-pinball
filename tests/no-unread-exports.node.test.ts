// SPDX-License-Identifier: AGPL-3.0-or-later
// THE RATCHET AGAINST THE DEFECT THIS PORT KEEPS FINDING.
//
// The recurring finding of this project, in one sentence: things that exist and are never reached.
// Modules written, tested and imported by nothing. Hooks accepted by twelve builders and forwarded by
// none. A camera built for two axes and called on one. A control the drain had been asking for since it
// was written, with nobody at the other end. Every one of them was found by reading, months late, and
// several of them were player-visible defects rather than tidiness.
//
// None of them would have survived this file.
//
// ⚠️ AND THE RULE IS "READ", NOT "USED IN THE GAME". A symbol referenced only by a test counts: a test
// is a reader, and something asserted but unwired is a different and much smaller problem than
// something nothing mentions at all. What this catches is the export nobody looked at twice.
//
// ⚠️ AND IT IS A WHOLE-WORD SEARCH, WHICH IS THE HONEST VERSION. A name that appears only inside a
// comment counts as read, and that is deliberate: the alternative is parsing TypeScript to find real
// references, and a test that is nearly right about something this structural is worse than one whose
// limits are stated. What it cannot miss is a name that appears exactly once in the whole repository —
// on the line that declares it.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function typescriptUnder(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) out.push(...typescriptUnder(path));
    else if (entry.endsWith('.ts')) out.push(path);
  }
  return out;
}

/** `export function foo` and `export const foo`. Types and interfaces are not in scope — see below. */
const DECLARATION = /^export (?:async )?(?:function|const) (\w+)/gm;

describe('every export is read by something', () => {
  test('⚠️ nothing in `app/js` is exported and then mentioned nowhere else', () => {
    const sources = [...typescriptUnder(join(ROOT, 'app', 'js')), ...typescriptUnder(join(ROOT, 'tests'))]
      .map((path) => ({ path, text: readFileSync(path, 'utf8') }));

    const declaredIn = new Map<string, string>();
    for (const { path, text } of sources) {
      if (!path.includes(`app${'/'}js`) && !path.includes(`app\\js`)) continue;
      for (const match of text.matchAll(DECLARATION)) declaredIn.set(match[1]!, path);
    }

    const unread: string[] = [];
    for (const [name, home] of declaredIn) {
      const word = new RegExp(`\\b${name}\\b`, 'g');
      let mentions = 0;
      for (const { text } of sources) {
        for (const _ of text.matchAll(word)) mentions++;
        if (mentions > 1) break;
      }
      // One mention is the declaration itself. Anything else is a reader.
      if (mentions <= 1) unread.push(`${name} (${home.slice(ROOT.length + 1)})`);
    }

    // The four this file was written after, all of them real: `FUEL_ROLLOVER_SPLITS`, a second copy of
    // six numbers that already lived beside the components they belong to; `DOCUMENTED_MATRIX`, an
    // alias made "for a test" that no test ever wanted; and `EMPTY_WIDTH` with `isEmpty`, the named
    // empty-rectangle sentinel, while the only module that uses empty rectangles spelled it `-1` seven
    // times. Two were deleted and two were given the consumer they were written for.
    expect(unread, 'exported and mentioned nowhere else').toEqual([]);
    expect(declaredIn.size, 'and the scan really looked at the whole tree').toBeGreaterThan(400);
  });
});
