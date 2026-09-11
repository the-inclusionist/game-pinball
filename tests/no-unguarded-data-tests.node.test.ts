// SPDX-License-Identifier: AGPL-3.0-or-later
// A CLONE WITHOUT THE MICROSOFT FILES HAS TO GO GREEN.
//
// `game_resources/` is gitignored and never committed — it is Microsoft's work, and the rule is in
// `.gitignore` in capitals. So every clone starts without it, and a test that reads it unguarded turns
// `npm test` red for everybody who has not run `npm run data:extract` yet. The failure is not subtle
// and it is not the newcomer's fault: it says the repository is broken when what is missing is a file
// they were never given.
//
// Verified by hiding the directory and running the suite: 1759 pass, 23 skip, one file skips whole, and
// the run exits zero. This gate is what keeps that true as data-dependent tests are added — five of
// them were added in one night, which is how often this can slip.
//
// ⚠️ ITS LIMIT, STATED. It asks that a file which reaches for the archive also contains `existsSync`.
// One that writes `existsSync` in a comment would pass wrongly; that has not happened, it is cheap to see
// in review, and the alternative — following imports to prove a guard runs before a read — is a type
// checker's job rather than a test's.
//
// ⚠️ AND THE OTHER HALF OF THAT LIMIT CAME TRUE, WHICH IS WHY THIS PARAGRAPH CHANGED. It used to say "a
// test that guards in a helper imported from elsewhere would be reported wrongly", and then the WHERE moved
// into a helper: every suite had the absolute path `C:/.../SpaceCadetPinball/game_resources/PINBALL.DAT`
// written out in full, the repository was renamed to `game-pinball`, and thirty-six suites quietly started
// skipping a directory that could no longer exist. So the path is derived from the helper's own location
// now (`tests/helpers/original-data`), and what this scan looks for is the IMPORT of it.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * A file READS the data if it takes the archive's location from the helper that knows where it is — or,
 * for anything written before that helper existed, if it names the directory inside a read call.
 */
const READS_DATA = /from '\.\/helpers\/original-data\.js'|(readFileSync|readdirSync|existsSync)\s*\(\s*[`'"][^`'"]*game_resources/;

describe('every test that needs the original data says so', () => {
  test('⚠️ and guards on it, so a clean clone stays green', () => {
    const offenders: string[] = [];

    for (const entry of readdirSync(HERE)) {
      if (!entry.endsWith('.ts')) continue;
      const source = readFileSync(resolve(HERE, entry), 'utf8');
      // The constant most of them use, and the literal path the rest do.
      const reads = READS_DATA.test(source);
      if (!reads) continue;
      if (!source.includes('existsSync')) offenders.push(entry);
    }

    expect(offenders, 'these read the archive without checking it is there').toEqual([]);
  });

  test('and the scan really is looking at the files that read it', () => {
    // The other half of the claim: a gate that matched nothing would pass for ever. Twenty-odd of this
    // directory's files read the archive, and this one is not among them.
    let readers = 0;
    for (const entry of readdirSync(HERE)) {
      if (!entry.endsWith('.ts')) continue;
      const source = readFileSync(resolve(HERE, entry), 'utf8');
      if (READS_DATA.test(source)) readers++;
    }

    /**
     * ⚠️ THIRTY-FIVE AND NOT FIFTEEN, and the number is the point. The bar was `> 15` while the scan
     * was matching the whole family; after the rename it would have matched ZERO, and `> 15` is exactly
     * the kind of loose bound that lets a scan go blind without saying so. The count is thirty-six.
     */
    expect(readers, 'the suite really does lean on the archive').toBeGreaterThan(35);
    expect(readFileSync(join(HERE, 'no-unguarded-data-tests.node.test.ts'), 'utf8'))
      .not.toMatch(READS_DATA);
  });
});
