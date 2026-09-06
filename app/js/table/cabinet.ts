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

import type { AuthoredComponent } from './authored.js';

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
export function cabinet(o: CabinetOptions): AuthoredComponent[] {
  const { width: w, height: h } = o;

  // The plunger lane runs down the right-hand side. Ten wide plus a four-wide divider, which is what
  // `low-orbit` uses and what the ball fits through without rattling.
  const laneX = w - 16;
  const divider = w - 21;
  // ⚠️ THE DIVIDER STOPS SHORT OF THE TOP. That opening is how a launched ball enters the play and it
  // is the only way in — a divider running the full height is a table with a sealed lane.
  const dividerTop = 34;

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

    { name: 'wall.laneDivider', kind: 'wall', role: WALL,
      bounds: { x: divider, y: dividerTop, width: 4, height: h - dividerTop },
      collision: [{ kind: 'line', from: { x: divider, y: h }, to: { x: divider, y: dividerTop } }] },

    /**
     * ⚠️ THE RETURN BEND. Without it the table does not play at all — see this module's header. It is
     * wound right-to-left-and-up so its normal points DOWN into the lane, which is the side a rising
     * ball arrives from: a single slope, steep enough to redirect and shallow enough not to stop the
     * ball dead.
     *
     * ⚠️ AND THE DEV ASKED FOR A CURVE HERE, WHICH IS NOT DONE. His words: "o lançador é um túnel que
     * vai retamente pra cima, mas ele deve acabar com uma curva (topo deve ser curvado) de modo que
     * uma bola lançada com força total ande por uma curva até a parede da esquerda."
     *
     * Three shapes were tried and all three broke tables, which is why the straight line is still here
     * rather than a half-working arc:
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
      bounds: { x: divider - 14, y: 4, width: w - divider + 14, height: 18 },
      collision: [{ kind: 'line', from: { x: w - 4, y: 21 }, to: { x: divider - 14, y: 6 } }] },

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
