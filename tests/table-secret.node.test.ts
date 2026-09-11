// SPDX-License-Identifier: AGPL-3.0-or-later
// A DOOR THAT IS NOT THERE UNTIL THE TABLE HAS TAKEN SOMETHING FROM YOU.
//
// ⚠️ THE DEV, TWICE, IN TWO DIFFERENT MESSAGES:
//   · "com um ou dois cenários contendo passagens secretas que se abrem caso na primeira tacada a
//     bola desça";
//   · "mesas que tenham passagem secreta, que permitam que a bola saia pela lateral baixa ao invés de
//     sair pelo topo."
//
// The second sentence is what the passage IS and the first is when it opens. A plunger lane delivers
// the ball to the top of the table and that is the only way in; a secret passage is a second mouth,
// low down, that lets a ball leave the lane beside the flippers instead of over the whole playfield.
//
// ========================= WHY IT IS A BLOCKER AND NOT A NEW KIND =========================
// ⚠️ THE MACHINERY WAS ALREADY HERE, BUILT FOR DROP TARGETS. A target that goes down stops being drawn
// (`drawTable`'s `hidden`) and stops being a wall (`physics-build.setComponentActive`), and
// `table/cabinet` records what it cost to learn that those two must agree — a target drawn but not
// solid is something the player aims at and the ball flies through.
//
// A secret door is that, inverted and on a different clock: solid and drawn until it opens, then
// neither. So it is a `blocker` with a condition on it, and nothing new has to be taught to the
// physics, the renderer or the validator.
//
// ========================= AND THE CONDITION IS COUNTED, NOT TIMED =========================
// "Caso na primeira tacada a bola desça" — if the ball goes down on the first shot. That is a count of
// balls LOST, which the game loop already keeps, and not a stopwatch. A door on a timer would open for
// a player who was doing well and had simply been playing a while, which is the opposite of what he
// described: this is the table giving something back after it has taken.
import { describe, test, expect } from 'vitest';
import { openSecrets, type AuthoredSecret } from '../app/js/table/secret.js';
import { validateTable, type AuthoredComponent, type AuthoredTable } from '../app/js/table/authored.js';
import { LOW_ORBIT } from '../app/js/table/low-orbit.js';
import {
  buildPhysics, drainedBy, inPlungerLane, launchSpeedFor, FRAME_SECONDS,
} from '../app/js/table/physics-build.js';
import { CRATER_RUN } from '../app/js/table/crater-run.js';

/** Sixty balls, the same number `tests/table-reachable` surveys with, and the same seed. */
const BALLS = 60;
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
import { advanceFrame } from '../app/js/physics/step.js';

const SECRET: AuthoredSecret = { afterLostBalls: 1 };

const door = (over: Partial<AuthoredComponent> = {}): AuthoredComponent => ({
  name: 'door', kind: 'blocker', role: 'structure',
  bounds: { x: 60, y: 60, width: 20, height: 4 },
  // ⚠️ LEFT TO RIGHT, so the normal points UP and it catches a ball falling onto it. The first draft
  // wound it right to left, which is a CEILING — and the ball fell straight through a door the test
  // was asserting is shut. `table/authored` has a table of the four windings and the note that the
  // first draft of every table in this repository got one of them wrong; this is the seventh.
  collision: [{ kind: 'line', from: { x: 60, y: 62 }, to: { x: 80, y: 62 } }],
  secret: SECRET,
  ...over,
});

/**
 * ⚠️ BUILT ON `low-orbit` AND NOT ON `crater-run`, WHICH THIS FILE USED TO USE. `crater-run` now
 * declares a passage of its own, so a fixture based on it returns two door names and every assertion
 * here about "the doors that are open" became a statement about somebody else's table as well.
 */
const withDoor = (over: Partial<AuthoredComponent> = {}): AuthoredTable => ({
  ...LOW_ORBIT,
  components: [...LOW_ORBIT.components, door(over)],
});

describe('when a secret door is open', () => {
  test('at the start of a game it is shut, which is what makes it secret', () => {
    expect(openSecrets(withDoor(), 0)).toEqual([]);
  });

  test('when the first ball has gone down, it opens', () => {
    expect(openSecrets(withDoor(), 1)).toEqual(['door']);
  });

  test('and it stays open for the rest of the game', () => {
    // A door that shut again would be a reward the player cannot plan around, and they have already
    // paid for it once.
    expect(openSecrets(withDoor(), 3)).toEqual(['door']);
  });

  test('a door that wants two balls is not opened by one', () => {
    expect(openSecrets(withDoor({ secret: { afterLostBalls: 2 } }), 1)).toEqual([]);
    expect(openSecrets(withDoor({ secret: { afterLostBalls: 2 } }), 2)).toEqual(['door']);
  });

  test('⚠️ and a table with no secret has none however many balls are lost', () => {
    // The empty list rather than a thrown error: most tables have no passage, and the loop asks every
    // frame.
    expect(openSecrets(LOW_ORBIT, 3)).toEqual([]);
  });
});

describe('a secret a table may not declare', () => {
  test('the honest one is legal', () => {
    expect(validateTable(withDoor(), { viewHeight: 180 })).toEqual([]);
  });

  test('⚠️ a door that opens after nought balls is a door that was never shut', () => {
    // It would validate, draw and play as an ordinary wall that is never there — which is a component
    // whose whole purpose is silently absent, and this repository has found six of those.
    expect(validateTable(withDoor({ secret: { afterLostBalls: 0 } }), { viewHeight: 180 }))
      .toEqual(['door: a secret that opens after 0 lost balls was never shut']);
  });

  test('⚠️ and a door with nothing solid in it is a passage that is always open', () => {
    // The gap IS the component. One with no collision is drawn shut and passed through, which is the
    // drop target's defect wearing the opposite mask.
    expect(validateTable(withDoor({ collision: [] }), { viewHeight: 180 }))
      .toContain('door: a secret door needs a collision — it is a wall until it opens');
  });
});

/**
 * ⚠️ AND THE BALL HAS TO NOTICE, which is the half a list of names cannot answer.
 *
 * `physics-build.setComponentActive` is what makes a shape stop being a wall, and it was written for
 * drop targets. This is the join: a door that opens in the model and stays solid in the physics is the
 * same defect as a target drawn after it has dropped, and that one shipped.
 */
describe('⚠️ a door in a real table', () => {
  const shutAndOpen = (active: boolean): boolean => {
    const table = withDoor();
    const physics = buildPhysics(table);
    physics.setComponentActive('door', active);

    const ball = physics.spawnBall();
    ball.position = { x: 70, y: 40 };
    ball.direction = { x: 0, y: 1 };
    ball.speed = 80;

    for (let i = 0; i < 40; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      for (const hit of physics.takeHits()) if (hit.name === 'door') return true;
    }
    return false;
  };

  test('shut, the ball bounces off it', () => {
    expect(shutAndOpen(true)).toBe(true);
  });

  test('⚠️ open, the ball goes straight through', () => {
    expect(shutAndOpen(false)).toBe(false);
  });
});

/**
 * ⚠️ AND THE PASSAGE HAS TO BE A ROUTE, NOT A HOLE NOBODY GOES THROUGH.
 *
 * The design worry, written down before it was measured: a ball falls STRAIGHT DOWN the plunger lane,
 * so a gap in the side of that lane might never be met however wide it is. It would validate, draw,
 * open on cue and change nothing — which is this repository's oldest defect wearing its best disguise,
 * because everything about it would look right.
 *
 * Measured instead, A/B on the same sixty balls with the door shut and open:
 *
 *     shut   0 / 60 left the lane through the passage band
 *     open  37 / 60
 *
 * So the ball does arrive with sideways speed — off the return bend's curve and off the plunger's own
 * face — and the passage is taken by most balls that are in the lane when it is open.
 */
describe('⚠️ `crater-run`’s passage is a route the ball takes', () => {
  const crossings = (open: boolean): number => {
    const random = rng(20260906);
    let used = 0;

    for (let n = 0; n < BALLS; n++) {
      /**
       * ⚠️ THE SEED GOES INTO THE PHYSICS AND IT USED NOT TO, WHICH MADE THIS SURVEY NON-DETERMINISTIC.
       *
       * `rng(20260906)` seeds the launch — direction, power, flap period — and `buildPhysics` was called
       * with nothing, so the ONE piece of chance inside the simulation fell back to `Math.random`:
       * `physics/stuck`'s nudge, which throws a wedged ball in a random direction.
       *
       * ⚠️ AND IT WAS HARMLESS UNTIL THE BALL COULD COME TO REST. A wall used to take nine tenths of the
       * along-wall speed on every touch, so nothing settled anywhere and the nudge almost never fired;
       * `physics/collision` charges friction against the impact now, balls rest, and the rescue runs.
       * This gate then failed once in five runs at 14 crossings of 60 against a bar of 15 and passed the
       * other four — a seeded test with an unseeded generator inside it, which is the shape
       * `tests/table-reachable` records finding once and this file had the same hole.
       */
      const physics = buildPhysics(CRATER_RUN, { random });
      if (open) physics.setComponentActive('passage.crater', false);

      const ball = physics.spawnBall();
      ball.direction = { x: (random() - 0.5) * 0.12, y: -1 };
      ball.speed = launchSpeedFor(CRATER_RUN) * (0.55 + random() * 0.45);
      const flap = 7 + Math.floor(random() * 34);
      let crossed = false;
      let wasInLane = true;

      for (let i = 0; i < 4000; i++) {
        if (inPlungerLane(CRATER_RUN, ball) && ball.speed < 20) {
          ball.direction = { x: 0, y: -1 };
          ball.speed = launchSpeedFor(CRATER_RUN) * (0.55 + random() * 0.45);
        }
        if (i % flap === 0) { physics.setFlippers('left', true); physics.setFlippers('right', true); }
        if (i % flap === Math.floor(flap / 2)) {
          physics.setFlippers('left', false); physics.setFlippers('right', false);
        }
        for (const { mover } of physics.movers) mover.advance(FRAME_SECONDS);
        advanceFrame([ball], physics.context, FRAME_SECONDS);
        physics.stuck.check(ball, i * (1000 / 60));
        physics.takeHits();

        const inLane = ball.position.x > 166;
        const band = ball.position.y > 155 && ball.position.y < 181;
        if (wasInLane && !inLane && band) crossed = true;
        wasInLane = inLane;
        if (drainedBy(CRATER_RUN, ball)) break;
      }
      if (crossed) used++;
    }
    return used;
  };

  /**
   * ⚠️ A BUDGET, BECAUSE THIS SURVEY CROSSED THE DEFAULT ONCE AND ONLY ONCE.
   *
   * 📏 Measured 2026-09-11: the twelve cases in this file take 1.68 s when the file runs alone, and this
   * one case passed 5 s in a full run with two web servers competing for the machine. It is sixty launches
   * of a thousand frames, which is the most arithmetic any single case here does.
   *
   * ⚠️ PER-TEST AND NOT A GLOBAL `testTimeout`, which is the whole decision. A global bump would move
   * this file's ceiling AND the ceiling of every fast case beside it, so the next survey to drift towards a
   * cliff would arrive at it silently. A budget on the case that needs one is a number somebody has to
   * write down, next to what was measured.
   *
   * 15 s is three times the slowest observation rather than a round number: the load this machine can be
   * under is not this file's to predict, and a budget that only just fits is the flake wearing a number.
   */
  test('⚠️ shut, NOTHING crosses — which is the half that says the wall is real', () => {
    expect(crossings(false)).toBe(0);
  }, 15_000);

  /**
   * 🔴 THE SAME BUDGET AS ITS TWIN, AND IT WAS LEFT OUT OF THE FIRST FIX. The case above got 15 s when
   * the flake was found; this one runs the SAME sixty launches of a thousand frames with the door open, and
   * kept the 5-second default — so the fix held for one of a pair and the other went on waiting for a busy
   * machine. Measured 2026-09-11: 6167 ms, on a run with nothing else competing for the box.
   *
   * ⚠️ WHICH IS THE ARGUMENT AGAINST FIXING A FLAKE WHERE IT FIRED rather than where it lives. The two
   * cases are one survey called twice; budgeting the one that happened to fail first is treating a symptom,
   * and the symptom moved next door within the hour.
   */
  test('⚠️ and open, most of them do', () => {
    // Measured at 37 in 60. The gate asks for a quarter, so a change that halved the effect is still
    // caught and one that removed it — a door that opens in the model and stays solid in the physics
    // — cannot pass at all.
    const used = crossings(true);

    expect(used, `${used}/${BALLS} crossed`).toBeGreaterThan(BALLS / 4);
  }, 15_000);
});
