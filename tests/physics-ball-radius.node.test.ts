// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BALL HAS A RADIUS, AND ON AN AUTHORED TABLE NOTHING KNEW IT.
//
// ⚠️ FOUND WHILE FIXING THE PLUNGER, WHICH THE DEV FOUND BY PLAYING. The first version of the plunger
// gate asked for the ball's SURFACE to stop at the launcher's face and it failed by exactly one radius
// on every table. The plunger was not the special case: every wall on every authored table was letting
// the ball sink to its centre.
//
// ========================= THE ORIGINAL'S TRICK, AND HALF A PORT OF IT =========================
// `physics/edges` states it in its own header: "the ball has a radius, but the original never tests a
// circle against a wall: it PUSHES the wall outward by the ball's radius and treats the ball as a
// point." `physics/wall` ports that faithfully — `installWall` offsets every line, grows every circle,
// and adds a corner circle wherever the offset would open a seam.
//
// `table/physics-build` calls `createLine` and `createCircle` directly and offsets nothing. So the 1995
// table got the treatment and the six authored ones did not, and the visible result is a 6-pixel ball
// buried three pixels into every surface it touches on a screen 320 pixels wide.
//
// ========================= AND THE CORNERS ARE THE REASON THIS IS NOT ONE LINE =========================
// ⚠️ PUSHING SIDES OUT OPENS THE CORNERS BETWEEN THEM. `physics/wall`'s header says so and closes them
// with a circle at each convex vertex. It can do that because it is handed a POLYGON and can see the
// turn from one side to the next. An authored table declares loose segments, and two walls that meet
// belong to different components — so there is no polygon to read a turn from, and a seam opened by the
// offset is a hole a point-ball goes straight through.
//
// The answer here is a circle at every segment END, which closes a seam without needing to know which
// side of it turns. It is over-inclusive on purpose: at a concave corner the circle sits inside the
// wall where nothing can reach it, and rounding an inside corner by three pixels is a smaller lie than
// a hole.
import { describe, test, expect } from 'vitest';
import { buildPhysics, FRAME_SECONDS } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

const RADIUS = 3;

/**
 * A box with a floor and two sides, written so every normal faces inward.
 *
 * ⚠️ AND THE FIRST DRAFT HAD BOTH SIDES WOUND BACKWARDS, which is worth leaving a note about because
 * the symptom was the one this file is investigating. A line's normal is `(dy, -dx)`, so a left-hand
 * wall faces INTO the box only when it is written downward — from the top to the floor. Written the
 * other way it answers balls arriving from outside the table and lets everything inside straight
 * through, and the corner test read that as the leak it was written to catch.
 */
const BOX: AuthoredTable = {
  name: 'box',
  size: { width: 100, height: 200 },
  ballRadius: RADIUS,
  lamps: [],
  components: [
    { name: 'wall.floor', kind: 'wall', role: 'structure',
      bounds: { x: 0, y: 190, width: 100, height: 10 },
      collision: [{ kind: 'line', from: { x: 0, y: 190 }, to: { x: 100, y: 190 } }] },
    { name: 'wall.left', kind: 'wall', role: 'structure',
      bounds: { x: 0, y: 0, width: 10, height: 200 },
      collision: [{ kind: 'line', from: { x: 10, y: 0 }, to: { x: 10, y: 190 } }] },
    { name: 'wall.right', kind: 'wall', role: 'structure',
      bounds: { x: 90, y: 0, width: 10, height: 200 },
      collision: [{ kind: 'line', from: { x: 90, y: 190 }, to: { x: 90, y: 0 } }] },
  ],
};

/** Drops the ball from `from` and reports where its centre came to rest. */
function settle(table: AuthoredTable, from: { x: number; y: number }, speed = 30) {
  const physics = buildPhysics(table);
  const ball = physics.spawnBall();
  ball.position = { ...from };
  ball.direction = { x: 0, y: 1 };
  ball.speed = speed;

  let deepest = from.y;
  for (let i = 0; i < 400; i++) {
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    physics.takeHits();
    deepest = Math.max(deepest, ball.position.y);
  }
  return deepest;
}

describe('⚠️ a ball rests ON a surface, not half inside it', () => {
  test('the floor stops the ball a radius short of itself', () => {
    // The claim in its plainest form. Before the offset the ball's centre came to rest AT y = 190,
    // which draws a 6-pixel ball with three pixels of it under the floor.
    const deepest = settle(BOX, { x: 50, y: 120 });

    expect(deepest, `the centre reached ${deepest.toFixed(2)}; the floor is at 190`)
      .toBeLessThanOrEqual(190 - RADIUS + 0.5);
  });

  test('⚠️ and it is the TABLE’s radius, not a constant', () => {
    // A table whose ball is twice the size gets twice the clearance. Reading a number here instead of
    // the table's own would be a fixture that happens to agree with the six tables that exist.
    const big: AuthoredTable = { ...BOX, ballRadius: RADIUS * 2 };

    const deepest = settle(big, { x: 50, y: 120 });

    expect(deepest, `the centre reached ${deepest.toFixed(2)}`)
      .toBeLessThanOrEqual(190 - RADIUS * 2 + 0.5);
  });

  /**
   * ⚠️ AND A CORNER GATE WAS WRITTEN HERE AND THEN DELETED, WHICH IS THE FINDING.
   *
   * `physics/wall`'s header says pushing sides out OPENS the corners between them, and it closes each
   * convex vertex with a circle. So circles were added at every segment end here too, and a test was
   * written to fire a ball into the seam.
   *
   * The test passed with the circles and passed without them. So did a sweep of 480 shots — every
   * three degrees, four speeds — from the middle of a closed box: nought escapes either way, and still
   * nought with the offset multiplied by EIGHT, which should tear any seam wide open.
   *
   * The reason is in how a table is written. `physics/wall` guards a POLYGON, whose sides abut end to
   * end and whose joints separate when both are pushed out. These tables declare walls as overlapping
   * SPANS — `low-orbit`'s floor runs the full width and its side the full height — so the two faces
   * still cross after the offset and there is no seam to open.
   *
   * Both the circles and the test went, under the rule this project learnt from the camera's
   * reachability gate: an assertion that cannot be made to fail is not evidence, and keeping it says
   * something is guarded when nothing is. What stays is this paragraph, so a leak found later starts
   * from what was already tried.
   */
});
