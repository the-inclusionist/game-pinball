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

  /**
   * ⚠️ AND A PHRASE GATE CANNOT CATCH A CLAIM THAT MERELY COUNTED WRONG.
   *
   * The two cases below this one ask whether a RETIRED SENTENCE has come back. They were written the day
   * the first font landed and they have held since. What they could not see is the note going on to say
   * something NEW and false: §4 opened with "there is one asset and it is a font" and closed with "no
   * other asset exists", and by 2026-09-11 the tree held eighteen — eleven playfields, two screens and
   * five fonts. Both sentences were written true, both rotted in place, and the document whose only job
   * is to be accurate about what is being licensed was the last place anybody looked.
   *
   * So the arithmetic gets a gate of its own: a sentence in the note that COUNTS assets may not count
   * fewer than `git ls-files` holds.
   *
   * ⚠️ ITS LIMIT, STATED. It reads two sentence shapes — "there is/are N asset(s)" and "N other asset(s)
   * exist(s)" — and `no` is a number here. A claim phrased any other way slips past, and the note is prose
   * rather than a form. What the gate buys is that the two shapes this document actually reaches for are
   * now arithmetic rather than atmosphere, and that a TRUE count pins itself: the next asset to land turns
   * this red until somebody updates the sentence, which is the whole point of writing it down.
   */
  /**
   * ⚠️ A DIRECTORY-SCOPED LICENCE THAT DOES NOT NAME THE FILE IS A HOLE, AND FOUR PICTURES WERE IN IT.
   *
   * The ledger above accepts one `LICENSE.txt` for a whole directory, and it is right to: six pictures
   * under one dedication should not carry six copies of the same text. But it matches on the DIRECTORY,
   * so a file that arrives in a directory that already has a licence is covered by arithmetic rather than
   * by anybody's decision — and `app/assets/tables/LICENSE.txt` named seven of the eleven pictures beside
   * it while four had landed under a section of the note headed "whose terms are NOT YET RECORDED".
   *
   * A redistributor opening that directory reads a dedication and eleven files, and has no way to learn
   * that four of them were not part of it. That is the exact harm a licence file exists to prevent.
   *
   * ⚠️ AND THE RULE IS NOT "ONE FILE PER ASSET", which is what the ledger above already refused. It is
   * that whatever the licence file covers, it SAYS what it covers. Naming is cheap; being covered by
   * proximity is what is not.
   */
  /**
   * ⚠️ NAMING A LICENCE IS NOT SHIPPING ONE, AND THE OFL SAYS SO IN ITS OWN CONDITION 5.
   *
   * The OFL requires that the licence travel WITH the font — "must be distributed entirely under this
   * license, and must not be distributed under any other license" — and this repository shipped four
   * Atkinson faces beside a file that named the licence and linked to it. `docs/LICENSES.md` §4.3 said so
   * out loud ("a link is not a copy"), the file beside the fonts said so about itself ("THIS IS OWED"),
   * and `README.md` made it a publication blocker. Three documents agreeing that an obligation is unmet
   * is not the same as meeting it, and the gate that existed asked only whether the words "SIL Open Font
   * License 1.1" appeared somewhere in the note.
   *
   * ⚠️ THE REPOSITORY ALREADY HELD THE ANSWER ONE DIRECTORY OVER. `app/assets/fonts/press-start-2p.OFL.txt`
   * is the verbatim text, and it is what this test measures the other one against: the licence BODY is the
   * same for every font under the OFL, and only the copyright line above it differs. So the check is not a
   * word count or a byte size — it is that the operative clauses are present, in both files.
   */
  test('⚠️ and a font’s licence file carries the TEXT, not the name of the text', () => {
    const files = tracked();
    const FONT = /\.(woff2?|ttf|otf)$/i;
    /** The clauses that make the OFL operate. A file without these is a reference to a licence. */
    const OPERATIVE = [
      'PERMISSION & CONDITIONS',
      '1) Neither the Font Software nor any of its individual components',
      '5) The Font Software, modified or unmodified, in part or in whole,',
      'TERMINATION',
      'DISCLAIMER',
    ];

    const fonts = files.filter((f) => FONT.test(f));
    const thin: string[] = [];
    for (const font of fonts) {
      const directory = font.slice(0, font.lastIndexOf('/'));
      const base = font.replace(/\.[^.]+$/, '');
      const licences = files.filter((f) => /(licen[cs]e|OFL|COPYING)/i.test(f)
        && (f.startsWith(base) || f.slice(0, f.lastIndexOf('/')) === directory));

      const carried = licences.some((f) => {
        const text = readFileSync(resolve(ROOT, f), 'utf8');
        return OPERATIVE.every((clause) => text.includes(clause));
      });
      if (!carried) thin.push(`${font} — ${licences.join(', ') || 'no licence file'} names the OFL without carrying it`);
    }

    expect(thin, 'fonts shipped beside a reference to their licence rather than the licence').toEqual([]);
    expect(fonts.length, 'there are fonts to check').toBeGreaterThan(0);
  });

  test('⚠️ a licence that covers a whole directory NAMES every asset in it', () => {
    const assets = tracked().filter((f) => ASSET.test(f));
    const files = tracked();
    const LICENCE = /(licen[cs]e|OFL|COPYING)/i;

    const uncovered: string[] = [];
    for (const asset of assets) {
      const directory = asset.slice(0, asset.lastIndexOf('/'));
      const name = asset.split('/').pop()!;
      const base = asset.replace(/\.[^.]+$/, '');

      // A licence that shares the asset's own file name covers it by that name alone — one font, one
      // `press-start-2p.OFL.txt`. Only the DIRECTORY-scoped ones have to list what they reach.
      if (files.some((f) => LICENCE.test(f) && f.startsWith(base))) continue;

      const scoped = files.filter((f) => LICENCE.test(f) && f.slice(0, f.lastIndexOf('/')) === directory);
      if (!scoped.length) continue; // the ledger above is what reports this one

      const named = scoped.some((f) => readFileSync(resolve(ROOT, f), 'utf8').includes(name));
      if (!named) uncovered.push(`${asset} — ${scoped.join(', ')} does not name it`);
    }

    expect(uncovered, 'assets a directory licence covers by proximity without saying so').toEqual([]);
    // ⚠️ AND THE SCAN REACHED SOMETHING. Every clause above is a `continue`; a bug in any of them would
    // empty the loop and leave this passing over nothing at all.
    expect(assets.length, 'there are assets to check').toBeGreaterThan(0);
  });

  test('⚠️ and no sentence in the note counts fewer assets than the tree holds', () => {
    const note = readFileSync(resolve(ROOT, 'docs', 'LICENSES.md'), 'utf8');
    const assets = tracked().filter((f) => ASSET.test(f));

    const WORDS: Record<string, number> = {
      no: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
      eighteen: 18, nineteen: 19, twenty: 20,
    };
    const numberOf = (word: string): number | null => {
      const w = word.toLowerCase();
      if (/^\d+$/.test(w)) return Number(w);
      return w in WORDS ? WORDS[w]! : null;
    };

    const CLAIMS = [
      /there (?:is|are) ([A-Za-z]+|\d+) (?:other )?assets?\b/gi,
      /\b([A-Za-z]+|\d+) other assets? (?:exists?|remains?)\b/gi,
    ];

    const counted: number[] = [];
    const short: string[] = [];
    for (const pattern of CLAIMS) {
      for (const [whole, word] of note.matchAll(pattern)) {
        const n = numberOf(word!);
        if (n === null) continue;
        counted.push(n);
        if (n < assets.length) short.push(`"${whole.trim()}" — the tree holds ${assets.length}`);
      }
    }

    expect(short, 'the note counts fewer assets than are tracked').toEqual([]);
    /**
     * ⚠️ AND THE SCAN HAS TO HAVE FOUND ONE. Two of these sentences existed and both were wrong; a
     * pattern that matched neither would pass for ever and say nothing, which is the failure this
     * repository has now met in three separate ledgers.
     */
    expect(counted.length, 'the note makes a countable claim at all').toBeGreaterThan(0);
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
