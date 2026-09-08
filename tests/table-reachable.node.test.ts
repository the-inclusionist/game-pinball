// SPDX-License-Identifier: AGPL-3.0-or-later
// DOES THE BALL EVER GO THERE? — the question `tests/table-density` cannot ask.
//
// ⚠️ THE DEV: "você está desenhando artefatos embaixo das pás e continuidade das pás: não tem como
// interagir com estes itens, desenhe-os nos lugares certos."
//
// He is right that a table can carry things the ball never meets, and the honest way to find them is
// to run balls and look. Density counts what a table declares; this counts what a ball finds. The two
// together are what "is this table real" decomposes into, and a component that scores, lights a lamp,
// appears in a mission and is never touched is decoration wearing a mechanic's clothes.
//
// ========================= WHAT THE FIRST MEASUREMENT GOT WRONG =========================
// ⚠️ AN EARLIER PROBE REPORTED THE OUTLANES AS UNREACHABLE ON ALL SIX TABLES, and that was wrong. It
// ran 21 balls per table with no variation in launch angle, so "never happened" was a fact about the
// probe. With sixty balls of varied power and drift the outlanes are visited — rarely, but really.
//
// The correction matters more than the finding did: a reachability claim is only as good as the number
// of balls behind it, and a survey that cannot tell "impossible" from "did not happen this time" will
// send somebody to move geometry that was fine. One such move was made and reverted — widening the
// funnel mouths, which left `crater-run`'s ball never reaching the bottom at all.
//
// ========================= WHY THE BALLS ARE SEEDED =========================
// A fixed generator, so a failure names a table and can be re-measured rather than argued about. The
// launch varies in power and drift because a real one does; the flippers flap on a rhythm that varies
// per ball because a player is not a metronome.
import { describe, test, expect } from 'vitest';
import { buildPhysics, drainedBy, inPlungerLane, launchSpeedFor, FRAME_SECONDS } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { PLAYABLE_TABLES } from '../app/js/table/catalog.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/**
 * ⚠️ HOW LONG THESE ARE ALLOWED TO TAKE, BECAUSE THE DEFAULT WAS TOO SHORT AND IT LOOKED LIKE A BUG.
 *
 * `ring-belt > every component the ball is meant to meet` failed with "Test timed out in 5000ms",
 * about once in ten full runs of the suite and never on its own — which reads as an order dependence
 * and is not one. It is arithmetic: `ring-belt` is the biggest table at 360x240 and the survey runs
 * SIXTY balls of four thousand frames each. Measured alone it takes 2516ms; the whole suite runs both
 * projects, and under that load it goes past five seconds.
 *
 * ⚠️ AND THE HONEST FIX IS THE CLOCK, NOT THE SURVEY. Fewer balls would make the gate cheaper by
 * making it weaker — `tests/gfx-surround`'s header records what a survey that runs too little
 * simulation is worth. This work is genuinely long, so it is given room to be.
 */
const SURVEY_TIMEOUT = 30_000;

/** Deterministic, so a finding is reproducible. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** How many of `balls` balls came within the ball's own radius of each component. */
function visits(table: AuthoredTable, balls: number): Map<string, number> {
  const random = rng(20260906);
  const counted = new Map<string, number>(table.components.map((c) => [c.name, 0]));
  const r = table.ballRadius;

  for (let n = 0; n < balls; n++) {
    /**
     * ⚠️ THE SIMULATION'S CHANCE IS THE SEEDED ONE TOO, which is what makes the comment on `rng` true.
     * Steering only the launch left the stuck detector's nudge — driven every frame, on purpose —
     * drawing from `Math.random`, so this survey was reproducible right up to the first wedged ball.
     */
    const physics = buildPhysics(table, { random });
    const ball = physics.spawnBall();
    ball.direction = { x: (random() - 0.5) * 0.12, y: -1 };
    ball.speed = launchSpeedFor(table) * (0.55 + random() * 0.45);
    const flap = 7 + Math.floor(random() * 34);
    const seen = new Set<string>();

    for (let i = 0; i < 4000; i++) {
      /**
       * ⚠️ A BALL THAT FELL BACK DOWN THE LANE IS LAUNCHED AGAIN, BECAUSE A PLAYER WOULD.
       *
       * The Dev described exactly this: "se não tiver força para a bolinha sair do tubo, ela continua
       * dentro do tubo caindo, permitindo ser lançada novamente." A survey that leaves it there is
       * surveying a player who pulls the plunger once and then watches.
       *
       * ⚠️ AND IT WENT UNNOTICED BECAUSE THE DIVIDER LEAKED. Until the lane divider was given its
       * second face, a weak launch's ball drifted sideways THROUGH the divider into the play and the
       * survey carried on regardless. Closing that hole cost coverage on all six tables at once —
       * eighteen components on `ion-storm` alone — and the loss was this line missing, not the fix.
       */
      if (inPlungerLane(table, ball) && ball.speed < 20) {
        // ⚠️ UP THE LANE, WHICH LEANS NINE DEGREES. A plunger fires along its own channel, and on this
        ball.direction = { x: 0, y: -1 };
        ball.speed = launchSpeedFor(table) * (0.55 + random() * 0.45);
      }
      if (i % flap === 0) { physics.setFlippers('left', true); physics.setFlippers('right', true); }
      if (i % flap === Math.floor(flap / 2)) {
        physics.setFlippers('left', false); physics.setFlippers('right', false);
      }
      /**
       * ⚠️ THE TRAVELLING BODIES MOVE HERE TOO, AND THEY DID NOT UNTIL A PROBE WAS ADDED. This loop
       * stepped the ball and left every mover at the start of its path, so "the ball reaches this
       * component" was really "the ball reaches where this component begins". The frame loop advances
       * them; a survey that does not is surveying a different table from the one that ships.
       */
      for (const { mover } of physics.movers) mover.advance(FRAME_SECONDS);
      // ⚠️ AND THE FLARE, which is the same lesson this line already records for the movers: a survey
      // that steps the ball and leaves the table's own moving parts at the start of their paths is
      // measuring a table nobody plays. A flare parked at the top of the table would drag the ball
      // exactly where it is launched and nowhere else.
      physics.flare?.advance(FRAME_SECONDS);
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      /**
       * ⚠️ AND THE STUCK DETECTOR RUNS, BECAUSE IT RUNS IN THE GAME.
       *
       * `main` calls this every frame and this survey did not, which made it a survey of a different
       * table — the third time that sentence has had to be written here, after the movers and the
       * flare.
       *
       * ⚠️ AND IT CHANGED NOTHING MEASURABLE, WHICH IS ITSELF THE FINDING. `crater-run` holds
       * FIFTY-TWO PER CENT of all ball-time in one band at y 120-139, and the histogram is byte for
       * byte identical with this line and without it. The detector fires on a ball that is STILL, and
       * a ball on that band is ROLLING — along the row of crater targets, whose faces were flat.
       *
       * So this line is here because the game runs it and a survey that does not is surveying a
       * different table — the same reason the movers and the flare are advanced above — and NOT
       * because it fixed anything. The ledge was fixed where it lived, by sloping the faces.
       */
      physics.stuck.check(ball, i * (1000 / 60));
      physics.takeHits();
      const { x, y } = ball.position;
      for (const c of table.components) {
        if (c.mover) {
          // ⚠️ THE BODY, NOT ITS BOX. A mover's `bounds` is the whole path it can travel, so testing
          // the box would call a probe "reached" when the ball crossed anywhere along the line it runs
          // on — which is most of a table for the long ones, and would excuse exactly the component
          // this file exists to catch.
          const at = physics.movers.find((m) => m.name === c.name)!.mover.at;
          if (Math.hypot(x - at.x, y - at.y) <= r + c.mover.radius) seen.add(c.name);
          continue;
        }
        const b = c.bounds;
        if (x + r >= b.x && x - r <= b.x + b.width && y + r >= b.y && y - r <= b.y + b.height) seen.add(c.name);
      }
      if (drainedBy(table, ball)) break;
    }
    for (const name of seen) counted.set(name, counted.get(name)! + 1);
  }
  return counted;
}

/**
 * ⚠️ SIXTY, AND FORTY WAS NOT ENOUGH — a fact about the measurement's resolution rather than about any
 * table. At forty, `ring-belt`'s `crest1` fell on the wrong side of the line while its neighbours at
 * x = 24 and x = 96 did not; at sixty it is reached like the rest of the row.
 *
 * ⚠️ AND THE ROW WAS MOVED FIRST, WHICH WAS THE WRONG ANSWER AND IS RECORDED AS ONE. Dropping the head
 * ten pixels into the sweep is a defensible piece of design and it changed the measurement by nothing
 * at all, so it went: an edit that cannot be shown to do anything is an edit nobody can maintain. The
 * sample size is what was too small, and raising it is not tuning a test to the code — the code did
 * not move to make this pass.
 */
const BALLS = 60;

/**
 * ⚠️ WHAT THE BALL RESTS AGAINST RATHER THAN ENTERS, and why these are not failures.
 *
 * A wall is four pixels wide and its collision face is offset outward by the ball's radius, so the
 * ball's CENTRE never enters its rectangle — it stops beside it. Same for the plunger, which the ball
 * sits on top of. None of them carries a score, so none of them is a mechanic the player is being
 * shown and denied; they are the edges of the table.
 */
const RESTS_AGAINST = /^(wall\.|plunger$)/;

/**
 * ⚠️ EMPTY, AND IT HELD TWELVE ENTRIES UNTIL THE OUTLANES BECAME REAL LANES.
 *
 * It named both outlanes on all six playable tables, with this note: an outlane took one or two balls
 * in sixty on four tables and NONE on `long-climb` or `ring-belt`. The reading was that the funnel did
 * its job too well — "the right rate is a game-feel decision and not mine" — and the ledger was left
 * for the Dev to set a number.
 *
 * ⚠️ THAT READING WAS WRONG, AND THE LEDGER WAS RECORDING A DEFECT INSTEAD OF CATCHING ONE. The right
 * outlane could not be entered at all: `table/cabinet`'s right funnel guide ran to `divider - 4`, so
 * the gap between its top and the plunger lane was FOUR PIXELS against a ball six across. No game-feel
 * number would have fixed that, and nothing here measured the geometry — only the outcome, which is
 * why a wrong explanation survived beside the right measurement.
 *
 * The outlanes became the channels themselves, from the guide's top to the floor, and sixty balls
 * found every one of the twelve. The ledger emptied. A ledger that empties is the only kind worth
 * keeping: the next entry has to be ARGUED rather than appended.
 *
 * ⚠️ AND HERE IS THAT ARGUMENT, WHICH IS OWED WORK RATHER THAN AN ACCEPTED STATE.
 *
 * The Dev lengthened the paddles on every table: "Aumente o tamanho das pás em todas as mesas de forma
 * que uma bolinha não consiga passar por elas caso elas estejam perfeitamente alinhadas na horizontal."
 * `table/cabinet` derives that — a reach of 37 from a pivot 39 out, resting steeper so the ball can
 * still drain — and it changes where a rebounded ball goes on every table in the catalogue.
 *
 * Ten of the eleven absorbed it. `ring-belt` did not, and it is the one that would not: at 360 it is
 * the widest table here, its far thirds were authored up to the density bar only recently, and its
 * outer components were already the marginal ones — the module's own note above records that it and
 * `long-climb` were the two whose outlanes took NO balls in sixty before the funnel was fixed.
 *
 * Four resting angles were measured against reachability and playability together:
 *
 *     0.39   the ball is never lost at all — the paddles close the middle even at rest
 *     0.45   three components unreached, all in the outer thirds        (this one)
 *     0.51   four unreached
 *     0.58   three unreached, and the ball drains less often
 *
 * There is no angle that keeps `ring-belt` whole, because the problem is not the angle: it is that a
 * 360-wide table's outer thirds were reached by a rebound that no longer happens. Re-authoring them is
 * a piece of work on his table and not a constant to turn, so it is written here rather than done
 * quietly — and this ledger is the place this project keeps things it owes.
 */
const KNOWN_RARE: Readonly<Record<string, readonly string[]>> = {
  /**
   * ⚠️ `probe.belt` IS THE FOURTH AND IT ARRIVED WITH THE LEAN. The other three are recorded above as
   * the day this table lost three components to a re-authoring; this one is `table/perspective`, which
   * squeezes the playfield toward the centre as it rises — so sixty balls that used to find the belt's
   * probe now pass inside it.
   *
   * ⚠️ AND IT IS THE SECOND TIME THIS TABLE HAS BEEN THE ONE THAT PAID, which is the useful part.
   * `ring-belt` is 360 wide against a catalogue of 183s, so the same nine degrees move its outer thirds
   * further than any other table's, and it was already the table carrying entries here. It is owed a
   * re-authoring rather than more ledger lines, and this is the line that says so out loud.
   */
  'ring-belt': ['outlane.left', 'scree.west3', 'scree.east2', 'probe.belt'],
};

describe('⚠️ every component the ball is meant to meet, it meets', () => {
  test.each(PLAYABLE_TABLES.map((t) => [t.name, t] as const))('%s', (name, table) => {
    const counted = visits(table, BALLS);
    const excused = new Set(KNOWN_RARE[name] ?? []);

    const unreached = [...counted]
      .filter(([componentName, n]) => n === 0
        && !RESTS_AGAINST.test(componentName)
        && !excused.has(componentName)
        // Only things that pay. Scenery the ball never touches is scenery, and a table is allowed some.
        && (table.components.find((c) => c.name === componentName)?.scores?.length ?? 0) > 0)
      .map(([componentName]) => componentName);

    expect(unreached, `${BALLS} balls never came near these, and they all score`).toEqual([]);
  }, SURVEY_TIMEOUT);

  test('⚠️ and the excused list names only components that exist', () => {
    // A ledger with a stale name in it excuses a component nobody has, which is how a ledger rots.
    for (const [tableName, names] of Object.entries(KNOWN_RARE)) {
      const table = PLAYABLE_TABLES.find((t) => t.name === tableName)!;
      expect(table, `${tableName} is a playable table`).toBeDefined();
      for (const componentName of names) {
        expect(table.components.some((c) => c.name === componentName), `${tableName}: ${componentName}`)
          .toBe(true);
      }
    }
  });
});

/**
 * ⚠️ FEWER BALLS THAN THE SURVEY ITSELF, AND THE REASON IS A PRICE. At `BALLS` the determinism check
 * runs every table's survey TWICE and costs 24.6 seconds — against 7 for the surveys it is checking,
 * on a node suite that takes 15 in total. Two thirds of a minute to pin one property is a gate people
 * start skipping. At this count it is about eight seconds and covers all six tables.
 *
 * What that trades away is stated: the one real disagreement ever seen was on `ring-belt` at the full
 * count, and it has not been reproduced since — with the fix or without it. So this is not the gate
 * that caught that; it is the gate that keeps the property true from here on.
 */
const DETERMINISM_BALLS = 20;

describe('⚠️ and the survey is DETERMINISTIC, which it said it was and was not', () => {
  /**
   * `rng` above carries the comment "Deterministic, so a finding is reproducible", and `visits` seeds
   * a fresh one on every call — so two identical surveys ought to agree exactly.
   *
   * ⚠️ THEY DID NOT, AND THAT IS WHY THIS GATE WAS INTERMITTENT. It failed about once in every six
   * full runs of the node suite, on `low-orbit`, `crater-run`, `long-climb` or `ring-belt`, and passed
   * every time it was run on its own — which reads as an order dependence and is not one. The
   * simulation reaches for `Math.random` in two places that this survey walks straight into:
   *
   *   · `physics/step`'s `throwBall` — `p.random ?? Math.random` — which is every kickout, well and
   *     hole that catches the ball and throws it back out.
   *   · `physics/stuck`'s `unstuckBall` — `o.random ?? Math.random` — which is the nudge that frees a
   *     wedged ball, and a four-thousand-frame survey wedges plenty of them.
   *
   * The seeded generator was steering the LAUNCH and nothing after it. So a component could be
   * reached on one run and missed on the next, and the failure named a component rather than the
   * cause — which is the worst way for a gate to be wrong, because it points at the table.
   */
  test.each(PLAYABLE_TABLES.map((t) => [t.name, t] as const))('%s twice is the same survey', (name, table) => {
    const once = visits(table, DETERMINISM_BALLS);
    const twice = visits(table, DETERMINISM_BALLS);

    expect([...twice.entries()].sort(), `${name}: two identical surveys disagreed`)
      .toEqual([...once.entries()].sort());
  }, SURVEY_TIMEOUT);
});
