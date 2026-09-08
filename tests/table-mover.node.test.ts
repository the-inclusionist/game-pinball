// SPDX-License-Identifier: AGPL-3.0-or-later
// A BODY THAT MOVES ON ITS OWN — the mechanic three of the Dev's four themes are made of.
//
// ⚠️ HIS WORDS, ACROSS THREE TABLES: "drones indo de satélite em satélite que interagem com a
// bolinha"; "sondas andando em esteiras que interagem com a bolinha"; "sondas que interagem com a
// bolinha indo de meteoro em meteoro."
//
// Everything on a table today is static except the flippers, and the flippers are a transcription of
// `TFlipperEdge` — a body that rotates about a pivot between two angles, with a swept collision and a
// kick proportional to its own tangential speed. Nothing in the authored format can say "this thing
// travels from here to there and back".
//
// ========================= WHY IT IS A PATH AND NOT A VELOCITY =========================
// A drone that went where its velocity took it would need a rule for what happens at the edges of the
// table, another for what happens when two of them meet, and a way for an author to predict where it
// will be. A drone that shuttles between two DECLARED points needs none of those: an author draws the
// line it runs along, and the table is the same table on every ball.
//
// ⚠️ AND THE PHASE IS A FUNCTION OF TIME, NOT AN ACCUMULATOR. `position(t)` is computed from the
// clock rather than stepped, so a frame that arrives late cannot leave a drone somewhere a shorter
// frame would not have. `physics/step` already learnt this the other way round — its substeps exist
// because a ball stepped by one big jump misses what it passes through — and a body whose position is
// integrated frame by frame drifts differently on a slow machine, which is a table that plays
// differently on a school laptop.
import { LOW_ORBIT } from '../app/js/table/catalog.js';
import { describe, test, expect } from 'vitest';
import { createMover, moverAt } from '../app/js/table/mover.js';
import { buildPhysics, FRAME_SECONDS } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { validateTable, type AuthoredComponent, type AuthoredTable } from '../app/js/table/authored.js';

const PATH = { from: { x: 20, y: 50 }, to: { x: 80, y: 50 }, seconds: 2, radius: 5 };

describe('where it is', () => {
  test('at rest it sits at the start of its path', () => {
    expect(moverAt(PATH, 0)).toEqual({ x: 20, y: 50 });
  });

  test('halfway through its first leg it is halfway along', () => {
    expect(moverAt(PATH, 1)).toEqual({ x: 50, y: 50 });
  });

  test('at the end of the leg it is at the far end', () => {
    expect(moverAt(PATH, 2)).toEqual({ x: 80, y: 50 });
  });

  test('⚠️ and then it comes BACK, which is what makes it a shuttle', () => {
    // A drone that reached the far satellite and stopped would be furniture with a delay on it.
    expect(moverAt(PATH, 3)).toEqual({ x: 50, y: 50 });
    expect(moverAt(PATH, 4)).toEqual({ x: 20, y: 50 });
  });

  test('and it keeps going round for ever', () => {
    expect(moverAt(PATH, 5)).toEqual(moverAt(PATH, 1));
    expect(moverAt(PATH, 400)).toEqual(moverAt(PATH, 0));
  });

  test('⚠️ a diagonal path is followed diagonally, not in steps', () => {
    // The obvious thing, asserted because the first implementation of anything like this interpolates
    // one axis and forgets the other, and a drone that moves in an L looks like a defect.
    const diagonal = { from: { x: 0, y: 0 }, to: { x: 100, y: 40 }, seconds: 1, radius: 4 };

    expect(moverAt(diagonal, 0.5)).toEqual({ x: 50, y: 20 });
  });
});

describe('how fast it is going', () => {
  test('⚠️ its speed is what it hands the ball, so it is part of the mover and not of the collision', () => {
    // A body that moves and imparts nothing is a moving wall: the ball bounces off where it happens to
    // be and the motion is decoration. The flipper's kick is `collisionMult * alignment * tangential
    // speed` for the same reason, and this is the same idea for a body that travels in a line.
    const m = createMover(PATH);

    m.advance(0.5);

    expect(m.speed).toBeCloseTo(30, 5);
    expect(m.direction.x).toBeCloseTo(1, 5);
    expect(m.direction.y).toBeCloseTo(0, 5);
  });

  test('and it reverses with the shuttle', () => {
    const m = createMover(PATH);

    m.advance(3);

    expect(m.direction.x).toBeCloseTo(-1, 5);
  });

  test('a path of no length is still legal and simply never moves', () => {
    // Refusing it would be a rule the validator has to carry; answering nought is a fact about the
    // path. An author who declares one has drawn a stationary disc, which is a thing a table may want.
    const still = createMover({ from: { x: 10, y: 10 }, to: { x: 10, y: 10 }, seconds: 1, radius: 3 });

    still.advance(0.5);

    expect(still.speed).toBe(0);
    expect(still.at).toEqual({ x: 10, y: 10 });
  });
});

describe('the box it can ever be in', () => {
  test('⚠️ it covers the whole path, because the grid is a static index', () => {
    // `physics/grid` places an edge into cells ONCE, by its bounding box. A body that moves must be
    // registered over everywhere it can go or it stops existing halfway along — which is exactly the
    // defect `physics-build` records for flippers, where a resting paddle vanished because only the
    // sweep was registered.
    const m = createMover(PATH);

    expect(m.bounds).toEqual({ x: 15, y: 45, width: 70, height: 10 });
  });

  test('and a diagonal path gets the box that contains it', () => {
    const m = createMover({ from: { x: 60, y: 10 }, to: { x: 20, y: 90 }, seconds: 1, radius: 4 });

    expect(m.bounds).toEqual({ x: 16, y: 6, width: 48, height: 88 });
  });
});

/**
 * ⚠️ AND IT HAS TO HIT THE BALL, which is the half `moverAt` cannot answer.
 *
 * `table/mover` is arithmetic about a path. What makes it a mechanic is that the grid holds it, the
 * ball meets it wherever it happens to be, and it PUSHES — a body that only got in the way would be a
 * wall that changes address. Every one of those is a seam, and this repository's recurring defect is a
 * capability that has all its parts and none of its joins.
 */
describe('⚠️ a travelling body in a real table', () => {
  const drone = (over: Partial<AuthoredComponent> = {}): AuthoredComponent => ({
    name: 'drone', kind: 'rebounder', role: 'goal',
    bounds: { x: 18, y: 38, width: 62, height: 12 },
    scores: [2000], control: 'RebounderControl', lamps: [],
    /**
     * ⚠️ IN THE EMPTY TOP-LEFT, AND IT USED TO BE AT y = 66 BETWEEN THE BUMPERS. `table/perspective`
     * squeezes the playfield toward the centre as it rises — at y = 55 on this table it is at 65% — so
     * things that were sixteen units apart are now ten: `bumper2` sits at x = 87 and the drone's
     * mid-path at 71, clear by four before the lean and overlapping by two after it. The ball dropped
     * onto the drone hit the bumper on the way down, and the gate read that as "the drone did not
     * answer".
     *
     * The fixture asks one thing of the table — empty air on both sides and above — and `low-orbit` has
     * exactly one region like that: the top-left corner, which `table/cabinet`'s own record calls out
     * as empty on every table in the catalogue.
     */
    mover: { from: { x: 24, y: 44 }, to: { x: 74, y: 44 }, seconds: 1.5, radius: 6 },
    ...over,
  });

  const withDrone = (): AuthoredTable => ({
    ...LOW_ORBIT,
    components: [...LOW_ORBIT.components, drone()],
  });

  test('the table it is on is legal', () => {
    expect(validateTable(withDrone(), { viewHeight: 180 })).toEqual([]);
  });

  test('⚠️ a ball dropped onto it bounces, wherever along the path it is', () => {
    // Twice, at two different phases of the drone's travel, so this cannot pass because the body
    // happened to be at its starting point — which is where a grid registered at the start would put
    // it, and is exactly the defect the whole-path registration exists to prevent.
    for (const settle of [0, 0.75]) {
      const physics = buildPhysics(withDrone());
      const found = physics.movers.find((m) => m.name === 'drone')!;
      found.mover.advance(settle);
      const at = found.mover.at;

      const ball = physics.spawnBall();
      /**
       * ⚠️ TWELVE ABOVE, AND IT WAS THIRTY. The drop distance was never the claim — what is being asked
       * is whether a body registered across its whole path answers the ball anywhere along it — and
       * since the tables lean, thirty units of fall on `low-orbit` crosses the drop bank's band. The
       * ball met a target on the way down and the gate read that as "the drone did not answer".
       */
      ball.position = { x: at.x, y: at.y - 12 };
      ball.direction = { x: 0, y: 1 };
      ball.speed = 60;

      let bounced = false;
      for (let i = 0; i < 40 && !bounced; i++) {
        advanceFrame([ball], physics.context, FRAME_SECONDS);
        for (const hit of physics.takeHits()) if (hit.name === 'drone') bounced = true;
      }

      expect(bounced, `at phase ${settle}, drone at x=${at.x.toFixed(0)}`).toBe(true);
    }
  });

  test('⚠️ and it PUSHES: a ball met head-on leaves faster than one the body is running from', () => {
    /**
     * The claim that separates a mover from a wall: same speed in, different out.
     *
     * ⚠️ AND THE TWO SIDES WERE THE WRONG WAY ROUND, which this file said in words for months: "a ball
     * sitting on its left face is run into, and one on its right face is run away from". The drone
     * travels +x at the start of its path, so the face it RUNS INTO is its right one. `physics/mover`
     * pushes only when the body's velocity has a positive component along the contact normal, which is
     * the correct physics and is why the left face gives nothing: measured, 20.3 in and 20.3 out.
     *
     * ⚠️ IT PASSED ANYWAY UNTIL THE TABLES LEANED, which is the part worth keeping. The loop stops at
     * the first drone hit and reads the speed there, and at the old position a ball on the left met
     * something else first and arrived carrying its rebound. The gate was reading a bumper. Moving the
     * drone into empty air took that away and left the claim standing alone, backwards.
     */
    const into = buildPhysics(withDrone());
    const away = buildPhysics(withDrone());
    const speeds: number[] = [];

    for (const [physics, side] of [[into, 1], [away, -1]] as const) {
      const found = physics.movers.find((m) => m.name === 'drone')!;
      const at = found.mover.at;
      const ball = physics.spawnBall();
      // Just off the face, moving gently onto it.
      ball.position = { x: at.x + side * 12, y: at.y };
      ball.direction = { x: -side, y: 0 };
      ball.speed = 20;

      /**
       * ⚠️ READ AT THE MOMENT OF THE HIT, and the first version took the maximum over forty frames.
       * That measured GRAVITY: the ball falls the whole time, so both runs ended at whatever a
       * two-thirds-of-a-second drop gives and the difference the drone made was buried under it. The
       * question is what the body handed the ball, so the answer is read where the body touched it.
       */
      let atImpact = 0;
      for (let i = 0; i < 40 && atImpact === 0; i++) {
        advanceFrame([ball], physics.context, FRAME_SECONDS);
        for (const hit of physics.takeHits()) if (hit.name === 'drone') atImpact = ball.speed;
      }
      speeds.push(atImpact);
    }

    expect(speeds[0]!, `head-on ${speeds[0]!.toFixed(0)} vs from-behind ${speeds[1]!.toFixed(0)}`)
      .toBeGreaterThan(speeds[1]!);
  });
});
