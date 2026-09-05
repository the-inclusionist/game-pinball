// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { drainBall, BASE_BONUS, type DrainLamp, type DrainOptions } from '../app/js/control/drain.js';
import { createScoreState } from '../app/js/control/score.js';

/** A lamp that records what was done to it, because the drain talks to lamps and little else. */
function lamp(on = false): DrainLamp & { readonly log: string[] } {
  const log: string[] = [];
  return {
    log,
    get lit() { return on; },
    turnOn() { on = true; log.push('on'); },
    turnOff() { on = false; log.push('off'); },
    resetTimed() { log.push('reset'); },
    messageField: 0,
  };
}

function build(over: Partial<DrainOptions['table']> = {}) {
  const shootAgainLamp = lamp();
  const spareLamp = lamp();
  const bonusHoldLamp = lamp();
  const missionLamp = { messageField: -1 };
  const perBallLamps = [lamp(true), lamp(true)];
  const perBallComponents = [{ resets: 0, reset() { this.resets++; } }];
  const info: { text: string; seconds: number }[] = [];
  const sounds: string[] = [];
  const music: string[] = [];
  const calls: string[] = [];

  const o: DrainOptions = {
    table: {
      tiltLocked: false, multiballCount: 0, extraBalls: 0,
      ballCount: 3, currentPlayer: 0, playerCount: 1, unlimitedBalls: false,
      ...over,
    },
    score: createScoreState(),
    shootAgainLamp, spareLamp, bonusHoldLamp, missionLamp,
    perBallLamps, perBallComponents,
    missionOnGameOver: 34, missionOnNextBall: 33,
    showInfo: (text, seconds) => info.push({ text, seconds }),
    playSound: (n) => sounds.push(n),
    playMusic: (n) => music.push(n),
    bonusText: (points) => 'BONUS ' + points,
    heldShootAgainText: 'STILL HOLDING ONE',
    spareSpentText: 'SPARE SPENT',
    extraBallText: (player) => 'EXTRA BALL P' + player,
    returnBall: () => calls.push('returnBall'),
    switchToNextPlayer: () => calls.push('nextPlayer'),
    dispatchMissionComplete: () => calls.push('missionComplete'),
    clearTiltLock: () => calls.push('clearTilt'),
  };

  return {
    o, shootAgainLamp, spareLamp, bonusHoldLamp, missionLamp,
    perBallLamps, perBallComponents, info, sounds, music, calls,
  };
}

describe('the drain asks four questions, in order', () => {
  test('a lit SHOOT AGAIN gives the ball back and costs nothing', () => {
    const b = build({ ballCount: 3 });
    b.shootAgainLamp.turnOn();

    const result = drainBall(b.o);

    expect(result).toEqual({ outcome: 'shootAgain', gameOver: false });
    expect(b.o.table.ballCount).toBe(3);
    expect(b.shootAgainLamp.lit).toBe(true);
  });

  test('a lit SPARE is SPENT into the shoot again', () => {
    // The spare is not a second save: it becomes the first one and is consumed doing so.
    const b = build();
    b.spareLamp.turnOn();

    const result = drainBall(b.o);

    expect(result.outcome).toBe('spareSpent');
    expect(b.spareLamp.lit).toBe(false);
    expect(b.shootAgainLamp.lit).toBe(true);
    expect(b.o.table.ballCount).toBe(3);
  });

  test('holding BOTH spends neither — the shoot again answers first', () => {
    // The order of the questions is the whole rule. Asking the spare first would burn it while a free
    // ball was already in hand.
    const b = build();
    b.shootAgainLamp.turnOn();
    b.spareLamp.turnOn();

    expect(drainBall(b.o).outcome).toBe('shootAgain');
    expect(b.spareLamp.lit).toBe(true);
  });

  test('with other balls in play NOTHING happens but a lamp going out', () => {
    const b = build({ multiballCount: 2 });

    const result = drainBall(b.o);

    expect(result.outcome).toBe('multiballContinues');
    expect(b.o.table.ballCount).toBe(3);
    expect(b.o.score.curScore).toBe(0);
    expect(b.music).toEqual([]);
  });

  test('the LAST of the extra balls restores the ordinary music', () => {
    const b = build({ multiballCount: 1 });

    drainBall(b.o);

    expect(b.music).toEqual(['track1']);
  });

  test('a save beats multiball: the lamps are asked before the count', () => {
    const b = build({ multiballCount: 2 });
    b.spareLamp.turnOn();

    expect(drainBall(b.o).outcome).toBe('spareSpent');
  });

  test('with no saves and no other balls, the ball is gone', () => {
    const b = build();

    expect(drainBall(b.o).outcome).toBe('ballLost');
    expect(b.o.table.ballCount).toBe(2);
  });

  test('UNLIMITED BALLS short-circuits every question', () => {
    const b = build();

    expect(drainBall(b.o).outcome).toBe('ballLost');

    const cheat = build({ unlimitedBalls: true });
    expect(drainBall(cheat.o).outcome).toBe('returned');
    expect(cheat.calls).toEqual(['returnBall']);
    expect(cheat.o.table.ballCount).toBe(3);
  });
});

describe('the bonus is cashed in when the ball dies', () => {
  test('the accumulated bonus becomes score when the ball dies', () => {
    const b = build();
    b.o.score.bonusScore = 175000;

    drainBall(b.o);

    expect(b.o.score.curScore).toBe(175000);
    expect(b.info[0]).toEqual({ text: 'BONUS 175000', seconds: 2 });
  });

  test('it is NOT multiplied, however high the multiplier is', () => {
    // `SpecialAddScore`. A x10 multiplier paying ten times for the bonus would dwarf the whole ball.
    const b = build();
    b.o.score.bonusScore = 100000;
    b.o.score.scoreMultiplier = 4; // x10

    drainBall(b.o);

    expect(b.o.score.curScore).toBe(100000);
  });

  test('a TILTED table forfeits the bonus and the saves it was holding', () => {
    const b = build({ tiltLocked: true });
    b.o.score.bonusScore = 175000;
    b.shootAgainLamp.turnOn();
    b.spareLamp.turnOn();

    const result = drainBall(b.o);

    expect(result.outcome).toBe('ballLost');
    expect(b.o.score.curScore).toBe(0);
    expect(b.shootAgainLamp.lit).toBe(false);
    expect(b.spareLamp.lit).toBe(false);
  });

  test('a save keeps the bonus for the next attempt: nothing is cashed in', () => {
    const b = build();
    b.o.score.bonusScore = 90000;
    b.shootAgainLamp.turnOn();

    drainBall(b.o);

    expect(b.o.score.curScore).toBe(0);
    expect(b.o.score.bonusScore).toBe(90000);
  });
});

describe('extra balls are spent before the ball count is', () => {
  test('an extra ball is consumed and the ball count is untouched', () => {
    const b = build({ extraBalls: 2, ballCount: 3 });

    drainBall(b.o);

    expect(b.o.table.extraBalls).toBe(1);
    expect(b.o.table.ballCount).toBe(3);
    expect(b.calls).not.toContain('nextPlayer');
  });

  test('an extra ball still pays the bonus and still resets the ball', () => {
    // It ends a BALL, not merely a turn: the reset list runs either way.
    const b = build({ extraBalls: 1 });
    b.o.score.bonusScore = 50000;

    drainBall(b.o);

    expect(b.o.score.curScore).toBe(50000);
    expect(b.perBallLamps.every((l) => !l.lit)).toBe(true);
  });
});

describe('only the last ball of the last player ends the game', () => {
  test('player one of two hands over instead of ending anything', () => {
    const b = build({ playerCount: 2, currentPlayer: 0, ballCount: 1 });

    const result = drainBall(b.o);

    expect(result.gameOver).toBe(false);
    expect(b.calls).toContain('nextPlayer');
    expect(b.spareLamp.messageField).toBe(0);
  });

  test('the last player with balls left also hands over', () => {
    const b = build({ playerCount: 2, currentPlayer: 1, ballCount: 3 });

    expect(drainBall(b.o).gameOver).toBe(false);
    expect(b.calls).toContain('nextPlayer');
  });

  test('the last ball of the last player is game over', () => {
    const b = build({ playerCount: 2, currentPlayer: 1, ballCount: 1 });

    const result = drainBall(b.o);

    expect(result.gameOver).toBe(true);
    expect(b.calls).not.toContain('nextPlayer');
    expect(b.spareLamp.messageField).toBe(1);
    expect(b.missionLamp.messageField).toBe(34);
  });

  test('an ordinary end of ball points the mission lamp at the next ball', () => {
    const b = build();

    drainBall(b.o);

    expect(b.missionLamp.messageField).toBe(33);
    expect(b.calls).toContain('missionComplete');
  });
});

describe('the reset list is the definition of "per ball"', () => {
  test('every listed lamp goes out and is untimed', () => {
    const b = build();

    drainBall(b.o);

    expect(b.perBallLamps.map((l) => l.log)).toEqual([['off', 'reset'], ['off', 'reset']]);
    expect(b.perBallComponents[0]!.resets).toBe(1);
    expect(b.calls).toContain('clearTilt');
  });

  test('a SAVED ball resets nothing — the ball never ended', () => {
    const b = build();
    b.spareLamp.turnOn();

    drainBall(b.o);

    expect(b.perBallLamps.every((l) => l.lit)).toBe(true);
    expect(b.perBallComponents[0]!.resets).toBe(0);
  });
});

describe('what bonus hold bought', () => {
  test('without the hold, the bonus drops back to its base', () => {
    const b = build();
    b.o.score.bonusScore = 400000;

    drainBall(b.o);

    expect(b.o.score.bonusScore).toBe(BASE_BONUS);
    expect(BASE_BONUS).toBe(25000);
  });

  test('with the hold lit, the accumulator survives and the lamp is spent', () => {
    const b = build();
    b.o.score.bonusScore = 400000;
    b.bonusHoldLamp.turnOn();

    drainBall(b.o);

    expect(b.o.score.bonusScore).toBe(400000);
    expect(b.bonusHoldLamp.lit).toBe(false);
  });

  test('the hold is spent per ball, not per game', () => {
    const b = build();
    b.o.score.bonusScore = 400000;
    b.bonusHoldLamp.turnOn();
    drainBall(b.o);

    b.o.score.bonusScore = 500000;
    drainBall(b.o);

    expect(b.o.score.bonusScore).toBe(BASE_BONUS);
  });
});

describe('⚠️ the three shoot-again lines mean three different things', () => {
  test('holding one already shows the HELD line, and it stays on screen', () => {
    // `STRING197`, displayed for -1 — until something replaces it. The port had all three of these
    // collapsed into one per-player line, which said "player two, shoot again" at three moments that
    // are not the same moment.
    const b = build();
    b.shootAgainLamp.turnOn();

    drainBall(b.o);

    expect(b.info[0]).toEqual({ text: 'STILL HOLDING ONE', seconds: -1 });
  });

  test('a spare spent shows the SPARE line, for two seconds', () => {
    // `STRING196`. A different string and a different duration: this one is news, the other is a state.
    const b = build();
    b.spareLamp.turnOn();

    drainBall(b.o);

    expect(b.info[0]).toEqual({ text: 'SPARE SPENT', seconds: 2 });
  });

  test('⚠️ and an extra ball names the PLAYER, which the other two never do', () => {
    // `STRING198`..`STRING201`, one per player. This is the only one of the three that changes with
    // who is playing, and it is the one the original chose by `CurrentPlayer`.
    const b = build({ extraBalls: 1, currentPlayer: 2 });

    drainBall(b.o);

    expect(b.info.some((line) => line.text === 'EXTRA BALL P2')).toBe(true);
  });
});
