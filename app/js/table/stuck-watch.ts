// SPDX-License-Identifier: AGPL-3.0-or-later
// table/stuck-watch — running the stuck-ball detector on an authored table.
//
// ========================= `physics/stuck` WAS PORTED AND IMPORTED BY NOTHING =========================
// Fully transcribed, fully tested, and reachable from no module: a ball that wedged itself stayed
// wedged for ever while the game went on running around it.
//
// This one was already known and not recognised. The `wide-arc` shelf that put the ball to sleep on a
// seven-degree ramp was diagnosed by reading this detector's threshold and observing that it was RIGHT
// not to fire — the ball was crawling at 2.5 and 0.8 is the bar. What went unnoticed at the time is
// that the detector could not have fired at any speed, because nothing called it.
//
// ========================= STUCK IS A PLACE, NOT A DURATION =========================
// The module's own first heading, and the reason this file exists at all: `unstuckBall` does nothing
// while the ball is inside a flipper's or the plunger's box. A ball resting on a raised flipper, or
// waiting to be launched, is legitimately still.
//
// ⚠️ SO THE FLIPPER'S BOX IS ITS SWEPT AREA, NOT ITS `bounds`. The declared rectangle is where the
// flipper sits at REST; trapping a ball on a raised one is a skill, and a rescue that fired there would
// take the ball off the paddle the player was holding it on. Erring wide is the right direction: a ball
// left stuck a moment longer is a smaller fault than a ball snatched out of a trap.

import {
  checkStuckBall, unstuckBall, type Bounds, type StuckBall,
} from '../physics/stuck.js';
import type { Ball } from '../physics/step.js';
import type { AuthoredTable } from './authored.js';

/**
 * Half the collision offset, which is what the original widens the boxes by so their edges count as
 * inside. The offset is the ball's radius, so this is half of it.
 */
export function boundsMarginOf(table: AuthoredTable): number {
  return table.ballRadius / 2;
}

/**
 * Every box a ball may legitimately stand still in.
 *
 * ⚠️ A LIST, and `four-flippers` is why. `physics/stuck` takes one rather than two named boxes, and
 * until that table existed nothing put more than three entries in it.
 */
export function controlBoundsOf(table: AuthoredTable): Bounds[] {
  const boxes: Bounds[] = [];

  for (const component of table.components) {
    if (component.kind === 'flipper' && component.flipper) {
      const f = component.flipper;
      // The whole sweep: the tip can be anywhere within `reach` of the pivot. See the header.
      const reach = Math.hypot(f.tipAtRest.x - f.pivot.x, f.tipAtRest.y - f.pivot.y) + f.tipRadius;
      boxes.push({
        xMin: f.pivot.x - reach, xMax: f.pivot.x + reach,
        yMin: f.pivot.y - reach, yMax: f.pivot.y + reach,
      });
      continue;
    }
    if (component.kind === 'plunger') {
      const b = component.bounds;
      boxes.push({ xMin: b.x, xMax: b.x + b.width, yMin: b.y, yMax: b.y + b.height });
    }
  }

  return boxes;
}

export interface StuckWatchOptions {
  /** `PlungerRelaunchBall`: what to do when twenty nudges have not worked. */
  readonly relaunch: () => void;
  readonly random?: () => number;
}

export interface StuckWatch {
  /**
   * One ball's turn. `now` is in MILLISECONDS, because `STUCK_IDLE_TICKS` is 500 and the original's
   * `time_ticks` is the SDL clock — half a second of stillness before the question is even asked.
   *
   * Takes the game's `Ball` OR a bare `StuckBall`, because a test should be able to state a ball's
   * stillness without building a collision memory to go with it.
   */
  check(ball: Ball | StuckBall, now: number): void;
}

/**
 * ⚠️ ONE FIELD SEPARATES THE TWO SHAPES, AND IT IS THE SAME FACT TWICE.
 *
 * `StuckBall.inCollisionComponent` asks "is a sink or a kickout holding this ball on purpose"; the
 * game's `Ball.component` IS that, as a reference rather than a flag — which is also how the original
 * carries it (`TBall::CollisionComp`, a pointer). Copying it into a second field would be two places to
 * keep true, so the view reads through instead, and the detector's writes land on the real ball because
 * every other property is shared by reference.
 */
function asStuckBall(ball: Ball | StuckBall): StuckBall {
  if ('inCollisionComponent' in ball) return ball;
  const game = ball as Ball;

  // ⚠️ ACCESSORS ON A NEW OBJECT, NOT A PROTOTYPE. `Object.create(game, …)` was the first attempt and it
  // is a trap: reads travel up the chain and WRITES SHADOW IT, so the detector's `speed = 1` would land
  // on the view and the ball would sit there unchanged. Every test in this file went on passing, because
  // they all hand in a bare `StuckBall` and never cross the bridge.
  const through = <K extends keyof Ball & keyof StuckBall>(key: K) => ({
    get: () => game[key],
    set: (value: Ball[K]) => { game[key] = value; },
    enumerable: true,
  });

  return Object.defineProperties({} as StuckBall, {
    active: through('active'),
    speed: through('speed'),
    radius: through('radius'),
    position: through('position'),
    direction: through('direction'),
    prevPosition: through('prevPosition'),
    stuckCounter: through('stuckCounter'),
    lastActiveTime: through('lastActiveTime'),
    inGroup: through('inGroup'),
    // ⚠️ IT IS WRITTEN, NOT ONLY READ. `throwBall` sets it false — "throwing frees the ball from
    // whatever was holding it" — so the setter has to RELEASE the component, which is what that means
    // on this side of the bridge. A read-only view threw here, which is how the pair was found.
    inCollisionComponent: {
      get: () => game.component !== null,
      set: (held: boolean) => { if (!held) game.component = null; },
      enumerable: true,
    },
  });
}

export function createStuckWatch(table: AuthoredTable, o: StuckWatchOptions): StuckWatch {
  const controlBounds = controlBoundsOf(table);
  const boundsMargin = boundsMarginOf(table);

  return {
    check(ball, now) {
      const view = asStuckBall(ball);
      if (!checkStuckBall(view, now)) return;
      unstuckBall(view, {
        controlBounds,
        boundsMargin,
        // An authored table has one ball. The count is what the give-up branch decrements so a rescue
        // cannot quietly grow the number of balls in play.
        table: { multiballCount: 1 },
        relaunch: o.relaunch,
        ...(o.random ? { random: o.random } : {}),
      });
    },
  };
}
