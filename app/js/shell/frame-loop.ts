// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/frame-loop — the frames, and what happens when one of them throws.
//
// ========================= IT WAS FIVE LINES IN `main.ts` WITH NO `try` =========================
// ⚠️ A FRAME THAT THREW STOPPED THE GAME IN SILENCE. `requestAnimationFrame` does not re-schedule a
// callback that raised, so one unexpected null anywhere under `step()` ended the game — and the only
// notice was a line in a console nobody playing has open.
//
// A sighted player sees a frozen picture and reloads. ⚠️ A PLAYER IN BLIND MODE GETS SILENCE, which is
// exactly what this game produces while it is thinking. They wait for a game that is already dead.
//
// The engine had written the other half of this and handed it over: `createGame` returns `aoFalhar`, which
// writes the assertive live region, draws a visible box and narrates. `ui/loop-crash`'s header says why it
// arrives as a value rather than as behaviour — "quem chama `startLoop` é o JOGO... um jogo que monte o
// laço sem passar isto continua a PARAR, porque parar não é opcional; o que ele perde é dizer que parou."
//
// ========================= AND STOPPING IS THE HARD HALF, NOT THE CATCHING =========================
// ⚠️ A `catch` THAT RE-REQUESTS THE FRAME IS WORSE THAN THE SILENCE. It turns one defect into sixty
// announcements a second over a game that cannot recover, and `ui/loop-crash` deliberately skips the
// clear-and-rewrite dance that would make the second one re-read — so the child hears it once and then
// watches a dead game fail sixty times a second in a language nothing reports. The engine's own loop stops
// for the same reason.
//
// ⚠️ AND IT IS A MODULE BECAUSE NOTHING COULD REACH IT WHERE IT WAS. Neither project can make a real frame
// throw without a hook in production code that exists for a test. Taking the clock, the frame and the
// failure channel as arguments is what lets `tests/shell-frame-loop` drive it without one.

export interface FrameLoopOptions {
  /** `requestAnimationFrame`, or anything that promises to call back once with a timestamp. */
  readonly raf: (callback: (now: number) => void) => unknown;
  /** The clock the first gap is measured from. `performance.now` in the browser. */
  readonly now: () => number;
  /** ⚠️ `frames`, NOT SECONDS — the engine counts in frames and so does everything under this. */
  readonly step: (frames: number) => void;
  /** What the engine does when a frame throws: says so, in every channel a child might have. */
  readonly aoFalhar: (error: unknown) => void;
  /**
   * The most frames one callback may be asked to advance.
   *
   * ⚠️ A BACKGROUNDED TAB IS NOT A FAST-FORWARD. A tab hidden for ten seconds returns with a `now` ten
   * seconds later; unclamped, that is six hundred frames of physics in one step and the ball teleports
   * through a wall — `physics/step` integrates, and a wall is only solid where the ball is measured to be.
   */
  readonly maxFrames?: number;
}

/** One frame, in milliseconds, at sixty a second. */
const FRAME_MS = 1000 / 60;

/**
 * Starts the frames. Returns nothing, because there is nothing to stop: the loop ends when a frame throws
 * and at no other time.
 */
export function startFrames(o: FrameLoopOptions): void {
  const cap = o.maxFrames ?? 4;
  let previous = o.now();

  const frame = (now: number): void => {
    try {
      o.step(Math.min(cap, (now - previous) / FRAME_MS));
      previous = now;
    } catch (error) {
      // ⚠️ AND NO `raf` AFTER THIS. See the header: the loop stops, and saying so is all that is left.
      o.aoFalhar(error);
      return;
    }
    o.raf(frame);
  };

  o.raf(frame);
}
