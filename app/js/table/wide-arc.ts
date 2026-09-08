// SPDX-License-Identifier: AGPL-3.0-or-later
// table/wide-arc — a table WIDER than the screen.
//
// ========================= WHAT THIS ONE IS FOR =========================
// The plan says a table wider than 320 scrolls horizontally through the same camera. Nothing had ever
// proved it, because every table so far was 183 wide and the horizontal axis had no travel at all.
//
// This one is 360x280. It makes two things happen that no other table does:
//
//   · `shell/camera`'s axis solver gets a second axis with real travel — 40 pixels of it — driven by
//     exactly the same function, which is the claim ADR-0001 § 7 made and never tested against a table.
//   · `shell/hud` reports `overlaying: true`, because there is no margin left beside the playfield and
//     the four blocks have to sit on top of the play. That path existed and had only ever been
//     exercised by a fixture.
//
// It is deliberately sparse. A wide table is here to test the geometry the screen imposes, not to be
// the most interesting one to play.
//
// ========================= AND SINCE 2026-09-07 IT IS LAID OUT ON A PICTURE =========================
// ⚠️ THE DEV PAINTED ONE AND SAID WHAT TO DO WITH IT: "artes feitas, lembrando: elas não são fiéis e é
// preciso refazer os mapas em cima de cada arte." The geometry moved to the art and not the other way
// round, which is the rule `gfx/backdrop`'s own header states — "the player aims at what they see and
// the ball meets what they do not".
//
// Read off `shots/grid-wide-arc.png`, which is the imported picture at four times with this table's own
// coordinates drawn on it. What the art promises and the geometry now answers:
//
//   · three domed bumpers at (128,100), (177,72) and (227,100), twenty across rather than nine — they
//     are painted big, and a bumper the ball misses by ten pixels is a bumper that is not there
//   · three rollover strips in a row at y = 134, which the art draws as lit green bars
//   · the ARC-BOOST chute, which the art runs from (205,197) up to (310,78) — the old ramp was a guess
//     at 45° in about the right place, and this is the same idea on the line that is drawn
//   · a funnel — and this is the one thing the art asked for and did not get. Its guides start 71 units
//     inside each wall with an outlane outside them, and authored that way the ball cannot be played:
//     the guides' own comment carries the three arrangements that were measured and what each one did.
//
// ⚠️ WHAT DID NOT MOVE IS THE PLUNGER LANE, and the reason is not laziness. `table/perspective` splits
// the map at `plungerLaneOf`'s divider — 339 here — and slides everything right of it instead of
// squeezing it, which is what keeps a corridor passable. The art paints its lane strip about eleven
// units wider than that. Moving the geometry to the paint would put the split THROUGH the lane, and a
// lane that is half squeezed and half slid is the wedge that stopped every launch in the catalogue.
// The paint is a few units generous; the channel is where the transform says it is.
//
// ⚠️ AND THE PADDLES ARE THE PAINTED ONES, WHICH MAKES THEM LONG. The art puts the pivots 136 apart —
// against 78 on a cabinet table — so a pair that closes the middle to under a ball needs a reach of 66
// where `low-orbit` uses 37. `physics/flipper`'s kick scales with reach, so this fixture hits harder
// than any other table, and that is the art's decision showing up in the physics rather than a tuning
// choice of mine.

import type { AuthoredTable } from './authored.js';

export const WIDE_ARC: AuthoredTable = {
  name: 'wide-arc',
  size: { width: 360, height: 280 },
  ballRadius: 3,

  lamps: ['lamp.left', 'lamp.right', 'lamp.arc'],

  components: [
    { name: 'wall.top', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 360, height: 4 },
      collision: [{ kind: 'line', from: { x: 360, y: 4 }, to: { x: 0, y: 4 } }] },
    // ⚠️ THESE HAD NO COLLISION AT ALL. They were bounds and a colour: the ball left the table
    // sideways and `drainedBy` reported `outside`. A wall that is only drawn is not a wall.
    { name: 'wall.left', kind: 'wall', role: 'structure', bounds: { x: 0, y: 0, width: 4, height: 280 },
      collision: [{ kind: 'line', from: { x: 4, y: 0 }, to: { x: 4, y: 280 } }] },
    { name: 'wall.right', kind: 'wall', role: 'structure', bounds: { x: 356, y: 0, width: 4, height: 280 },
      collision: [{ kind: 'line', from: { x: 356, y: 280 }, to: { x: 356, y: 0 } }] },

    // The return bend. See `low-orbit` for why a plunger lane needs one.
    { name: 'wall.laneReturn', kind: 'wall', role: 'structure',
      bounds: { x: 316, y: 4, width: 42, height: 22 },
      collision: [{ kind: 'line', from: { x: 356, y: 25 }, to: { x: 316, y: 7 } }] },

    /**
     * ⚠️ THE LANE DIVIDER, AND THIS FIXTURE NEVER HAD ONE. Every table built on `table/cabinet` gets it
     * and the three hand-authored ones were each written before that module existed; here the omission
     * was invisible because `guide.right` used to run from the pivot all the way to the RIGHT WALL and
     * closed that side by accident.
     *
     * Laying the table out on the Dev's picture moved the guide to where the art draws it — a triangle
     * ending at x = 285 — and the accident stopped happening. Traced: the launch came down the right,
     * bounced off `rail.right` and the wall, and left through the floor at x = 342, which is between
     * the plunger and nothing at all. `drainedBy` answered `below`: a hole in the geometry.
     *
     * ⚠️ TWO FACES, for the reason `table/cabinet` gives at length: this is the only wall in the game
     * with the play on one side and the plunger lane on the other, and a single face lets a ball in the
     * lane walk straight through it.
     */
    { name: 'wall.laneDivider', kind: 'wall', role: 'structure',
      bounds: { x: 339, y: 34, width: 4, height: 246 },
      collision: [
        { kind: 'line', from: { x: 339, y: 280 }, to: { x: 339, y: 34 } },
        { kind: 'line', from: { x: 343, y: 34 }, to: { x: 343, y: 280 } },
      ] },

    { name: 'plunger', kind: 'plunger', role: 'structure', bounds: { x: 344, y: 244, width: 10, height: 32 },
      collision: [{ kind: 'line', from: { x: 344, y: 244 }, to: { x: 354, y: 244 } }] },

    /**
     * The three domes, where the art paints them and at the size it paints them.
     *
     * ⚠️ RADIUS TWENTY, AND EVERY OTHER BUMPER IN THE CATALOGUE IS NINE. The picture draws these as
     * forty-unit domes with a lit cap, and a nine-unit circle inside one is a bumper the ball passes
     * through the picture of. The kick is unchanged — `RESPONSES.bumper` is a boost along the normal
     * and knows nothing about the radius — so what a bigger dome changes is how often it is hit, which
     * is what the art is saying it wants.
     */
    { name: 'bumper.far.left', kind: 'bumper', role: 'structure',
      bounds: { x: 108, y: 80, width: 40, height: 40 }, scores: [500, 1000, 1500, 2000],
      control: 'BumperControl', lamps: ['lamp.left'],
      collision: [{ kind: 'circle', at: { x: 128, y: 100 }, radius: 20 }] },
    { name: 'bumper.far.right', kind: 'bumper', role: 'structure',
      bounds: { x: 207, y: 80, width: 40, height: 40 }, scores: [500, 1000, 1500, 2000],
      control: 'BumperControl', lamps: ['lamp.right'],
      collision: [{ kind: 'circle', at: { x: 227, y: 100 }, radius: 20 }] },
    { name: 'bumper.middle', kind: 'bumper', role: 'structure',
      bounds: { x: 157, y: 52, width: 40, height: 40 }, scores: [500, 1000, 1500, 2000],
      control: 'BumperControl', lamps: ['lamp.arc'],
      collision: [{ kind: 'circle', at: { x: 177, y: 72 }, radius: 20 }] },

    /**
     * ⚠️ THE THREE LIT BARS, WHICH THE FIXTURE NEVER HAD. The art draws them in a row under the domes
     * and a table where a painted target does nothing teaches a player that the picture is decoration.
     * They are lanes rather than targets: the art shows a flat strip flush with the floor, which is a
     * thing a ball rolls OVER, and a target is a thing it hits.
     */
    { name: 'lane.arc1', kind: 'lane', role: 'free', bounds: { x: 101, y: 130, width: 32, height: 8 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.left'] },
    { name: 'lane.arc2', kind: 'lane', role: 'free', bounds: { x: 137, y: 130, width: 30, height: 8 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.arc'] },
    { name: 'lane.arc3', kind: 'lane', role: 'free', bounds: { x: 171, y: 130, width: 30, height: 8 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.right'] },

    // ⚠️ IT USED TO BE A 280-PIXEL SHELF AT SEVEN DEGREES, AND THE BALL WENT TO SLEEP ON IT.
    // Two runs found two different faults in the same component. The first: it stopped at x = 300, the
    // ball came down the right-hand side past its end, and met nothing at all the whole way to the
    // bottom. Extending it to x = 340 fixed that and created the second, which is worse and much
    // quieter — a line that shallow does not deflect a ball, it CATCHES one. The probe shows the ball
    // arriving with speed 112, losing it to four bounces, and then creeping down the slope at a steady
    // 2.5: x = 208 after 400 frames, x = 168 after 4000, still going. It would have reached the low end
    // in about fifteen thousand frames, four minutes of sitting and watching.
    //
    // `physics/stuck` cannot help, and is right not to: 2.5 is well above its 0.8 threshold, so the ball
    // IS moving and the detector says so. The fault is not in the physics and not in the detector. A
    // long, nearly flat, one-sided line in the middle of a playfield is a bed.
    //
    // So the ramp is now a CHUTE: 45 degrees, 80 pixels, on the right where the bend delivers the ball.
    // At that angle gravity's pull along the surface is as large as the pull into it, and a ball cannot
    // settle — it is thrown back across the table towards the far bumper, which is what a ramp is for.
    /**
     * ⚠️ AND NOW IT IS THE LINE THE ART DRAWS, which runs from (205,197) to (310,78) — 48 degrees,
     * where the guess it replaces was 45 in roughly the same corner. The paragraph above is kept
     * because the fault it records is the one that decided the ANGLE, and the art happens to agree
     * with it: a chute steep enough that a ball cannot settle on it.
     */
    { name: 'ramp.long', kind: 'ramp', role: 'goal', bounds: { x: 205, y: 78, width: 105, height: 119 },
      scores: [10000], control: 'RampControl',
      collision: [{ kind: 'line', from: { x: 205, y: 197 }, to: { x: 310, y: 78 } }] },

    // ⚠️ THE FUNNEL, WITHOUT WHICH A 360-WIDE TABLE HAS EIGHTY PIXELS OF PADDLE AND NO WAY TO REACH THEM.
    // Measured: the ball crossed the flipper line at x = 57, eighty-three pixels left of the left
    // pivot, and a run flapping the flippers came out identical to a run touching nothing.
    //
    // Forty-five degrees and no shallower, which is a rule this table taught: its own ramp was a
    // seven-degree shelf and the ball went to SLEEP on it. A guide is a surface a ball slides down, and
    // the angle is what decides whether it slides or settles.
    /**
     * ⚠️ THE FUNNEL RUNS FROM THE WALLS TO THE PADDLES' TIPS, AND THE ART DRAWS SOMETHING SHORTER.
     *
     * Its two triangles start 71 units inside each wall, with a red-marked outlane down the outside of
     * each — "OUT-LANE / GRAV-STRESS" in the Dev's own lettering. Authored that way this table cannot be
     * played, and every arrangement of it was measured before that sentence was written:
     *
     *   · guides ending at the PIVOTS, rails from the pivots down to the floor: a ball rolling down a
     *     guide is handed straight to the rail beside it and out, touching the paddle only at its base
     *     where the arm barely moves. `flipper.right@255,232`, then the outlane, in both runs.
     *   · rails moved twenty units clear of the pivots to fix that: a twenty-unit WINDOW opens between
     *     the two, the ball flies through it and ends up under both paddles. Flap periods of 24, 18, 30
     *     and 12 frames all came out at (193,281) — no tempo tells a player from a spectator.
     *   · guides ending at the TIPS, which is what `table/cabinet` does and why: the same, one hole
     *     further along.
     *
     * ⚠️ SO THE PICTURE'S OUTLANES STAY PAINT. It is the decision `bare-minimum` already carries for its
     * three engines and `narrow-tower` for its guides — "the sixteen units are the liberty; the funnel
     * is the reason" — and it is the same trade both times: a table nobody can play is not a truer
     * depiction of a picture. This fixture exists to give the horizontal camera something to follow.
     *
     * Forty-five degrees and no shallower, which is a rule this table taught: its own ramp was a
     * seven-degree shelf and the ball went to SLEEP on it. A guide is a surface a ball slides down, and
     * the angle is what decides whether it slides or settles.
     */
    { name: 'guide.left', kind: 'wall', role: 'structure', bounds: { x: 4, y: 116, width: 168, height: 116 },
      collision: [{ kind: 'line', from: { x: 4, y: 116 }, to: { x: 172, y: 232 } }] },
    { name: 'guide.right', kind: 'wall', role: 'structure', bounds: { x: 188, y: 116, width: 168, height: 116 },
      collision: [{ kind: 'line', from: { x: 188, y: 232 }, to: { x: 356, y: 116 } }] },

    /**
     * ⚠️ THE TIPS ARE SIXTEEN PIXELS APART AND WERE TWENTY-FOUR, which is the width of the drain's
     * mouth and therefore a way to lose that no paddle could reach. The ball came off `guide.left`,
     * touched the ramp once more and fell straight down the middle between two raised flippers — and a
     * flapping run came out identical to a quiet one, which is exactly what the funnel note above this
     * says the guides were added to stop. The funnel delivered the ball to a hole between the paddles.
     *
     * Found when the ball gained a radius and every trajectory moved three pixels; the gap had been
     * survivable by luck rather than by geometry.
     */
    /**
     * ⚠️ LENGTHENED WITH THE REST OF THE CATALOGUE. The Dev: "Aumente o tamanho das pás em todas as
     * mesas de forma que uma bolinha não consiga passar por elas caso elas estejam perfeitamente
     * alinhadas na horizontal." `table/cabinet` derives this for the tables that use it; this fixture
     * writes its own pair, so it gets the same arithmetic by hand — pivots unmoved at 140 and 220, a
     * reach of 38 of the 40 that separates each from the middle, leaving 4 between the raised tips.
     */
    { name: 'flipper.left', kind: 'flipper', role: 'structure',
      bounds: { x: 112, y: 232, width: 60.3, height: 27.1 },
      flipper: {
        pivot: { x: 112, y: 232 }, tipAtRest: { x: 172.3, y: 259.1 }, sweepDegrees: -55,
        baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },
    { name: 'flipper.right', kind: 'flipper', role: 'structure',
      bounds: { x: 187.7, y: 232, width: 60.3, height: 27.1 },
      flipper: {
        pivot: { x: 248, y: 232 }, tipAtRest: { x: 187.7, y: 259.1 }, sweepDegrees: 55,
        baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },

    { name: 'drain', kind: 'drain', role: 'hazard', bounds: { x: 164, y: 268, width: 32, height: 10 },
      control: 'DrainControl' },
  ],
};
