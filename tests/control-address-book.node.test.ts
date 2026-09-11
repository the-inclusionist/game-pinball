// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ADDRESS BOOK, CHECKED AGAINST THE ARCHIVE IT DESCRIBES.
//
// `control/links` and `control/simple-components` are ports of `make_links` and its 145-name second
// pass. Neither is on this port's wiring path: `table/original-dispatch` attaches behaviour per KIND —
// lanes, target banks, bumper groups — which is richer than the flat name-to-control loop the original
// runs, and it is the one the game uses.
//
// What these two hold that the dispatch does not is the COMPLETENESS QUESTION. The original resolves a
// missing name to null and moves on; these report it. So this is the job only they can do, and until
// now nobody asked them to do it: the 88 scoring components and the 145 simple names had never been
// checked against the file they are written for.
//
// ⚠️ AND THE RULE IS NOT "THE TAG IS THE NAME". Eight of the 145 are two components pointing at one
// group — `soundwave50_1` and `soundwave50_2` are one emitter that two different things trigger — so a
// resolver that used the name directly would satisfy 137 and silently lose 8.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readGroups } from '../app/js/dat/partman.js';
import {
  SIMPLE_COMPONENTS, SIMPLE_TAGS, resolveSimpleComponents,
} from '../app/js/control/simple-components.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';
import { createComponentRegistry, makeLinks, type LinkableComponent } from '../app/js/control/links.js';
import { resource } from './helpers/original-data.js';

const DAT = resource('PINBALL.DAT');
const groupNames = (): Set<string> | null => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  const groups = readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  return new Set(groups.map((g) => g.name).filter((n): n is string => Boolean(n)));
};

/** The archive's groups as the loader's inert components: a name, no behaviour, no scores. */
const asComponents = (names: Set<string>): LinkableComponent[] =>
  [...names].map((groupName) => ({ groupName, control: null, scores: [] }));

const noop = (): void => {};

describe('the control layer’s address book against PINBALL.DAT', () => {
  test('⚠️ all 145 simple names resolve, and only because the tags are consulted', () => {
    const names = groupNames();
    if (!names) return expect(existsSync(DAT)).toBe(false);

    const found = resolveSimpleComponents(
      SIMPLE_COMPONENTS, (name) => (names.has(SIMPLE_TAGS[name]!) ? true : null),
    );

    expect(SIMPLE_COMPONENTS).toHaveLength(145);
    expect(found.missing, 'names the archive does not answer to').toEqual([]);
    expect(found.resolved).toBe(145);
  });

  test('⚠️ and the identity rule would lose exactly the eight shared emitters', () => {
    // The mutant this test exists for, run forwards: resolving by NAME instead of by tag. It is not a
    // hypothetical — it is the rule anybody would write first, and it is right 137 times out of 145.
    const names = groupNames();
    if (!names) return expect(existsSync(DAT)).toBe(false);

    const naive = resolveSimpleComponents(SIMPLE_COMPONENTS, (name) => (names.has(name) ? true : null));

    expect(naive.missing).toEqual([
      'soundwave50_1', 'soundwave36_1', 'soundwave50_2', 'soundwave35_1',
      'soundwave36_2', 'soundwave35_2', 'soundwave14_1', 'soundwave14_2',
    ]);
  });

  test('⚠️ and every one of the 88 scoring components has a group to attach to', () => {
    // `make_links`' first pass, over the real file. A name in the score table with nothing to bind to
    // is a component the game scores and the table does not have — silence in the original, a list here.
    const names = groupNames();
    if (!names) return expect(existsSync(DAT)).toBe(false);
    const registry = createComponentRegistry(asComponents(names));

    const result = makeLinks(
      registry,
      SCORE_COMPONENTS.map((row) => ({ name: row.tag, control: noop, scores: row.scores })),
      SIMPLE_COMPONENTS.map((name) => SIMPLE_TAGS[name]!),
    );

    expect(SCORE_COMPONENTS).toHaveLength(88);
    expect(result.missing, 'control-table names with no group').toEqual([]);
    expect(result.linked).toBe(88);
  });

  test('and the registry scans the component list once per distinct name, not once per lookup', () => {
    // The cache is the reason this can be run over 233 names without being quadratic. 88 score names
    // and 145 simple ones share the four doubled emitters, so 229 distinct names are asked for.
    const names = groupNames();
    if (!names) return expect(existsSync(DAT)).toBe(false);
    const registry = createComponentRegistry(asComponents(names));

    makeLinks(
      registry,
      SCORE_COMPONENTS.map((row) => ({ name: row.tag, control: noop, scores: row.scores })),
      SIMPLE_COMPONENTS.map((name) => SIMPLE_TAGS[name]!),
    );
    const afterFirst = registry.scanCount;
    registry.resolve(SCORE_COMPONENTS[0]!.tag);

    expect(afterFirst).toBeLessThan(SCORE_COMPONENTS.length + SIMPLE_COMPONENTS.length);
    expect(registry.scanCount, 'a repeat lookup scans nothing').toBe(afterFirst);
  });
});
