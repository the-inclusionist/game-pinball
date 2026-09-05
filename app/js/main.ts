// SPDX-License-Identifier: AGPL-3.0-or-later
// main — the entry point, and the ONE file that touches the engine's runtime.
//
// ========================= WHY THE BOUNDARY IS HERE AND NOT IN `shell/boot` =========================
// The engine publishes raw `.ts` through its exports map, so importing it puts its source into this
// repository's type-check — and this project is stricter than the engine is. It enables
// `noUncheckedIndexedAccess`; the engine does not, and sixty errors across seven engine files follow.
// None of them is a defect in the engine: they are the difference between two tsconfigs.
//
// So this file, and only this file, imports `createGame`, and `tsconfig.json` excludes it from `tsc`
// with the reason written beside the exclusion. `shell/boot` takes the factory as an argument, stays
// under the strict check, and keeps every rule about the game testable in node.
//
// ⚠️ THE COST, STATED: this file is compiled by Vite and not type-checked here. It is deliberately as
// small as a file can be for that reason — it assembles and hands over, and every decision it might
// otherwise have made lives in `shell/boot`, which IS checked and IS tested.

import { createGame } from '@the-inclusionist/engine';
import { bootPinball, type LiveTable, type Phase } from './shell/boot.js';

/**
 * Placeholder table. The real one arrives with the loader in the next step; what matters today is that
 * the shell, the declaration and the engine agree on a shape.
 */
const table: LiveTable = {
  playfieldWidth: 183,
  playfieldHeight: 235,
  ballRadius: 3,
  balls: [],
  components: [],
  missionTextId: 'STRING151',
  missionHave: 0,
  missionNeed: 0,
  missionTargets: [],
};

let phase: Phase = 'title';

const shell = bootPinball({
  locale: 'pt',
  table,
  // `cvdHost` is where the engine mounts its six colour-vision filters. Omitting it is not an error —
  // `createGame` reports it in `problems` instead of throwing — which is exactly how it went unnoticed
  // until the game was actually booted.
  host: { doc: document, win: window, cvdHost: document.getElementById('cvd-filters') },
  phase: () => phase,
}, createGame);

// What the host document failed to provide. Empty is the good case; the engine does not throw for it,
// so somebody has to look.
if (shell.problems.length) {
  console.warn('[pinball] host markup incomplete:', shell.problems.join(', '));
}

// `update(dt)` counts FRAMES, not seconds — see `shell/boot`. The engine hands the count through and
// the camera's damping is per frame, so this passes it on untouched.
let previous = performance.now();
function frame(now: number): void {
  const frames = Math.min(4, (now - previous) / (1000 / 60));
  previous = now;
  if (phase === 'playing') shell.advance(frames);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed so the browser gate can confirm a real boot rather than a screenshot.
Object.assign(window as unknown as Record<string, unknown>, {
  __pinball: {
    get camera() { return shell.camera; },
    get problems() { return shell.problems; },
    hud: shell.hud,
    declaration: shell.declaration,
    setPhase(next: Phase) { phase = next; },
  },
});
