// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE COMES FROM THE REGISTRY, AND THIS IS WHAT SAYS SO.
//
// ⚠️ IT USED TO COME FROM A PATH. `"@the-inclusionist/engine": "file:../SP-the-inclusionist-tracer"`
// installs a SYMLINK into the engine's own working tree, and for the first eight phases of this port
// that was the only way to have it at all — it was not published yet. The Dev published it, this
// repository moved to `^6.36.1`, and on 2026-09-11 to `^8.0.0` — which is the whole point of the move:
// an upgrade is a deliberate act with a version number attached.
//
// ========================= WHY THAT IS WORTH A GATE =========================
// A `file:` link is not a weaker version of a dependency. It is a different thing, and three of its
// differences cost this project real time on the day it was removed:
//
//   · ⚠️ IT HIDES MISSING DEPENDENCIES. The engine's `platform/tts` reached for
//     `@mintplex-labs/piper-tts-web`, which the published package did not declare. Through the
//     symlink it resolved anyway, out of the ENGINE's own `node_modules`, by accident of layout. The
//     first build against the registry failed, and the defect had been there the whole time, invisible
//     precisely because the link made it so.
//
//     📌 FIXED UPSTREAM IN ENGINE 8, AND THAT IS WHAT THIS GATE IS FOR. ADR-0094 (engine) moved the
//     naming of the provider to the GAME, so the package appears in the engine only in prose; the stub
//     this repository aliased it to is deleted, and what replaced it is one declared line
//     (`declines.semVozNeural`). A defect only an outside consumer could see, reported and then gone.
//   · IT HAS NO VERSION AND NO INTEGRITY HASH. `package-lock.json` records `"link": true` and nothing
//     else, so nothing pins WHICH engine this game was tested against, and a clone on another machine
//     gets whatever that path happens to contain — or fails, if it contains nothing.
//   · IT MAKES ANOTHER REPOSITORY'S WORKING TREE A BUILD INPUT. Two sessions share that tree. A commit
//     there landed in this game's build with no version change and no way to say afterwards which one.
//
// So this is not a style rule. Every one of those is a way for a green test run to have proved nothing.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>;
};
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
  packages: Record<string, { resolved?: string; integrity?: string; link?: boolean }>;
};

const NAME = '@the-inclusionist/engine';

describe('the engine dependency', () => {
  test('⚠️ is a registry range, not a path', () => {
    const spec = manifest.dependencies[NAME];

    // `file:`, `link:`, `../`, `/` and `C:\` are all the same mistake wearing different syntax.
    expect(spec, `${NAME} is declared`).toBeDefined();
    expect(spec, `${NAME} = ${spec} points at a filesystem path`)
      .not.toMatch(/^(file:|link:|portal:|\.{0,2}\/|[A-Za-z]:)/);
  });

  test('⚠️ and the lockfile pins a tarball with an integrity hash', () => {
    // The declaration above can be a range and still resolve to a link if the lockfile was not
    // re-resolved — which is exactly what happened here: editing `package.json` and running
    // `npm install` left the symlink in place and `"link": true` in the lock, because npm saw a
    // satisfying tree and did nothing. It took `npm uninstall` first. A gate reading only the
    // manifest would have passed that state.
    const entry = lock.packages[`node_modules/${NAME}`];

    expect(entry, `${NAME} is in the lockfile`).toBeDefined();
    expect(entry!.link, `${NAME} is linked rather than installed`).toBeUndefined();
    expect(entry!.resolved ?? '', `${NAME} resolves to a registry tarball`)
      .toMatch(/^https:\/\/registry\.npmjs\.org\//);
    expect(entry!.integrity ?? '', `${NAME} carries an integrity hash`).toMatch(/^sha\d+-/);
  });
});
