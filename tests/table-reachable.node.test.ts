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
import { buildPhysics, drainedBy, launchSpeedFor, FRAME_SECONDS } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { PLAYABLE_TABLES } from '../app/js/table/catalog.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

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
    const physics = buildPhysics(table);
    const ball = physics.spawnBall();
    ball.direction = { x: (random() - 0.5) * 0.12, y: -1 };
    ball.speed = launchSpeedFor(table) * (0.55 + random() * 0.45);
    const flap = 7 + Math.floor(random() * 34);
    const seen = new Set<string>();

    for (let i = 0; i < 4000; i++) {
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
 * The outlanes are now the channels themselves, from the guide's top to the floor. Sixty balls find
 * every one of the twelve, so nothing needs excusing. A ledger that empties is the only kind worth
 * keeping: it stays here, empty, so the next entry has to be argued rather than appended.
 */
const KNOWN_RARE: Readonly<Record<string, readonly string[]>> = {};

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
  });

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
