// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HALF OF THE SCOREBOARD THAT WAS MISSING.
//
// ⚠️ `control/high-score` WAS READ AND NEVER WRITTEN. It was transcribed from `high_score.cpp`, tested
// down to the checksum and the thirty-one-character cap, and shown under the table selector — and
// nothing in the game ever called `scorePosition`, `placeScore` or `writeTable`. Every game ended, the
// board said "nobody has played yet", and it always would have.
//
// Its orphan-ledger entry had been retired on the grounds that the title screen READS it. That was my
// own reasoning and it was wrong: "something imports it" is not "the feature works", and the ledger
// only ever asked the first question.
import { describe, test, expect } from 'vitest';
import { mountHighScoreDialog } from '../app/js/shell/high-score-dialog.js';
import { readTable, emptyTable, writeTable, placeScore, MAX_NAME, type HighScoreStore } from '../app/js/control/high-score.js';

interface FakeElement {
  tag: string; id: string; className: string; textContent: string; value: string;
  attributes: Record<string, string>; style: Record<string, string>;
  children: FakeElement[]; clicks: (() => void)[];
  keys: ((e: { code: string; key: string; preventDefault(): void; stopPropagation(): void }) => void)[];
  focused: number;
}

function fakeElement(tag: string): FakeElement {
  const el: FakeElement = {
    tag, id: '', className: '', textContent: '', value: '', attributes: {}, style: {},
    children: [], clicks: [], keys: [], focused: 0,
  };
  return Object.assign(el, {
    setAttribute(name: string, value: string) { el.attributes[name] = value; },
    appendChild(child: FakeElement) { el.children.push(child); return child; },
    focus() { el.focused++; },
    addEventListener(type: string, fn: never) {
      if (type === 'click') el.clicks.push(fn as () => void);
      if (type === 'keydown') el.keys.push(fn);
    },
  });
}

const memory = (): HighScoreStore & { held: Record<string, string> } => {
  const held: Record<string, string> = {};
  return { held, getItem: (k) => held[k] ?? null, setItem: (k, v) => { held[k] = v; } };
};

function harness(store: HighScoreStore = memory()) {
  const created: FakeElement[] = [];
  const host = fakeElement('div');
  let done = 0;
  const dialog = mountHighScoreDialog({
    doc: { createElement: (tag: string) => { const el = fakeElement(tag); created.push(el); return el; } } as never,
    host: host as never,
    store,
    t: (key) => key,
    onDone: () => { done++; },
  });
  const find = (tag: string) => created.find((e) => e.tag === tag);
  const buttons = (): FakeElement[] => created.filter((e) => e.tag === 'button');
  const root = (): FakeElement => host.children[0]!;
  /** A key pressed on the dialog, the way the cabinet sends one, reporting what it did to the event. */
  let stopped = 0;
  const press = (code: string): void => {
    for (const fn of root().keys) {
      fn({ code, key: code, preventDefault() {}, stopPropagation() { stopped++; } } as never);
    }
  };
  return {
    dialog, store, host, buttons, press, root, done: () => done, stopped: () => stopped,
    input: () => find('input'),
    /** The key the cursor is on, which IS the focused button — see the module for why those are one. */
    cursor: (): FakeElement | undefined =>
      buttons().find((b) => b.attributes['data-cursor'] === 'true'),
    typed: (): string => created.find((e) => e.attributes['data-name'] === 'true')?.textContent ?? '',
  };
}

describe('offering the board to a finished game', () => {
  test('⚠️ a score that places asks for a name', () => {
    const h = harness();

    expect(h.dialog.offer(12345)).toBe(true);
    expect(h.root().style.display, 'the dialog is on screen').toBe('flex');
    // ⚠️ THE FOCUS LANDS ON THE ALPHABET, NOT ON A FIELD. It used to be the text input; the cursor is
    // the focus now, so this is the same assertion pointed at the thing that replaced it.
    expect(h.cursor()?.focused, 'and the cursor has the focus').toBeGreaterThan(0);
  });

  test('⚠️ and a score that does NOT place shows nothing at all', () => {
    // Being told you failed to make the top five is not information anybody asked for. A score of
    // nought never places — `scorePosition` refuses at or below it before looking at the table — so a
    // player who drained three balls without scoring is not asked to sign for it.
    const h = harness();

    expect(h.dialog.offer(0)).toBe(false);
    expect(h.root().style.display).toBe('none');
  });

  test('a full board refuses a score below all five', () => {
    const store = memory();
    let table = emptyTable();
    for (const score of [9, 8, 7, 6, 5]) table = placeScore(table, { name: 'X', score: score * 1000 }, 0);
    writeTable(store, table);
    const h = harness(store);

    expect(h.dialog.offer(100)).toBe(false);
  });
});

describe('recording it', () => {
  /** Spells a word on the alphabet, the way a player does: walk to the letter, take it. */
  const spell = (h: ReturnType<typeof harness>, word: string): void => {
    for (const ch of word.toUpperCase()) {
      const at = h.buttons().findIndex((b) => b.attributes['data-key'] === ch);
      h.buttons()[at]!.clicks[0]!();
    }
  };
  const doneKey = (h: ReturnType<typeof harness>): FakeElement =>
    h.buttons().find((b) => b.attributes['data-act'] === 'done')!;

  test('⚠️ the name and the score reach the STORE, which is what was missing', () => {
    const h = harness();
    h.dialog.offer(4242);

    spell(h, 'ROCHA');
    doneKey(h).clicks[0]!();

    expect(readTable(h.store)[0]).toEqual({ name: 'ROCHA', score: 4242 });
  });

  test('⚠️ start records it too, because a cabinet finishes with start', () => {
    // The old version of this test said "Enter is what a text field means by done", which was true
    // about the field that used to be here. There is no field; Enter is START, and on this screen
    // that is what start is for — a player should not have to walk the cursor to the end of the
    // alphabet to say they have finished.
    const h = harness();
    h.dialog.offer(999);

    spell(h, 'JOSE');
    h.press('Enter');

    expect(readTable(h.store)[0]!.name).toBe('JOSE');
  });

  test('and a key that is no part of the cabinet records nothing', () => {
    const h = harness();
    h.dialog.offer(999);
    spell(h, 'JOSE');

    h.press('KeyZ');

    expect(readTable(h.store)[0]!.name, 'nothing was written').toBe('');
  });

  test('⚠️ an empty name is recorded as anonymous, not as an empty row', () => {
    // A blank line on a scoreboard reads as a defect. The score was earned either way.
    const h = harness();
    h.dialog.offer(500);

    // Three spaces, which is what a player leaning on the space key produces.
    h.buttons().find((b) => b.attributes['data-key'] === ' ')!.clicks[0]!();
    h.buttons().find((b) => b.attributes['data-key'] === ' ')!.clicks[0]!();
    doneKey(h).clicks[0]!();

    expect(readTable(h.store)[0]!.name).toBe('pinball.highScore.anonymous');
  });

  test('and the dialog closes and says so, so the board behind it can be redrawn', () => {
    const h = harness();
    h.dialog.offer(500);

    doneKey(h).clicks[0]!();

    expect(h.root().style.display).toBe('none');
    expect(h.done(), 'the caller is told').toBe(1);
  });
});

// ============================================================================================
// ⚠️ THE ALPHABET, WHICH IS WHAT THE DEV ASKED FOR AND WHAT A PINBALL HAS ALWAYS HAD.
//
// "A tela de melhor pontuação precisa de um alfabeto na tela para que o jogador escreva usando os
// botões do controle, não pelo teclado."
//
// A cabinet has two flippers, a plunger and a start button. It does not have a keyboard, and the
// machine this port is of asks for your initials with exactly those: the flippers walk an alphabet,
// the plunger takes the letter. Everything below is that, and the reason each piece is a real
// `<button>` is whackwhack's, quoted in the module: at the size this rasterises, canvas text is
// illegible, does not scale with the reader's own type setting and is invisible to a screen reader.
// Real buttons mean Tab, Enter and Space work because the platform makes them work.
// ============================================================================================
describe('the alphabet', () => {
  test('⚠️ there is no text field at all, which is the ask', () => {
    // The Dev's words are "não pelo teclado". A field left beside the alphabet would be the same
    // screen with more on it: the player still has to find a keyboard, and the cabinet still cannot
    // spell. This is the assertion that makes the change a change.
    const h = harness();
    h.dialog.offer(1000);

    expect(h.input(), 'a text input survives somewhere in the dialog').toBeUndefined();
  });

  test('every letter, every digit, a space, a rubout and a done', () => {
    const h = harness();
    const labels = h.buttons().map((b) => b.textContent);

    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(labels, `the alphabet is missing ${letter}`).toContain(letter);
    }
    for (const digit of '0123456789') {
      expect(labels, `the digits are missing ${digit}`).toContain(digit);
    }
    expect(h.buttons().filter((b) => b.attributes['data-key'] === ' '), 'a space').toHaveLength(1);
    expect(h.buttons().filter((b) => b.attributes['data-act'] === 'rub'), 'a rubout').toHaveLength(1);
    expect(h.buttons().filter((b) => b.attributes['data-act'] === 'done'), 'a done').toHaveLength(1);
  });

  test('⚠️ the cursor IS the focused button, so there is one fact and not two', () => {
    // A highlight kept beside the focus is two answers to "where am I", and they come apart the first
    // time somebody presses Tab. This repository has found that shape four times under other names.
    const h = harness();
    h.dialog.offer(1000);

    expect(h.cursor(), 'something is under the cursor').toBeDefined();
    expect(h.cursor()!.focused, 'and it has been focused').toBeGreaterThan(0);
  });
});

describe('writing with the cabinet', () => {
  test('the right flipper walks forward and the left flipper walks back', () => {
    const h = harness();
    h.dialog.offer(1000);
    const first = h.cursor()!.textContent;

    h.press('KeyD');
    const second = h.cursor()!.textContent;
    h.press('KeyA');

    expect(second, 'the right flipper moved the cursor').not.toBe(first);
    expect(h.cursor()!.textContent, 'and the left flipper moved it back').toBe(first);
  });

  test('⚠️ and it wraps, because a cabinet has no way to say "stop"', () => {
    // Walking off the end of the alphabet and stopping there is a player pressing a flipper that does
    // nothing, on a machine whose only feedback is that something moves.
    const h = harness();
    h.dialog.offer(1000);
    const first = h.cursor()!.textContent;

    h.press('KeyA');

    expect(h.cursor()!.textContent, 'left from the first key wrapped to the last').not.toBe(first);
    h.press('KeyD');
    expect(h.cursor()!.textContent, 'and back again').toBe(first);
  });

  test('the plunger takes the letter under the cursor', () => {
    const h = harness();
    h.dialog.offer(1000);

    h.press('KeyU');

    expect(h.typed(), 'the first letter of the alphabet').toBe('A');
  });

  test('⚠️ and the name is shown as it is spelled, in something a reader announces', () => {
    // The player cannot see the letter they just took unless the screen says so, and a player who
    // cannot see the screen at all needs it announced. Both are the same element.
    const h = harness();
    h.dialog.offer(1000);
    h.press('KeyU');
    h.press('KeyD');
    h.press('KeyU');

    const shown = h.buttons().length && h.typed();
    expect(shown, 'two letters spelled').toBe('AB');
  });

  test('the rubout takes the last letter back', () => {
    const h = harness();
    h.dialog.offer(1000);
    h.press('KeyU');
    h.press('KeyD');
    h.press('KeyU');

    h.buttons().find((b) => b.attributes['data-act'] === 'rub')!.clicks[0]!();

    expect(h.typed()).toBe('A');
  });

  test('⚠️ and rubbing out an empty name does nothing rather than throwing', () => {
    const h = harness();
    h.dialog.offer(1000);

    h.buttons().find((b) => b.attributes['data-act'] === 'rub')!.clicks[0]!();

    expect(h.typed()).toBe('');
  });

  test('start records what was spelled, without touching the alphabet again', () => {
    const h = harness();
    h.dialog.offer(4242);
    h.press('KeyU');

    h.press('Enter');

    expect(readTable(h.store)[0]).toEqual({ name: 'A', score: 4242 });
    expect(h.done(), 'and the dialog said it was finished').toBe(1);
  });

  test('⚠️ the thirty-one the original keeps is enforced on the alphabet too', () => {
    // `placeScore` truncates because `high_score.cpp` does. An alphabet that let a player keep
    // pressing would spell a name and then silently lose the end of it.
    const h = harness();
    h.dialog.offer(1000);
    for (let i = 0; i < MAX_NAME + 5; i++) h.press('KeyU');

    expect(h.typed()).toHaveLength(MAX_NAME);
  });

  test('and a key that is no part of the cabinet spells nothing', () => {
    const h = harness();
    h.dialog.offer(1000);

    h.press('KeyZ');

    expect(h.typed()).toBe('');
  });
});

describe('and the cabinet is not shared while this screen owns it', () => {
  test('⚠️ a key the alphabet uses does not reach the game underneath', () => {
    /**
     * ⚠️ THE DIALOG LIVES INSIDE `#game-region`, WHICH IS WHERE `bindPinballControls` BINDS. So a
     * keydown on a letter bubbles straight into the game: pressing START to save would save the score
     * AND toggle the pause, and every flipper press would flap a paddle behind the screen. The game is
     * over by then, which is exactly why this would have been found by somebody playing rather than by
     * anything here — the effects are invisible.
     */
    const h = harness();
    h.dialog.offer(1000);

    h.press('KeyD');
    h.press('KeyU');
    h.press('Enter');

    expect(h.stopped(), 'three cabinet keys, three stopped').toBe(3);
  });

  test('and a key it does NOT use is left alone, so the accessibility keys still work', () => {
    // Blind mode, the sonar and the palette are on B, S and C. They are switches for how the game is
    // PERCEIVED and they have to keep working on every screen, including this one.
    const h = harness();
    h.dialog.offer(1000);

    h.press('KeyB');

    expect(h.stopped(), 'nothing was swallowed').toBe(0);
  });
});
