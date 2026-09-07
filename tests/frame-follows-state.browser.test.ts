// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT THE SIMULATION HOLDS AND WHAT THE PLAYER SEES, COMPARED.
//
// ⚠️ THIS IS THE GAP TWO PLAYER-VISIBLE DEFECTS CAME THROUGH, both found by the Dev playing rather
// than by anything here:
//
//   · THE FLIPPERS. They swing in the physics — `tests/table-playable` proves it on every table — and
//     they were stroked into a composition made once per change, so the paddle moved and the picture
//     showed it at rest for ever. Every render gate asked about the composed table, and the flippers
//     were correctly in it. Every physics gate asked what the ball does, and the ball answered.
//   · THE LAMPS. Lit constantly by the control layer, read by `table/objective` to decide what is
//     finished, and drawn nowhere at all.
//
// Both are the same shape: state that changes with nothing drawing it. No test in this repository
// spanned the two halves, so a correct simulation and a correct-looking picture could disagree for
// ever without a single assertion moving.
//
// ⚠️ AND THE INVENTORY TEST THAT WENT WITH THE LAMP FIX IS NOT THIS. It reads `main.ts` as text and
// requires the lit set to be passed to `drawTable`; it cannot tell whether anything reached the
// canvas. This reads the CANVAS.
//
// ⚠️ WHAT IT DELIBERATELY DOES NOT DO is assert what the frame looks like. A picture cannot be
// asserted into correctness, and a hash would fail for every legitimate change while saying nothing
// about any of them. It asserts that the frame FOLLOWS: change one thing in the simulation and the
// pixels must differ. That is exactly the property both defects broke, and nothing more.
import { describe, test, expect, beforeAll } from 'vitest';

interface PinballDebug {
  problems: readonly string[];
  /** Puts the view back where a new game starts. See `main`, where it says why this exists. */
  resetView(): void;
  ball: { x: number; y: number; speed: number; active: boolean };
  screen: { width: number; height: number };
  setPhase(next: string): void;
  /** Added for this test: the live paddle geometry, and where the window sits. */
  flippers: readonly { pivot: { x: number; y: number }; tip: { x: number; y: number } }[];
  playfieldX: number;
  cameraY: number;
  /** Which phase the game is in. Added for the pause tests. */
  phase: string;
  /** How far the plunger is drawn back, 0 to 1. Added for the charge test at the foot of this file. */
  plungerPull: number;
}

const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;
const region = (): HTMLElement => document.getElementById('game-region')!;

/** The composed frame, as the player has it. */
function frame(): Uint8ClampedArray {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-region canvas')!;
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
}

/**
 * Pixels that differ INSIDE one rectangle of the screen.
 *
 * ⚠️ THE FIRST VERSION OF THIS FILE COMPARED THE WHOLE FRAME, AND WAS WORTHLESS. Restoring the exact
 * defect it was written for — deleting the live flipper draw, so paddles are stroked into the static
 * composition at their resting angle again — left all five tests PASSING. Any difference anywhere
 * satisfied "the picture changed", and the ball is always moving, so the assertion was about the ball
 * every time.
 *
 * A gate for "did THIS thing get drawn" has to look where that thing is.
 */
const differingIn = (a: Uint8ClampedArray, b: Uint8ClampedArray, box: Box): number => {
  const width = 320;
  let n = 0;
  for (let y = box.top; y < box.bottom; y++) {
    for (let x = box.left; x < box.right; x++) {
      const i = (y * width + x) * 4;
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
    }
  }
  return n;
};

interface Box { left: number; right: number; top: number; bottom: number; }

/**
 * Where a flipper is on the SCREEN, from the table's own geometry and the camera.
 *
 * The playfield window is inset by `hud.playfield.x`, and the camera's vertical offset is subtracted —
 * the same arithmetic `drawFlipper` does, which is a link this test shares with the code and cannot
 * avoid: the alternative is hunting the paddle by colour, which finds the guides as well.
 */
function flipperBox(side: 'left' | 'right'): Box {
  const d = debug();
  const f = d.flippers[side === 'left' ? 0 : 1]!;
  /**
   * ⚠️ THE WHOLE SWING, NOT WHERE THE PADDLE IS NOW.
   *
   * The first version measured the current geometry, so the box moved with the paddle — and a test
   * that raised the flipper, took the box, then lowered it, was looking at where the paddle had BEEN.
   * It reported no change and passed by accident in one direction and failed in the other.
   *
   * A paddle sweeps an arc around its pivot with a radius of its own length, so the box is that arc's
   * bounding square. It is generous on purpose: this asks "did anything about the paddle change", and
   * a box too tight answers about part of one.
   */
  const reach = Math.hypot(f.tip.x - f.pivot.x, f.tip.y - f.pivot.y) + 4;
  /**
   * ⚠️ AND THE BOX MAY NOT BE A SLIVER, which is the shape the flake wore.
   *
   * The clamps below keep the box on the screen, and when the view is scrolled they keep almost
   * nothing: the failing run measured fourteen rows of a twenty-eight-row arc, and the part still
   * showing did not change when the paddle moved. Zero differing pixels, and every assertion built on
   * this box then answered a question about a strip of background.
   *
   * `stopTheWorld` puts the view back, so this cannot happen — and this is what says so if it ever
   * does again, loudly and in the right place, instead of as "the paddle did not come down".
   */
  const visible = Math.min(180, Math.round(f.pivot.y - d.cameraY + reach))
    - Math.max(0, Math.round(f.pivot.y - d.cameraY - reach));
  expect(visible, `only ${visible} rows of the ${side} paddle's ${Math.round(reach * 2)} are on screen`
    + ` — the view is scrolled to ${d.cameraY}`).toBeGreaterThan(reach);

  return {
    left: Math.max(0, Math.round(d.playfieldX + f.pivot.x - reach)),
    right: Math.min(320, Math.round(d.playfieldX + f.pivot.x + reach)),
    top: Math.max(0, Math.round(f.pivot.y - d.cameraY - reach)),
    bottom: Math.min(180, Math.round(f.pivot.y - d.cameraY + reach)),
  };
}

/** Where the ball is on the screen, so a paddle's test can prove it is not measuring the ball. */
function ballOnScreen(): { x: number; y: number } {
  const d = debug();
  return { x: d.playfieldX + d.ball.x, y: d.ball.y - d.cameraY };
}

const inside = (p: { x: number; y: number }, box: Box): boolean =>
  p.x >= box.left && p.x < box.right && p.y >= box.top && p.y < box.bottom;

/**
 * ⚠️ EVERY TEST STARTS FROM KEYS UP, because this suite runs in a RANDOM ORDER.
 *
 * `sequence.shuffle` is on for exactly the reason it caught a flaky test the hour it was turned on. A
 * test here that left a flipper held would hand the next one a paddle already raised — and the first
 * draft of this file did precisely that, which is why one of its assertions found no change at all.
 */
async function allKeysUp(): Promise<void> {
  key('KeyA', 'keyup');
  key('KeyD', 'keyup');
  await frames(24);
}

/**
 * ⚠️ AND THE WORLD IS STOPPED FIRST, so the only thing that can change is the paddle.
 *
 * The frame loop steps the ball only while the phase is `playing`. Leaving it running made this suite
 * FLAKY under the random order: whenever the ball test ran first it left a live ball loose, and a ball
 * crossing a paddle's box is 578 pixels of difference that the paddle did not make. Measured, on the
 * third run.
 *
 * Flippers are stepped whatever the phase — which is why the paddle still answers here — so stopping
 * the world removes the ball and nothing else.
 */
async function stopTheWorld(): Promise<void> {
  debug().setPhase('title');
  /**
   * ⚠️ AND THE VIEW GOES BACK TO THE TOP, WHICH IS THE FLAKE THIS SUITE HAD.
   *
   * `setPhase('title')` freezes the ball — the loop steps it only while playing — and leaves the
   * CAMERA wherever the last ball dragged it, because `setPhase` is not `leaveGame`. With the view
   * scrolled the flippers sit partly below the visible window, and `flipperBox` clamps to the screen:
   * the failing run measured the left paddle's box as FOURTEEN ROWS of a twenty-eight-row arc, and
   * the sliver still showing did not change when the paddle moved. Zero differing pixels, read as
   * "the paddle did not come down".
   *
   * It failed about twice in fifty full runs and passed every time on its own, which is what an order
   * dependence looks like and is exactly what this was: whichever test ran before decided where the
   * ball — and therefore the camera — had been left. Reproduced at `--sequence.seed=24`.
   */
  debug().resetView();
  await allKeysUp();
}

/**
 * Everything about the running game that could make a paddle assertion fail for a reason that is not
 * the paddle. Put into the MESSAGE of the assertions below rather than asserted.
 *
 * ⚠️ THIS IS HERE BECAUSE THESE TWO TESTS FAILED UNDER SHUFFLE AND COULD NOT BE REPRODUCED. About one
 * run in four of the whole browser suite, on `raising a FLIPPER` and `the OTHER paddle moves
 * independently`; every time on their own, and every time paired with the file most likely to disturb
 * them. Eighteen consecutive clean runs later there was still nothing to look at — a seed and a
 * count, and no state.
 *
 * The failure prints a seed and `--sequence.seed=<n>` replays the order, which is the repository's
 * existing answer and was not enough here: what the seed could not say is what the GAME was doing.
 * Guessing at a fix for something that cannot be reproduced would be adding unverified changes to
 * working code, so this adds evidence instead: the next occurrence names the phase, the camera and
 * the ball, and one of those is either the cause or eliminates itself.
 */
/**
 * ⚠️ WHAT HAS BEEN ELIMINATED ABOUT THE FLAKE, so nobody walks it twice.
 *
 * `raising a FLIPPER` and `the OTHER paddle moves independently` have failed about twice in fifty
 * shuffled runs of the whole browser suite, and pass every time on their own and every time paired
 * with the files most likely to disturb them. Two readings of the code, both plausible, both wrong:
 *
 *   · ⚠️ "A PADDLE LEFT RAISED BY THE PREVIOUS TEST." It would produce exactly this: `before` is
 *     already the raised picture, the key changes nothing, and the count of differing pixels is
 *     nought. And `stopTheWorld` sets the phase to `title` BEFORE releasing the keys, so the 24
 *     frames of `allKeysUp` looked like frames in which nothing could move. They are not: `main`'s
 *     step passes `phase === 'playing' ? [ball] : []` to `advanceFrame`, so the BALL is what depends
 *     on the phase and the flippers are stepped either way — deliberately, and its comment says so.
 *     The paddles do fall.
 *   · "TOO FEW FRAMES UNDER LOAD." `frames` is a count of animation callbacks and the simulation
 *     advances by elapsed TIME, so a busy machine takes MORE game frames per callback, not fewer.
 *
 * What is left is genuinely unknown, which is why `running()` below exists rather than a fix.
 */
function running(): string {
  const d = debug();
  const ball = d.ball;
  return `phase=${d.phase} cameraY=${d.cameraY.toFixed(1)} playfieldX=${d.playfieldX.toFixed(1)} `
    + `ball=(${ball.x.toFixed(1)},${ball.y.toFixed(1)}) active=${ball.active} speed=${ball.speed.toFixed(2)}`;
}

/** Waits for the game's own animation frames rather than a timer, so this follows the real loop. */
const frames = (n: number): Promise<void> => new Promise((resolve) => {
  let left = n;
  const tick = (): void => { if (--left <= 0) resolve(); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

const key = (code: string, type: 'keydown' | 'keyup'): void => {
  region().dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
};

beforeAll(async () => {
  document.body.innerHTML = `
    <main id="game-region" tabindex="-1"></main>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd-filters" width="0" height="0" aria-hidden="true" focusable="false"></svg>
  `;
  await import('../app/js/main.js');
  /**
   * ⚠️ INTO A GAME THE WAY A PLAYER GETS INTO ONE, which this file used not to do: it booted `main`
   * and pressed game keys with the TITLE SCREEN still covering the table. That worked for as long as
   * nothing but `phase` decided what a key meant, and stopped the day pause learned to ask whether
   * there is a table on the screen at all — because there was not one, and the refusal was right.
   *
   * A test that drives the game from a state a player cannot be in is a test measuring something the
   * product does not do.
   */
  document.querySelector<HTMLElement>('.pinball-title button')?.click();
  await frames(4);
  document.querySelector<HTMLElement>('[data-table]')?.click();
  await frames(5);
  region().focus();
  await frames(4);
});

describe('the frame follows the simulation', () => {
  test('⚠️ raising a FLIPPER changes what is on screen', async () => {
    // The defect, exactly. Before the fix the paddle swung and this comparison found nothing: the
    // flipper was in the static composition at its resting angle, and the static composition is not
    // redrawn per frame.
    await stopTheWorld();
    const box = flipperBox('left');
    const before = frame();

    // ⚠️ AND THE BALL IS NOT IN THAT BOX, or this is the ball's test wearing the paddle's name.
    expect(inside(ballOnScreen(), box), 'the ball is elsewhere on the table').toBe(false);

    key('KeyA', 'keydown');
    await frames(6);

    expect(differingIn(before, frame(), box),
      `the left paddle is drawn where it now is — ${running()} box=${JSON.stringify(box)}`)
      .toBeGreaterThan(0);
    await allKeysUp();
  });

  test('and lowering it changes the screen back', async () => {
    await stopTheWorld();
    const box = flipperBox('left');
    key('KeyA', 'keydown');
    await frames(6);
    const raised = frame();

    await allKeysUp();

    expect(differingIn(raised, frame(), box), `the paddle came down again — ${running()}`)
      .toBeGreaterThan(0);
  });

  test('⚠️ and the OTHER paddle moves independently, or one key drives both', async () => {
    // Two flippers is two chances to wire one of them to nothing — `four-flippers` exists in the
    // catalogue because this port already assumed there was one pair.
    await stopTheWorld();
    const box = flipperBox('right');
    const leftBox = flipperBox('left');
    const before = frame();

    key('KeyD', 'keydown');
    await frames(6);
    const rightUp = frame();

    expect(differingIn(before, rightUp, box), `the right paddle moved — ${running()}`)
      .toBeGreaterThan(0);
    // ⚠️ AND THE LEFT ONE DID NOT, or one key drives both. `four-flippers` exists in the catalogue
    // because this port already assumed there was a single pair.
    expect(differingIn(before, rightUp, leftBox), 'the left paddle stayed where it was').toBe(0);
    await allKeysUp();
  });

  test('⚠️ a moving BALL moves on screen, which is the oldest link of the three', async () => {
    await allKeysUp();
    key('KeyU', 'keydown');
    key('KeyU', 'keyup');
    await frames(2);
    const justLaunched = frame();
    const wasAt = debug().ball.y;

    await frames(10);

    expect(debug().ball.y, 'the physics moved it').not.toBe(wasAt);
    expect(differingIn(justLaunched, frame(), { left: 0, right: 320, top: 0, bottom: 180 }),
      'and so did the picture').toBeGreaterThan(0);
  });

  /**
   * ⚠️ THE PLUNGER CHARGES IN A REAL FRAME LOOP, AND THAT IS THE HALF NO UNIT TEST REACHES.
   *
   * `shell/plunger` is a model with its own tests, and it was correct on the day it was written while
   * the game still launched every ball at the minimum: the line that advances it — `plunger.advance`
   * — sat inside `if (phase === 'playing')`, the one phase where a plunger can do nothing. The model
   * was right, the wiring was right, and neither of them ran.
   *
   * So the claim has to be made where the frames are real. This is also the reason it is not checked
   * in the Browser pane by hand: `requestAnimationFrame` is frozen there while the pane is not on
   * screen, and three manual probes were void before that was understood. Here the frames tick.
   */
  test('⚠️ holding the plunger launches HARDER than tapping it', async () => {
    await stopTheWorld();
    key('KeyU', 'keydown');
    key('KeyU', 'keyup');
    await frames(2);
    const tapped = debug().ball.speed;

    await stopTheWorld();
    key('KeyU', 'keydown');
    // A second of real frames on the key, which is 40% of a full draw.
    await frames(60);
    const drawn = debug().plungerPull;
    key('KeyU', 'keyup');
    await frames(2);
    const held = debug().ball.speed;

    expect(drawn, 'the plunger drew back while the key was down').toBeGreaterThan(0.2);
    expect(held, `tapped launched at ${tapped.toFixed(0)}`).toBeGreaterThan(tapped * 1.2);
  });

  /**
   * ⚠️ THE DEV, PLAYING: "botão enter/H não está pausando." Measured here rather than reasoned about,
   * because the pause key has two possible owners — this game binds `Enter` in `DEFAULT_BINDINGS` and
   * the ENGINE has had `PAUSE_KEYS = {Escape, Enter}` in `input/keydown` since before this port
   * existed. Two handlers on one key is a question a test can answer and a reading of the source
   * cannot.
   */
  test('⚠️ Enter pauses the game', async () => {
    await stopTheWorld();
    key('KeyU', 'keydown');
    key('KeyU', 'keyup');
    await frames(4);
    expect(debug().phase, 'a ball is in play first').toBe('playing');

    key('Enter', 'keydown');
    key('Enter', 'keyup');
    await frames(2);

    expect(debug().phase).toBe('paused');
  });

  test('⚠️ and H pauses it too, which is the engine’s own start key', async () => {
    // ADR-0085 gave `start` a keyboard binding for the first time and ADR-0086's default is
    // `['KeyH', 'Enter']`. `CABINET_OF_ENGINE_ACTION` maps `start` to this cabinet's pause, so H
    // should arrive through the engine's remapper the way every other key does.
    await stopTheWorld();
    key('KeyU', 'keydown');
    key('KeyU', 'keyup');
    await frames(4);

    key('KeyH', 'keydown');
    key('KeyH', 'keyup');
    await frames(2);

    expect(debug().phase).toBe('paused');
  });

  /**
   * ⚠️ A DRONE MOVES ON SCREEN WITH NOBODY TOUCHING ANYTHING, which is a new claim for this file.
   *
   * Every other body here changes because the PLAYER changed it — a flipper because a key went down,
   * the ball because it was launched. A travelling body changes on its own, and that is exactly the
   * kind of thing a composition made once per change cannot hold: `drawTable` skips anything with a
   * `mover`, so a drone the frame loop fails to draw is INVISIBLE rather than stale, and one it fails
   * to advance sits at the start of its path while the ball bounces off it there.
   *
   * The world is stopped first, so nothing else in the frame can be moving: no ball, no keys down.
   * Whatever differs is the drone.
   */
  test('⚠️ a travelling body moves the picture with no input at all', async () => {
    await stopTheWorld();
    await frames(2);
    const before = frame();

    // `low-orbit`'s high drone crosses in 2.4 seconds, so half a second is a quarter of its path.
    await frames(30);

    expect(differingIn(before, frame(), { left: 0, right: 320, top: 0, bottom: 180 }),
      'something moved while the game was stopped and no key was down').toBeGreaterThan(0);
  });

  test('nothing fell over while doing any of that', () => {
    expect(debug().problems).toEqual([]);
  });
});
