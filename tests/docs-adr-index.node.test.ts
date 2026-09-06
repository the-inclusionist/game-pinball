// SPDX-License-Identifier: AGPL-3.0-or-later
// A RECORD NOBODY CAN FIND IS A RECORD NOBODY READS.
//
// The plan lists five "registros devidos" and requires each to be written IN THE TURN IT BECOMES TRUE.
// That rule has a hole in it that only shows up later: a record can be written, committed, and never
// added to the index — and the next person, who reaches these decisions through `README.md` because
// that is what a README is for, will not know it exists. The decision is then made twice, and the
// second time without the reasoning that settled it.
//
// ⚠️ IT IS A LEDGER, IN BOTH DIRECTIONS, like `tests/no-unsanctioned-orphans`. A file that is not
// listed fails, and a listing that names no file fails too — a renamed record leaves a dead link in
// the one document whose job is to find it, and a dead link is worse than a missing line because it
// looks like it works.
import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADR_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/2-Architecture/adr');

const records = (): string[] =>
  readdirSync(ADR_DIR).filter((name) => name.startsWith('ADR-') && name.endsWith('.yaml')).sort();

/** Every `(…yaml)` link target in the index. */
const linked = (): string[] => {
  const index = readFileSync(resolve(ADR_DIR, 'README.md'), 'utf8');
  return [...index.matchAll(/\(([^)]+\.yaml)\)/g)].map((m) => m[1]!).sort();
};

describe('the architecture records and the index over them', () => {
  test('⚠️ every record is listed, and every listing names a record', () => {
    expect(linked(), 'the index and the directory agree').toEqual(records());
    // ⚠️ AND BOTH FOUND SOMETHING. Two empty lists are equal, and a glob that stopped matching would
    // make this pass for ever while saying nothing at all.
    expect(records().length, 'there are records to index').toBeGreaterThan(0);
  });

  test('and each one opens with the metadata the format requires', () => {
    // The format is the engine's so the two read the same way. A record missing its status or its
    // decision-makers is a record whose standing cannot be told from its content — "accepted by whom,
    // and is it still true" is the first question anybody brings to one.
    for (const name of records()) {
      const source = readFileSync(resolve(ADR_DIR, name), 'utf8');

      expect(source.startsWith('---\nmetadata:'), `${name} opens with metadata`).toBe(true);
      expect(source, `${name} says what its standing is`).toMatch(/^ {2}status: /m);
      expect(source, `${name} says who decided`).toMatch(/^ {2}decision-makers: /m);
      expect(source, `${name} says when`).toMatch(/^ {2}date: \d{4}-\d{2}-\d{2}$/m);
    }
  });
});
