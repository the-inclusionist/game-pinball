// SPDX-License-Identifier: AGPL-3.0-or-later
// THE REASON THIS PROJECT EXISTS, EXERCISED WHERE IT ACTUALLY RUNS.
//
// A pinball table is a stream of positions and a sonar; that is the whole argument for porting one
// into an accessibility engine, and it is the part of this repository that has never run outside node.
// The keys were bound, the targets were filled in, the guide was wired — each proven by a unit test
// against a fake — and the one time the whole chain was tried end to end it turned out that
// `createGame` took an `isBlindMode` callback `main.ts` never supplied, so the switch had been dead for
// two commits while every test passed.
//
// ⚠️ AND `main.ts` HAS EXPOSED THE HOOKS FOR THIS ALL ALONG. `__pinball.blind` and `__pinball.sonar`
// carry comments saying they exist "so the browser gate can confirm sound rather than assume it". The
// gate was never written. This is it.
//
// What makes these browser tests rather than node ones is the same thing as everywhere else here: the
// keys are bound to `#game-region` and not to `window`, so only a real focus proves a real key arrives.
import { describe, test, expect, beforeAll } from 'vitest';
import { userEvent } from 'vitest/browser';

interface PinballDebug {
  problems: readonly string[];
  blind: boolean;
  sonar: { guideCount: number; sonarCount: number };
  objective: { have: number; need: number; targets: readonly string[] };
}

const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;
const said = (): string => document.getElementById('sr-status')?.textContent ?? '';

async function press(key: string): Promise<void> {
  document.getElementById('game-region')!.focus();
  await userEvent.keyboard(key);
}

/**
 * ⚠️ CAPTURED BEFORE ANY KEY IS PRESSED, because "it starts off" is a claim about the BOOT and not
 * about whichever test happens to run first.
 *
 * The first version of this file read `__pinball.blind` inside the test instead, and that test passed
 * only while it ran before the two that press the same key. Shuffled, it failed two runs in five — a
 * flaky test committed as a green one, found by running the suite in a random order rather than by
 * anything noticing. The state is a snapshot taken once; the assertion can then be made from anywhere.
 */
let blindAtBoot = true;

beforeAll(async () => {
  document.body.innerHTML = `
    <main id="game-region" tabindex="-1"></main>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd-filters" width="0" height="0" aria-hidden="true" focusable="false"></svg>
  `;
  await import('../app/js/main.js');
  blindAtBoot = debug().blind;
});

describe('blind mode, from the key a player would actually press', () => {
  test('⚠️ B turns it on, and the game KNOWS it is on', async () => {
    // ⚠️ AND THIS COVERS HALF OF THE DEFECT IT WAS WRITTEN FOR, which is worth saying exactly.
    //
    // The original fault was two links in a chain: the key had to reach the switch, and the switch had
    // to reach the ENGINE, through the `isBlindMode` callback `createPinballOptions` passes. The second
    // link was the broken one — `main.ts` supplied no callback, the engine's default `() => false`
    // stood, and the guide never fired.
    //
    // `__pinball.blind` is the variable, not the callback, so what runs here is the FIRST link: a real
    // key, on a real focus, reaching a real switch. The second is held by the inventory test in
    // `tests/shell-boot`, which reads `main.ts` and requires the callback to be passed. Together they
    // cover the chain; neither covers it alone, and this file would pass on a build where the engine
    // was told nothing.
    expect(blindAtBoot, 'nobody is opted into blind mode at boot').toBe(false);
    const before = debug().blind;

    await press('b');

    expect(debug().blind, 'the key moved it').toBe(!before);
  });

  test('and it SAYS so, in the live region rather than in silence', async () => {
    // A switch that changes how the game speaks, and does not say it has changed, is a switch a blind
    // player cannot tell they pressed.
    const before = said();

    await press('b');

    expect(said(), 'the announcement changed').not.toBe(before);
    expect(said().length, 'and it is words, not an empty string').toBeGreaterThan(0);
  });

  test('pressing it again turns it off, so it is a toggle and not a trap', async () => {
    const wasOn = debug().blind;

    await press('b');

    expect(debug().blind).toBe(!wasOn);
  });
});

describe('the sonar, which is what makes a pinball explorable at all', () => {
  test('⚠️ S sweeps, and the sweep REACHES the engine', async () => {
    // `targetsOf` is what the sonar points at, and it was filled in two commits before anything could
    // ask it a question. This asks it, through the key, in a browser, with the region focused.
    const before = debug().sonar.sonarCount;

    await press('s');

    expect(debug().sonar.sonarCount, 'the engine ran a sweep').toBeGreaterThan(before);
  });

  test('and it can be asked more than once, because a table is explored and not announced at', async () => {
    const before = debug().sonar.sonarCount;

    await press('s');
    await press('s');

    expect(debug().sonar.sonarCount - before).toBe(2);
  });

  test('⚠️ a key that is not bound sweeps NOTHING, or the count above proves nothing', async () => {
    // Without this the two tests above would pass on a build where every keystroke ran a sweep.
    const before = debug().sonar.sonarCount;

    await press('q');

    expect(debug().sonar.sonarCount).toBe(before);
  });
});

describe('and there is something to point at', () => {
  test('the objective reports a need and its targets, rather than an empty promise', () => {
    // The sonar sweeping an empty target list is a sweep that says nothing, and it would satisfy every
    // count above. What a player is actually told comes from here.
    const { need, targets } = debug().objective;

    expect(need, 'the mission asks for something').toBeGreaterThan(0);
    expect(targets.length, 'and names what').toBeGreaterThan(0);
  });

  test('nothing fell over doing any of that', () => {
    expect(debug().problems).toEqual([]);
  });
});

describe('⚠️ pause says so, because a silent pause reads as a hang', () => {
  // The audit that found this: `togglePause` set the phase and stopped. The frame loop steps the ball
  // only while playing, so pressing start froze the table and told nobody why — a lock-up to a sighted
  // player, silence to a blind one. The same class as the flippers drawn at rest and the lamps drawn
  // nowhere: state that changes with nothing reporting it.
  test('start announces the pause, and announces coming back', async () => {
    // A game has to be running first: pause on the title would be a state the title cannot leave.
    await press('u');
    const before = said();

    await press('{Enter}');
    const paused = said();

    expect(paused, 'the pause is announced').not.toBe(before);
    expect(paused.length, 'and it is words').toBeGreaterThan(0);

    await press('{Enter}');

    expect(said(), 'and so is the resume').not.toBe(paused);
  });
});
