// SPDX-License-Identifier: AGPL-3.0-or-later
// A FRAME THAT THROWS HAS TO SAY SO, BECAUSE A STOPPED GAME AND A THINKING GAME SOUND THE SAME.
//
// ⚠️ THE LOOP WAS A BARE `requestAnimationFrame` RECURSION WITH NO `try`. If `step()` threw — a null the
// physics did not expect, a bitmap that decoded to nothing, anything — the frames simply stopped arriving.
// A sighted player sees a frozen picture and knows to reload. A player in blind mode gets SILENCE, which is
// exactly what the game produces while it is thinking, and waits for a game that already died.
//
// The engine wrote the other half of this and handed it over: `createGame` returns `aoFalhar`, built by
// `ui/loop-crash`, which writes the assertive live region, draws a visible box and narrates. Its own header
// says why it is delivered rather than installed: "quem chama `startLoop` é o JOGO — ele é o dono do ticker
// —, então isto é entregue e não instalado: um jogo que monte o laço sem passar isto continua a PARAR,
// porque parar não é opcional; o que ele perde é dizer que parou."
//
// ========================= WHY THE LOOP IS A MODULE NOW =========================
// ⚠️ THE FIVE LINES WERE IN `main.ts`, WHERE NOTHING CAN REACH THEM. This repository has one node project
// and its browser project boots the real entry point; neither can make a real frame throw without a hook in
// production code that exists for the test — which `CLAUDE.md` names as the thing not to do.
//
// So the loop is a function that takes its clock, its frame and its failure channel. The node case below
// drives it with a `raf` that never yields to a browser, which is what makes "and NOTHING was scheduled
// after it" checkable at all: in a real loop that claim is the absence of an event nobody can wait for.
//
// ⚠️ AND THE OTHER LINK IS HELD ELSEWHERE. This file proves a throwing frame REACHES `aoFalhar` and stops;
// `tests/loop-crash.browser` proves that what `aoFalhar` does reaches a child in THIS document. Neither
// covers the chain alone, which is the same shape blind mode's two gates take.
import { describe, test, expect } from 'vitest';
import { startFrames } from '../app/js/shell/frame-loop.js';

/** A clock that hands out frames only when asked, so a test owns the schedule. */
function fakeClock() {
  const queued: ((now: number) => void)[] = [];
  return {
    raf: (cb: (now: number) => void): number => { queued.push(cb); return queued.length; },
    /** Runs the one frame that is waiting, at `now`. Answers whether there was one. */
    tick(now: number): boolean {
      const next = queued.shift();
      if (!next) return false;
      next(now);
      return true;
    },
    get pending(): number { return queued.length; },
  };
}

describe('the frame loop', () => {
  test('runs frames, and measures them against the clock', () => {
    const clock = fakeClock();
    const seen: number[] = [];

    startFrames({ raf: clock.raf, now: () => 0, step: (f) => seen.push(f), aoFalhar: () => {} });
    clock.tick(1000 / 60);
    clock.tick(1000 / 30);

    // ⚠️ IN FRAMES AND NOT IN SECONDS, which is the engine's own trap written down in this port's plan:
    // `update(dt)` counts frames. Sixteen and a bit milliseconds is one frame; twice that is one more.
    expect(seen.map((f) => Math.round(f * 100) / 100)).toEqual([1, 1]);
  });

  test('⚠️ a frame that throws reaches `aoFalhar`, with the error it threw', () => {
    const clock = fakeClock();
    const boom = new Error('the physics found a null');
    const told: unknown[] = [];

    startFrames({
      raf: clock.raf, now: () => 0, aoFalhar: (e) => told.push(e),
      step: () => { throw boom; },
    });
    clock.tick(16);

    expect(told, 'the failure channel was told exactly once').toEqual([boom]);
  });

  test('⚠️ AND NOTHING IS SCHEDULED AFTER IT — the loop stops rather than limping', () => {
    /**
     * ⚠️ THE HALF THAT IS EASY TO GET WRONG, and getting it wrong is worse than the silence it replaces.
     * A `try`/`catch` that re-requests the frame turns one defect into sixty announcements a second, over
     * a game that cannot recover — and `ui/loop-crash` deliberately does NOT clear-and-rewrite the live
     * region, so a second identical announcement would not even be re-read. The engine's `core/loop` stops
     * for the same reason: "parar não é opcional".
     */
    const clock = fakeClock();

    startFrames({
      raf: clock.raf, now: () => 0, aoFalhar: () => {}, step: () => { throw new Error('boom'); },
    });
    clock.tick(16);

    expect(clock.pending, 'a frame was queued after the loop was supposed to have stopped').toBe(0);
    expect(clock.tick(32), 'and there is nothing left to run').toBe(false);
  });

  test('and a healthy frame DOES schedule the next one', () => {
    // The mirror of the case above: without this, a loop that never scheduled anything would satisfy it.
    const clock = fakeClock();

    startFrames({ raf: clock.raf, now: () => 0, step: () => {}, aoFalhar: () => {} });
    clock.tick(16);

    expect(clock.pending).toBe(1);
  });

  test('⚠️ and a long gap is CLAMPED, because a backgrounded tab is not a fast-forward', () => {
    /**
     * A tab that was hidden for ten seconds comes back with a `now` ten seconds later. Unclamped, that is
     * six hundred frames of physics in one step: the ball teleports through a wall, because `physics/step`
     * integrates and a wall is only solid where the ball is measured to be.
     */
    const clock = fakeClock();
    const seen: number[] = [];

    startFrames({ raf: clock.raf, now: () => 0, step: (f) => seen.push(f), aoFalhar: () => {} });
    clock.tick(10_000);

    expect(seen).toEqual([4]);
  });
});
