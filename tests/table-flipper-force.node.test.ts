// SPDX-License-Identifier: AGPL-3.0-or-later
// A FLIPPER THAT COULD NOT SHOOT.
//
// ⚠️ THE DEV FOUND IT BY PLAYING: "os flaps precisam ter força para mandar a bola voando para o topo."
//
// Measured before it was believed, on all six tables: a ball dropped onto the paddle and flipped rose
// TWENTY-NINE PIXELS up a table between 235 and 300 tall — eleven to fourteen per cent of the way — and
// the peak speed after the flip was the speed the ball arrived with. The paddle was not adding
// anything. It was a wall that happened to move.
//
// ========================= AND THE CAUSE IS A UNIT, NOT A TUNING =========================
// `physics/flipper` transcribes `TFlipperEdge::flipper_collision` exactly:
//
//     tangentialSpeed = |moveSpeed| * sqrt(distanceSq / distanceDivSq)
//
// `moveSpeed` is RADIANS PER SECOND and `sqrt(distanceSq / distanceDivSq)` is the contact point as a
// FRACTION of the paddle's reach — so the product is ω × (r/L), which is an angular rate scaled by a
// dimensionless number. The tangential speed of a rotating paddle is ω × r. The formula is missing a
// length, and it is only invisible in the original because the original's table units make L about one:
// a number near 1 divides out and nobody sees the dimension go missing.
//
// ⚠️ AN AUTHORED TABLE IS IN PIXELS. `low-orbit` is 183 wide, gravity is 120 px/s², a full plunger is
// 273 px/s, and a paddle is 24 px long. So ω × (r/L) came out around twelve — against ball speeds in
// the hundreds. The kick was not weak; it was in the wrong unit, and the ratio was the paddle's length.
//
// The fix is at the authored table's own seam rather than in the transcription: `FLIPPER_COLLISION_MULT`
// is already a constant of ours, because "the original reads it from the table data (attribute 803) and
// an authored table has no such file". It carries the length back. The 1995 table's flippers read their
// own multiplier from the archive and are not touched.
import { describe, test, expect } from 'vitest';
import { buildPhysics, launchSpeedFor, FRAME_SECONDS } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { PLAYABLE_TABLES } from '../app/js/table/catalog.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/**
 * Drops the ball straight down onto the middle of the left paddle from `fromY`, flips as it arrives,
 * and reports how far up the table it got.
 *
 * ⚠️ THE FLIP IS TIMED, which is the whole subject. A flipper kicks only while it is MOVING — see
 * `setFlipperMotion`, where a motion with nothing left to travel becomes `still` — so a flip pressed
 * too early is a stationary wall by the time the ball arrives, and measuring that would measure the
 * bounce rather than the shot.
 */
function shoot(table: AuthoredTable, fromY: number) {
  const physics = buildPhysics(table);
  const paddle = table.components.find((c) => c.kind === 'flipper' && c.name.endsWith('left'))!;
  const f = paddle.flipper!;
  const ball = physics.spawnBall();
  ball.position = { x: (f.pivot.x + f.tipAtRest.x) / 2, y: fromY };
  ball.direction = { x: 0, y: 1 };
  ball.speed = 0;

  let highest = fromY;
  let flipped = false;
  let arrived = 0;
  for (let i = 0; i < 900; i++) {
    if (!flipped && ball.position.y > f.pivot.y - 12) {
      arrived = ball.speed;
      physics.setFlipper(paddle.name, true);
      flipped = true;
    }
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    physics.takeHits();
    highest = Math.min(highest, ball.position.y);
    if (ball.position.y > table.size.height) break;
  }
  return { arrived, highest, climb: f.pivot.y - highest, pivotY: f.pivot.y };
}

describe('⚠️ a flipper sends the ball to the top', () => {
  /**
   * ⚠️ THE BAR IS "HIGHER THAN IT FELL FROM", AND THE FIRST VERSION OF IT WAS WORTHLESS.
   *
   * That version asked for two-thirds of the way up the table, and the broken code reached SIXTY-TWO
   * per cent — it failed by four points, on the wrong side of a line it very nearly cleared by
   * bouncing. Of course it did: the paddle's elasticity is 0.8, so a ball dropped from a third of the
   * way down comes back to 0.8² of its fall whatever the flipper does, and any bar under that number
   * measures the bounce.
   *
   * A ball cannot rebound HIGHER than it fell from unless something gave it energy. That is the whole
   * claim, it needs no per-table number, and no elasticity below one can fake it.
   */
  test('⚠️ low-orbit: the ball comes back HIGHER than it fell from', () => {
    // ⚠️ ONE TABLE, AND WHY IT IS ONE. This is the claim in its strongest form and it is the only one
    // here that depends on what the ball meets on the way up — `long-climb` puts an ice corridor over
    // the left paddle and `slipstream` a vane, so on those two the ball is stopped by the table doing
    // its job, and a gate that failed for that reason would be measuring the layout. `low-orbit` has a
    // clear column above the paddle, so here the energy is visible as height. The tables' own shots
    // are covered by the speed gate below, which no geometry can interfere with.
    /**
     * ⚠️ DROPPED FROM HALFWAY, AND IT USED TO BE A THIRD OF THE WAY DOWN. `low-orbit` gained a
     * three-target DROP BANK under its bumper nest, at y = 92, which is squarely in the column above
     * the left paddle — so the shot now meets the bank instead of open air, rises to 92 and stops.
     *
     * That is the bank doing its job rather than a regression: a drop bank exists to be in the ball's
     * way, and after the first pass the column opens. What it costs is this test's original drop
     * height, because rising past y = 78 is no longer possible from that paddle however hard it is
     * hit. Halfway is still a real claim — the ball comes back higher than it fell from, which no
     * elasticity below one can fake — and it is now measured against the table that exists.
     */
    const table = PLAYABLE_TABLES[0]!;
    const from = table.size.height / 2;

    const shot = shoot(table, from);

    expect(shot.highest,
      `dropped from ${from.toFixed(0)}, arrived at ${shot.arrived.toFixed(0)}, rose to ${shot.highest.toFixed(0)}`)
      .toBeLessThan(from);
  });

  /**
   * ⚠️ AND THIS IS THE ONE THAT RUNS ON EVERY TABLE, because it cannot be interfered with.
   *
   * The measurement that named the defect: peak speed after the flip equalled the ARRIVAL speed on
   * every table, to within a pixel a second. An elastic wall does that; a flipper does not. Speed is
   * read at the moment of the kick, so nothing the ball meets afterwards can flatter or spoil it —
   * which is exactly what the height test above has to work around on two of the six.
   */
  test.each(PLAYABLE_TABLES.map((t) => [t.name, t] as const))(
    '%s: the paddle ADDS speed rather than merely returning it', (_name, table) => {
    const physics = buildPhysics(table);
    const paddle = table.components.find((c) => c.kind === 'flipper' && c.name.endsWith('left'))!;
    const f = paddle.flipper!;
    const ball = physics.spawnBall();
    ball.position = { x: (f.pivot.x + f.tipAtRest.x) / 2, y: f.pivot.y - 30 };
    ball.direction = { x: 0, y: 1 };
    ball.speed = 40;

    let flipped = false;
    let arrived = 0;
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      if (!flipped && ball.position.y > f.pivot.y - 12) {
        arrived = ball.speed;
        physics.setFlipper(paddle.name, true);
        flipped = true;
      }
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      physics.takeHits();
      if (flipped) peak = Math.max(peak, ball.speed);
    }

    expect(peak, `arrived at ${arrived.toFixed(0)}`).toBeGreaterThan(arrived * 1.5);
  });
});

/**
 * ⚠️ AND A CEILING, BECAUSE THE FIRST FIX OVERSHOT AND NOTHING WOULD HAVE SAID SO.
 *
 * Restoring the paddle's length turned a kick of about twelve into one of about five hundred, and the
 * gates above only ask whether the ball goes far enough. Measured afterwards, which is the point of
 * measuring afterwards: a player flapping both paddles could drive the ball to 1953 px/s — 32 pixels
 * a frame against a ball 6 pixels across, six times the speed of a full plunger.
 *
 * ⚠️ IT DID NOT TUNNEL, AND THAT IS NOT THE SAME AS BEING RIGHT. `physics/step` cuts every frame into
 * half-radius substeps and clamps the ball at `radius * 200` — 600 px/s here — so the ball stayed on
 * the table. What it did instead was live pinned against that clamp, which means the ceiling was doing
 * the design's job: the table's own geometry no longer decided anything, because everything was as
 * fast as the engine would allow.
 *
 * So the bar is the engine's own constant rather than a number to taste. A collision may overshoot the
 * clamp WITHIN a frame — the clamp is applied before the movement, the boost after it — but a design
 * that overshoots it by more than double is one where the clamp is the design.
 */
describe('⚠️ and a flipper does not turn the ball into a bullet', () => {
  // `physics/step`'s own `MAX_SPEED_PER_RADIUS`, named here because a copy of a number is how two
  // files start disagreeing. If that constant moves, this bar moves with it and somebody notices.
  const ENGINE_CAP_PER_RADIUS = 200;

  test.each(PLAYABLE_TABLES.map((t) => [t.name, t] as const))(
    '%s: flapping cannot drive it past twice the engine’s clamp', (_name, table) => {
    let peak = 0;
    // Four rhythms, because the worst one differs per table and picking a single period would be
    // choosing the answer. `flap8` is faster than any human; that is deliberate.
    for (const flapEvery of [8, 16, 24, 40]) {
      const physics = buildPhysics(table);
      const ball = physics.spawnBall();
      // ⚠️ UP THE LANE, WHICH LEANS NINE DEGREES. A plunger fires along its own channel, and on this
      ball.direction = { x: 0, y: -1 };
      ball.speed = launchSpeedFor(table);
      for (let i = 0; i < 2000; i++) {
        if (i % flapEvery === 0) { physics.setFlippers('left', true); physics.setFlippers('right', true); }
        if (i % flapEvery === Math.floor(flapEvery / 2)) {
          physics.setFlippers('left', false); physics.setFlippers('right', false);
        }
        advanceFrame([ball], physics.context, FRAME_SECONDS);
        physics.takeHits();
        peak = Math.max(peak, ball.speed);
        if (ball.position.y > table.size.height + 20) break;
      }
    }

    const clamp = table.ballRadius * ENGINE_CAP_PER_RADIUS;
    expect(peak, `peaked at ${peak.toFixed(0)}; the clamp is ${clamp}`).toBeLessThan(clamp * 2);
  });
});
