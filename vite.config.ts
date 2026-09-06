import { defineConfig } from 'vitest/config'; // not from 'vite': it is vitest/config that types the `test` field
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = dirname(fileURLToPath(import.meta.url));

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
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['../tests/**/*.node.test.ts'], // relative to `root` (app/): tinyglobby's glob wants forward slashes, and join() returns backslashes on Windows
        },
      },
      {
        root: join(RAIZ, 'app'),
        test: {
          name: 'browser',
          include: ['../tests/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            // ⚠️ HEADLESS, because this runs in a sandbox with no display and in CI with no person. A
            // window that needs somebody to look at it is a gate that hangs rather than fails.
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
