// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SENTENCE REACHES A CHILD WHO HAS NO SCREEN READER.
//
// ⚠️ `tests/shell-announce` PROVES THE SEAM CALLS BOTH CHANNELS. What it cannot see is whether the channel
// it calls is the ENGINE'S — a fake `narrate` in a node test is satisfied by anything. This file presses
// the real thing: the mixer's own toggle, the engine's own counter, in a real browser.
//
// 📏 AND THE VOICE IS BORN OFF, WHICH IS THE POINT AND NOT AN OBSTACLE. `platform/audio-mixer` puts `tts`
// among the categories that start silent, so nothing this game says is spoken until a child presses 🗨️ —
// the button the engine mounts in the bar, which until §10 did nothing for any sentence this game wrote.
// The first case measures that silence; the second turns the toggle on, which is what a child does.
import { describe, test, expect, beforeAll } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';
import { audioCat } from '@the-inclusionist/engine/platform/audio.js';

interface PinballDebug {
  narrateCount: number;
  phase: string;
  setPhase(next: string): void;
}
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};

/**
 * An announcement A PLAYER CAUSES, which is the only kind worth measuring.
 *
 * ⚠️ AND NOT `__pinball.setPhase`, WHICH THE FIRST VERSION OF THIS FILE USED AND WHICH MEASURED NOTHING.
 * That setter assigns the phase and returns; the announcement lives in `enterPhase`, which the PAUSE KEY
 * reaches. The debug handle was the quiet path around the thing under test — both cases failed with an
 * empty live region and a counter at zero, and neither failure was about the seam.
 */
const announceSomething = async (): Promise<void> => {
  document.getElementById('game-region')!.focus();
  await userEvent.keyboard('{Enter}');
  await frames(4);
};

/**
 * Into a game the way a player gets into one — the title, a table, the mission number, the plunger.
 *
 * ⚠️ WITHOUT IT THE PAUSE KEY REACHES NOTHING, because the game boots on the TITLE screen and there is
 * no pause to toggle there. The first version of this file pressed Enter at the title and read a counter
 * that had never had anything to count.
 */
async function play(): Promise<void> {
  document.querySelector<HTMLElement>('.pinball-title button')?.click();
  await frames(3);
  document.querySelector<HTMLElement>('[data-table]')?.click();
  await frames(5);
  document.querySelector<HTMLElement>('[data-times]')?.click();
  await frames(5);
  await userEvent.keyboard('{u}');
  await frames(6);
}

beforeAll(async () => {
  document.body.innerHTML = PAGE_MARKUP;
  pinLanguage();
  await import('../app/js/main.js');
  await frames(10);
  await play();
});

describe('the game speaks, once a child asks it to', () => {
  test('⚠️ with the voice off, nothing is spoken — and the live region still says it', async () => {
    /**
     * Both halves matter. A game that spoke without being asked would talk over a classroom; a game whose
     * live region went quiet when the voice did would have traded one channel for the other instead of
     * adding one.
     */
    const before = debug().narrateCount;

    await announceSomething();

    expect(debug().narrateCount, 'it spoke without being asked').toBe(before);
    expect(document.getElementById('sr-status')!.textContent, 'and the reader was told nothing')
      .not.toBe('');
  });

  test('⚠️ and with the voice ON, the sentence is spoken through the ENGINE', async () => {
    /**
     * ⚠️ THE COUNTER IS THE ENGINE'S, WHICH IS THE WHOLE VALUE OF THIS CASE. `platform/tts.narrate`
     * increments `_narrateCount` after its own gates — sound on, `audioCat.tts.on`, non-empty text — and
     * before it tries to speak, so this measures the sentence ARRIVING rather than any voice succeeding.
     * A test that asserted audible speech would be asserting about the runner's speech synthesiser.
     *
     * Setting the category directly is what the 🗨️ button does; the button itself is the engine's and has
     * its own tests upstream.
     */
    expect(audioCat, 'the mixer never initialised, so this case would measure nothing').not.toBeNull();
    audioCat!.tts!.on = true;

    const before = debug().narrateCount;
    await announceSomething();

    expect(debug().narrateCount, 'the sentence never reached the engine’s voice')
      .toBeGreaterThan(before);

    // Left as it was found: born off is a decision, and a suite that leaves it on decides for the next file.
    audioCat!.tts!.on = false;
  });
});
