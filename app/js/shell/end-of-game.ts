// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/end-of-game — the four things that happen when a game is over, in one place.
//
// ========================= WHY THIS IS A MODULE AND NOT THREE LINES =========================
// A game can end three ways: the last ball drains, the player chooses "Encerrar partida", or the comet
// drill reaches twenty points and is WON. All three owe the player the same four things — say it, offer
// the board, stop the game, show the title — and until this module they were written out at each site.
//
// ⚠️ AND THE THIRD SITE WAS UNTESTED, which is why it moved. `tests/shell-boot` counts the calls to
// `highScores.offer(` in `main.ts` and says they are all ends of a game; that gate is real and stays,
// but it is a gate about a STRING in a file. Nothing drove a win and watched what happened, because
// driving one means twenty real hits in a browser or a back door into the score — and the back door is
// refused in the comment on the gate that would have used it.
//
// A function is the way out of that. The trigger is proved in `tests/comet-mission.node` (twenty points
// and `won` is true); the reaction is proved here, by calling it and watching. What is left in `main.ts`
// is one line that names both.
//
// ⚠️ THE ANNOUNCEMENT GOES FIRST, AND THAT IS THE ORDER RATHER THAN AN ORDERING. A player who cannot
// see the screen learns that the game is over from the live region; putting the title screen up before
// saying so means the last thing they heard was a comet, and the first thing they meet is a menu they
// were not told they had been sent to.

export interface EndOfGameOptions {
  /**
   * The high-score board. Called with the final score, and called ONCE.
   *
   * ⚠️ IT DECIDES FOR ITSELF WHETHER TO SHOW ANYTHING. `mountHighScoreDialog.offer` asks the board and
   * shows nothing when the score does not place — being told you failed to make the top five is not
   * information anybody asked for.
   */
  readonly offer: (score: number) => void;
  /** Stops the game: the phase, the HUD, the ball, the camera and the comet drill. */
  readonly leave: () => void;
  /** Puts the player back on the title screen and redraws it. */
  readonly toTitle: () => void;
  /** Says it, for a player who cannot see the screen change. Absent means there is nothing to say. */
  readonly announce?: (words: string) => void;
}

/**
 * Ends the game.
 *
 * `words` is what to announce. Omitted — as it is for a drained last ball, which the HUD has already
 * reported — nothing is said, because an EMPTY live-region update is an interruption that carries no
 * information, and a screen reader reads the interruption either way.
 */
export function endGame(o: EndOfGameOptions, score: number, words?: string): void {
  if (words !== undefined && words !== '') o.announce?.(words);
  o.offer(score);
  o.leave();
  o.toTitle();
}
