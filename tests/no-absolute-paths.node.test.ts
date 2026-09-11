// SPDX-License-Identifier: AGPL-3.0-or-later
// NO TEST NAMES A PLACE OUTSIDE THIS REPOSITORY.
//
// ========================= WHAT THIS COSTS WHEN IT IS NOT CHECKED =========================
// ⚠️ THE REPOSITORY WAS RENAMED — `SpaceCadetPinball` TO `game-pinball` — AND THIRTY-SIX SUITES WENT DARK
// IN THE SAME MINUTE. Each of them opened the Microsoft archive through an absolute path written out in
// full, drive letter and all. That directory is gitignored and populated by `npm run data:extract`, so
// every one of those suites is written to SKIP when it is absent — which is correct, and which is exactly
// what made the rename invisible.
//
// They did not fail. They went on passing, and several of them asserted the emptiness as evidence:
// `expect(existsSync(DAT)).toBe(false)` had become a true statement about a directory that could not
// exist, standing in for a claim about the parser. The whole 1995 half of this port — the `.DAT` reader,
// the bitmaps, the z-map, the score tables, the address book, the frame budget — was green and blind.
//
// ========================= AND AN ABSOLUTE PATH IS THE ONLY SHAPE THAT CAN DO THIS =========================
// A relative path breaks LOUDLY when the file moves; a derived one (`import.meta.url`) moves with it. Only
// an absolute literal keeps resolving to somewhere that used to be right, which is why the rule is about
// the shape and not about the particular directory that was wrong. The archive's location lives in
// `tests/helpers/original-data` now, derived from where that file sits.
//
// ⚠️ ITS TWO LIMITS, STATED. It looks for a DRIVE LETTER, so a POSIX absolute path would pass — this
// repository has never produced one, and widening the rule to a leading slash would flag every
// root-relative URL a browser test fetches, which is how a rule gets switched off instead of obeyed. And
// it skips comment lines, because the defect has to be quotable in the file that explains it.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A drive letter inside a string literal: `'C:/…'`, `"D:\…"`. */
const ABSOLUTE = /['"`][A-Za-z]:[\\/][^'"`\n]*['"`]/;

/** Prose, in either comment style. A defect has to be quotable in the file that explains it. */
const isComment = (line: string): boolean => {
  const t = line.trimStart();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
};

/** Every offending line of a source, as `file:line: text`. */
function offendersIn(entry: string, source: string): string[] {
  return source.split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => !isComment(line) && ABSOLUTE.test(line))
    .map(({ line, n }) => `${entry}:${n}: ${line.trim()}`);
}

describe('a test names no place outside this repository', () => {
  test('⚠️ no absolute filesystem path in any test file', () => {
    const offenders = readdirSync(HERE)
      // This file's own fixtures are the defect, written out on purpose; see the case below.
      .filter((entry) => entry.endsWith('.ts') && entry !== 'no-absolute-paths.node.test.ts')
      .flatMap((entry) => offendersIn(entry, readFileSync(resolve(HERE, entry), 'utf8')));

    expect(offenders, 'these resolve to somewhere this repository does not control').toEqual([]);
  });

  test('and the scan can see one, which is the half a passing scan never proves', () => {
    /**
     * ⚠️ A GATE THAT MATCHES NOTHING PASSES FOREVER, and the family this one replaces is the proof: the
     * archive scan next door held a bound of "more than 15 readers" while the rename had taken it to
     * zero of thirty-six. So the pattern is shown the exact defect and asked to name it — and shown a
     * comment carrying the same text, which it must NOT name.
     */
    const bad = `  const DAT = 'C:/Users/x/game_resources/PINBALL.DAT';`;
    const quoted = `  // it used to say 'C:/Users/x/game_resources/PINBALL.DAT', which is the defect`;

    expect(offendersIn('f.ts', bad)).toHaveLength(1);
    expect(offendersIn('f.ts', quoted), 'prose is not a path').toEqual([]);
  });
});
