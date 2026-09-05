// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const tracked = () =>
  execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);

/**
 * ⚠️ `docs/LICENSES.md` § 3 SAYS `.gitignore` IS A MECHANISM AND NOT THE PROMISE. THIS IS THE PROMISE.
 *
 * `game_resources/` being ignored keeps the original data out of a commit by accident. It does nothing
 * about `git add -f`, and the asymmetry is what makes this worth a test rather than a paragraph: a
 * commit that carries somebody else's binary can be reverted and cannot be un-published. Once it is in
 * the history of a repository that has been pushed, the only remedies are rewriting history everyone
 * has already pulled, or nothing.
 *
 * So the rule is checked where it can still be enforced — before the commit — and it is checked against
 * what git actually tracks rather than against what `.gitignore` claims.
 */
describe('⚠️ the original game data never enters the history', () => {
  // Microsoft's own file types. Deliberately by EXTENSION rather than by directory: moving a WAV out of
  // `game_resources/` would defeat a path check, and would not make the file any more ours.
  const FORBIDDEN = /\.(dat|wav|mid|midi)$/i;

  test('no Microsoft asset is tracked, anywhere in the tree', () => {
    expect(tracked().filter((f) => FORBIDDEN.test(f))).toEqual([]);
  });

  test('and neither is any other binary asset, because none has been licensed yet', () => {
    // `LICENSES.md` § 4 states plainly that there is no art in this repository and that the phase-8
    // drawing is code. That claim expires the moment somebody commits a PNG, and it should expire
    // LOUDLY: the note has to be extended in the same commit that first adds an asset, naming its
    // author and its terms. Deleting this test is the honest way to do that. Quietly adding the file
    // is not.
    const assets = tracked().filter((f) => /\.(png|jpe?g|gif|webp|bmp|svg|ttf|otf|woff2?|mp3|ogg)$/i.test(f));

    expect(assets).toEqual([]);
  });

  test('the licence note and the credits both exist and are reachable from the README', () => {
    // A note nobody is pointed at is a note nobody reads.
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');

    expect(tracked()).toContain('docs/LICENSES.md');
    expect(tracked()).toContain('docs/CREDITS.md');
    expect(readme).toContain('docs/LICENSES.md');
    expect(readme).toContain('docs/CREDITS.md');
  });

  test('the upstream MIT notice is reproduced verbatim, copyright line included', () => {
    // MIT's one condition. A credit that names the project and drops the copyright line does not
    // satisfy it, and the line was fetched from the upstream repository rather than remembered.
    const credits = readFileSync(resolve(ROOT, 'docs/CREDITS.md'), 'utf8');

    expect(credits).toContain('Copyright (c) 2020-2021 Andrey Muzychenko');
    expect(credits).toContain('The above copyright notice and this permission notice shall be included in all');
  });
});
