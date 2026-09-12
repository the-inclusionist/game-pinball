import { defineConfig } from 'vitest/config'; // not from 'vite': it is vitest/config that types the `test` field
import { playwright } from '@vitest/browser-playwright';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = dirname(fileURLToPath(import.meta.url));

/*
 * ⚠️ THE PIPER ALIAS LIVED HERE UNTIL ENGINE 8.0.0, AND ITS ABSENCE IS THE NEWS. `6.36.1` named
 * `@mintplex-labs/piper-tts-web` in a dynamic `import(...)` of its own and did not declare the package,
 * so every consumer installing from the registry failed to build; this file aliased the specifier to a
 * stub that threw, twice over, because a Vite project does not inherit `resolve` from the config around
 * it. ADR-0094 moved the naming to the GAME (`carregarVozNeural`) and the engine now mentions the
 * package only in prose — measured in the 8.0.0 tree before these lines were deleted. A game that does
 * not open that door says so in one field instead: `declines.semVozNeural`, in `shell/boot`.
 */

// ============================================================================
// WHY THE VITE ROOT IS `app/` AND NOT THE REPOSITORY
// The same reason as the tracer's: what is PUBLISHABLE lives inside `app/`, and everything else
// (scripts, tests, docs) is out of the server's reach BY CONSTRUCTION rather than by an exclusion
// rule someone has to remember to maintain.
//
// THE TWO PROJECTS, AND WHY THE SECOND ONE ARRIVED LATE
// `node` is pure logic — the .DAT parser, maths, collision, the mission state machine, and every
// decision this port could pull out of an event handler on purpose so that it could be tested without
// a browser. That deliberate split is why there are seventeen hundred node tests and why they are
// worth having.
//
// ⚠️ AND IT IS ALSO WHY THIS PROJECT WAS OWED. The plan's verification section asks for `vitest run
// (node + browser)`; the comment that stood here promised the browser half "in phase 2, along with the
// first pixel drawn", on the sound argument that a gate configured before the thing it tests is a gate
// that never went red. Phase 2 passed. Eight phases of pixels were drawn. Nothing was ever run in a
// browser, and the cost showed up twice in one session: a menu registered with the engine's Escape
// chain that Escape did not close, and a highlight that widened every wall — both found by hand, in a
// preview, because no automated thing could see them.
//
// What belongs here is what a node test CANNOT make: real layout, real focus, real key events, real
// canvas. Everything else stays in `node`, where it is faster and where a failure names one function.
// ============================================================================
export default defineConfig({
  root: join(RAIZ, 'app'),
  build: { outDir: join(RAIZ, 'dist'), emptyOutDir: true },
  plugins: [
    /**
     * ========================= THE STANDALONE HALF OF ADR-0140 BECOMES A PWA =========================
     * ⚠️ IT IS FOR THE CHILD WHO ARRIVES ON THE SECOND DAY WITHOUT A NETWORK. That is the engine's own
     * reasoning for its heavy precache (ADR-0110 (b), ADR-0116, ADR-0119) and it is the whole reason
     * here too: a school machine, a connection that comes and goes, and a game that either opens or
     * does not. Everything this game needs to run is its own bundle, its eleven playfields, two screens
     * and two fonts — no CDN, no origin but this one.
     *
     * 📌 AND ONLY THE APP BUILD GETS ONE. A cartridge does not: ADR-0117 puts the service worker on the
     * SITE, once per origin, and six cartridges each registering one would be six scopes fighting over
     * the same paths. `vite.lib.config.ts` has no plugins for exactly that reason.
     */
    VitePWA({
      /**
       * ⚠️ `prompt` AND NOT `autoUpdate`, AND THE DIFFERENCE IS A BALL IN PLAY. `autoUpdate` claims the
       * page as soon as a new worker installs — which, mid-game, takes the table away from a child who
       * was two comets from winning. `prompt` leaves the new version waiting and it applies on the next
       * visit, which for a game is the only honest moment.
       *
       * 📌 No prompt UI is shipped with it, deliberately: an update notice is a screen this game would
       * have to make navigable, translate into three languages and fit inside 320×180. Until that is
       * designed, waiting silently and applying next time is better than a button nobody can reach.
       */
      registerType: 'prompt',
      workbox: {
        /**
         * ⚠️ THE PICTURES ARE IN THE LIST, which is most of the bytes and the point. A precache that
         * held only the JavaScript would leave a child offline with a game that boots and cannot draw a
         * table — which is worse than not opening, because it looks like the game is broken.
         */
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        /**
         * 📌 The playfields are large and there are eleven of them. The default cap is 2 MiB per FILE
         * and none of ours approaches it; this raises the ceiling only so that a future authored table
         * with a bigger picture fails loudly at build time rather than being silently dropped from the
         * precache and going missing offline.
         */
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'Space Cadet Pinball',
        short_name: 'Pinball',
        description: 'Space Cadet pinball, rebuilt to be played by children who cannot see it.',
        lang: 'pt-BR',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        /**
         * 📌 THE COLOURS ARE THE GAME'S OWN FRAME, not a theme chosen here: `#000` is what the page
         * sits on while the 320×180 framebuffer is centred in it, so an installed window that paints
         * anything else would flash a colour the game never shows.
         */
        background_color: '#000000',
        theme_color: '#000000',
        /**
         * 🔴 NO ICONS, AND THAT IS A DEBT RATHER THAN AN OVERSIGHT — WITH THE SPECIFICATION ATTACHED.
         *
         * A browser will not offer to INSTALL a PWA without an icon of at least 192×192, so what ships
         * today is the offline half: the game caches and runs with no network, and does not appear as an
         * installable app. The half that works is the half that matters most on a school machine.
         *
         * ⚠️ THE ART IS THE DEV'S AND THIS DOES NOT INVENT IT. What is owed to him is the brief, and
         * this is it:
         *   · `app/public/icon-192.png` — 192×192, square, opaque, the wordmark or the ball
         *   · `app/public/icon-512.png` — 512×512, same artwork
         *   · `app/public/icon-maskable-512.png` — 512×512 with the artwork inside the central 80%, so
         *     Android's circular and squircle masks do not cut it
         * The day they land, they go in this array and the game becomes installable in one line.
         */
      },
    }),
  ],
  test: {
    /**
     * ⚠️ RANDOM ORDER, EVERY RUN, AND IT FOUND SOMETHING THE HOUR IT WAS TURNED ON.
     *
     * A test that only passes when it runs before its neighbours is green until the day something
     * reorders it, and nothing here had ever reordered anything: `tests/accessibility.browser.test.ts`
     * asserted that blind mode "starts off" by reading the live state, which is true only while that
     * test runs before the two others that press the same key. Shuffled, it failed two runs in five.
     * It had been committed green.
     *
     * THE TRADE, STATED: a real order dependence now surfaces as an INTERMITTENT failure rather than
     * never surfacing at all. Intermittent is harder to read than deterministic — but the alternative
     * is not "deterministic", it is "silent", and this repository has spent enough nights on silent.
     *
     * A failure prints its seed. `npx vitest run --sequence.seed=<n>` replays that exact order, which
     * is what makes an intermittent failure a reproducible one.
     */
    sequence: { shuffle: { files: true, tests: true } },
    /**
     * ⚠️ THE TWO PROJECTS RUN ONE AFTER THE OTHER, AND THAT IS A FLAKE FIX RATHER THAN HOUSEKEEPING.
     *
     * By default Vitest starts every project at once. The node project spawns a worker per core and
     * the browser project drives two real engines, so the machine is asked for about twice what it
     * has — and the half that suffers is the browser, because a `userEvent` click is a round trip to a
     * driver that is being starved. Reproduced on purpose by running a second `vitest run --project
     * node` beside the suite: `shell-high-score-dialog` failed after 20.8 SECONDS on a locator whose
     * budget is five, with the element resolved and visible the whole time.
     *
     * Five tests were seen failing that way across a day — `perf-frame-budget`, `table-secret`,
     * `audio-midi-end-to-end`, `licence-note` and `shell-keymap-dialog` — and every one of them passed
     * alone and passed at the same seed when only its own project ran. Not one was an order
     * dependence, which is what the shuffle above is for and which stays exactly as it was.
     *
     * ⚠️ AND THE ALTERNATIVE WAS WORSE. Raising the timeouts would have turned "the machine was busy"
     * into "the machine was busy for longer", and it would have raised them on the assertions where
     * time IS the subject — `perf-frame-budget` measures a frame against sixteen milliseconds, and a
     * budget that grows to fit whatever the machine is doing is not a budget.
     *
     * `groupOrder` is Vitest's own answer: projects sharing a number run together, and a lower number
     * runs first. Node first because it is the larger half and needs no display.
     */
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          sequence: { groupOrder: 0 },
          include: ['../tests/**/*.node.test.ts'], // relative to `root` (app/): tinyglobby's glob wants forward slashes, and join() returns backslashes on Windows
        },
      },
      {
        root: join(RAIZ, 'app'),
        test: {
          name: 'browser',
          // ⚠️ AFTER THE NODE PROJECT — see `groupOrder` above. Two real engines cannot share a machine
          // with a worker per core and still answer a click inside five seconds.
          sequence: { groupOrder: 1 },
          /**
           * ⚠️ AND FEWER PAGES AT ONCE, WHICH IS THE OTHER HALF OF THE SAME PROBLEM. Running after the
           * node project stops the two halves fighting; this stops the browser project fighting
           * ITSELF. By default Vitest opens about a worker per core, and every one of them here is a
           * real browser page — TWICE, because the matrix is Chromium and Firefox. A `userEvent` click
           * is a round trip to a driver, and a starved driver answers it late or not at all: measured
           * at 20.8 seconds against a five-second budget, with the element resolved and visible the
           * whole time.
           *
           * The number is not tuning for this machine. It is "as many pages as there are engines",
           * which is the least that keeps both engines busy and the most that cannot oversubscribe by
           * construction.
           */
          maxWorkers: 2,
          include: ['../tests/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            // ⚠️ HEADLESS, because this runs in a sandbox with no display and in CI with no person. A
            // window that needs somebody to look at it is a gate that hangs rather than fails.
            headless: true,
            /**
             * ⚠️ TWO ENGINES, BECAUSE ONE OF THEM HID A DEFECT FOR FOUR REPORTS. The Dev: "Pausa
             * ainda não funciona fora daqui, testei no Brave e no Firefox." The cause was a pointer
             * rule that left the focus alone for anything inside the game — including the CANVAS,
             * which is not focusable — so clicking the game left the keyboard dead. It never showed
             * here because CHROMIUM had already put the focus on the region at load, which is not
             * something a page may rely on and which Gecko does not do.
             *
             * A suite that runs one engine is a suite that tests one engine's defaults. This game is
             * for school machines, where the browser is whatever is installed.
             */
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
});
