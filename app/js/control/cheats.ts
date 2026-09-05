// SPDX-License-Identifier: AGPL-3.0-or-later
// control/cheats — the back door. Port of `control::pbctrl_bdoor_controller` and
// `control::cheat_bump_rank`.
//
// ========================= ONE ROLLING BUFFER, AND SUFFIX COMPARISONS =========================
// There is no state machine and no per-cheat progress counter. Every keystroke shifts an
// eleven-character buffer left by one and drops the new character on the end; then each cheat is
// tested by comparing the LAST n characters against its code. That is the whole mechanism.
//
// It buys two things worth noticing. A cheat can be typed at any moment, after any amount of
// nonsense, because the nonsense simply falls off the front. And the buffer being eleven characters
// is not arbitrary — `hidden test` is eleven characters, so the buffer is exactly as long as the
// longest cheat and nothing longer could ever be recognised.
//
// `hidden test` has a second spelling with a tab in place of the space, because of how the original's
// key handler reports the character between the two words.
//
// ========================= AN EASTER EGG IS NOT A CHEAT =========================
// Every branch that matches falls through to `TableG->CheatsUsed = 1` — except the two Full Tilt
// easter eggs, which `return` before reaching it. Typing the credits does not mark your game; giving
// yourself unlimited balls does.
//
// Those two branches are NOT ported. They print a list of quotes and a thirty-five-line credit roll
// belonging to Cinematronics and Maxis, which is third-party text this repository does not carry (see
// CLAUDE.md), and they are guarded by `pb::FullTiltMode`, which is false in Space Cadet — so nothing
// observable is lost.
//
// ========================= SWITCHING EASY MODE OFF IS NOT LOWERING THE BLOCKER =========================
// It sends the blocker a `ControlTimerExpired` instead. A blocker in its first phase answers that by
// starting its flashing extension (see `control/feed`), so the player gets the usual warning rather
// than having the drain open under a ball already in flight. Reusing the timeout in place of a
// disable is the entire difference.

/** `hidden test` is eleven characters, and so is the buffer. */
export const CHEAT_BUFFER_SIZE = 11;

/** Everything the back door can do. */
export interface CheatActions {
  toggleCheatMode(): void;
  armGravityWell(): void;
  addExtraBall(seconds: number): void;
  toggleUnlimitedBalls(): void;
  bumpRank(): void;
  /** Returns the state it has just been switched INTO. */
  toggleEasyMode(): boolean;
  raiseBlocker(): void;
  /** `DrainBallBlockerControl(ControlTimerExpired, block1)` — see this module's header. */
  expireBlocker(): void;
  disableGates(): void;
  markCheatsUsed(): void;
}

export interface CheatCode {
  readonly code: string;
  readonly run: (a: CheatActions) => void;
}

/** The order matters only in that the original tests them in it; no two codes overlap. */
export const CHEAT_CODES: readonly CheatCode[] = [
  { code: 'hidden test', run: (a) => a.toggleCheatMode() },
  { code: 'hidden\ttest', run: (a) => a.toggleCheatMode() },
  { code: 'gmax', run: (a) => a.armGravityWell() },
  { code: '1max', run: (a) => a.addExtraBall(2) },
  { code: 'bmax', run: (a) => a.toggleUnlimitedBalls() },
  { code: 'rmax', run: (a) => a.bumpRank() },
  {
    code: 'easy mode',
    run: (a) => {
      if (a.toggleEasyMode()) {
        a.raiseBlocker();
        a.disableGates();
      } else {
        a.expireBlocker();
      }
    },
  },
];

/**
 * `pbctrl_bdoor_controller`. Feed it one character at a time; it reports whether a cheat fired.
 * The original allowed cheats only before the first launch, which is a caller's rule, not this one's.
 */
export function makeCheatController(actions: CheatActions): (key: string) => boolean {
  let buffer = '';

  return (key: string): boolean => {
    // Shift left by one and drop the new character on the end. Keeping the whole history instead
    // would behave identically — a suffix match cannot see past the longest code — so this line is
    // transcription and memory hygiene, not a rule. No test can distinguish it, and none pretends to.
    buffer = (buffer + key).slice(-CHEAT_BUFFER_SIZE);

    const cheat = CHEAT_CODES.find((c) => buffer.endsWith(c.code));
    if (!cheat) return false;

    cheat.run(actions);
    actions.markCheatsUsed();
    return true;
  };
}

/* ===================== THE RANK CHEAT ===================== */

export interface CheatBumpRankOptions {
  /** The rank circle. Its lit count IS the rank — see `control/rank`. */
  readonly middleCircle: { readonly onCount: number; resetAndTurnOn(period: number): void };
  readonly rankText: (index: number) => string;
  readonly showMission: (text: string, seconds: number) => void;
  readonly playSound: (name: string) => void;
  readonly promotionSound: string;
}

/**
 * `cheat_bump_rank`. The rank is read BEFORE the lamp is lit, so the announcement names the rank whose
 * lamp is being turned on. The guard is the constant 9, not the circle's size — the same constant
 * `AddRankProgress` uses, and the shipped table happens to have nine lamps.
 */
export function cheatBumpRank(o: CheatBumpRankOptions): void {
  const rank = o.middleCircle.onCount;
  if (rank >= 9) return;

  o.middleCircle.resetAndTurnOn(2);
  o.showMission(o.rankText(rank), 8);
  o.playSound(o.promotionSound);
}
