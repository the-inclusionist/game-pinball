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
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';

interface PinballDebug {
  problems: readonly string[];
  reach: { ok: boolean; pedidas: number; seguraPedidas: number };
  table: string;
  tables: readonly string[];
  hud: { playfield: { x: number; y: number; width: number; height: number } };
  ball: { x: number; y: number; speed: number; active: boolean };
  screen: { width: number; height: number };
  setPhase(next: string): void;
  plungerPull: number;
}

const debug = (): PinballDebug =>
  (window as unknown as { __pinball: PinballDebug }).__pinball;

beforeAll(async () => {
  // The page's own markup, as `app/index.html` writes it. A boot against different markup would be a
  // boot of a different program.
  document.body.innerHTML = PAGE_MARKUP;
  pinLanguage();
  await import('../app/js/main.js');
});

describe('⚠️ what this game asks of a machine, measured at boot', () => {
  test('⚠️ the engine knows how many actions this cabinet needs', () => {
    /**
     * ⚠️ THIS WAS STRUCTURALLY ZERO AND COULD NOT BE ANYTHING ELSE. `createGame` computes the action set
     * from the `preset` it is given; with none it is empty, the reach card is skipped by a length guard,
     * and `engine.alcance` answers `{ ok: false, pedidas: 0 }` for ever — a permanent "nothing fits" that
     * no screen shows and no test could distinguish from a machine that genuinely cannot play.
     *
     * A pinball asks a transport for eight positions and asks it to HOLD two of them at once. On a phone
     * that registers two fingers, or a tablet with no keyboard and no pad, that is the difference between
     * a child being told what is missing and a child poking a ball that will not move.
     */
    expect(debug().reach.pedidas, 'the engine was told this game\u2019s positions').toBe(8);
    expect(debug().reach.seguraPedidas, 'and how many are held at once').toBe(2);
  });

  test('⚠️ and it does NOT show the reach card here, because this machine can play', () => {
    /**
     * The other half, and the one worth measuring rather than assuming: a card that fires where it should
     * not is how a feature gets switched off. The engine reads touch as `pointer:coarse && hover:none`;
     * under Playwright there is a keyboard, so the card must stay away.
     *
     * ⚠️ IF THIS EVER GOES RED IT IS A FINDING ABOUT THE DETECTION, not a reason to stop declaring the
     * preset — the engine's own comment admits it errs on a tablet WITH a keyboard and tolerates the error
     * because the screen informs rather than refuses.
     */
    expect(debug().reach.ok, 'a machine with a keyboard reaches this cabinet').toBe(true);
    expect(document.getElementById('reach-notice'), 'no card was drawn').toBeNull();
  });
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
    // ⚠️ FROM A KNOWN PHASE, because this suite runs in a RANDOM ORDER and a sibling test launches
    // too. Whichever ran first left a ball in flight, and `launch` refuses while the phase is already
    // `playing` — so this asserted a moving ball had got faster, and it was slowing.
    debug().setPhase('title');
    // ⚠️ `u`, NOT SPACE. The Dev respecified the controls as a cabinet — directions, three buttons and
    // a start — and button 1 is the plunger. This test pressed Space and failed the moment the mapping
    // changed, which is the gate working: a control test naming a key that is no longer bound is
    // testing a game nobody plays.
    await userEvent.keyboard('u');

    expect(debug().problems, 'and nothing fell over doing it').toEqual([]);
    // ⚠️ A TAP LAUNCHES WEAKLY, WHICH IS THE PLUNGER WORKING. This asserted a speed above 200 — the
    // table's full 273 — and that was right while every launch was identical. The Dev asked for a
    // launcher whose force a player controls, so `userEvent.keyboard('u')` presses and releases in the
    // same instant: the weakest possible draw, about a third of full. Asserting the old number would be
    // asserting the defect.
    expect(debug().ball.speed, 'the plunger launched the ball').toBeGreaterThan(0);
    expect(debug().ball.speed, 'and weakly, because it was barely drawn').toBeLessThan(200);
  });

  test('⚠️ and HOLDING it DRAWS IT BACK, which is what was asked for', async () => {
    /**
     * ⚠️ THIS ASSERTED THE LAUNCH SPEED AND PASSED WITHOUT THE FEATURE. Deleting `plunger.advance` —
     * the one line that charges it — left the test green: it compared a tap against a hold, and with
     * no charge both launch at the same minimum, so the comparison was being satisfied by something
     * else entirely. A gate that survives the removal of the code it exists for is not a gate.
     *
     * The charge itself is the thing. `plungerPull` is the model's own state, it moves only when the
     * frame loop advances it, and it is what the renderer draws — so asserting it is asserting the
     * feature rather than a consequence of it that something else can produce.
     */
    debug().setPhase('title');
    const region = document.getElementById('game-region')!;
    region.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyU', bubbles: true }));

    const atPress = debug().plungerPull;
    await new Promise((resolve) => { setTimeout(resolve, 600); });
    const afterHolding = debug().plungerPull;

    region.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyU', bubbles: true }));

    expect(atPress, 'it starts at rest').toBe(0);
    expect(afterHolding, 'and is drawn back by holding').toBeGreaterThan(0);
    expect(debug().plungerPull, 'and springs back on release').toBe(0);
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
    // ⚠️ AND THE NUMBER: choosing a table now asks for the times table before it starts anything.
    // No wait between the two — `title-dom` redraws inside the click handler, so the number buttons
    // are in the document by the time the first click returns.
    document.querySelector<HTMLElement>('[data-times]')!.click();

    expect(region.contains(document.activeElement), 'the focus is inside the game region').toBe(true);
  });
});

describe('⚠️ the running mission is on screen, not only in the declaration', () => {
  // Found by auditing rather than by playing: `missionTextId` reaches the engine's declaration, so
  // blind mode could speak the mission — and the HUD has no mission block, so on screen the text
  // appeared only at the moment one was COMPLETED, when the hint was set to the next. The first
  // mission of every game went unannounced.
  test('launching a ball puts the current mission in the hint', async () => {
    const hint = () => document.querySelector('.pinball-hud-hint')?.textContent ?? '';
    document.getElementById('game-region')!.focus();
    // Same reason as the plunger test above: a known phase, or the launch this depends on is refused.
    debug().setPhase('title');

    await userEvent.keyboard('u');
    /**
     * ⚠️ AND THEN FRAMES ARE WAITED FOR, BECAUSE THE HINT REACHES THE DOM FROM THE FRAME LOOP.
     *
     * `launch` sets the hint in a variable; `hud.update` is what puts it in the element, and that runs
     * once per animation frame. Pressing the key and reading the element in the same turn is a race
     * that `userEvent` happened to win on Chromium and lost on Firefox — found by the shuffle, at
     * `--sequence.seed=1788783516370`, where this test ran FIRST and so had no earlier test's frames
     * to inherit. Reproduced in isolation in 238ms, so it is an ordering fault and not the machine
     * being busy.
     *
     * The wait is the correction rather than the assertion, because what the test claims is true: the
     * hint does arrive. It arrives on a frame.
     */
    for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));

    // `low-orbit`'s first mission is the bumper nest. What matters is that SOMETHING describing it is
    // there — asserting the sentence would be asserting the i18n file, which has its own gate.
    expect(hint().length, 'the player is told what to do').toBeGreaterThan(0);
    expect(hint(), 'and it is a sentence, not a key').not.toMatch(/^pinball\./);
  });
});
