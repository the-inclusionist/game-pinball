import { defineConfig } from 'vitest/config'; // not from 'vite': it is vitest/config that types the `test` field
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// WHY THE VITE ROOT IS `app/` AND NOT THE REPOSITORY
// The same reason as the tracer's: what is PUBLISHABLE lives inside `app/`, and everything else
// (scripts, tests, docs) is out of the server's reach BY CONSTRUCTION rather than by an exclusion
// rule someone has to remember to maintain.
//
// WHY ONLY THE `node` PROJECT FOR NOW
// Phases 1 to 5 of the plan are pure logic — the .DAT parser, maths, collision, the mission state
// machine. None of it touches the DOM. The `browser` project (Playwright) arrives in phase 2, along
// with the first pixel drawn, because a browser project configured before the thing it tests exists
// is a gate that never went red.
// ============================================================================
export default defineConfig({
  root: join(RAIZ, 'app'),
  build: { outDir: join(RAIZ, 'dist'), emptyOutDir: true },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['../tests/**/*.node.test.ts'], // relative to `root` (app/): tinyglobby's glob wants forward slashes, and join() returns backslashes on Windows
        },
      },
    ],
  },
});
