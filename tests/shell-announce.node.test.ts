// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME SPEAKS OUT LOUD, AND NOT ONLY TO SOFTWARE THAT MAY NOT BE RUNNING.
//
// ⚠️ EIGHT PLACES IN `main.ts` WROTE `textContent` INTO A LIVE REGION AND NOTHING ELSE. That reaches a
// child who already has a screen reader running and nobody else — and since engine 8 the 🗨️ button is on
// screen, in the bar the engine mounts, doing nothing for any sentence this game writes.
//
// `engine.tts.narrate` is the other channel: it speaks through the engine's own mixer, with no assistive
// technology installed at all, which is the school-Chromebook case the engine's voice work is written
// about. The game had never touched it.
//
// ========================= TWO DEFECTS, AND THE SECOND IS QUIETER =========================
// ⚠️ WRITING `textContent` DIRECTLY ALSO SKIPS THE RE-ANNOUNCE. `core/a11y-sr` clears the region, waits a
// frame and then writes, and the comment says why: "o padrão limpar→requestAnimationFrame→escrever força o
// leitor a reanunciar mesmo texto repetido". Assigning the same string twice changes nothing in the DOM,
// so a screen reader says it once. Two identical comet reports in a row were announced once.
//
// ========================= WHY BOTH CHANNELS FIRE, AND WHY THAT IS NOT DOUBLE-SPEAKING =========================
// 📏 MEASURED IN THE ENGINE: `narrate` does not touch the live region (`platform/tts` gates on `soundOn`,
// `audioCat.tts.on` and non-empty text, then speaks) and `srSay` does not speak. The two cannot collide by
// construction, and the engine's own sonar calls both on the same line.
//
// ⚠️ THE ONE CASE WHERE A CHILD HEARS A SENTENCE TWICE is a screen reader running AND 🗨️ pressed. Screen
// reader presence is undetectable in a browser and every scheme claiming otherwise is wrong about
// somebody — and `platform/audio-mixer` puts `tts` in the categories that are BORN OFF, so the voice is
// silent until a child turns it on with the same icon that turns it off again.
import { describe, test, expect } from 'vitest';
import { createAnnouncer } from '../app/js/shell/announce.js';

function channels() {
  const said: string[] = [];
  const alerted: string[] = [];
  const spoken: string[] = [];
  return {
    said, alerted, spoken,
    srSay: (w: string) => said.push(w),
    srAlert: (w: string) => alerted.push(w),
    narrate: (w: string) => spoken.push(w),
  };
}

describe('an announcement reaches both channels', () => {
  test('⚠️ a polite one goes to the live region AND is spoken', () => {
    const c = channels();

    createAnnouncer(c).say('a bola voltou');

    expect(c.said, 'the screen reader was not told').toEqual(['a bola voltou']);
    expect(c.spoken, 'and nobody said it out loud').toEqual(['a bola voltou']);
    expect(c.alerted, 'a polite announcement must not interrupt').toEqual([]);
  });

  test('⚠️ an assertive one interrupts, and goes nowhere near the polite region', () => {
    /**
     * The two regions are not interchangeable. `aria-live="assertive"` cuts off whatever the reader is
     * saying; using it for a score would talk over the child constantly, and using the polite one for the
     * end of a game would let the news arrive after it stopped mattering.
     */
    const c = channels();

    createAnnouncer(c).alert('fim de jogo');

    expect(c.alerted).toEqual(['fim de jogo']);
    expect(c.said, 'an alert leaked into the status region').toEqual([]);
    expect(c.spoken, 'and it is spoken too').toEqual(['fim de jogo']);
  });

  test('⚠️ and the SAME sentence twice reaches the reader twice', () => {
    /**
     * ⚠️ THIS IS THE DEFECT THAT HID BEHIND `textContent =`. Assigning a string that is already there
     * changes no DOM, so the reader has nothing to notice. Two identical comet reports in a row were
     * announced once, and the second one was the one that told a child the mission had not moved.
     *
     * The seam does not implement the fix — `core/a11y-sr` does, with clear→frame→write — and this case is
     * what says the seam ROUTES through it rather than around it. The double is asserted on the channel
     * because a fake cannot have a frame.
     */
    const c = channels();
    const announce = createAnnouncer(c);

    announce.say('dois cometas');
    announce.say('dois cometas');

    expect(c.said).toEqual(['dois cometas', 'dois cometas']);
    expect(c.spoken).toEqual(['dois cometas', 'dois cometas']);
  });

  test('nothing is announced for nothing, because silence is a sentence too', () => {
    // An empty announcement clears a live region, which a reader may or may not report — and it would
    // spend the one interruption an assertive region gets on saying nothing at all.
    const c = channels();

    createAnnouncer(c).say('');
    createAnnouncer(c).alert('');

    expect([...c.said, ...c.alerted, ...c.spoken]).toEqual([]);
  });
});
