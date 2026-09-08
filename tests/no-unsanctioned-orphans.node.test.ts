// SPDX-License-Identifier: AGPL-3.0-or-later
// A MODULE NOTHING IMPORTS IS A DECISION OR A DEFECT, AND IT HAS TO SAY WHICH.
//
// `tests/no-unread-exports` closed the fine-grained half of this: no exported name goes unmentioned.
// The coarse half was still open — a whole FILE that nothing imports passes that gate as long as its
// exports are named in its own tests, and this project's recurring finding is exactly that shape.
// `control/cheats` sat unwired for months with a full test suite; `gfx/gdrv` did; `dat/spliced` does.
//
// So the orphans are enumerated, with the reason each one is allowed to be one. A seventh appearing is
// not a failure of taste — it is a question nobody has answered yet, and this is what asks it.
//
// ⚠️ AND THE SPECIFIER IS RESOLVED, NOT MATCHED. My first version compared file NAMES, and it was wrong
// twice in one run: `'../audio/sound-links.js'` counted as an import of `control/links.ts`, so a real
// orphan was hidden; and `control/controls.ts` and `shell/controls.ts` share a basename, so an import
// of either would have counted for both. Each relative specifier is resolved against the directory of
// the file that writes it, which is what the runtime does.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'js');

/**
 * The six that are allowed to be orphans, and why. Each was decided in a commit and the reason lives in
 * the module's own header; this is the ledger, not the argument.
 */
const SANCTIONED: Readonly<Record<string, string>> = {
  'main.ts':
    'the browser entry point — `index.html` imports it, and nothing in `app/js` should',
  'control/links.ts':
    'the flat wiring loom the original runs; `table/original-dispatch` wires per KIND instead, and two '
    + 'looms would drift. What lives only here is the completeness question, asked by '
    + '`tests/control-address-book`',
  'control/simple-components.ts':
    'the 145-name address book the control layer is written against, checked against the archive by '
    + 'the same test',
  'dat/spliced.ts':
    'the spliced-bitmap decoder. All 318 bitmaps in the shipped archive are raw, so it has nothing to '
    + 'do here; `dat/bitmap8.readIndexedBitmap` refuses a spliced one by name rather than walking it',
  /**
   * ⚠️ THE FIRST ORPHAN THAT IS OWED RATHER THAN EXPLAINED, and the difference matters. The four below
   * are permanent: each says why nothing imports it and why that is right. This one is step 1 of
   * `docs/plans/2026-09-08-a-table-editor.md` — the part library the editor is built on — and the plan
   * says in the same breath that the catalogue should move onto it, one table at a time, so that there
   * are not two ways of describing a table.
   *
   * It stops being an orphan the day either lands. If neither does, this line is the record that
   * somebody wrote a library nobody uses.
   */
  'table/parts.ts':
    'the part library from the table-editor plan, step 1. Nothing imports it until the editor exists or '
    + 'the catalogue moves onto it; `tests/table-parts` is what holds it up meanwhile',
  'gfx/render.ts':
    'the dirty-rectangle compositor. The demonstration repaints all 43005 pixels each frame, which at '
    + 'this size costs less than the bookkeeping that would avoid it',
};

function modulesUnder(directory: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) out.push(...modulesUnder(path, `${prefix}${entry}/`));
    else if (entry.endsWith('.ts')) out.push(`${prefix}${entry}`);
  }
  return out;
}

/**
 * Every relative specifier a file imports, resolved to a path under `app/js`.
 *
 * ⚠️ RESOLVED BY HAND, NOT BY `path.resolve`. The module paths here are posix-shaped
 * (`table/x.ts`) because that is what an import specifier looks like, and `path.resolve` on Windows
 * answers with a drive letter and backslashes — which reported a hundred and twenty-five orphans out
 * of a hundred and thirty-one modules the first time this ran.
 */
function importsOf(module: string, source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/from '(\.[^']*)\.js'/g)) {
    const parts = [...dirname(module).split('/'), ...match[1]!.split('/')];
    const stack: string[] = [];
    for (const part of parts) {
      if (part === '.' || part === '') continue;
      else if (part === '..') stack.pop();
      else stack.push(part);
    }
    out.push(`${stack.join('/')}.ts`);
  }
  return out;
}

describe('every module is imported, or is a sanctioned orphan', () => {
  const modules = modulesUnder(APP);
  const imported = new Set<string>();
  for (const module of modules) {
    for (const target of importsOf(module, readFileSync(join(APP, module), 'utf8'))) {
      imported.add(target);
    }
  }

  test('⚠️ nothing is orphaned by accident', () => {
    const orphans = modules.filter((module) => !imported.has(module));

    expect(orphans.sort(), 'orphans, against the ledger').toEqual(Object.keys(SANCTIONED).sort());
  });

  test('and every sanctioned name is a file that still exists', () => {
    // A ledger entry for a deleted module is a reason nobody can check any more, and it would let a
    // real orphan hide behind a name that is no longer in the tree.
    for (const name of Object.keys(SANCTIONED)) {
      expect(modules, `${name} is still here`).toContain(name);
    }
  });

  test('⚠️ and two modules DO share a basename, which is why the specifier is resolved', () => {
    // `control/controls.ts` is the game's control functions; `shell/controls.ts` is the keyboard.
    // `table/plunger.ts` is the 1995 component; `shell/plunger.ts` is the pull-back the player works.
    // A scan that compared names would count an import of either as an import of both, and these are
    // the evidence that the resolution above is not decoration.
    //
    // ⚠️ THE LIST IS PINNED RATHER THAN COUNTED, so a THIRD clash has to be looked at rather than
    // absorbed. Two modules with one name is a fact about this codebase; three is a question about
    // whether somebody meant to shadow something.
    const byBase = new Map<string, string[]>();
    for (const module of modules) {
      const base = basename(module, '.ts');
      byBase.set(base, [...(byBase.get(base) ?? []), module]);
    }
    const clashes = [...byBase.entries()].filter(([, paths]) => paths.length > 1);

    expect(clashes.map(([base]) => base).sort()).toEqual(['controls', 'plunger']);
  });
});
