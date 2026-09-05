// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');

/**
 * ⚠️ THE DEMONSTRATION MODE READS MICROSOFT'S ARCHIVE, AND THE BUILD MUST NEVER CARRY IT.
 *
 * `docs/LICENSES.md` § 3 keeps the original data out of the repository's history, and
 * `tests/licence-note` holds that against what git tracks. This is the third place the same rule has to
 * be true and the one nothing was watching: a `dist` folder is what gets uploaded, and a build that
 * quietly bundled `PINBALL.DAT` would be a redistribution of somebody else's game by accident.
 *
 * The demo therefore asks the PLAYER for the file. It is never fetched, never copied by the build, and
 * never a dependency of anything that ships — which is also why this test can be this simple.
 */
describe('the build carries nothing that is not ours', () => {
  test('no original asset anywhere in dist', () => {
    if (!existsSync(DIST)) return expect(existsSync(DIST)).toBe(false);

    const forbidden = /\.(dat|wav|mid|midi)$/i;
    const found: string[] = [];

    const walk = (at: string): void => {
      for (const entry of readdirSync(at)) {
        const path = join(at, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (forbidden.test(entry)) found.push(path.slice(DIST.length + 1));
      }
    };
    walk(DIST);

    expect(found).toEqual([]);
  });
});
