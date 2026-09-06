// SPDX-License-Identifier: AGPL-3.0-or-later
// A BROWSER PROJECT WITH NOTHING IN IT REPORTS SUCCESS.
//
// This project was owed for eight phases. The comment in `vite.config.ts` that deferred it made the
// right argument — a gate configured before the thing it tests is a gate that never went red — and
// then nobody came back. The failure this file guards is the same one arriving from the other side:
// the project is configured, the glob matches nothing, `vitest run` says everything passed, and the
// browser half of the plan's verification is decoration again. Nothing else would notice, because
// there is no output to be missing.
//
// ⚠️ AND IT CHECKS THE CONFIG TOO, because two things have to agree for a browser test to run at all:
// a file named the way the glob expects, and a glob that expects that name. Either one alone is
// silent.
import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('the browser half of the verification', () => {
  test('⚠️ there is at least one test that actually runs in a browser', () => {
    const specs = readdirSync(resolve(ROOT, 'tests')).filter((n) => n.endsWith('.browser.test.ts'));

    expect(specs.length, 'the browser project has something to run').toBeGreaterThan(0);
  });

  test('and the config still asks for them, by the name they are written under', () => {
    const config = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf8');

    expect(config, 'a browser project is declared').toMatch(/name: 'browser'/);
    expect(config, 'and its glob is the one the files are named for')
      .toMatch(/include: \['\.\.\/tests\/\*\*\/\*\.browser\.test\.ts'\]/);
    // ⚠️ HEADLESS IS NOT A PREFERENCE HERE. This runs in a sandbox with no display and in CI with no
    // person: a project that wants to open a window hangs instead of failing, which is the worst of
    // the two because it looks like work in progress.
    expect(config, 'and it needs no screen').toMatch(/headless: true/);
  });
});
