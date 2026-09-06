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

  test('⚠️ and every binary asset that IS tracked has been licensed, one by one', () => {
    // This test used to say there were none, and told whoever added the first one to delete it: "the
    // note has to be extended in the same commit that first adds an asset, naming its author and its
    // terms. Deleting this test is the honest way to do that."
    //
    // ⚠️ DELETING IT WOULD HAVE THROWN THE PROTECTION AWAY WITH THE CLAIM. The claim that expired is
    // "there are none"; what must not expire is that each one is accounted for. The first asset
    // arrived on 2026-09-06 — Press Start 2P, for the title screen the Dev asked for — and it fired
    // this test in the same run that added it, which is the gate working exactly as its own comment
    // promised.
    //
    // So it became a ledger. Every tracked asset must satisfy all three, and `LICENSES.md` § 4 says
    // why each one matters: a licence file BESIDE it, a row in the licence note, and an attribution in
    // the credits. An asset that is none of those is one nobody can lawfully ship.
    const assets = tracked().filter((f) => /\.(png|jpe?g|gif|webp|bmp|ttf|otf|woff2?|mp3|ogg)$/i.test(f));
    const note = readFileSync(resolve(ROOT, 'docs', 'LICENSES.md'), 'utf8');
    const credits = readFileSync(resolve(ROOT, 'docs', 'CREDITS.md'), 'utf8');
    const files = new Set(tracked());

    const unaccounted = assets.filter((asset) => {
      const base = asset.replace(/\.[^.]+$/, '');
      const hasLicence = [...files].some((f) => f.startsWith(base) && /(licen[cs]e|OFL|COPYING)/i.test(f));
      const name = asset.split('/').pop()!;
      return !hasLicence || !note.includes(name) || !credits.includes('Press Start 2P');
    });

    expect(unaccounted, 'tracked assets with no licence beside them or no record of their terms')
      .toEqual([]);
    // ⚠️ AND THE SCAN FOUND THE ONE THERE IS. An expression that matched nothing would satisfy the
    // assertion above for ever, which is the shape every green test with no subject takes.
    expect(assets.length, 'the asset ledger has something in it').toBeGreaterThan(0);
  });

  test('and no asset arrives without the note saying it did', () => {
    // The counterpart: § 4 must go on describing the state of the tree. It said "there is no art in
    // this repository" until the font landed, and a note that still said so would be a licence
    // document that is wrong about what is being licensed.
    const note = readFileSync(resolve(ROOT, 'docs', 'LICENSES.md'), 'utf8');

    expect(note).not.toContain('There is no art in this repository.');
    expect(note, 'the note names the terms').toContain('SIL Open Font License 1.1');
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
