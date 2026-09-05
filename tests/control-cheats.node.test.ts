// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  makeCheatController, cheatBumpRank, CHEAT_BUFFER_SIZE, CHEAT_CODES,
  type CheatActions,
} from '../app/js/control/cheats.js';

function build() {
  const log: string[] = [];
  let easy = false;
  let unlimited = false;
  let cheatMode = false;
  const actions: CheatActions = {
    toggleCheatMode() { cheatMode = !cheatMode; log.push('cheatMode:' + cheatMode); },
    armGravityWell() { log.push('gravityWell'); },
    addExtraBall(seconds) { log.push('extraBall:' + seconds); },
    toggleUnlimitedBalls() { unlimited = !unlimited; log.push('unlimited:' + unlimited); },
    bumpRank() { log.push('bumpRank'); },
    toggleEasyMode() { easy = !easy; log.push('easy:' + easy); return easy; },
    raiseBlocker() { log.push('raiseBlocker'); },
    expireBlocker() { log.push('expireBlocker'); },
    disableGates() { log.push('disableGates'); },
    markCheatsUsed() { log.push('marked'); },
  };
  const control = makeCheatController(actions);
  const type = (text: string): boolean => {
    let fired = false;
    for (const key of text) fired = control(key) || fired;
    return fired;
  };
  return { log, type, control };
}

describe('the cheat buffer is eleven characters and a set of suffixes', () => {
  test('a four-letter cheat fires when its last four characters line up', () => {
    const b = build();

    expect(b.type('1max')).toBe(true);
    expect(b.log).toEqual(['extraBall:2', 'marked']);
  });

  test('anything typed before it is simply pushed out of the way', () => {
    // One rolling buffer and a suffix comparison — no per-cheat progress, no state machine. Which is
    // why a cheat can be typed at any moment, after any amount of nonsense.
    const b = build();

    b.type('zzzzzzzzzzzzzzzzzz1max');

    expect(b.log).toEqual(['extraBall:2', 'marked']);
  });

  test('the longest cheat is exactly the size of the buffer', () => {
    // `hidden test` is eleven characters, and the buffer is eleven. Nothing longer can ever be
    // recognized, which is the real reason for that number.
    expect(CHEAT_BUFFER_SIZE).toBe(11);
    expect(Math.max(...CHEAT_CODES.map((c) => c.code.length))).toBe(CHEAT_BUFFER_SIZE);
  });

  test('the longest cheat still fires after a full buffer of junk', () => {
    const b = build();

    b.type('qwertyuiopasdfghjklhidden test');

    expect(b.log).toEqual(['cheatMode:true', 'marked']);
  });

  test('the same cheat spelled with a TAB also works', () => {
    // Two spellings of one cheat, because of how the key handler reports the character between the
    // two words.
    const b = build();

    b.type('hidden\ttest');

    expect(b.log).toEqual(['cheatMode:true', 'marked']);
  });

  test('an unrecognized key does nothing and marks nothing', () => {
    const b = build();

    expect(b.type('1mbx')).toBe(false);
    expect(b.log).toEqual([]);
  });

  test('a partial cheat that gets interrupted never fires', () => {
    const b = build();

    b.type('1ma?x');

    expect(b.log).toEqual([]);
  });
});

describe('what each cheat does', () => {
  test('bmax toggles the unlimited-balls flag, both ways', () => {
    const b = build();

    b.type('bmax');
    b.type('bmax');

    expect(b.log).toEqual(['unlimited:true', 'marked', 'unlimited:false', 'marked']);
  });

  test('gmax arms the gravity well and rmax bumps the rank', () => {
    const b = build();

    b.type('gmax');
    b.type('rmax');

    expect(b.log).toEqual(['gravityWell', 'marked', 'bumpRank', 'marked']);
  });

  test('easy mode ON raises the drain blocker and shuts both gates', () => {
    const b = build();

    b.type('easy mode');

    expect(b.log).toEqual(['easy:true', 'raiseBlocker', 'disableGates', 'marked']);
  });

  test('easy mode OFF sends the blocker a timeout instead of lowering it', () => {
    // Which is not the same thing: a blocker in its first phase answers a timeout by starting its
    // flashing extension. Switching easy mode off gives the player the usual warning rather than
    // dropping the blocker under a ball in flight.
    const b = build();
    b.type('easy mode');

    b.type('easy mode');

    expect(b.log.slice(4)).toEqual(['easy:false', 'expireBlocker', 'marked']);
  });

  test('every recognized cheat marks the game as cheated', () => {
    const b = build();

    for (const cheat of CHEAT_CODES) b.type(cheat.code);

    expect(b.log.filter((l) => l === 'marked')).toHaveLength(CHEAT_CODES.length);
  });
});

describe('the rank cheat', () => {
  function build(rank: number) {
    const log: string[] = [];
    const circle = {
      get onCount() { return rank; },
      resetAndTurnOn(period: number) { rank++; log.push('on:' + period); },
    };
    return {
      log, circle,
      run: () => cheatBumpRank({
        middleCircle: circle,
        rankText: (index) => 'RANK ' + index,
        showMission: (text, seconds) => log.push('mission:' + text + ':' + seconds),
        playSound: (name) => log.push('sound:' + name),
        promotionSound: 'promote',
      }),
    };
  }

  test('it lights the next circle and announces the rank it just reached', () => {
    // The rank is read BEFORE the lamp is lit, so the text names the rank whose lamp is being turned
    // on — index 3 of the names, when three were already lit.
    const b = build(3);

    b.run();

    expect(b.log).toEqual(['on:2', 'mission:RANK 3:8', 'sound:promote']);
  });

  test('at the top rank it does nothing at all', () => {
    const b = build(9);

    b.run();

    expect(b.log).toEqual([]);
  });
});
