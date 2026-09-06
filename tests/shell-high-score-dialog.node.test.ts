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
  keys: ((e: { key: string; preventDefault(): void }) => void)[];
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
  const find = (tag: string) => created.find((e) => e.tag === tag)!;
  return { dialog, store, host, input: () => find('input'), confirm: () => find('button'),
    root: () => host.children[0]!, done: () => done };
}

describe('offering the board to a finished game', () => {
  test('⚠️ a score that places asks for a name', () => {
    const h = harness();

    expect(h.dialog.offer(12345)).toBe(true);
    expect(h.root().style.display, 'the dialog is on screen').toBe('flex');
    expect(h.input().focused, 'and the field has the focus').toBeGreaterThan(0);
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
  test('⚠️ the name and the score reach the STORE, which is what was missing', () => {
    const h = harness();
    h.dialog.offer(4242);

    h.input().value = 'ROCHA';
    h.confirm().clicks[0]!();

    expect(readTable(h.store)[0]).toEqual({ name: 'ROCHA', score: 4242 });
  });

  test('Enter records it too, because Enter is what a text field means by done', () => {
    const h = harness();
    h.dialog.offer(999);

    h.input().value = 'JOSÉ';
    for (const fn of h.input().keys) fn({ key: 'Enter', preventDefault() {} });

    expect(readTable(h.store)[0]!.name).toBe('JOSÉ');
  });

  test('and a key that is not Enter records nothing', () => {
    const h = harness();
    h.dialog.offer(999);

    h.input().value = 'JOSÉ';
    for (const fn of h.input().keys) fn({ key: 'a', preventDefault() {} });

    expect(readTable(h.store)[0]!.name).toBe('');
  });

  test('⚠️ an empty name is recorded as anonymous, not as an empty row', () => {
    // A blank line on a scoreboard reads as a defect. The score was earned either way.
    const h = harness();
    h.dialog.offer(500);

    h.input().value = '   ';
    h.confirm().clicks[0]!();

    expect(readTable(h.store)[0]!.name).toBe('pinball.highScore.anonymous');
  });

  test('the field refuses more than the thirty-one the original keeps', () => {
    const h = harness();

    expect(h.input().attributes['maxlength']).toBe(String(MAX_NAME));
  });

  test('and the dialog closes and says so, so the board behind it can be redrawn', () => {
    const h = harness();
    h.dialog.offer(500);

    h.confirm().clicks[0]!();

    expect(h.root().style.display).toBe('none');
    expect(h.done(), 'the caller is told').toBe(1);
  });
});
