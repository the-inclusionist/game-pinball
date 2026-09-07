// SPDX-License-Identifier: AGPL-3.0-or-later
// table/cabinet — the parts every pinball table has, built once instead of copied six times.
//
// ========================= WHY THIS EXISTS =========================
// `low-orbit` was authored by hand and the hand-authoring found two defects that no rule could have
// predicted, both recorded in its own comments and both fatal to the game:
//
//   · WITHOUT A RETURN BEND the launched ball goes straight up the lane, off the ceiling and straight
//     back down the same lane. Three balls out of three drained without ever entering the play.
//   · WITHOUT THE FUNNEL GUIDES the ball crosses the flipper line ninety pixels wide of the pivot and
//     slides UNDER both paddles. A run flapping the flippers and a run touching nothing came out
//     identical: same frames, same score, same drain. The player is a spectator.
//
// Five more tables were then asked for. Copying that skeleton five times would mean five chances to
// re-make both — and the winding of a collision line, which decides which SIDE of it is solid, is
// something a person gets wrong quietly and a machine does not. So the cabinet is built once, from the
// geometry that was proven by playing it, and a table declares only what makes it that table.
//
// ⚠️ WHAT IS PARAMETERISED AND WHAT IS NOT. The cabinet scales with the table's WIDTH and HEIGHT,
// because a taller table is a longer lane and a wider one is a wider funnel. The bottom assembly does
// NOT scale: a flipper is sized against the BALL, not against the table, and a table twice as tall
// with flippers twice as long would play nothing like a pinball. Those numbers are `low-orbit`'s,
// which are the ones that were played.

import type { AuthoredComponent, AuthoredShape } from './authored.js';

const WALL = 'structure' as const;

/** The lamps the cabinet's own scoring parts drive. A table must declare these alongside its own. */
export const CABINET_LAMPS: readonly string[] = [
  'lamp.launch', 'lamp.outlaneLeft', 'lamp.outlaneRight', 'lamp.inlaneLeft', 'lamp.inlaneRight',
];

export interface CabinetOptions {
  readonly width: number;
  readonly height: number;
}

/**
 * The shell: outer walls, the plunger lane and its return bend, the flippers, the funnel, the outlanes
 * and the drain.
 *
 * Every collision line's winding is chosen so its normal faces the play. See `normalOf` in
 * `table/authored` for the four cases and for why the first draft of every table here got it wrong.
 */
/**
 * The radius of the rounded top of the plunger lane. See `wall.laneReturn`.
 *
 * ⚠️ TWENTY, AND THE TWO NUMBERS EITHER SIDE OF IT ARE BOTH RECORDED FAILURES. Thirty-four reached
 * down to y = 38 against a divider whose top is at 34, so its lower half hung inside the lane and
 * `crater-run` lost balls through the geometry. An arc centred on the LANE rather than the corner has
 * a vertical tangent at the lane's own column, so a rising ball travels parallel to it and is never
 * touched at all.
 */
const RETURN_RADIUS = 20;
/**
 * ⚠️ EIGHT SEGMENTS, WHICH IS A MEASUREMENT AND NOT A ROUND NUMBER. A quarter turn of radius 20 is
 * thirty-one pixels of arc; eight chords deviate from the true curve by `R(1 - cos 5.6°)` = a TENTH of
 * a pixel, which is well inside the framebuffer's own resolution. More would be arithmetic nobody can
 * see; four would be a visible corner cut.
 */
const RETURN_SEGMENTS = 8;

/**
 * A quarter-circle as a chain of lines, wound so that every normal points AT THE CENTRE.
 *
 * ⚠️ THE WINDING IS THE WHOLE THING, exactly as `table/authored` says of a single line: a wall from
 * one side and thin air from the other. Walking the angle DOWNWARD makes each chord run up-and-left
 * around a top-right corner, and `(dy, -dx)` then points inward — at the play. Walked the other way
 * the arc is a wall the ball can only hit from outside the table, which is to say never.
 */
function arcInward(
  centre: { x: number; y: number }, radius: number, fromDegrees: number, toDegrees: number,
): AuthoredShape[] {
  const at = (degrees: number) => ({
    x: centre.x + radius * Math.cos((degrees * Math.PI) / 180),
    y: centre.y + radius * Math.sin((degrees * Math.PI) / 180),
  });
  const shapes: AuthoredShape[] = [];
  for (let i = 0; i < RETURN_SEGMENTS; i++) {
    const a = fromDegrees + ((toDegrees - fromDegrees) * i) / RETURN_SEGMENTS;
    const b = fromDegrees + ((toDegrees - fromDegrees) * (i + 1)) / RETURN_SEGMENTS;
    shapes.push({ kind: 'line', from: at(a), to: at(b) });
  }
  return shapes;
}

/**
 * Where the plunger lane is, for anything outside this module that has to know.
 *
 * ⚠️ PUBLISHED RATHER THAN COPIED, and the reason is the defect that made it necessary. The comet
 * drill's drag slowed EVERY ball everywhere, including one climbing the tunnel, and no table in the
 * catalogue could launch while a mission was running. Fixing that means the shell has to be able to
 * ask "is this ball still in the lane" — and a second copy of `w - 21` in `main.ts` is a number that
 * would go on answering after this module changed it, which is how the drop targets and the cabinet
 * itself each drifted once already.
 */
export function plungerLaneOf(o: CabinetOptions): { laneX: number; divider: number; dividerTop: number } {
  return { laneX: o.width - 16, divider: o.width - 21, dividerTop: 34 };
}

export function cabinet(o: CabinetOptions): AuthoredComponent[] {
  const { width: w, height: h } = o;

  // The plunger lane runs down the right-hand side. Ten wide plus a four-wide divider, which is what
  // `low-orbit` uses and what the ball fits through without rattling.
  const { laneX, divider } = plungerLaneOf(o);
  // ⚠️ THE DIVIDER STOPS SHORT OF THE TOP. That opening is how a launched ball enters the play and it
  // is the only way in — a divider running the full height is a table with a sealed lane.
  const { dividerTop } = plungerLaneOf(o);

  // The bottom assembly, measured UP from the floor rather than scaled: a flipper is sized against the
  // ball. `low-orbit`'s numbers, which are the ones that were played.
  const floor = h;
  const flipperY = floor - 29;
  const centre = (w - 16) / 2;
  const halfGap = 11;          // 22 between the tips, so the middle is losable on purpose
  const flipperLength = 28;
  const guideTop = flipperY - 38;
  /**
   * How wide the side channels are, and therefore where the funnel guides start.
   *
   * ⚠️ ONE NUMBER FOR BOTH, because they are two sides of the same gap and were written separately.
   * The ball is six pixels across; fourteen is a channel it enters without rattling and does not
   * fall into by accident.
   */
  const OUTLANE_WIDTH = 14;

  return [
    /* ===================== THE OUTER SHELL ===================== */
    { name: 'wall.left', kind: 'wall', role: WALL, bounds: { x: 0, y: 0, width: 4, height: h },
      collision: [{ kind: 'line', from: { x: 4, y: 0 }, to: { x: 4, y: h } }] },
    { name: 'wall.right', kind: 'wall', role: WALL, bounds: { x: w - 4, y: 0, width: 4, height: h },
      collision: [{ kind: 'line', from: { x: w - 4, y: h }, to: { x: w - 4, y: 0 } }] },
    { name: 'wall.top', kind: 'wall', role: WALL, bounds: { x: 0, y: 0, width: w, height: 4 },
      collision: [{ kind: 'line', from: { x: w, y: 4 }, to: { x: 0, y: 4 } }] },

    /**
     * ⚠️ TWO FACES, AND IT HAD ONE. `table/authored` states the rule: a collision line is one-sided and
     * its winding decides which side. Every other wall in this cabinet has the PLAY on one side and
     * the outside of the table on the other, so a single face is all any of them needs. The divider is
     * the only wall in the game with the play on one side and the PLUNGER LANE on the other, and it
     * was wound for the play alone.
     *
     * ⚠️ SO A BALL IN THE LANE WALKED THROUGH IT. Measured before it was fixed, on every table: shoved
     * left at 40, 120 and 300 pixels a second it crossed every time, ending at x = 132 against a left
     * face at 162 — it did not even slow down, because there was nothing there. Found while designing
     * the Dev's secret passage, because a door in a wall the ball can already walk through is not a
     * door.
     *
     * The lane is the whole reason this is a wall at all. Both faces now, wound outward from the
     * divider's own body: bottom-to-top on the left face points its normal into the play, and
     * top-to-bottom on the right face points the other one into the lane.
     */
    { name: 'wall.laneDivider', kind: 'wall', role: WALL,
      bounds: { x: divider, y: dividerTop, width: 4, height: h - dividerTop },
      collision: [
        { kind: 'line', from: { x: divider, y: h }, to: { x: divider, y: dividerTop } },
        { kind: 'line', from: { x: divider + 4, y: dividerTop }, to: { x: divider + 4, y: h } },
      ] },

    /**
     * ⚠️ THE RETURN BEND. Without it the table does not play at all — see this module's header. It is
     * wound right-to-left-and-up so its normal points DOWN into the lane, which is the side a rising
     * ball arrives from: a single slope, steep enough to redirect and shallow enough not to stop the
     * ball dead.
     *
     * ⚠️ AND IT IS THE DEV'S CURVE AT LAST. His words: "o lançador é um túnel que vai retamente pra
     * cima, mas ele deve acabar com uma curva (topo deve ser curvado) de modo que uma bola lançada
     * com força total ande por uma curva até a parede da esquerda." It was the seventh item of his
     * list and the oldest one still open.
     *
     * ⚠️ AND IT TOOK FOUR ATTEMPTS AND TWO MEASUREMENTS, so the failures stay written down. Three
     * shapes were tried first and all three broke tables:
     *
     *   · AN ARC CENTRED ON THE LANE never touched the ball. Its lowest point sits at the lane's own
     *     column with a VERTICAL tangent, so a rising ball meets the end of the arc travelling
     *     parallel to it — no collision — and passes above into the ceiling. Five tables failed "the
     *     ball leaves the plunger lane" at once.
     *   · AN ARC ON THE CORNER AT RADIUS 34 reached down to y = 38 against a divider that starts at
     *     34, so its lower half hung inside the lane. `crater-run` lost balls through the geometry.
     *   · AT RADIUS 20, with and without a straight run out of it, `crater-run` and `long-climb`
     *     stopped answering the flippers: the ball entered the play at a different angle and never
     *     reached a paddle.
     *
     * ⚠️ AND THEN IT WAS MEASURED, WHICH IS WHAT THE THREE GUESSES SHOULD HAVE BEEN. The arc works: on
     * the corner at radius 20, a full launch enters the play moving `(-0.77, 0.64)` where the straight
     * slope gives `(-0.44, 0.90)` — much more leftward, and eighteen pixels higher. That IS the curve
     * the Dev asked for, and it is not why it cannot be adopted.
     *
     * ⚠️ WHAT THE MEASUREMENT FOUND IS THAT THE TOP-LEFT OF EVERY TABLE IS EMPTY. A ball thrown to the
     * left wall has nothing there to meet: it hugs the wall down past the funnel's mouth — which
     * starts at x = 14 against a wall face at 7 — and out of the bottom without ever reaching a
     * paddle. On `crater-run` and `long-climb` a flapping run and a quiet one came out IDENTICAL, 315
     * and 471 frames, which is the playability gate's definition of a table the player watches.
     *
     * So the curve is right and every table is missing the furniture that a curve implies: something
     * in the top-left corner to turn a sweeping ball back into the play. That is a change to six
     * layouts, not to one line, and it is the next piece of authoring rather than a fix to this file.
     *
     * ⚠️ AND `low-orbit` WOULD NOT HAVE FOLLOWED ANYWAY, which is a wart of my own making. It does not
     * call `cabinet()` at all — it was written before this module existed and was never converted — so
     * every cabinet change since has reached five tables and skipped the flagship. Its walls, lane,
     * bend, flippers and funnel are a copy that has been drifting quietly.
     */
    { name: 'wall.laneReturn', kind: 'wall', role: WALL,
      bounds: { x: w - 4 - RETURN_RADIUS, y: 4, width: RETURN_RADIUS, height: RETURN_RADIUS },
      // From the right wall's face round to the top wall's, so the two ends meet the shell rather than
      // stopping in mid-air. The angle DECREASES, which is what points the normals into the play.
      collision: arcInward({ x: w - 4 - RETURN_RADIUS, y: 4 + RETURN_RADIUS }, RETURN_RADIUS, 0, -90) },

    /**
     * ⚠️ THE HEAD BEND, AND IT IS THE FURNITURE THE CURVE IMPLIES.
     *
     * The record above says a ball thrown at the left wall "has nothing there to meet" and runs down
     * the wall out of the play. That was measured before the curve existed and it was still true after
     * it: with the arc in and nothing here, `long-climb` failed "flapping the flippers changes the
     * ball's life" — a flapping run and a quiet one came out the same, which is the gate's definition
     * of a table the player watches.
     *
     * So the top-left corner is rounded too. A ball sweeping left under the ceiling meets it and is
     * turned DOWN AND RIGHT, back into the play, instead of finding the wall and following it to the
     * outlane. It is the return bend mirrored, and it is in the cabinet rather than in six files for
     * the reason everything else here is: a shape written six times is a shape that drifts.
     *
     * ⚠️ AND IT IS NOT A THIRD WALL. `wall.left` and `wall.top` still meet at the corner behind it;
     * this rounds the inside of that corner so the ball never reaches the join. Taking it out would
     * not open a hole — it would only give the ball a right angle to lose its speed in.
     */
    { name: 'wall.headBend', kind: 'wall', role: WALL,
      bounds: { x: 4, y: 4, width: RETURN_RADIUS, height: RETURN_RADIUS },
      // From the top wall's face round to the left wall's, angle decreasing, so the normals point into
      // the play — the same rule and the same helper as the return bend.
      collision: arcInward({ x: 4 + RETURN_RADIUS, y: 4 + RETURN_RADIUS }, RETURN_RADIUS, -90, -180) },

    /* ===================== THE PLUNGER LANE ===================== */
    /**
     * ⚠️ THE PLUNGER IS A BODY, AND IT HAD NO EDGE AT ALL.
     *
     * The Dev, playing: "após lançar a bola, se o lançamento é fraco ela cai pro cima do lançador ao
     * invés de quicar nele." A launch that does not clear the return bend comes back down the lane,
     * and there was nothing at the bottom of it — the ball fell through the launcher, through the
     * floor of the table, and kept going. Measured before it was fixed: a ball dropped in the lane
     * of a table 235 tall reached y = 1841.
     *
     * `authored.ts` states the rule this came from and the rule is right — a lane is rolled over, a
     * well swallows, "a plunger is where the ball STARTS" — but the plunger is in the wrong sentence.
     * Where a ball is PUT is a fact about `spawnBall`. What happens when a ball ARRIVES is a different
     * question, and for a steel rod with a spring behind it the answer is that the ball lands on it.
     *
     * ⚠️ ONE-SIDED, AND THE WINDING IS THE WHOLE OF IT. `lineInit`'s normal is `(dy, -dx)`, so a face
     * drawn LEFT TO RIGHT has its normal pointing up the screen and answers only what comes down onto
     * it. The launch travels the other way and is let through untouched. Wound backwards, the plunger
     * catches its own ball and the game cannot be started — which is why the launch has a test of its
     * own beside the two about the landing.
     */
    { name: 'plunger', kind: 'plunger', role: WALL,
      bounds: { x: laneX, y: h - 35, width: 10, height: 32 },
      collision: [{ kind: 'line', from: { x: laneX, y: h - 35 }, to: { x: laneX + 10, y: h - 35 } }] },
    { name: 'lane.launch', kind: 'lane', role: 'free',
      bounds: { x: laneX, y: 40, width: 10, height: h - 77 },
      scores: [500], control: 'LaneControl', lamps: ['lamp.launch'] },

    /* ===================== THE BOTTOM ===================== */
    { name: 'flipper.left', kind: 'flipper', role: WALL,
      bounds: { x: centre - halfGap - flipperLength, y: flipperY, width: flipperLength, height: 7 },
      flipper: {
        pivot: { x: centre - halfGap - flipperLength, y: flipperY },
        tipAtRest: { x: centre - halfGap, y: flipperY + 7 },
        sweepDegrees: -55, baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },
    { name: 'flipper.right', kind: 'flipper', role: WALL,
      bounds: { x: centre + halfGap, y: flipperY, width: flipperLength, height: 7 },
      flipper: {
        pivot: { x: centre + halfGap + flipperLength, y: flipperY },
        tipAtRest: { x: centre + halfGap, y: flipperY + 7 },
        sweepDegrees: 55, baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },

    /**
     * ⚠️ THE FUNNEL, AND IT IS NOT DECORATION. See the header: without these the ball passes wide of
     * the paddles and the player is a spectator. Each guide runs from the side wall down to a flipper
     * pivot, narrowing the path until the only way past is over a paddle. Each faces the play.
     */
    { name: 'guide.left', kind: 'wall', role: WALL,
      bounds: { x: 4 + OUTLANE_WIDTH, y: guideTop,
        width: centre - halfGap - flipperLength - 4 - OUTLANE_WIDTH, height: flipperY - guideTop },
      collision: [{ kind: 'line', from: { x: 4 + OUTLANE_WIDTH, y: guideTop },
        to: { x: centre - halfGap - flipperLength, y: flipperY } }] },
    { name: 'guide.right', kind: 'wall', role: WALL,
      bounds: { x: centre + halfGap + flipperLength, y: guideTop,
        width: divider - OUTLANE_WIDTH - (centre + halfGap + flipperLength), height: flipperY - guideTop },
      collision: [{ kind: 'line', from: { x: centre + halfGap + flipperLength, y: flipperY },
        to: { x: divider - OUTLANE_WIDTH, y: guideTop } }] },

    // Outside a guide, reached through the gap at its top: losing the ball there is bad luck rather
    // than the default route.
    /**
     * ⚠️ THE RETURN LANES, WHICH FIVE TABLES HAVE NEVER HAD.
     *
     * Inside each guide, where a ball that survived the funnel comes back down to a paddle. Every
     * pinball has them and this cabinet had only the OUTLANES — so the lower third of five tables paid
     * the player 2000 for BAD LUCK and nothing at all for good play, which is the wrong way round.
     *
     * Found while measuring density against the 1995 playfield (`tests/table-density`): `low-orbit` is
     * hand-authored and got its own pair, and putting the same thing five more times in five files
     * would have been five chances to put it somewhere slightly different. The cabinet is where the
     * bottom of a table is decided.
     *
     * ⚠️ AND THEY ARE CALLED INLANES BECAUSE `slipstream` ALREADY HAS `return.left`. Its return lanes
     * are part of its one-way vane design, they sit halfway up the table, and one of its missions
     * names them. The first draft of this pair took that name and the validator refused the table —
     * "declared twice — behaviour is wired by name" — which is the rule doing exactly its job. Inlane
     * is what a pinball calls the lane inside the guide, so the better name was also the free one.
     */
    /**
     */
    // ⚠️ SEATED ON THE PIVOTS, AND THE FIRST DRAFT WAS NOT. It put them at fixed offsets from the wall
    // and the divider, and the rendered table showed each one STRADDLING its guide — the lower half
    // outside the funnel, where the ball cannot reach because the guide is solid. An inlane is the
    // strip between the guide and the paddle it feeds, so it is measured from the paddle.
    { name: 'inlane.left', kind: 'lane', role: 'free',
      bounds: { x: centre - halfGap - flipperLength, y: flipperY - 26, width: 12, height: 22 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.inlaneLeft'] },
    { name: 'inlane.right', kind: 'lane', role: 'free',
      bounds: { x: centre + halfGap + flipperLength - 12, y: flipperY - 26, width: 12, height: 22 },
      scores: [1500], control: 'LaneControl', lamps: ['lamp.inlaneRight'] },

    /**
     * ⚠️ THE OUTLANE IS THE CHANNEL ITSELF, AND IT USED TO BE A RECTANGLE PARKED BESIDE ONE.
     *
     * The Dev, playing: "Você está desenhando artefatos embaixo das pás... não tem como interagir com
     * estes itens, desenhe-os nos lugares certos." The first half of that sentence is this. Each
     * outlane was twelve wide and thirty tall at a fixed offset from the wall — starting ten pixels
     * above the flipper line and ending THIRTEEN BELOW it, with the funnel guide finishing above it
     * and nothing leading a ball in. A red rectangle in an empty corner.
     *
     * ⚠️ AND THE RIGHT-HAND ONE WAS UNREACHABLE BY CONSTRUCTION, which nothing had measured. The right
     * guide ran to `divider - 4`, so the gap between its top and the plunger lane was FOUR pixels and
     * the ball is six across. It could not fit. Sixty balls per table found the outlanes 1 to 4 times
     * out of 60 — and `tests/table-reachable` carried all twelve of them in its KNOWN_RARE list, which
     * is a gate recording a defect instead of catching it.
     *
     * So an outlane is now what an outlane is: the channel between the side wall and the OUTSIDE of
     * the funnel guide, running from the guide's top to the floor. `OUTLANE_WIDTH` sets both the
     * channel and the guide that bounds it, from one number, because the two used to be written
     * separately and drifted into a lane the ball could not enter.
     */
    { name: 'outlane.left', kind: 'lane', role: 'hazard',
      bounds: { x: 4, y: guideTop, width: OUTLANE_WIDTH, height: h - guideTop },
      scores: [2000], control: 'LaneControl', lamps: ['lamp.outlaneLeft'] },
    { name: 'outlane.right', kind: 'lane', role: 'hazard',
      bounds: { x: divider - OUTLANE_WIDTH, y: guideTop, width: OUTLANE_WIDTH, height: h - guideTop },
      scores: [2000], control: 'LaneControl', lamps: ['lamp.outlaneRight'] },

    { name: 'drain', kind: 'drain', role: 'hazard',
      bounds: { x: centre - 15, y: h - 9, width: 30, height: 8 }, control: 'DrainControl' },
  ];
}
