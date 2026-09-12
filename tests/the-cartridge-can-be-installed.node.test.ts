// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SECOND ARTEFACT: A LIBRARY A HOST CAN INSTALL.
//
// ========================= ADR-0140: ONE SOURCE, TWO ARTEFACTS =========================
// ⚠️ A STANDALONE PWA *AND* A CARTRIDGE, AND NEITHER REPLACES THE OTHER. `app/index.html` and its shell
// are the first; this is the second — an ES module the platform imports, with the engine left OUTSIDE it.
//
// ⚠️ AND "OUTSIDE IT" IS THE WHOLE CLAIM, not a size preference. If the engine were bundled INTO this
// file, a page with two cartridges would hold two copies of `core/state`, `core/i18n` and `core/rng` —
// two blind-mode flags, two dictionary tables, two random streams. The engine's own user story is
// exactly that: «I want the engine to carry no game state, so that two games on one page do not
// collide». A bundled copy makes the collision impossible to fix, because the two halves would no longer
// even be talking about the same module.
//
// ========================= WHY THIS DOES NOT SKIP WHEN THE BUILD IS ABSENT =========================
// 🔴 `tests/build-carries-no-original-data` OPENS WITH `if (!existsSync(DIST)) return` AND PASSES OVER
// NOTHING. That is the same shape as the 36 gates this repository found reading a dead absolute path
// after a rename: green, forever, measuring a folder that was not there.
//
// So this one FAILS when the artefact is missing, and `npm run validate` builds it before the suite runs.
// A gate that cannot tell "correct" from "absent" is not a gate.
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(ROOT, 'dist-lib');

describe('the cartridge builds as a library', () => {
  test('🔴 the artefact exists, and its absence is a failure rather than a skip', () => {
    expect(existsSync(LIB),
      'dist-lib is missing — run `npm run build:lib`, which `npm run validate` does for you')
      .toBe(true);
  });

  test('⚠️ and the engine is left OUTSIDE it', () => {
    /**
     * ⚠️ MEASURED BY WHAT THE FILE IMPORTS, not by how big it is. A size threshold would be a number
     * nobody could defend and would drift with every table added; an `import … from
     * '@the-inclusionist/engine…'` surviving into the output is a positive statement that the host
     * supplies it.
     *
     * 📌 AND THE OPPOSITE IS CHECKED TOO. A bundled engine leaves no import at all — so asserting only
     * "no engine source" would pass over a build that dropped the dependency entirely and threw at
     * runtime on the first `createGame`.
     */
    const entry = readdirSync(LIB).filter((name) => name.endsWith('.js'));
    expect(entry.length, 'the library build produced no JavaScript').toBeGreaterThan(0);

    const source = entry.map((name) => readFileSync(join(LIB, name), 'utf8')).join('\n');

    expect(source, 'the engine is bundled in, so two cartridges would hold two copies of its state')
      .toMatch(/from\s*["']@the-inclusionist\/engine/);
    // A distinctive string from the engine's own source. If this appears, the module was inlined.
    expect(source, 'engine source found inside the library build')
      .not.toContain('NASCEM_DESLIGADAS');
  });

  test('🔴 and the table pictures are FILES, not data URIs inside the module', () => {
    /**
     * 🔴 MEASURED, AND IT IS WHY THIS BUILD DOES NOT USE VITE'S `build.lib`. In library mode Vite
     * inlines every asset as base64 REGARDLESS of `assetsInlineLimit` — documented behaviour, and
     * reasonable for a library of components. For this game it meant thirteen playfield PNGs inside the
     * JavaScript: **1,051 kB, of which 602 kB was base64**, against 324 kB with the same pictures beside
     * it. Gzipped, 572 kB against 90 kB.
     *
     * ⚠️ AND THE SIZE IS THE SMALLER HALF OF THE COST. A picture inlined in the module cannot be
     * cached on its own, cannot be fetched in parallel, and is re-downloaded in full every time one line
     * of this game changes — on the school machines this port is for, over the connections they have.
     * ADR-0117 puts the platform in charge of loading heavy things ONCE; a cartridge that hides 600 kB
     * inside its own module has taken that decision away from it.
     *
     * So the build uses `rollupOptions.input` rather than `build.lib`, which respects
     * `assetsInlineLimit: 0` and emits the pictures beside the module.
     */
    const source = readFileSync(join(LIB, 'cartridge.js'), 'utf8');

    expect(source.match(/data:image\/[a-z]+;base64/g) ?? [],
      'the table pictures are inlined again, which is 600 kB a host cannot cache separately')
      .toEqual([]);
    expect(existsSync(join(LIB, 'assets')),
      'no assets folder, so the pictures went somewhere this gate cannot see').toBe(true);
  });

  test('⚠️ it is an ES module, because a host imports it', () => {
    const entry = readdirSync(LIB).filter((name) => name.endsWith('.js'));
    const source = entry.map((name) => readFileSync(join(LIB, name), 'utf8')).join('\n');

    expect(source, 'no exports at all, so a host has nothing to import').toMatch(/\bexport\s*[{*]/);
    expect(source, 'a CommonJS build is not something a platform can import').not.toMatch(/\bmodule\.exports\b/);
  });

  test('🔴 every path `package.json` promises a consumer actually resolves', () => {
    /**
     * 🔴 IT DID NOT, FOR ONE COMMIT, AND NOTHING ELSE COULD HAVE SEEN IT. `exports` named
     * `./dist-lib/assets/cartridge-entry.css` while the build emitted `cartridge-entry-CH-0eQyK.css` — a
     * HASHED name, which is right for a picture and wrong for a path a host writes down. Every case above
     * passed: the module was fine, the engine was external, the pictures were files. The only broken
     * thing was the promise.
     *
     * ⚠️ AND A CONSUMER WOULD HAVE MET IT AND NOT US. `npm ci` succeeds, the install succeeds, and the
     * failure arrives as `ERR_PACKAGE_PATH_NOT_EXPORTED` on somebody else's machine — the class of defect
     * `docs/LICENSES.md` and this plan both keep naming: a claim in a file nobody measures against the
     * tree. So the manifest is read, and every path it offers is resolved.
     */
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      exports: Record<string, string | Record<string, string>>;
      files: readonly string[];
    };

    const promised: string[] = [];
    for (const value of Object.values(manifest.exports)) {
      if (typeof value === 'string') promised.push(value);
      else promised.push(...Object.values(value));
    }
    expect(promised.length, 'package.json promises nothing, so this case measures nothing')
      .toBeGreaterThan(2);

    /**
     * 📌 THE `.d.ts` IS EXEMPT AND THAT IS AN OWED THING, NOT A LOOPHOLE. Nothing in this repository
     * emits declarations yet — `tsc --noEmit` is the typecheck — so `exports.types` points at a file that
     * will exist when a declaration build lands. Named here so the exemption is a decision somebody can
     * find, rather than a gap the gate silently allows.
     */
    const missing = promised
      .filter((path) => !path.endsWith('.d.ts'))
      .filter((path) => !existsSync(join(ROOT, path)));

    expect(missing, 'package.json offers a consumer these paths and they are not there').toEqual([]);
    expect(manifest.files, 'the build output is not in `files`, so npm would ship an empty package')
      .toContain('dist-lib');
  });

  test('⚠️ and it carries the words, the identity and the way in', () => {
    /**
     * `cartridge-contract.md` names what a cartridge exports: a slug, its dictionaries, the game-owned
     * half and the way to create an instance. A build that produced a module missing one of them would
     * satisfy every case above and be useless to a host.
     *
     * 📌 THE NAMES ARE READ OUT OF THE BUILT FILE rather than imported from source, which is the point of
     * a packaging gate: what a consumer gets is the OUTPUT, and a re-export that the bundler dropped is
     * invisible from inside this repository.
     */
    const entry = readdirSync(LIB).filter((name) => name.endsWith('.js'));
    const source = entry.map((name) => readFileSync(join(LIB, name), 'utf8')).join('\n');

    const exported = (source.match(/export\s*{([^}]*)}/g) ?? []).join(' ');
    for (const name of ['CARTRIDGE_SLUG', 'cartridgeDicts', 'delegatingCartridge', 'createPinball']) {
      expect(exported, `${name} is not exported from the built library`).toContain(name);
    }
  });
});
