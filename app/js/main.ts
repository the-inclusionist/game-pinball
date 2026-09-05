// SPDX-License-Identifier: AGPL-3.0-or-later
// main — the entry point, and the ONE file that touches the engine's runtime.
//
// ========================= IT ASSEMBLES, AND DECIDES AS LITTLE AS IT CAN =========================
// This file used to be excluded from `tsc`, because the engine published raw `.ts` and importing it
// dragged the engine's own source under this project's stricter settings. The engine now ships
// `dist-pkg/` with declarations, the exclusion is gone, and this file is type-checked like everything
// else.
//
// It stays small anyway. Every rule about how the game behaves lives in `shell/boot`, `table/*` and
// `gfx/*`, which are exercised in node; what is left here is wiring, and wiring is the part a browser
// has to prove.

import { createGame } from '@the-inclusionist/engine';
import { bootPinball, type Phase } from './shell/boot.js';
import { CATALOG, DEFAULT_TABLE, tableNamed } from './table/catalog.js';
import { toLiveTable, validateTable, type TableState } from './table/authored.js';
import { DEFAULT_CAMERA } from './shell/camera.js';
import { DEFAULT_HUD } from './shell/hud.js';
import { createFramebuffer } from './gfx/framebuffer.js';
import { drawTable, blitView, drawBall } from './gfx/table-view.js';
import { buildPhysics, drainedBy, launchSpeedFor, FRAME_SECONDS } from './table/physics-build.js';
import { advanceFrame } from './physics/step.js';
import { bindPinballControls } from './shell/controls.js';
import { createLiveControls } from './table/live-controls.js';

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

/* ===================== THE BALL ===================== */
//
// The physics is built from the table's declared geometry and stepped here. The ball object the
// physics owns is handed STRAIGHT to the declaration and the renderer — the same object, not a copy —
// which is the same "a view, never a snapshot" rule `shell/boot` follows, at one level down.

const physics = buildPhysics(authored);
const ball = physics.spawnBall();

let state: TableState = {
  balls: [ball],
  missionTextId: 'STRING151',
  missionHave: 0,
  missionNeed: 0,
  missionTargets: [],
};

/**
 * Launches from the plunger. Up the table, which is toward y = 0.
 *
 * ⚠️ THIS SAID 260, AND 260 IS THE NUMBER THE PLAYABILITY TEST WAS WRITTEN TO KILL. A ball at speed v
 * against gravity g rises v² / 2g: 260 against 120 is 282 pixels, enough for this table's 235 and 75
 * short of `narrow-tower`'s 420. `launchSpeedFor` was added for exactly that and the test used it — and
 * this line, the only launch a PLAYER ever performs, went on using the constant. The gate was green and
 * the game was broken, which is the worst arrangement of the two.
 */
function launch(): void {
  ball.active = true;
  ball.direction = { x: 0, y: -1 };
  ball.speed = launchSpeedFor(authored);
  phase = 'playing';
}

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
/**
 * ⚠️ THIS COMMENT USED TO SAY "what a control layer WOULD dispatch", and that was the whole defect.
 *
 * The control layer was ported in full in phases 4 and 5 and reached from nothing: the hits went into
 * this array and stopped there. No score, no lamp, in a game that had been playable for commits. The
 * list stays because a check needs to see what was touched; the dispatch below is the part that was
 * missing, and it is two lines.
 */
const hits: string[] = [];

const live = createLiveControls(authored, {
  showInfo: (text) => { hint = text; },
  showMission: (text) => { hint = text; },
});
let hint = '';
let frameCount = 0;
let ballsLost = 0;
let lastFrames = 0;
let previous = performance.now();
/**
 * ⚠️ ONE FRAME, CALLABLE. The loop below drives it, and so can a test.
 *
 * Splitting it out is not tidiness. A browser pauses `requestAnimationFrame` when its tab is not
 * compositing — which is exactly what a headless check does — and a game whose only way forward is
 * that callback cannot be verified at all: the first attempt to watch the ball move reported zero
 * frames in six hundred milliseconds, and the code was fine. A loop that can be stepped by hand is a
 * loop that can be proved.
 */
function step(frames: number): void {
  frameCount++;
  lastFrames = frames;

  // ⚠️ THE FLIPPERS MOVE WHETHER OR NOT A BALL IS IN PLAY, and this used to run only while playing.
  // A player pressing the button on the title screen got nothing back — no movement, no sound, no way
  // to find out what the controls are before committing a ball to them. Found by pressing a real key
  // in the browser and watching the angle stay at zero while the motion said `extending`.
  //
  // The BALL is what depends on the phase. `advanceFrame` takes an empty list and steps the flippers
  // alone, which is the same path a test uses.
  {
    // ⚠️ The physics wants TIME, not a frame count — see `FRAME_SECONDS`. The camera wants frames.
    // They are two different units in the same loop and mixing them is silent in both directions.
    advanceFrame(phase === 'playing' ? [ball] : [], physics.context, frames * FRAME_SECONDS);
    for (const hit of physics.takeHits()) {
      hits.push(hit.name);
      live.hit(hit.name);
    }
    live.advance(frames * FRAME_SECONDS);
  }

  if (phase === 'playing') {
    // The drain is a POSITION, not a collision — see `drainedBy`. Without this the ball leaves the
    // table and is simulated forever, which is what the first run did.
    const drained = drainedBy(authored, ball);
    if (drained) {
      hits.push(`drained:${drained}`);
      ballsLost++;
      const fresh = physics.spawnBall();
      ball.position = fresh.position;
      ball.direction = { x: 0, y: -1 };
      ball.speed = 0;
      phase = 'title';
    }

    shell.advance(frames);
  }

  blitView(screen, tablePicture, shell.hud.playfield, 0, shell.camera.offset);
  for (const ball of state.balls) {
    drawBall(screen, ball, authored.ballRadius, shell.hud.playfield, 0, shell.camera.offset);
  }
  // One `ImageData`, reused. Allocating one per frame would be sixty allocations a second of the
  // same 230 KB, and the copy is what the canvas wants anyway.
  image.data.set(screen.bytes);
  context.putImageData(image, 0, 0);
}

function frame(now: number): void {
  step(Math.min(4, (now - previous) / (1000 / 60)));
  previous = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/**
 * ⚠️ THE GAME HAD NO INPUT UNTIL THIS LINE, AND A THOUSAND TESTS WERE GREEN OVER IT.
 *
 * Bound to `#game-region` and not to `window`, so a table embedded in a page does not eat the reader's
 * arrow keys. See `shell/controls` for the rest, including why a held key is not a stream of presses.
 */
const unbindControls = bindPinballControls({
  region: document.getElementById('game-region')!,
  setFlipper: (side, extended) => physics.setFlippers(side, extended),
  launch: () => { if (!ball.active) launch(); },
});

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
    get ball() { return { x: ball.position.x, y: ball.position.y, speed: ball.speed, active: ball.active }; },
    /** What the ball has touched, and what the control layer made of it. */
    get hits() { return hits; },
    get score() { return live.score.curScore; },
    get lamps() { return live.litLamps(); },
    get hint() { return hint; },
    launch,
    /** Steps the game by hand, for a check that cannot rely on the browser compositing. */
    step,
    /** The flippers, so a check can confirm a key press reached them. */
    get flippers() {
      return physics.flippers.map((f) => ({ motion: f.motion, angle: f.currentAngle }));
    },
    setFlippers: (side: 'left' | 'right', extended: boolean) => physics.setFlippers(side, extended),
    unbindControls,
    get diag() { return { frameCount, lastFrames, phase, ballsLost, speed: ball.speed, y: ball.position.y }; },
    setState(next: Partial<TableState>) {
      state = { ...state, ...next };
      tablePicture = drawTable({ table: authored, missionTargets: state.missionTargets });
    },
  },
});

