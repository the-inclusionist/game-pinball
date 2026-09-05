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
import { bootPinball, type Phase } from './shell/boot.js';
import { CATALOG, DEFAULT_TABLE, tableNamed } from './table/catalog.js';
import { toLiveTable, validateTable, type TableState } from './table/authored.js';
import { DEFAULT_CAMERA } from './shell/camera.js';
import { DEFAULT_HUD } from './shell/hud.js';
import { createFramebuffer } from './gfx/framebuffer.js';
import { drawTable, blitView, drawBall } from './gfx/table-view.js';

// `?table=wide-arc` opens another one of the five. There is no menu yet, and a query parameter is
// enough to look at all of them without one.
const requested = new URLSearchParams(location.search).get('table');
const authored = (requested && tableNamed(requested)) || DEFAULT_TABLE;

// A table that does not validate must not open. The rules are in `table/authored` and every one of
// them is there because this port hit the failure it prevents.
const tableProblems = validateTable(authored, { viewHeight: DEFAULT_CAMERA.viewHeight });
if (tableProblems.length) {
  throw new Error(`[pinball] table "${authored.name}" cannot open:\n  ${tableProblems.join('\n  ')}`);
}

let state: TableState = {
  balls: [],
  missionTextId: 'STRING151',
  missionHave: 0,
  missionNeed: 0,
  missionTargets: [],
};

const table = toLiveTable(authored, () => state);

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

/* ===================== THE PICTURE ===================== */
//
// The screen is a 320x180 framebuffer put on a canvas with nearest-neighbour scaling. The TABLE is
// drawn once, at its own size, and the camera copies a window of it every frame — see `gfx/table-view`
// for why that is a window rather than a transform.

const screen = createFramebuffer(DEFAULT_HUD.screenWidth, DEFAULT_HUD.screenHeight);
const canvas = document.createElement('canvas');
canvas.width = screen.width;
canvas.height = screen.height;
canvas.style.width = '100%';
canvas.style.imageRendering = 'pixelated';
document.getElementById('game-region')!.appendChild(canvas);
const context = canvas.getContext('2d')!;
const image = context.createImageData(screen.width, screen.height);

// Redrawn only when what it shows changes, which today is when the mission's targets change.
let tablePicture = drawTable({ table: authored, missionTargets: state.missionTargets });

// `update(dt)` counts FRAMES, not seconds — see `shell/boot`. The engine hands the count through and
// the camera's damping is per frame, so this passes it on untouched.
let previous = performance.now();
function frame(now: number): void {
  const frames = Math.min(4, (now - previous) / (1000 / 60));
  previous = now;
  if (phase === 'playing') shell.advance(frames);

  blitView(screen, tablePicture, shell.hud.playfield, 0, shell.camera.offset);
  for (const ball of state.balls) {
    drawBall(screen, ball, authored.ballRadius, shell.hud.playfield, 0, shell.camera.offset);
  }
  // One `ImageData`, reused. Allocating one per frame would be sixty allocations a second of the
  // same 230 KB, and the copy is what the canvas wants anyway.
  image.data.set(screen.bytes);
  context.putImageData(image, 0, 0);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed so the browser gate can confirm a real boot rather than a screenshot.
Object.assign(window as unknown as Record<string, unknown>, {
  __pinball: {
    get camera() { return shell.camera; },
    get problems() { return shell.problems; },
    hud: shell.hud,
    table: authored.name,
    tables: CATALOG.map((t) => t.name),
    declaration: shell.declaration,
    setPhase(next: Phase) { phase = next; },
    /** Exposed so the browser gate can look at the pixels rather than at a screenshot. */
    get screen() { return screen; },
    get picture() { return tablePicture; },
    setState(next: Partial<TableState>) {
      state = { ...state, ...next };
      tablePicture = drawTable({ table: authored, missionTargets: state.missionTargets });
    },
  },
});

