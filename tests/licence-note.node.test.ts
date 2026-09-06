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
 * What counts as an asset, in ONE place because two tests ask the question — and a second copy of this
 * expression is exactly the defect the README test below exists to record.
 */
const ASSET = /\.(png|jpe?g|gif|webp|bmp|ttf|otf|woff2?|mp3|ogg)$/i;

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
    const assets = tracked().filter((f) => ASSET.test(f));
    const note = readFileSync(resolve(ROOT, 'docs', 'LICENSES.md'), 'utf8');
    const credits = readFileSync(resolve(ROOT, 'docs', 'CREDITS.md'), 'utf8');
    const files = new Set(tracked());

    /**
     * ⚠️ BESIDE IT MEANS BESIDE IT, AND THAT USED TO MEAN "SHARING ITS FILE NAME". One font needs one
     * `press-start-2p.OFL.txt`; six pictures under one dedication need ONE `LICENSE.txt` in the
     * directory they live in, which is what every project in the world does and what the rule refused.
     * A licence per asset would have been six copies of the same text — the shape this repository
     * spends most of its comments warning about.
     *
     * ⚠️ AND THE CREDIT IS CHECKED AGAINST THE ASSET, WHICH IT WAS NOT. The third clause read
     * `credits.includes('Press Start 2P')` for EVERY asset, so the font's own credit satisfied the
     * ledger for anything that might arrive later. It is a test that reads by the same link twice: the
     * font was both the subject and the evidence. Six pictures landed and it went on passing that
     * clause.
     */
    const unaccounted = assets.filter((asset) => {
      const base = asset.replace(/\.[^.]+$/, '');
      const directory = asset.slice(0, asset.lastIndexOf('/'));
      const licence = /(licen[cs]e|OFL|COPYING)/i;
      const hasLicence = [...files].some((f) => licence.test(f)
        && (f.startsWith(base) || f.slice(0, f.lastIndexOf('/')) === directory));
      const name = asset.split('/').pop()!;
      return !hasLicence || !note.includes(name) || !credits.includes(name);
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

  /**
   * ⚠️ AND THE SAME CLAIM LIVES IN THE README, WHERE THE GATE ABOVE COULD NOT SEE IT.
   *
   * The test above was written when the font landed, because § 4 of the note had said "there is no art
   * in this repository" and had stopped being true. The README's licence section said the same thing in
   * different words — "Art follows its own author's terms, and there is none in this repository yet" —
   * and went on saying it for every commit since, because the gate reads one file and the sentence was
   * in two.
   *
   * That is this project's most-repeated shape arriving in prose: one rule, two copies, one of them
   * checked. It has already cost a bumper's rectangle, a HUD inset and a plunger's speed.
   */
  test('⚠️ and the README, which says it too, agrees with the tree', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
    const assets = tracked().filter((f) => ASSET.test(f));

    expect(assets.length, 'there is something to be wrong about').toBeGreaterThan(0);
    expect(readme, 'the README does not claim an empty tree')
      .not.toMatch(/there is none in this repository/i);

    /**
     * ⚠️ THE DIRECTORY AND NOT THE FILE, so this scales to a table's worth of sprites without asking
     * a README to list them one by one — and still fails the day an asset arrives somewhere the
     * licence section has never heard of, which is the case a phrase match cannot reach. A
     * hand-written sentence is checked against `git ls-files` rather than against the last time
     * somebody remembered.
     */
    for (const asset of assets) {
      const directory = asset.slice(0, asset.lastIndexOf('/'));
      expect(readme, `${directory} is accounted for in the README`).toContain(directory);
    }
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
