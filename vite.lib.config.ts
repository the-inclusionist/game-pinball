// SPDX-License-Identifier: AGPL-3.0-or-later
// The SECOND build — the cartridge, for a host that installs it.
//
// ========================= WHY A SECOND CONFIG AND NOT A MODE FLAG =========================
// ⚠️ THE TWO BUILDS DISAGREE ABOUT THE MOST IMPORTANT THING, which is whether the engine is inside the
// output. The app build BUNDLES it, because `app/index.html` is a page that has to work on its own. This
// one leaves it OUT, because a platform already has one.
//
// A mode flag would put that disagreement inside a conditional, where the two answers look like a
// setting. They are not a setting: they are ADR-0140's two artefacts, and the reason each is right is
// different. Two files say so by existing.
//
// ========================= WHAT "EXTERNAL" BUYS, AND IT IS NOT SIZE =========================
// ⚠️ AN ENGINE BUNDLED INTO A CARTRIDGE IS A SECOND COPY OF ITS MODULE STATE. `core/state.modoCego`,
// `core/i18n`'s dictionary table and `core/rng`'s shared stream are all module-level, and two copies mean
// two blind-mode flags, two dictionary tables and two random streams on one page — with the host writing
// one and the cartridge reading the other.
//
// That is the engine's own user story failing from the inside: «I want the engine to carry no game
// state, so that two games on one page do not collide». Weight is the least of it; the collision would
// be unfixable, because the two halves would no longer be talking about the same module.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // The same root as the app build, for the same reason: what is PUBLISHABLE lives inside `app/`, so
  // scripts, tests and docs are out of reach by construction rather than by an exclusion rule.
  root: join(RAIZ, 'app'),
  build: {
    outDir: join(RAIZ, 'dist-lib'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: join(RAIZ, 'app', 'js', 'cartridge-entry.ts'),
      preserveEntrySignatures: 'strict',
      output: {
        format: 'es',
        entryFileNames: 'cartridge.js',
        /**
         * ⚠️ THE STYLESHEET GETS A STABLE NAME AND THE PICTURES DO NOT, and the asymmetry is the point.
         * `package.json`'s `exports` NAMES the stylesheet — a host writes `import
         * '@the-inclusionist/…/style.css'` — so a hash in it would be a path that changes every build and
         * an export that points at nothing. The pictures are referenced by the module itself, which is
         * rewritten with each build, so their hashes are free cache-busting.
         *
         * 🔴 This was wrong for one commit: `exports` said `cartridge-entry.css` while the build emitted
         * `cartridge-entry-CH-0eQyK.css`. `tests/the-cartridge-can-be-installed` resolves every path in
         * `exports` now, which is what found it.
         */
        assetFileNames: (info) => (info.names?.some((n) => n.endsWith('.css'))
          ? 'cartridge.css'
          : 'assets/[name]-[hash][extname]'),
      },
      /**
       * ⚠️ THE PATTERN MATCHES THE DEEP IMPORTS TOO, and that is not tidiness. This game imports
       * `@the-inclusionist/engine/core/i18n.js`, `/core/a11y-sr.js`, `/core/state.js`, `/core/rng.js` and
       * `/platform/audio.js` by path — the contract names those as "what stays a deep import", because
       * they hold no module state of their own. A bare-name external would leave every one of them
       * bundled, which is the defect this whole option exists to prevent, arriving through the door
       * nobody watched.
       */
      external: [/^@the-inclusionist\/engine(\/.*)?$/],
    },
  },
});
