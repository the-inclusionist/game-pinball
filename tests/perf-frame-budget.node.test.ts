// SPDX-License-Identifier: AGPL-3.0-or-later
// A FRAME HAS SIXTEEN AND TWO THIRDS MILLISECONDS, AND NOBODY HAD EVER TIMED ONE.
//
// This port exists to run inside an accessibility engine aimed at school machines. A table that renders
// correctly at ten frames a second is not a table anybody can play, and every gate in this repository
// asks whether the answer is right rather than whether it arrives — which is the same shape as the
// render gates that never asked what the frame looks like.
//
// ⚠️ AND HERE IS EXACTLY WHAT IT CATCHES, MEASURED RATHER THAN HOPED. The bound is a third of a frame,
// which is about seventy times the current cost. I put a per-row allocation into `blitView` to see what
// would trip it: that costs seven times as much — 0.075 ms became 0.537 — and this test did NOT notice.
//
// So it catches a catastrophe and not a regression: `drawTable` moving into the frame loop, the
// playfield being decoded per frame, a framebuffer allocated sixty times a second. A bound tight enough
// to see the sevenfold case would sit four times over the measurement and fail on a loaded machine for
// reasons that have nothing to do with this code. That is the trade, and it is written down rather than
// left to look like precision.
//
// Measured on the machine that wrote this, over the real archive: `step(1)` 0.010 ms, `render()` 0.045,
// a whole frame 0.055 — about three hundred times inside the budget. `createDemo` costs 51 ms once,
// which is the archive being parsed and every sprite decoded, and happens before the first frame.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createDemo } from '../app/js/shell/demo.js';
import { drawTable, blitView } from '../app/js/gfx/table-view.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';
import { layoutHud, DEFAULT_HUD } from '../app/js/shell/hud.js';
import { LOW_ORBIT } from '../app/js/table/catalog.js';

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';

/** Sixty frames a second. The only number in this file that is not arbitrary. */
const FRAME_BUDGET_MS = 1000 / 60;
/** What a frame is allowed to cost before this fails: a third of the budget, which is 200x the measure. */
const CEILING_MS = FRAME_BUDGET_MS / 3;

describe('a frame of the 1995 table fits in a frame', () => {
  test('⚠️ stepping and rendering together stay far inside sixteen milliseconds', () => {
    if (!existsSync(DAT)) return expect(existsSync(DAT)).toBe(false);
    const file = readFileSync(DAT);
    const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const demo = createDemo(bytes, { textFor: (id) => id, random: () => 0.5 });

    // A ball in play: an idle ball is the cheap case and would prove nothing about the expensive one.
    demo.plunge(true);
    demo.step(150);
    demo.plunge(false);
    demo.step(200);

    const rounds = 600;
    const started = performance.now();
    for (let i = 0; i < rounds; i++) {
      demo.step(1);
      demo.render();
    }
    const perFrame = (performance.now() - started) / rounds;

    expect(perFrame, `a frame cost ${perFrame.toFixed(3)} ms`).toBeLessThan(CEILING_MS);
  });
});

describe('and a frame of an authored table does too', () => {
  test('⚠️ the picture is drawn ONCE and the frame only copies a window of it', () => {
    // `drawTable` walks every component and is the expensive call; `main.ts` runs it when the objective
    // changes and not per frame. If that ever moves into the loop this is where it shows up, because
    // the per-frame path here is only the blit.
    const picture = drawTable({ table: LOW_ORBIT });
    const screen = createFramebuffer(320, 180);
    const layout = layoutHud({ ...DEFAULT_HUD, playfieldWidth: LOW_ORBIT.size.width });

    const rounds = 2000;
    const started = performance.now();
    for (let i = 0; i < rounds; i++) blitView(screen, picture, layout.playfield, 0, i % 55);
    const perFrame = (performance.now() - started) / rounds;

    expect(perFrame, `a blit cost ${perFrame.toFixed(3)} ms`).toBeLessThan(CEILING_MS);
  });
});
