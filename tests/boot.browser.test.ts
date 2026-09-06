// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME ACTUALLY BOOTS, CHECKED BY A MACHINE INSTEAD OF BY ME.
//
// The plan asks for "confirmação de boot real no painel Browser (canvas presente + estado do jogo),
// nunca só screenshot". That check has been done by hand, in a preview, once per session, for as long
// as there has been something to boot — which means it was done when somebody remembered and not when
// something broke. This is the same check, run by `npm run validate`.
//
// ⚠️ IT IMPORTS THE ENTRY POINT, which is the only version of this worth having. `main.ts` is where the
// wiring lives, and wiring is what an inventory test can only approximate: `tests/shell-boot` reads
// the file as TEXT and asserts that certain lines appear in it, because no unit test drives it. This
// one runs it.
//
// ⚠️ AND IT NEVER TOUCHES `PINBALL.DAT`. The archive is Microsoft's and the Dev's constraint is exact —
// never versioned, never in `dist`, never served over HTTP — and a browser test is served by a dev
// server. `__pinball.loadOriginal` exists for checks that want the 1995 table and this deliberately
// does not call it: the authored table is what phase 8 ships anyway.
import { describe, test, expect, beforeAll } from 'vitest';
import { userEvent } from 'vitest/browser';

interface PinballDebug {
  problems: readonly string[];
  table: string;
  tables: readonly string[];
  hud: { playfield: { x: number; y: number; width: number; height: number } };
  ball: { x: number; y: number; speed: number; active: boolean };
  screen: { width: number; height: number };
  setPhase(next: string): void;
}

const debug = (): PinballDebug =>
  (window as unknown as { __pinball: PinballDebug }).__pinball;

beforeAll(async () => {
  // The page's own markup, as `app/index.html` writes it. A boot against different markup would be a
  // boot of a different program.
  document.body.innerHTML = `
    <main id="game-region" tabindex="-1"></main>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd-filters" width="0" height="0" aria-hidden="true" focusable="false"></svg>
  `;
  await import('../app/js/main.js');
});

describe('the page comes up', () => {
  test('⚠️ and reports NO problems, which is where a missing element goes', () => {
    // `createGame` does not throw on markup it cannot find — it reports. The `cvd-filters` host went
    // missing once and nothing said so until the game was booted by hand: the six colour-blindness
    // filters were simply not installed, and the menu that offers them had nothing behind it.
    expect(debug().problems).toEqual([]);
  });

  test('there is a canvas, at the size the plan fixed', () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-region canvas')!;

    expect(canvas, 'the game drew itself somewhere').not.toBeNull();
    // Decision 4 of the plan: 320x180, honoured to the letter. The CSS width is a scale; the buffer is
    // the promise.
    expect([canvas.width, canvas.height]).toEqual([320, 180]);
    expect(canvas.getBoundingClientRect().width, 'and it is actually laid out').toBeGreaterThan(0);
  });

  test('and the table it opened is one of the authored five', () => {
    expect(debug().tables).toContain(debug().table);
  });
});

describe('⚠️ ADR-0002 measured in LAYOUT rather than in arithmetic', () => {
  test('no HUD block overlaps the playfield, on the screen instead of on paper', () => {
    // The record's own test walks the block rectangles against the playfield rectangle and passes. It
    // passed while the table was drawn sixty-nine columns left of where the HUD expected it, because
    // both sides of that comparison were computed and neither was measured. These are the boxes the
    // browser actually put on the page.
    //
    // ⚠️ AND THE TWO MUTATIONS SAY EXACTLY WHAT THIS ADDS, which is less than it sounds and more than
    // nothing. Slide the score block forty pixels onto the playfield and BOTH catch it — the node HUD
    // test is not blind, and pretending otherwise would be selling this file on a false claim.
    //
    // Lay the canvas out at 60% of its width instead of 100%, so the model stays right and the SCREEN
    // disagrees with it, and three blocks land on the play here while all 1845 node tests pass. That
    // second one is the defect that actually happened, and it is the only kind this file exists for.
    const canvas = document.querySelector<HTMLCanvasElement>('#game-region canvas')!;
    const box = canvas.getBoundingClientRect();
    const scale = box.width / canvas.width;
    const { playfield } = debug().hud;
    const play = {
      left: box.left + playfield.x * scale,
      right: box.left + (playfield.x + playfield.width) * scale,
      top: box.top + playfield.y * scale,
      bottom: box.top + (playfield.y + playfield.height) * scale,
    };

    const blocks = [...document.querySelectorAll<HTMLElement>('[class^="pinball-hud-"]')];
    expect(blocks.length, 'there are blocks to check').toBeGreaterThan(0);

    const covering = blocks.filter((block) => {
      const r = block.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      return r.left < play.right && r.right > play.left && r.top < play.bottom && r.bottom > play.top;
    });

    expect(covering.map((b) => b.className), 'blocks sitting on the play').toEqual([]);
  });
});

describe('⚠️ the keyboard is bound to #game-region and NOT to the window', () => {
  // One of the two engine traps the plan names in advance: "o teclado é ligado em `#game-region`,
  // nunca em `window`". A key handler on the window works in every manual check — the region has the
  // focus when a person is playing — and stops working the moment anything else on the page takes it.
  // Only a real focus can tell the two apart.
  test('a key pressed with the region focused reaches the game', async () => {
    const region = document.getElementById('game-region')!;
    region.focus();
    expect(document.activeElement, 'the region can hold focus').toBe(region);

    // ⚠️ AND THE BALL ACTUALLY LAUNCHES, which this test used to refuse to assert.
    //
    // It said: "Space is the plunger. What it does depends on the table's state; what matters here is
    // that the page consumed it rather than scrolling." That sentence is why the game shipped
    // unplayable. `physics.spawnBall()` returns a ball with `active: true`, and both launch paths were
    // guarded on `!ball.active` — so the plunger key did nothing from the first frame to the last, and
    // the only test that pressed it had decided in advance not to look at the result.
    //
    // A key that is "consumed" is not a key that works.
    const before = debug().ball;
    await userEvent.keyboard(' ');

    expect(debug().problems, 'and nothing fell over doing it').toEqual([]);
    expect(debug().ball.speed, 'the plunger launched the ball').toBeGreaterThan(before.speed);
  });

  test('and the region is reachable by keyboard at all, or none of that matters', () => {
    // `tabindex="-1"` makes it focusable by script and by click but not by Tab, which is what the page
    // wants: the game takes focus when it is played, and Tab walks the controls around it.
    const region = document.getElementById('game-region')!;

    expect(region.getAttribute('tabindex')).toBe('-1');
  });
});

describe('⚠️ and the game is CONTROLLABLE once it starts, not merely visible', () => {
  // The defect this exists for shipped and the Dev found it: after the title screen was added, choosing
  // a table left the focus on the button that was clicked, and then on `<body>` when the selector hid.
  // `bindPinballControls` listens on `#game-region` and never on `window` — the right choice, and the
  // engine trap the plan names in advance — so a keydown on the body reached nothing. Every key did
  // nothing until the player happened to click the canvas.
  //
  // ⚠️ `tests/title.browser` PASSED THROUGHOUT. It asks which screen occupies the canvas, which is a
  // question about pixels; this is a question about whether the game can be played, and the two are not
  // the same. The controls were implemented, tested, and unreachable — which is worse than absent,
  // because the game looks finished and does not respond.
  test('starting a table puts the focus where the keys are bound', () => {
    const region = document.getElementById('game-region')!;
    const title = document.querySelector<HTMLElement>('.pinball-title button');
    if (!title) return expect(document.querySelector('.pinball-title')).toBeNull();

    title.click();
    document.querySelector<HTMLElement>('[data-table]')!.click();

    expect(region.contains(document.activeElement), 'the focus is inside the game region').toBe(true);
  });
});
