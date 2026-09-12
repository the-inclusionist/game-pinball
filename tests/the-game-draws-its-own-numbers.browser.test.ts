// SPDX-License-Identifier: AGPL-3.0-or-later
// THIS GAME'S RANDOMNESS IS ITS OWN, AND IT IS NOT THE PAGE'S.
//
// ========================= ADR-0141, AND THE DEFECT UNDERNEATH IT =========================
// ⚠️ `core/rng` EXPORTS TWO DIFFERENT THINGS AND THE GAMES REACHED FOR THE WRONG ONE. `createRng(seed)`
// is an independent stream; `rnd`, `randInt`, `shuffle` and `reseed` are all bound to ONE module-level
// stream shared by everything that imports them. In standalone mode that is harmless — one game, one
// stream. On the platform, two cartridges importing `rnd` share a stream and a `reseed` in one
// repositions the other's, which is the engine's own user story failing from the inside: «I want the
// engine to carry no game state, so that two games on one page do not collide».
//
// ✅ THIS GAME NEVER IMPORTED THOSE FOUR — measured, and recorded in the plan's B4 inventory. What it did
// instead was reach for `Math.random`, which is the SAME defect wearing the page's clothes: a stream
// owned by nobody, that a host cannot seed, replay or isolate.
//
// ========================= WHY THIS COUNTS RATHER THAN COMPARES =========================
// 📌 THE OBVIOUS GATE WOULD BE WRONG HERE. "Boot twice with one seed and compare" would assert that this
// pinball is REPRODUCIBLE — and `table/physics-build` argues at length that it must not be: «a pinball
// that kicks the same way every time is one a player could learn to exploit». The shell seeds from the
// clock on purpose, so there is nothing to compare against.
//
// The claim is not about the numbers. It is about WHERE THEY COME FROM: with a stream handed in, nothing
// in this cartridge should touch the page's. A counter over `Math.random` is exactly that claim.
//
// ============ 🔴 AND THE COUNTER HAS TO GO ON BEFORE THE IMPORT, WHICH COST A DETOUR ============
// Every seam in this game reads `const random = o.random ?? Math.random` — **once, when it is built**.
// That captures the global BY VALUE. A counter installed after the game was constructed is therefore
// never called at all, however many numbers the game draws afterwards: the first version of this file
// watched thirty seconds of play with a ball in motion and two comets falling, and reported ZERO.
//
// It was wrong in the direction that passes, which is the one that matters. What settled it was a
// mutation — making `comet-mission`'s fallback THROW instead of returning a number, which stopped the
// loop on the first spawn and proved the path was live all along. So the counter goes on in `beforeAll`,
// before the import, and the six calls that measurement had written off turned out to be the
// cartridge's own: two comet spawns at three draws each.
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';

interface PinballDebug {
  backdropLoaded: boolean;
  phase: string;
  comets: readonly unknown[];
  step(frames: number): void;
}
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};

const REAL_RANDOM = Math.random;
/** Every call, whoever made it — including the runner's. Its only job is to prove the counter is live. */
let everybody = 0;
/** The ones that came out of this cartridge's own source. */
let theCartridge = 0;
const where: string[] = [];

beforeAll(async () => {
  /**
   * ⚠️ IT IDENTIFIES THE CALLER RATHER THAN COUNTING EVERYTHING, and that is not fastidiousness.
   * `vitest`'s own `wrapModule` draws a couple of numbers while it loads modules, so a bare count can
   * never reach zero and a gate written against one would have to be `toBeLessThan(3)` — a threshold
   * nobody could defend, which drifts, and which hides the first real call behind it.
   *
   * 📌 SO IT LOOKS AT THE FRAME THAT CALLED IT, and only that one. This game's modules are served at
   * `/js/…` — the browser project's root is `app/`, which is why the first version of this filter looked
   * for `app/js` and matched NOTHING. The mutation below is what caught that, and it is the reason this
   * paragraph exists rather than a one-line regex nobody would re-check.
   *
   * ⚠️ AND IT IS THE IMMEDIATE CALLER RATHER THAN THE WHOLE STACK, because the runner's own draws happen
   * while it is loading modules, and those stacks run down THROUGH this game's files. Asking whether the
   * game appears anywhere in the stack would count them, and the gate could never reach zero.
   */
  const GAME_MODULE = /\/js\/[^\s)]*\.ts/;
  /**
   * 🔴 AND THE CALLER IS FOUND BY SKIPPING, NOT BY INDEX, BECAUSE THE TWO ENGINES DISAGREE.
   *
   * Chromium puts the error's MESSAGE on the first line and the frames after it; firefox starts straight
   * at the frames. So `stack[2]` is the caller in one browser and the caller's caller in the other —
   * which is how this file passed in chromium and failed in firefox on the same tree, with the same game
   * drawing the same numbers.
   *
   * Dropping this counter's OWN frame and taking what is left first says what is meant in both.
   *
   * 🔴 AND IT IS THE FUNCTION NAME, NOT THE FILE NAME, WHICH COST ANOTHER RUN. Dropping frames that
   * mention this file dropped one too many: `vitest`'s `wrapModule` frame carries the test file's path
   * inside a QUERY PARAMETER (`?iframeId=…the-game-draws-its-own-numbers…`), so the runner's own draw was
   * skipped over and the frame underneath it — `standalone.ts`, which had done the dynamic import —
   * surfaced as the caller. One call, attributed to the game, made by the runner.
   */
  Math.random = function fromThePage(): number {
    everybody++;
    const caller = (new Error('drawn from the page').stack ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('http') && !line.includes('fromThePage'))[0] ?? '';

    if (GAME_MODULE.test(caller)) {
      theCartridge++;
      if (where.length < 4) where.push(caller);
    }
    return REAL_RANDOM();
  };

  document.body.innerHTML = PAGE_MARKUP;
  pinLanguage();
  await import('../app/js/standalone.js');
  for (let i = 0; i < 600 && !debug().backdropLoaded; i++) await frames(1);
});

afterAll(() => {
  // Left in place, every other suite in this browser would run against a counter whose file has
  // finished — and the runner shuffles files, so which suite that is would change from run to run.
  Math.random = REAL_RANDOM;
});

describe('the cartridge draws from the stream it was given', () => {
  test('⚠️ a game in play never reaches for the page\'s generator', async () => {
    /**
     * 📌 A BALL HAS TO BE MOVING, AND THAT IS WHY THIS IS A BROWSER FILE. The seams that draw are the
     * kickouts and wells of `physics/step`, the nudge in `physics/stuck`, the lamp animations of
     * `table/light-group`, the comet spawns and the power-ups — and not one of them runs on a title
     * screen. Measured: 180 frames before the launch draw nothing at all.
     */
    document.querySelector<HTMLElement>('.pinball-title button')?.click();
    await frames(4);
    document.querySelector<HTMLElement>('[data-table]')?.click();
    await frames(5);
    document.querySelector<HTMLElement>('[data-times="7"]')?.click();
    await frames(6);

    await userEvent.keyboard('{u}');
    await frames(10);
    expect(debug().phase, 'the ball never launched, so nothing below is being measured')
      .toBe('playing');

    // Thirty seconds of simulation, stepped rather than waited for: comets spawn on a timer, and a
    // real-time wait that long is twice the runner's whole budget for a case.
    debug().step(1800);

    // ---- the two guards that stop a green from being empty ----
    expect(everybody, 'nothing called `Math.random` at all, so the counter is not installed')
      .toBeGreaterThan(0);
    expect(debug().comets.length, 'no comet ever fell, so the count below watched an idle game')
      .toBeGreaterThan(0);

    // ---- and the claim ----
    expect(theCartridge,
      `the cartridge drew from the page's generator:\n${where.join('\n')}`)
      .toBe(0);
  });
});
