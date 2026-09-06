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
  'lamp.launch', 'lamp.outlaneLeft', 'lamp.outlaneRight',
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
      bounds: { x: 14, y: guideTop, width: centre - halfGap - flipperLength - 14, height: flipperY - guideTop },
      collision: [{ kind: 'line', from: { x: 14, y: guideTop },
        to: { x: centre - halfGap - flipperLength, y: flipperY } }] },
    { name: 'guide.right', kind: 'wall', role: WALL,
      bounds: { x: centre + halfGap + flipperLength, y: guideTop,
        width: divider - 4 - (centre + halfGap + flipperLength), height: flipperY - guideTop },
      collision: [{ kind: 'line', from: { x: centre + halfGap + flipperLength, y: flipperY },
        to: { x: divider - 4, y: guideTop } }] },

    // Outside a guide, reached through the gap at its top: losing the ball there is bad luck rather
    // than the default route.
    { name: 'outlane.left', kind: 'lane', role: 'hazard',
      bounds: { x: 20, y: flipperY - 10, width: 12, height: 30 },
      scores: [2000], control: 'LaneControl', lamps: ['lamp.outlaneLeft'] },
    { name: 'outlane.right', kind: 'lane', role: 'hazard',
      bounds: { x: divider - 16, y: flipperY - 10, width: 12, height: 30 },
      scores: [2000], control: 'LaneControl', lamps: ['lamp.outlaneRight'] },

    { name: 'drain', kind: 'drain', role: 'hazard',
      bounds: { x: centre - 15, y: h - 9, width: 30, height: 8 }, control: 'DrainControl' },
  ];
}
