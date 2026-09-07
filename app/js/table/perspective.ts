// SPDX-License-Identifier: AGPL-3.0-or-later
// table/perspective — every table is a trapezium, and so is everything standing on it.
//
// ⚠️ THE DEV: "Deixe todos os túneis inclinados em nove graus transformando todas as mesas em trapézios
// com ângulos internos de 81 graus na base." Choosing between the ways of doing it: "Melhor caminho:
// lançador a nove graus em todas as mesas graus equivalentes ao trapézio da mesa original, o que faz
// com que o topo de mesas muito longas como a long-climb sejam bem menores do que de mesas baixas como
// a ring-belt." And then: "Continue com o redesenho das mesas para dar a impressão de profundidade."
//
// ========================= NINE DEGREES IS THE ORIGINAL'S OWN NUMBER =========================
// Measured on the 1995 playfield, rendered from the Dev's own `PINBALL.DAT` and looked at: both side
// walls lean 9.5° from vertical, dx/dy = 0.167 — one pixel in six. The launched ball's climb drifts
// left at exactly that ratio, which is the same fact seen from inside the table rather than outside it.
// `table/original-oneways` carries the record, including the day this port read that measurement and
// drew the wrong conclusion from it.
//
// ========================= AND THE FURNITURE LEANS WITH THE WALLS =========================
// ⚠️ THE OBVIOUS IMPLEMENTATION IS TO SLANT THE FOUR WALLS AND LEAVE THE TABLE ALONE, and it is wrong
// twice over. Measured before this file existed: six to twelve components PER TABLE would then be
// standing outside their own wall — a bumper embedded in it, a lane running through it — which is a
// re-authoring of eleven files and eleven chances to put something back slightly wrong. And a frame
// that converges around furniture that stays square does not read as depth. It reads as a mistake in
// the drawing, because a photograph of a real table converges everything at once. That is what a
// perspective IS.
//
// So the lean is one map over every x on the table, and it has two pieces that meet without a seam:
//
//     inset(y)  = tan(9°) · (h − y)                  nothing at the floor, widest at the top
//     playfield   x < divider  →  inset + x · (divider − 2·inset) / divider
//     lane        x ≥ divider  →  x − inset
//
// ⚠️ THE PLAYFIELD IS SQUEEZED INTO WHAT IS LEFT AND THE LANE IS MERELY SLID, and most of the design is
// in that difference. A plunger lane is a corridor with a MECHANICAL CLEARANCE in it: the ball is six
// across and cannot be scaled with the picture. Squeezed like everything else the lane becomes a wedge
// — measured on `low-orbit`, 12.1 units wide at the plunger and 8.6 at the bend, because its two walls
// start at different distances from the centre and so move by different amounts.
//
// ⚠️ AND A BALL CANNOT BE FIRED UP A CONVERGING WEDGE. It is the oldest result in billiards: each
// bounce turns the velocity by twice the wall's angle, always the same way, so a ball fired up a wedge
// leaning nine degrees is travelling sideways after five of them. Traced frame by frame before this was
// written: the ball left the plunger at 271 units a second, touched the outer wall at frame 3, the
// divider at 5, the outer wall again at 6, and by frame 8 was moving horizontally at 95 and climbing no
// further. Every table in the catalogue failed "the ball leaves the plunger lane".
//
// Sliding the lane by the same `inset` its outer wall moves keeps both its walls parallel and the
// corridor its own width all the way up. The lean is the same lean; only a corridor gets it as a
// translation. `table/physics-build`'s `launchDirectionFor` is the other half of that sentence — a
// plunger fires ALONG its lane.
//
// ⚠️ AND THE TWO PIECES MEET EXACTLY. At `x = divider` the playfield's formula gives `divider − inset`,
// which is where the lane's gives it too: the map is continuous, so nothing falls down the join. The
// playfield ends where the lane starts at every height, which is also what stops anything on the field
// being squeezed INTO the lane — measured before this piece existed, `four-flippers`'s right bumper
// was, and the launch hit it at the top of the tunnel.
//
// ========================= WHAT DOES NOT MOVE =========================
// The base line is the identity, and that is deliberate rather than incidental. The flippers, the
// drain, the funnel's feet and the plunger's seat are all within thirty-five of the floor, and they are
// the numbers this port tuned BY PLAYING. A transform that moved them would be a re-tuning of the
// bottom of every table wearing a coat of perspective. `y` is untouched everywhere: this is a lean, not
// a projection, and a table that also foreshortened vertically would need the camera and the ball's own
// radius to follow it.

import type {
  AuthoredComponent, AuthoredLight, AuthoredShape, AuthoredTable,
} from './authored.js';
import type { MoverPath } from './mover.js';
import { plungerLaneOf } from './cabinet.js';

/** The angle, from vertical, of every wall that runs up the table. */
export const LEAN_DEGREES = 9;

/**
 * How wide the PLAYFIELD has to stay at the top, measured in balls.
 *
 * ⚠️ THE FLOOR EXISTS BECAUSE OF `narrow-tower`, AND IT IS A RULE RATHER THAN AN EXCEPTION LIST. That
 * table is 120 wide and 420 tall; at nine degrees the two walls CROSS before they reach the top —
 * 2 × 420 × tan 9° is 133 units of narrowing out of 120 available. The instruction is not difficult
 * there, it is geometrically impossible, and the Dev's own sentence names `long-climb` and `ring-belt`,
 * which are tables a player is offered. `narrow-tower` is a fixture: it exists to give the camera 240
 * pixels of vertical travel to follow.
 *
 * So: nine degrees, or the steepest lean that leaves four balls of PLAYFIELD at the top, whichever is
 * shallower. The playfield rather than the table, because the lane down the right-hand side carries its
 * own width all the way up — what a ball needs room in is the part it is played on.
 *
 * It is stated once instead of eleven times, it bites on two fixtures and on no table a player is
 * offered, and a table authored tomorrow at some other size gets a playable top instead of an inverted
 * one.
 */
export const MIN_TOP_BALLS = 4;

/**
 * The lean this table can actually take, as dx per dy.
 *
 * Every table a player is offered comes out at the full nine degrees; see the constant above for the
 * two fixtures that do not and why the answer is a floor rather than a special case.
 */
export function leanOf(table: {
  readonly size: { readonly width: number; readonly height: number };
  readonly ballRadius: number;
}): number {
  const full = Math.tan((LEAN_DEGREES * Math.PI) / 180);
  const { divider } = plungerLaneOf(table.size);
  const room = (divider - MIN_TOP_BALLS * 2 * table.ballRadius) / (2 * table.size.height);
  return Math.min(full, Math.max(0, room));
}

/** How a table's points move sideways. */
type MapX = (x: number, y: number) => number;

/**
 * The table's map: where the column `x` at height `y` ends up.
 *
 * Exported because it is the whole geometry of the lean in one function, and because a gate that
 * rebuilt the arithmetic would be a second copy of the thing it is checking.
 */
export function taperMap(table: AuthoredTable): MapX {
  const { height: h } = table.size;
  const lean = leanOf(table);
  const { divider } = plungerLaneOf(table.size);
  return (x, y) => {
    const inset = lean * (h - y);
    if (x >= divider) return x - inset;
    return inset + (x * (divider - 2 * inset)) / divider;
  };
}

const point = (m: MapX, p: { readonly x: number; readonly y: number }): { x: number; y: number } =>
  ({ x: m(p.x, p.y), y: p.y });

/**
 * A rectangle after the lean, placed on one of its own rows.
 *
 * ⚠️ A RECTANGLE CANNOT LEAN, so a row has to be chosen, and the MIDDLE is where the error is smallest
 * in both directions. `bounds` is what the renderer fills for a component with no collision of its own
 * and what a lane's trigger is read from, and both want the box where the shape is on average.
 *
 * ⚠️ EXCEPT A PLUNGER, WHICH IS MEASURED AT ITS FACE. `spawnBall` puts the ball on the plunger's top
 * edge and reads the column from this box, so a plunger placed on its middle row hands the ball a
 * column 22 units below where the ball actually sits — and in a lane that slides a sixth of a unit per
 * unit of height, that is three and a half units of error against about three of clearance. Measured on
 * `wide-arc`, whose plunger declares no collision face for `spawnBall` to prefer: the ball spawned 0.6
 * from the outer wall, touched it four frames later, and left the lane sideways.
 */
function rect(
  m: MapX, r: { readonly x: number; readonly y: number;
    readonly width: number; readonly height: number },
  row: 'middle' | 'top' | 'span',
): { x: number; y: number; width: number; height: number } {
  /**
   * ⚠️ A LANE IS THE BOX THAT CONTAINS ITS WHOLE LEANING CHANNEL, and this is the third row rule
   * because it is the third question a rectangle gets asked.
   *
   * A lane's bounds is a TRIGGER: `main`'s loop asks "is the ball inside it". `lane.launch` runs the
   * height of the plunger lane — 158 units on `low-orbit` — and the lane slides a sixth of a unit for
   * every one of them, so a box placed on the middle row sits nineteen units left of where the ball
   * rests on the plunger. Measured: the launch scored nothing at all, and two browser gates went red
   * reading a pause menu whose score said zero.
   *
   * Taking the extremes of the box's own rows covers the parallelogram instead. It is GENEROUS — the
   * corners it adds are outside the channel — and that is the right way to be wrong for a trigger: a
   * lane that pays a ball rolling half a unit past its mouth is a rounding error, and a lane that never
   * pays is a mechanic that does not exist.
   */
  if (row === 'span') {
    const bottom = r.y + r.height;
    const left = Math.round(Math.min(m(r.x, r.y), m(r.x, bottom)));
    const right = Math.round(Math.max(m(r.x + r.width, r.y), m(r.x + r.width, bottom)));
    return { x: left, y: r.y, width: right - left, height: r.height };
  }
  const at = row === 'top' ? r.y : r.y + r.height / 2;
  /**
   * ⚠️ ROUNDED, WHICH THE COLLISION SHAPES ARE NOT. A `bounds` is a rectangle of PIXELS — the renderer
   * fills it, the camera measures it, a lane's trigger is read from it — and this transform hands out
   * fractions. `tests/gfx-table-view` indexes a framebuffer with `for (let x = box.x; ...)`, so a box
   * starting at 28.87 read `pixels[28.87]` every time: undefined on both sides of the comparison,
   * equal, and the gate reported that hiding a target changed nothing where the target was. Collision
   * geometry keeps its fractions, because the physics works in table units and not in pixels.
   */
  const left = Math.round(m(r.x, at));
  const right = Math.round(m(r.x + r.width, at));
  return { x: left, y: r.y, width: right - left, height: r.height };
}

function shape(m: MapX, s: AuthoredShape): AuthoredShape {
  if (s.kind === 'line') return { kind: 'line', from: point(m, s.from), to: point(m, s.to) };
  /**
   * ⚠️ A CIRCLE KEEPS ITS RADIUS AND MOVES ITS CENTRE, which is the one place this transform refuses to
   * be consistent with itself and says so. A true perspective would make it an ellipse; the physics has
   * circles and lines and nothing else, and a bumper's radius is a tuned number — the kick a ball takes
   * off one is measured against it. Squeezing bumpers at the top of a tall table would change how that
   * table scores as well as how it looks, which is not what "impressão de profundidade" asked for.
   */
  return { kind: 'circle', at: point(m, s.at), radius: s.radius };
}

function mover(m: MapX, path: MoverPath): MoverPath {
  return { ...path, from: point(m, path.from), to: point(m, path.to) };
}

/** Which row of its own box each kind of component is measured on. See `rect`. */
const ROW_FOR: Partial<Record<AuthoredComponent['kind'], 'middle' | 'top' | 'span'>> = {
  plunger: 'top',
  lane: 'span',
};

function component(m: MapX, c: AuthoredComponent): AuthoredComponent {
  return {
    ...c,
    bounds: rect(m, c.bounds, ROW_FOR[c.kind] ?? 'middle'),
    ...(c.collision ? { collision: c.collision.map((s) => shape(m, s)) } : {}),
    ...(c.flipper
      ? { flipper: {
        ...c.flipper,
        pivot: point(m, c.flipper.pivot),
        tipAtRest: point(m, c.flipper.tipAtRest),
      } }
      : {}),
    ...(c.mover ? { mover: mover(m, c.mover) } : {}),
  };
}

const light = (m: MapX, l: AuthoredLight): AuthoredLight => ({ ...l, at: point(m, l.at) });

/**
 * The table as a trapezium.
 *
 * ⚠️ APPLIED IN `table/catalog` AND NOWHERE ELSE, over every table including the four that never called
 * `table/cabinet`. `low-orbit` is the flagship and was hand-authored before the cabinet existed, so
 * every shared change since has reached the other tables and skipped it — a drift its own comments
 * record. A transform over the finished table cannot skip anything: it does not know which parts came
 * from where.
 */
export function taper(table: AuthoredTable): AuthoredTable {
  const m = taperMap(table);
  return {
    ...table,
    components: table.components.map((c) => component(m, c)),
    ...(table.lights ? { lights: table.lights.map((l) => light(m, l)) } : {}),
  };
}
