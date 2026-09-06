// SPDX-License-Identifier: AGPL-3.0-or-later
// table/lane-progress — how far down a lane the ball has got, so the lane can light up behind it.
//
// ========================= WHY THIS EXISTS =========================
// ⚠️ THE DEV, ASKED HOW OFTEN A BALL SHOULD GO DOWN AN OUTLANE: "Sempre que ela não for lançada com
// força suficiente para sair, ela deve descer, e deve haver luzes que vão acendendo conforme ela sai
// da pista lateral."
//
// The lane became a real lane one commit ago — the channel between the wall and the funnel guide,
// which the right-hand ball could not previously enter at all. This is the rest of his sentence.
//
// ========================= A HIGH-WATER MARK, NOT A POSITION =========================
// ⚠️ "VÃO ACENDENDO" IS AN ACCUMULATION. Lights that were simply "where the ball is" would go out
// behind it — a torch rather than a lane lighting up — and a ball that rattled back up the channel
// would UNLIGHT what it had already passed, which is a table taking something back from the player.
//
// So the mark is the deepest the ball has been in that lane on this ball, and it survives the ball
// leaving. `reset` clears it, because the next ball gets a fresh lane.
//
// ========================= AND IT IS NOT A LAMP =========================
// ⚠️ A LAMP IS THE CONTROL LAYER'S AND A MISSION CAN READ IT. `control/registry`'s `laneControl` lights
// every lamp a lane declares the moment the ball touches it — right for "this lane was crossed", wrong
// for a chase, since four lamps would all come on together. And `table/objective` reads lamps to
// decide what is FINISHED, so a lane declaring four would tell the sonar it was three-quarters done
// with a ball halfway down it.
//
// The chase is a fact about WHERE THE BALL IS, like `drainedBy` and `inPlungerLane`, and it lives
// where those live: a position test the game loop owns.

import type { AuthoredTable } from './authored.js';
import type { Rect } from '../shell/hud.js';

/**
 * How many lights a lane is shown as.
 *
 * ⚠️ AND THE DEPTH IS QUANTISED TO THEM, which is two things at once. It is what makes them read as
 * LIGHTS rather than as a bar filling up; and `main` composes `tablePicture` once per change, so a
 * continuous depth would recompose the whole table on every frame the ball spends in a lane. A segment
 * index changes a handful of times per trip.
 */
export const LANE_SEGMENTS = 5;

/**
 * How far along `lane` the point is, from 0 at its mouth to 1 at its far end. `null` when outside.
 *
 * ⚠️ ALONG THE LONG AXIS, which is the same rule `gfx/table-view` draws the rails by — a lane measured
 * down its short side would fill up in its first pixel and the chase would be one flash.
 */
export function laneDepth(lane: Rect, at: { readonly x: number; readonly y: number }): number | null {
  if (at.x < lane.x || at.x > lane.x + lane.width) return null;
  if (at.y < lane.y || at.y > lane.y + lane.height) return null;

  const along = lane.height >= lane.width
    ? (at.y - lane.y) / Math.max(lane.height, Number.EPSILON)
    : (at.x - lane.x) / Math.max(lane.width, Number.EPSILON);
  return Math.min(1, Math.max(0, along));
}

export interface LaneProgress {
  /** The ball is here. Deepens whatever lane it is in; touches nothing else. */
  advance(at: { readonly x: number; readonly y: number }): void;
  /** How much of that lane is lit, quantised to `LANE_SEGMENTS`. Nought for anything untracked. */
  depthOf(componentName: string): number;
  /** The ball is lost. The next one gets a fresh lane. */
  reset(): void;
}

export function createLaneProgress(table: AuthoredTable): LaneProgress {
  /**
   * ⚠️ ONLY LANES, because only a lane is a stretch of table the ball TRAVELS. "How far into it the
   * ball has got" is a question about a collision on anything else, and the answer would be a chase of
   * lights across the face of a solid object.
   */
  const lanes = table.components.filter((c) => c.kind === 'lane');
  const deepest = new Map<string, number>(lanes.map((c) => [c.name, 0]));

  return {
    advance(at) {
      for (const lane of lanes) {
        const depth = laneDepth(lane.bounds, at);
        if (depth === null) continue;
        // Down to the segment below, so a light comes on when the ball has passed it rather than when
        // it is about to.
        const stepped = Math.floor(depth * LANE_SEGMENTS) / LANE_SEGMENTS;
        if (stepped > deepest.get(lane.name)!) deepest.set(lane.name, stepped);
      }
    },

    depthOf(componentName) { return deepest.get(componentName) ?? 0; },

    reset() { for (const name of deepest.keys()) deepest.set(name, 0); },
  };
}
