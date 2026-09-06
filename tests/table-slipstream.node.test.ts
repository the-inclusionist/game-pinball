// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VANES ARE ACTUALLY ONE-WAY.
//
// ⚠️ `slipstream` PASSED EVERY EXISTING GATE THE MOMENT IT WAS WRITTEN — the validator, all four
// playability checks, the stuck watch — and none of them asks the question the table exists for. A
// table whose vanes were solid in BOTH directions would still launch, still score, still drain
// properly and still answer the flippers. It would simply be a table with two walls across the middle
// and a chamber nobody can enter, and every mission above the vanes would be unreachable.
//
// That is this port's signature defect wearing a new hat: something declared, believed, and never
// asked. So the claim gets a test.
//
// ⚠️ AND IT IS ABOUT THE WINDING, WHICH IS THE THING A PERSON GETS WRONG. `table/authored` documents
// it in capitals — "A LINE IS ONE-SIDED, AND ITS WINDING DECIDES WHICH SIDE" — and records that the
// first draft of every table in this repository had walls wound backwards, with the symptom being a
// ball that fell straight through the table rather than a wall that felt odd. Reversing a vane here
// would turn the table inside out and break nothing that currently runs.
import { describe, test, expect } from 'vitest';
import { buildPhysics } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { SLIPSTREAM } from '../app/js/table/slipstream.js';

const FRAME_SECONDS = 1 / 60;

/** Puts a ball just below or just above a vane, sends it at the line, and reports whether it got past. */
function throughVane(startY: number, directionY: number): boolean {
  const physics = buildPhysics(SLIPSTREAM);
  const ball = physics.spawnBall();
  const vane = SLIPSTREAM.components.find((c) => c.name === 'vane.left')!;
  const line = vane.collision![0]!;
  const y = 'from' in line ? line.from.y : 0;

  ball.position.x = 57;
  ball.position.y = startY;
  ball.direction = { x: 0, y: directionY };
  ball.speed = 40;
  ball.active = true;

  for (let i = 0; i < 60; i++) {
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    physics.takeHits();
    // Past the line, travelling the way it was sent.
    if (directionY < 0 && ball.position.y < y - 6) return true;
    if (directionY > 0 && ball.position.y > y + 6) return true;
  }
  return false;
}

describe('the vanes across the middle', () => {
  test('⚠️ a FALLING ball passes through, which is how the chamber empties', () => {
    // The plunger delivers the ball to the TOP of the table, so falling is the direction it travels
    // first and the one that must not be blocked. Wound the other way it never came down at all: four
    // thousand frames without a drain, and two playability gates failing.
    expect(throughVane(100, 1), 'down through the vane').toBe(true);
  });

  test('⚠️ and a RISING ball does NOT, which is the whole table', () => {
    // If this comes back true the vanes are not vanes: the table is an ordinary open one with two
    // decorative lines across it, and nothing else in the repository would notice. The first version of
    // this table WAS that table, with a paragraph confidently describing the opposite.
    expect(throughVane(140, -1), 'up through the vane').toBe(false);
  });

  test('and the chamber is not a trap: the flanks outside the vanes are open', () => {
    // ⚠️ THE OTHER WAY THIS DESIGN FAILS. A chamber sealed on every side is one the ball never leaves —
    // `physics/stuck` would nudge it twenty times and then relaunch, and the player would watch a ball
    // sit still. The vanes are short and the flanks are open, so a ball can always fall down the
    // outside whether or not it finds a return lane.
    const physics = buildPhysics(SLIPSTREAM);
    const ball = physics.spawnBall();
    ball.position.x = 18;          // outside the left vane, which starts at 34
    ball.position.y = 100;
    ball.direction = { x: 0, y: 1 };
    ball.speed = 30;
    ball.active = true;

    for (let i = 0; i < 240; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      physics.takeHits();
    }

    expect(ball.position.y, 'it fell past the vane line down the outside').toBeGreaterThan(126);
  });
});
