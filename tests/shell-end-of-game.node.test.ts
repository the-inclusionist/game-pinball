// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT HAPPENS WHEN A GAME ENDS — DRIVEN, NOT READ OFF A SOURCE FILE.
//
// ⚠️ THIS FILE EXISTS TO CLOSE A GAP I REPORTED RATHER THAN PAPERED OVER. The comet drill's win — twenty
// mission points — ran three lines in `main.ts` that no test had ever executed. The only thing watching
// them was `tests/shell-boot`, which counts the `highScores.offer(` calls in the source and says all of
// them are ends of a game. That is a gate about a string in a file: it cannot tell whether the board is
// offered the right score, whether the game actually stops, or whether the player is told.
//
// Driving a real win was not the way out. It means twenty hits with a real ball in a real browser, or a
// back door into the score — and the back door is refused, in as many words, in the comment on the debug
// surface that would have provided it. So the REACTION moved into a function and the function is called
// here. The TRIGGER is `tests/comet-mission.node`: twenty points and `won` is true.
import { describe, test, expect } from 'vitest';
import { endGame, type EndOfGameOptions } from '../app/js/shell/end-of-game.js';

/** Records what was done and in what order, which is half of what this file is checking. */
function watcher() {
  const log: string[] = [];
  const offered: number[] = [];
  const said: string[] = [];
  const options: EndOfGameOptions = {
    offer: (score) => { log.push('offer'); offered.push(score); },
    leave: () => { log.push('leave'); },
    toTitle: () => { log.push('toTitle'); },
    announce: (words) => { log.push('announce'); said.push(words); },
  };
  return { options, log, offered, said };
}

describe('ending a game', () => {
  test('⚠️ it does all three, and offers the board exactly once', () => {
    /**
     * ⚠️ EACH OF THE THREE IS A REAL DEFECT IF IT GOES MISSING, which is why they are asserted apart
     * rather than as a count. No `offer` is a game whose score is thrown away. No `leave` is a game
     * that is over and still running — the comets go on falling, the ball goes on rolling behind the
     * title screen. No `toTitle` leaves the player on a table that has nothing left to ask of them,
     * which before the pause menu existed was a state whose only exit was reloading the page.
     *
     * ⚠️ AND "EXACTLY ONCE" IS THE ONE THAT COSTS SOMETHING TO GET WRONG. A board offered twice puts
     * the same game on it twice, and the five names a school machine holds become one child's evening.
     */
    const { options, log, offered } = watcher();

    endGame(options, 12_500, 'you won');

    expect(log.filter((step) => step === 'offer'), 'the board was not offered exactly once')
      .toHaveLength(1);
    expect(log).toContain('leave');
    expect(log).toContain('toTitle');
    expect(offered, 'the board was offered a score that is not the one played').toEqual([12_500]);
  });

  test('⚠️ and the announcement comes BEFORE the screen changes', () => {
    // A player who cannot see the screen learns the game is over from the live region. Said after the
    // title is up, the last thing they heard was a comet and the first thing they meet is a menu they
    // were never told they had been sent to.
    const { options, log, said } = watcher();

    endGame(options, 400, 'mission complete');

    expect(log.indexOf('announce'), 'the title screen went up before the player was told')
      .toBeLessThan(log.indexOf('toTitle'));
    expect(said).toEqual(['mission complete']);
  });

  test('⚠️ nothing to say means nothing is said, rather than a blank interruption', () => {
    /**
     * The drained last ball takes this path: the HUD has already put "Fim de jogo" in the corner, so
     * there is no sentence owed. An empty live-region update is still an update — a screen reader
     * interrupts whatever it was reading and then has nothing to read, which is worse than silence.
     */
    const { options, log } = watcher();

    endGame(options, 0);
    endGame(options, 0, '');

    expect(log.filter((step) => step === 'announce'), 'an empty announcement was pushed out')
      .toEqual([]);
    expect(log.filter((step) => step === 'toTitle'), 'and the game still ended, twice')
      .toHaveLength(2);
  });

  test('a game ends even when nobody is listening for the announcement', () => {
    // `announce` is optional: the demonstration has no live region of its own to write to.
    const log: string[] = [];
    endGame({
      offer: () => log.push('offer'), leave: () => log.push('leave'), toTitle: () => log.push('toTitle'),
    }, 99, 'said to nobody');

    expect(log, 'a missing announcer stopped the game from ending').toEqual(['offer', 'leave', 'toTitle']);
  });
});
