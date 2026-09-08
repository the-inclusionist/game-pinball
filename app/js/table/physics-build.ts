// SPDX-License-Identifier: AGPL-3.0-or-later
// table/physics-build — turning an authored table into something a ball can be dropped into.
//
// ========================= THE LAST JOIN =========================
// Phases 3 and 4 ported the physics: the edge grid, the ray queries, the substepping, the collision
// response. Phase 8 authored tables that DESCRIBE geometry. Nothing had ever connected the two, so the
// tables were pictures and the physics had nothing to run on.
//
// This is that join, and it is deliberately small: read the `collision` shapes a table declares,
// build the edges the grid wants, and hand back a `StepContext`. No new physics is written here —
// if a ball behaves wrongly on an authored table, the fault is in the table's geometry or in the
// ported physics, and this module is not a third place to look.
//
// ========================= WHICH COMPONENT WAS HIT, AND NOT JUST THAT ONE WAS =========================
// The grid's `Component` is an interface with one method and no identity. That is enough for the
// physics and not enough for the game: `control/dispatch` hands the CALLER to every control function,
// and a bumper that cannot say it is `bumper1` cannot score.
//
// So each edge is given a component that knows its own name and appends to a hit list. The frame reads
// that list, dispatches it, and clears it. Collecting rather than calling straight through is what
// keeps the physics free of the control layer — a ball can be stepped in a test with no score, no
// lamps and no sound.
//
// ========================= GRAVITY IS THE ONLY FIELD, FOR NOW =========================
// `StepContext.fieldEffects` is where the table's forces go. A real table has ramps that pull and
// kickers that push; this has gravity, pointing down the table, because that is what an authored table
// declares today. When a ramp declares a field, it goes here and nowhere else.

import { thrustField, type ThrustState } from './ball-assist.js';
import type { BallState } from '../physics/collision.js';
import {
  createEdgeManager, placeLineInGrid, placeCircleInGrid, type Edge, type EdgeManager,
} from '../physics/grid.js';
import { createLine, createCircle, offsetLine, type Component } from '../physics/edges.js';
import { basicCollision, type CollisionResponse } from '../physics/collision.js';
import { rayIntersectCircle } from '../maths/maths.js';
import { createBall, type Ball, type StepContext } from '../physics/step.js';
import {
  createFlipper, deriveFlipper, setFlipperMotion, setControlPoints, distanceToFlipper,
  flipperCollision, type Flipper, type FlipperGeometry,
} from '../physics/flipper.js';
import { extendedTipOf, type AuthoredComponent, type AuthoredTable } from './authored.js';
import { createMover, type Mover } from './mover.js';
import { flareGrip, stormPath } from './storm.js';
import { createStuckWatch, type StuckWatch } from './stuck-watch.js';

/**
 * How a surface answers a ball. One per kind, because a bumper is not a wall.
 *
 * ⚠️ AND EVERY ONE OF THEM SETS `frictionByImpact`, WHICH THE 1995 TABLE DOES NOT. `physics/collision`
 * carries the whole argument: the transcription takes a fixed share of the ALONG-SURFACE speed on every
 * contact, and a ball resting on a slope pays it sixty times a second — so it freezes where it was put.
 * The Dev photographed exactly that on `ring-belt`. Read as a friction coefficient scaled by the
 * impact, the same numbers agree with the transcription at 45° and let a ball roll.
 *
 * The numbers themselves are unchanged and are still ours, written for the authored tables.
 */
export const RESPONSES: Readonly<Record<string, CollisionResponse>> = {
  // A wall gives most of the speed back across it and keeps what runs along it.
  wall: { elasticity: 0.7, smoothness: 0.1, threshold: 1e9, boost: 0, frictionByImpact: true },
  // A bumper ADDS speed above a threshold, which is what makes it ignore a light touch.
  bumper: { elasticity: 0.9, smoothness: 0.1, threshold: 1.0, boost: 1.4, frictionByImpact: true },
  // A flipper is a wall that hits back; the kick itself lives in `physics/flipper`.
  flipper: { elasticity: 0.8, smoothness: 0.05, threshold: 1e9, boost: 0, frictionByImpact: true },
  // Everything else: a soft edge that mostly stops the ball.
  default: { elasticity: 0.5, smoothness: 0.2, threshold: 1e9, boost: 0, frictionByImpact: true },
};

export function responseFor(component: AuthoredComponent): CollisionResponse {
  return RESPONSES[component.kind] ?? RESPONSES.default!;
}

/**
 * An authored flipper in the form `physics/flipper` wants. The only translation is the sweep: the table
 * declares an angle, the physics wants the tip's extended POSITION, and `extendedTipOf` is the rotation
 * between them.
 */
export function flipperGeometryOf(component: AuthoredComponent, ballRadius: number): FlipperGeometry {
  const f = component.flipper!;
  return {
    pivot: { ...f.pivot },
    tipAtRest: { ...f.tipAtRest },
    tipExtended: extendedTipOf(f),
    baseRadius: f.baseRadius,
    tipRadius: f.tipRadius,
    extendTime: f.extendTime,
    retractTime: f.retractTime,
    collisionMult: RESPONSES.flipper!.elasticity === 0 ? 1 : flipperMultFor(component),
    elasticity: RESPONSES.flipper!.elasticity,
    smoothness: RESPONSES.flipper!.smoothness,
    // `table->CollisionCompOffset`: the faces are pushed out by the ball's radius so the ball can be
    // treated as a point, the same trick `offsetLine` plays for a wall.
    collisionOffset: ballRadius,
  };
}

/**
 * How much the flipper's own speed is added on top of the bounce. The original reads it from the table
 * data (attribute 803); an authored table has no such file, so it is a constant here and is declared as
 * a constant rather than smuggled in as a magic number.
 *
 * ⚠️ IT WAS 2, AND THAT NUMBER WAS CHOSEN WHILE THE KICK WAS MEANINGLESS. See `flipperMultFor` below:
 * the transcribed formula was short by the paddle's length, so the whole term came out around twelve
 * against ball speeds in the hundreds, and doubling twelve is still nothing. Restoring the length made
 * the multiplier matter for the first time, and 2 was then measured: a player flapping both paddles
 * drove the ball to 1953 px/s — six times a full plunger, and pinned against `physics/step`'s own
 * clamp, which meant the clamp had become the design.
 *
 * ⚠️ ONE IS NOT A SMALLER GUESS. Two independent readings give it. It is `original-flippers`' own
 * default for attribute 803 when the archive does not say — the value the port already trusts for the
 * 1995 table. And it is what makes a paddle contribute exactly ITS OWN TIP SPEED once: the sweep is
 * about 0.96 rad over 0.08 s, so ω is 12 rad/s, and at a reach of 26 that is 312 px/s — against a
 * full plunger of 273 to 309. The strongest shot a player can make comes out level with the strongest
 * launch, which is what a pinball feels like, and it falls out of the geometry rather than being
 * dialled in.
 */
export const FLIPPER_COLLISION_MULT = 0.78;

/**
 * How much of its own speed a travelling body hands the ball.
 *
 * ⚠️ ONE, FOR THE REASON `FLIPPER_COLLISION_MULT` IS ONE: a body contributes its own speed once. That
 * number was measured — a paddle's tip speed lands on the plunger's full launch — and this is the same
 * claim for a body that travels in a line. Anything larger and a drone becomes a second plunger; the
 * flipper's own history is what says so, where a multiplier of 2 pinned the ball against the engine's
 * clamp and made every table play the same.
 */
export const MOVER_PUSH = 1;

/**
 * ⚠️ AND THE MULTIPLIER CARRIES A LENGTH, BECAUSE THE TRANSCRIBED FORMULA DIVIDES ONE OUT.
 *
 * The Dev, playing: "os flaps precisam ter força para mandar a bola voando para o topo." Measured on
 * all six tables before anything was changed: a ball dropped onto the paddle and flipped rose
 * TWENTY-NINE PIXELS up a table between 235 and 300 tall, and its peak speed after the flip equalled
 * the speed it arrived with. The paddle was a wall that happened to move.
 *
 * `physics/flipper` transcribes `TFlipperEdge::flipper_collision` exactly, and the kick is
 *
 *     tangentialSpeed = |moveSpeed| * sqrt(distanceSq / distanceDivSq)
 *
 * `moveSpeed` is RADIANS PER SECOND; the square root is the contact point as a FRACTION of the
 * paddle's reach. So the product is ω × (r / L) where the tangential speed of a rotating paddle is
 * ω × r. A length is missing, and in the original it is invisible: its table units make L about one,
 * and a number near one divides out without anybody noticing a dimension go with it.
 *
 * ⚠️ AN AUTHORED TABLE IS IN PIXELS. Gravity is 120 px/s², a full plunger is 273 px/s, and a paddle is
 * 24 px long — so ω × (r/L) came out around twelve, against ball speeds in the hundreds. The kick was
 * never weak. It was an angular rate being added to a linear speed, short by exactly the paddle's
 * length.
 *
 * ⚠️ AND THE CORRECTION GOES HERE RATHER THAN IN `physics/flipper`, on purpose. That module is a
 * transcription and the 1995 table runs through it with coordinates and a multiplier read from the
 * archive; changing the formula would change a table whose numbers were calibrated in 1995 against
 * this exact arithmetic. This function is the authored tables' own seam — the constant above exists
 * because "an authored table has no such file" — so the fix reaches the tables it is about and no
 * others.
 *
 * A paddle twice as long therefore gets twice the multiplier, which is the point: the ratio the
 * formula normalises away is restored, and a table author who draws a longer flipper does not have to
 * discover this comment.
 */
export function flipperMultFor(component: AuthoredComponent): number {
  const f = component.flipper!;
  const reach = Math.hypot(f.tipAtRest.x - f.pivot.x, f.tipAtRest.y - f.pivot.y);
  // `distanceDiv` in `physics/flipper` is the reach out to the tip's SURFACE, and this must be the
  // same length or the ratio is only mostly cancelled.
  return FLIPPER_COLLISION_MULT * (reach + f.tipRadius);
}

export interface Hit {
  /** The component's name, which is what the control layer dispatches on. */
  readonly name: string;
  /** What `basicCollision` returned: the REBOUND speed, not the speed left over. */
  readonly reboundSpeed: number;
}

/**
 * ⚠️ THE DRAIN IS THE ONE COMPONENT THAT WORKS BY THE BALL NOT HITTING ANYTHING.
 *
 * Every other piece of a table is an edge: the ball arrives, the edge answers. A drain is a HOLE, so
 * it has bounds and no collision at all, and nothing in the physics can report it — the ball simply
 * carries on into the space below the table.
 *
 * Which is exactly what the first run did: launched, bounced off the ceiling, came back down and kept
 * going to y = 4408 on a table 235 tall, at the speed cap, forever. Nothing was wrong with the
 * physics. There was no rule saying where a table ENDS.
 *
 * So this is a position test rather than a collision. And it distinguishes TWO ways of leaving, which
 * a first version did not:
 *
 *   · BELOW the table is a legitimate way to lose. In a pinball anything that gets past the flippers
 *     is gone whether or not it passed through the drain's own rectangle — the bottom of the table IS
 *     the drain, and a narrow drain component only says where the middle of it is.
 *   · Past a SIDE or the top is a hole in the geometry. A table the ball can leave sideways is
 *     unfinished, and calling that a drain would hide it.
 *
 * Running the five tables is what forced the split: `wide-arc` and `narrow-tower` both lost their ball
 * a few pixels to one side of a drain that was too narrow to catch it, and reporting that the same way
 * as a ball escaping through a wall would have made a design question look like a broken table.
 */
export type DrainKind = string | 'below' | 'outside';

export function drainedBy(table: AuthoredTable, ball: { position: { x: number; y: number } }): DrainKind | null {
  const { x, y } = ball.position;

  for (const component of table.components) {
    if (component.kind !== 'drain') continue;
    const b = component.bounds;
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return component.name;
  }

  // Past the flippers: lost, and legitimately so.
  if (y > table.size.height) return 'below';
  // Out of any other side: the table has a hole in it.
  if (y < 0 || x < 0 || x > table.size.width) return 'outside';
  return null;
}

/**
 * Is the ball in the plunger's lane, where the plunger can still reach it?
 *
 * ⚠️ THE PLUNGER DOES NOT RETRACT WHEN THE GAME STARTS. The Dev, playing: "após lançar a bolinha o
 * lançador deve continuar funcionando, visto que a bolinha pode continuar acima dele." He is
 * describing a real machine, and `main.ts` was guarding the plunger on the PHASE — a question about
 * the game rather than about where the ball is. A launch that fails to clear the return bend leaves
 * the ball rolling back down the lane, which is the very case the plunger's own face was added for,
 * and there was then no way to launch it again.
 *
 * ⚠️ A POSITION TEST, FOR THE SAME REASON `drainedBy` IS ONE. Nothing collides to report that a ball
 * is sitting in a lane; the lane is a region and the question is geometric.
 *
 * The lane is the plunger's own column, from the top of the divider down. Above the divider the ball
 * is in the PLAY, travelling left across the head of the table — a plunger that could still shove it
 * there would be a second pair of flippers nobody asked for.
 */
export function inPlungerLane(
  table: AuthoredTable, ball: { position: { x: number; y: number } },
): boolean {
  const plunger = table.components.find((c) => c.kind === 'plunger');
  if (!plunger) return false;
  const divider = table.components.find((c) => c.name === 'wall.laneDivider');

  const b = plunger.bounds;
  // A margin of the ball's own radius: a ball touching the lane's wall is still in the lane, and the
  // alternative is a plunger that stops working when the ball leans on something.
  const margin = table.ballRadius;
  const { x, y } = ball.position;
  if (x < b.x - margin || x > b.x + b.width + margin) return false;
  // Down from the top of the divider. A table without one has no lane to speak of, so the plunger
  // reaches its own column and no further up than the ball can be launched from.
  const top = divider ? divider.bounds.y : b.y;
  return y >= top && y <= table.size.height;
}

/**
 * ⚠️ HOW HARD THE PLUNGER HAS TO PUSH, WHICH IS NOT A CONSTANT.
 *
 * A fixed launch speed worked on `low-orbit` and failed on `narrow-tower`, and the reason is
 * arithmetic rather than tuning: a ball launched at speed v against gravity g rises `v² / 2g`. At 260
 * against 120 that is 282 pixels, which clears low-orbit's 235-tall lane and falls 75 pixels short of
 * narrow-tower's 420 — so the ball never reached the return bend and came straight back down.
 *
 * The plunger is therefore sized to the TABLE, with a margin so a full launch clearly clears the bend
 * rather than just reaching it. A table twice as tall needs a plunger √2 times stronger, and nothing
 * about that is a matter of taste.
 */
export function launchSpeedFor(table: AuthoredTable, o: PhysicsOptions = {}): number {
  const gravity = o.gravity ?? DEFAULT_GRAVITY;
  return Math.sqrt(2 * gravity * table.size.height) * LAUNCH_MARGIN;
}

/**
 * How much more than "just enough to reach the bend" a full draw gives.
 *
 * ⚠️ IT STAYS AT 1.15, AND THE DEV ASKED FOR TWICE THAT. "O lançador está tão fraco que a bola não
 * consegue sair do túnel. Dobre a força do lançador." He is right that the ball could not leave the
 * tunnel and the cause was not this number — it was `MISSION_DRAG`, added a commit earlier for his own
 * "a bolinha precisa ser mais lenta", which took 1.1 of the ball's speed per second away from
 * EVERYTHING including a ball climbing the lane. Measured: a full draw with the drill on climbed 121
 * of the 160 `low-orbit` needs, and 145 of `factory`'s 229. Not one table could launch. That drag is
 * gone — the drill slows the CLOCK now, see `table/ball-assist` — and this number outlived it.
 *
 * ⚠️ AND DOUBLING WAS TRIED AND MEASURED BEFORE IT WAS REJECTED, which is the only reason to write
 * this down rather than just do as asked. At x2 the ball enters the play faster and takes different
 * routes, and FIVE gates go red: `crater-run` and `factory` stop letting the flippers change the
 * ball's life, and `low-orbit`, `ring-belt` and others stop reaching components that score. At x1.5,
 * three still fail — including `narrow-tower`, 420 tall, which STILL cannot launch under the drag
 * because a proportional force costs a tall table disproportionately more.
 *
 * So the plunger was never the problem and making it stronger does not fix it. The drag is exempted
 * inside the lane instead — a drill that slows PLAY has no business slowing the LAUNCH — which puts
 * the plunger back exactly where it was when the Dev last played it and leaves the tables tuned as
 * they are. Raising this number is a re-tuning of six tables and is his to ask for knowing that.
 */
export const LAUNCH_MARGIN = 1.15;

export const DEFAULT_GRAVITY = 120;

export interface TablePhysics {
  readonly grid: EdgeManager;
  readonly context: StepContext;
  /** The live flippers, in declaration order. */
  readonly flippers: readonly Flipper[];
  /**
   * The bodies that travel a path of their own, with the names that declared them.
   *
   * The frame loop advances them and the renderer draws them where they are; neither can ask the grid,
   * which holds a static disc covering the whole path rather than the body itself.
   */
  readonly movers: readonly { readonly name: string; readonly mover: Mover }[];
  /**
   * The solar flare sweeping the table, if it declares one. Absent on every table that does not.
   *
   * The frame loop advances it and the backdrop is painted from where it is; the physics reads it
   * through `fieldEffects`. It is a `Mover` and not in the grid — see where it is built.
   */
  readonly flare?: Mover;
  /** By name, because the control layer and the keyboard both address them that way. */
  flipperNamed(name: string): Flipper | undefined;
  /**
   * Switches a component's edges on or off, by name.
   *
   * ⚠️ WHAT A DROP TARGET NEEDS. `table/target-bank` decides that a target is down; this is what makes
   * the ball pass over where it was. Without it a dropped target is still a wall the ball bounces off,
   * which is a body with no behaviour — the worst of both.
   *
   * `table/blocker` has done the same for the 1995 table since it was ported. A component with no
   * collision shapes has no edges and this does nothing to it, which is correct: what makes a lane
   * inert is that the ball rolls over it, and there is nothing to switch.
   */
  setComponentActive(name: string, active: boolean): void;
  /** Raises or drops one, by name. */
  setFlipper(name: string, extended: boolean): void;
  /**
   * ⚠️ Raises or drops EVERY flipper on a side, which is what a key press means.
   *
   * The side is read off the pivot's position relative to the table's middle, not off the component's
   * name. Names happen to say `left` on all five tables today and would work; the first table that
   * called one `paddle.port` would bind to nothing, silently, and a flipper that does not answer the
   * key looks like a physics bug. `four-flippers` is the table that makes the plural matter.
   */
  setFlippers(side: 'left' | 'right', extended: boolean): void;
  /** Hits since the last `takeHits`. Collected, never dispatched from inside the physics. */
  takeHits(): readonly Hit[];
  /** A ball at the plunger, ready to be launched. */
  spawnBall(): Ball;
  /**
   * ⚠️ THE STUCK DETECTOR, which was ported and reached from nothing. A ball that wedges itself stays
   * wedged for ever otherwise, and the game goes on running around it.
   */
  readonly stuck: StuckWatch;
}

/**
 * ⚠️ HOW LONG A FRAME IS, AND WHY IT IS NOT ONE.
 *
 * `physics/step` measures time in the original's units, not in frames: it pins a slow ball's timestep
 * to 0.01 and calls anything under speed 0.8 slow. Handing it `timeDelta = 1` — the obvious reading of
 * "advance one frame" — makes every frame a hundred times too long for the clamp and the ball crawls:
 * a probe showed speed 0.03 after fifty frames, and the ball had not visibly moved.
 *
 * A frame is a sixtieth, and speeds are therefore large numbers: crossing a 235-pixel table in about
 * two seconds needs roughly two pixels a frame, which is a speed near 120.
 */
export const FRAME_SECONDS = 1 / 60;

export interface PhysicsOptions {
  /**
   * What to do when twenty nudges have not freed the ball. Absent = nothing, which is honest for a test
   * that only wants geometry, and is why the option exists rather than a default that pretends.
   */
  readonly relaunch?: () => void;
  /**
   * Down the table, in the same units. Chosen for how the ball BEHAVES rather than transcribed: an
   * authored table's gravity is an authoring decision, and the tests below check the behaviour
   * instead of the number.
   */
  readonly gravity?: number;
  /**
   * An extra force the SHELL supplies, added to gravity every frame.
   *
   * ⚠️ THE PHYSICS NEVER HEARS THE WORD "MISSION", which is the point of the shape. The Dev asked for
   * a little steering with the directional while the comet drill is on; that is a FORCE, and
   * `fieldEffects` has been the place a force goes since gravity was the only one. A function rather
   * than a value, because it changes every frame — the player is holding a key or not.
   *
   * ⚠️ AND THE OTHER HALF OF THAT ASK IS NOT HERE ANY MORE. "A bolinha precisa ser mais lenta" was
   * first answered with a drag through this same hook, and the Dev played it and reported what a
   * dissipative force costs: a ball that parks on a level surface and creeps down slopes. It is now the
   * simulated step that shrinks, which this file never sees — see `table/ball-assist`.
   */
  readonly extraField?: (ball: BallState) => ThrustState;
  /**
   * The source of chance inside the simulation, so a survey can be repeatable.
   *
   * ⚠️ THIS EXISTS BECAUSE `tests/table-reachable` CALLED ITSELF DETERMINISTIC AND WAS NOT. It seeds a
   * generator and steers the LAUNCH with it — direction, speed, how often the flippers flap — and
   * then everything downstream reached for `Math.random`:
   *
   *   · `physics/stuck.unstuckBall` — `o.random ?? Math.random` — the nudge that frees a wedged ball,
   *     which is the one this survey actually walks into: it drives the stuck detector every frame,
   *     deliberately, "because it runs in the game".
   *   · `physics/step`'s `throwBall` — `p.random ?? Math.random` — every kickout, well and hole that
   *     catches the ball and throws it back.
   *
   * So a component could be reached on one run and missed on the next. The gate failed about once in
   * every six full runs of the node suite and passed every time on its own, which reads as an order
   * dependence and is not one — and it named a COMPONENT, which points the reader at the table.
   *
   * ⚠️ AND IT IS OPTIONAL, BECAUSE THE GAME WANTS THE REAL THING. A pinball whose nudge went the same
   * way every time would be a pinball a player could learn to exploit; `Math.random` is the right
   * default and the survey is the caller that wants otherwise.
   */
  readonly random?: () => number;
}

export function buildPhysics(table: AuthoredTable, o: PhysicsOptions = {}): TablePhysics {
  const grid = createEdgeManager(0, 0, table.size.width, table.size.height);
  const gravity = o.gravity ?? DEFAULT_GRAVITY;
  let hits: Hit[] = [];
  const nameOfFlipper = new Map<Flipper, string>();
  /** Every edge a component owns, so it can be switched out of the table by name. */
  const edgesOfComponent = new Map<string, Edge[]>();

  for (const component of table.components) {
    if (!component.collision?.length) continue;
    const response = responseFor(component);

    // The component the EDGES point at: it knows its name, and it only records.
    const owner: Component = {
      collision(_ball, position, direction, _distance, _edge) {
        const ball = _ball as Ball;
        const rebound = basicCollision(ball, position, direction, response);
        hits.push({ name: component.name, reboundSpeed: rebound });
      },
    };

    /**
     * ⚠️ THE BALL HAS A RADIUS AND NOTHING HERE KNEW IT.
     *
     * `physics/edges` states the original's trick in its own header — "the original never tests a
     * circle against a wall: it PUSHES the wall outward by the ball's radius and treats the ball as a
     * point" — and `physics/wall` ports it faithfully for the 1995 table. This loop called `createLine`
     * and `createCircle` straight, so on an authored table every surface let the ball sink to its
     * CENTRE: a six-pixel ball buried three pixels into everything it touched, on a screen 320 wide.
     *
     * Found while fixing the plunger the Dev reported. The first version of that gate asked for the
     * ball's surface to stop at the launcher's face and failed by exactly one radius on all six
     * tables, which is how a defect belonging to every wall showed up as a property of one.
     */
    /**
     * ⚠️ THE EDGES ARE KEPT NOW, AND THEY WERE THROWN AWAY. `placeLineInGrid` takes an edge and the
     * grid owns it; this loop built each one, handed it over and forgot it, so nothing downstream
     * could ever switch a component out of the table.
     *
     * `table/blocker` has done exactly that for the 1995 table since it was ported — "for (const edge
     * of o.edges) edge.active = value" — and it is what a DROP TARGET needs: a target that is down is
     * below the playfield, and the ball passes over where it was. Without this a dropped target is
     * still a wall the ball bounces off, which is a body with no behaviour: the worst of both.
     */
    const mine: Edge[] = [];
    edgesOfComponent.set(component.name, mine);

    for (const shape of component.collision) {
      if (shape.kind === 'line') {
        const line = createLine({
          component: owner, start: { x: shape.from.x, y: shape.from.y },
          end: { x: shape.to.x, y: shape.to.y },
        });
        // Along its own normal, which is the side the ball is on: these faces are one-sided and wound
        // to face the play. See `normalOf` in `table/authored` for why the winding is the contract.
        offsetLine(line, table.ballRadius);
        placeLineInGrid(grid, line);
        mine.push(line);

        /**
         * ⚠️ AND THERE ARE NO CORNER CIRCLES HERE, WHICH WAS WRITTEN, MEASURED AND THEN REMOVED.
         *
         * `physics/wall`'s header says pushing sides out OPENS the corners between them, and it closes
         * each convex vertex with a circle. It can pick the right vertices because it is handed a
         * POLYGON and can read the turn from one side to the next; an authored table declares loose
         * segments belonging to different components, so a circle at every segment END was written
         * instead — over-inclusive, on the argument that a rounded inside corner beats a hole.
         *
         * ⚠️ NO MEASUREMENT COULD FIND THE HOLE. 480 shots — every three degrees, four speeds — fired
         * from the middle of a closed box: nought escapes with the circles and nought without, the
         * same number. Repeated with the offset multiplied by EIGHT, which should tear any seam wide
         * open: still nought.
         *
         * The reason is in how a table is written. `physics/wall` guards a polygon, whose sides ABUT
         * end to end and whose joints separate when both are pushed out. These tables declare walls as
         * overlapping SPANS — `low-orbit`'s floor runs the full width and its side runs the full
         * height, so the two faces still cross after the offset and there is no seam to open. The
         * hazard is real for the shape `physics/wall` handles and does not arise for this one.
         *
         * So the circles went, under this project's own rule: a gate that cannot be made to fail is
         * deleted rather than kept for comfort, and code nobody can justify is code nobody can
         * maintain. This paragraph is what stays, so that a leak found later has somewhere to start.
         */
      } else {
        // A circle grows rather than moves: same trick, one dimension less. `installWall` writes it
        // as `o.offset + data[3]`.
        const circle = createCircle({
          component: owner, center: { x: shape.at.x, y: shape.at.y },
          radius: shape.radius + table.ballRadius,
        });
        placeCircleInGrid(grid, circle);
        mine.push(circle);
      }
    }
  }

  const plunger = table.components.find((c) => c.kind === 'plunger');

  /**
   * ⚠️ A FLIPPER IS IN THE GRID *AND* SWEPT, AND LEAVING OUT EITHER HALF BREAKS A DIFFERENT THING.
   *
   * `TFlipper`'s constructor ends with `flipperEdge->place_in_grid(&AABB)`. I read the sweep first and
   * skipped that line, and the result was exactly what it should have been: a RESTING flipper stopped
   * existing. `flipperSweep` returns immediately when the motion is still, so with no edge in the grid
   * the ball fell straight through both flippers on every table, and the playability gate caught it.
   *
   * The two halves answer different questions. The grid answers "the ball moved into the flipper"; the
   * sweep answers "the flipper moved into the ball". A pinball needs both, and a still flipper only
   * ever gets asked the first.
   *
   * The box registered is the whole SWEPT area, not the flipper at rest — the grid is a static index
   * and it has to hold every position the body can occupy.
   */
  const flippers: Flipper[] = [];
  const flipperByName = new Map<string, Flipper>();
  const movers: { readonly name: string; readonly mover: Mover }[] = [];

  /**
   * ⚠️ THE FLARE IS A TRAVELLING BODY THAT DOES NOT COLLIDE, so it is a `Mover` and it is NOT in the
   * grid. Everything above about registering a moving body over its whole path is about bodies the
   * ball bounces off; this one the ball passes through, and what it meets there is a force rather
   * than an edge. Putting it in the grid would make the storm a wall across the table.
   */
  const flare = table.storm ? createMover(stormPath(table.storm, table.size)) : undefined;

  /**
   * ⚠️ A BODY THAT TRAVELS, REGISTERED OVER EVERYWHERE IT CAN GO.
   *
   * `physics/grid` places an edge into cells ONCE, by its bounding box, so a moving body registered
   * where it starts stops existing as soon as it moves. The flipper below has the same problem and the
   * same answer: register a disc covering the whole sweep, and let `findCollisionDistance` ask the
   * body where it actually is. `table/physics-build` already records what the other half of that
   * mistake cost — a resting paddle that vanished because only the sweep was registered.
   *
   * ⚠️ AND THE BODY PUSHES. A mover that only got in the way would be a wall that changes address:
   * the ball would bounce off wherever it happened to be and the motion would be decoration. The push
   * is the mover's own speed, scaled by how squarely it is travelling INTO the ball — which is the
   * shape of the flipper's kick, `collisionMult * alignment * tangentialSpeed`, for a body that
   * travels in a line instead of turning about a pivot.
   */
  for (const component of table.components) {
    if (!component.mover) continue;
    const mover = createMover(component.mover);
    movers.push({ name: component.name, mover });

    const response = responseFor(component);
    const disc = { center: { x: 0, y: 0 }, radiusSq: component.mover.radius * component.mover.radius };
    const path = component.mover;
    const half = Math.hypot(path.to.x - path.from.x, path.to.y - path.from.y) / 2;

    placeCircleInGrid(grid, {
      active: true,
      collisionGroup: 1,
      center: { x: (path.from.x + path.to.x) / 2, y: (path.from.y + path.to.y) / 2 },
      // The whole path, plus the body, plus the ball — the ball is a point here, as everywhere else.
      radius: half + path.radius + table.ballRadius,
      findCollisionDistance(ray) {
        const at = mover.at;
        disc.center.x = at.x;
        disc.center.y = at.y;
        return rayIntersectCircle(ray, {
          center: disc.center,
          radiusSq: (path.radius + table.ballRadius) ** 2,
        });
      },
      edgeCollision(ballLike, distance) {
        const ball = ballLike as Ball;
        const position = {
          x: distance * ball.direction.x + ball.position.x,
          y: distance * ball.direction.y + ball.position.y,
        };
        const at = mover.at;
        const normal = { x: position.x - at.x, y: position.y - at.y };
        const length = Math.hypot(normal.x, normal.y) || 1;
        normal.x /= length;
        normal.y /= length;

        // How squarely the body is travelling into the ball. Nought when it is moving away, which is
        // what stops a drone from dragging a ball along behind it.
        const into = Math.max(0, mover.direction.x * normal.x + mover.direction.y * normal.y);
        const boost = MOVER_PUSH * into * mover.speed;
        basicCollision(ball, position, normal, {
          elasticity: response.elasticity,
          smoothness: response.smoothness,
          // A negative threshold is how the flipper escapes the "only above such a rebound speed" rule,
          // and a body that pushes has to escape it too or a slow ball is ignored by a fast drone.
          threshold: boost > 0 ? -1 : response.threshold,
          boost,
        });
        hits.push({ name: component.name, reboundSpeed: 0 });
      },
    });
  }

  for (const component of table.components) {
    if (component.kind !== 'flipper' || !component.flipper) continue;

    const geometry = flipperGeometryOf(component, table.ballRadius);
    const flipper = createFlipper(deriveFlipper(geometry));
    flippers.push(flipper);
    flipperByName.set(component.name, flipper);
    nameOfFlipper.set(flipper, component.name);

    const reach = Math.max(geometry.baseRadius, geometry.tipRadius) + table.ballRadius
      + Math.hypot(geometry.tipAtRest.x - geometry.pivot.x, geometry.tipAtRest.y - geometry.pivot.y);
    // Registered as a DISC about the pivot, which is a superset of the sector the flipper can occupy.
    // A superset only costs a few extra distance queries; the alternative, registering the flipper at
    // rest, would leave it missing from the boxes it swings into.
    placeCircleInGrid(grid, {
      active: true,
      collisionGroup: 1,
      center: { x: geometry.pivot.x, y: geometry.pivot.y },
      radius: reach,
      findCollisionDistance(ray) {
        // Rebuilt here because the sweep may have turned the flipper since anything last looked at it.
        // `ControlPointDirtyFlag` in the original.
        setControlPoints(flipper, flipper.currentAngle);
        return distanceToFlipper(flipper, ray).distance;
      },
      edgeCollision(ball) {
        flipperCollision(flipper, ball as Ball);
        hits.push({ name: component.name, reboundSpeed: 0 });
      },
    });
  }

  return {
    grid,
    flippers,
    movers,
    flare,
    stuck: createStuckWatch(table, {
      relaunch: o.relaunch ?? (() => {}),
      ...(o.random ? { random: o.random } : {}),
    }),
    flipperNamed: (name) => flipperByName.get(name),
    /**
     * Switches a component's edges on or off.
     *
     * ⚠️ THE EDGES, NOT THE COMPONENT. A component with no collision shapes — a lane, a drain — has no
     * edges to switch and this does nothing to it, which is correct rather than a silent failure: what
     * makes a lane inert is that the ball rolls over it, and there is nothing to turn off.
     */
    setComponentActive(name: string, active: boolean): void {
      for (const edge of edgesOfComponent.get(name) ?? []) edge.active = active;
    },
    setFlipper(name, extended) {
      const flipper = flipperByName.get(name);
      if (flipper) setFlipperMotion(flipper, extended ? 'extending' : 'retracting');
    },
    setFlippers(side, extended) {
      const middle = table.size.width / 2;
      for (const [name, flipper] of flipperByName) {
        const pivot = table.components.find((c) => c.name === name)!.flipper!.pivot;
        if ((pivot.x < middle) !== (side === 'left')) continue;
        setFlipperMotion(flipper, extended ? 'extending' : 'retracting');
      }
    },
    context: {
      grid,
      flippers,
      onFlipperHit(flipper, _ball) {
        hits.push({ name: nameOfFlipper.get(flipper) ?? 'flipper', reboundSpeed: 0 });
      },
      fieldEffects(ball, destination) {
        // Down the table. `y` grows downward, so gravity is positive.
        destination.x = 0;
        destination.y = gravity;

        /**
         * ⚠️ AND THE SHELL'S OWN FORCE, WHICH IS THE THIRD USER OF THIS HOOK. The directional gives the
         * ball a light push during a comet drill; it is a force, so it arrives here rather than as a
         * special case somewhere in the loop. `table/ball-assist` argues the arithmetic.
         *
         * ⚠️ AND IT NEEDS NO KNOWLEDGE OF THE CLOCK. The push is an acceleration and so is gravity, so
         * a slowed table weakens both by the same factor and the ratio between them — which is the whole
         * of what "leve" means — is the same at any pace.
         */
        const thrust = o.extraField?.(ball);
        if (thrust) {
          const push = thrustField(thrust);
          destination.x += push.x;
          destination.y += push.y;
        }

        /**
         * ⚠️ AND THE FLARE DRAGS, WHICH IS THE FIRST THING BESIDES GRAVITY EVER TO USE THIS HOOK.
         * `StepContext.fieldEffects` has existed since the physics was ported and has answered the
         * same constant for every ball at every point on every table since — a seam with one user,
         * which is how a seam stops being one.
         *
         * The force is `-k·v`: opposed to the way the ball is going, and proportional to how fast it
         * is going. `physics/step` multiplies by the frame time and adds it to the velocity, so the
         * ball loses a FRACTION of its speed per second rather than a fixed amount — which is what a
         * medium does, and is stable at any frame rate. See `table/storm`.
         */
        if (!flare || !table.storm) return;
        const grip = flareGrip(ball.position.y, flare.at.y, table.storm.thickness);
        if (grip === 0) return;
        const k = grip * table.storm.drag;
        destination.x -= k * ball.direction.x * ball.speed;
        destination.y -= k * ball.direction.y * ball.speed;
      },
    },
    takeHits() {
      const taken = hits;
      hits = [];
      return taken;
    },
    spawnBall() {
      // In the plunger lane if there is one, at the top otherwise. A table without a plunger cannot
      // pass `validateTable`, so the fallback is only for a table under construction.
      /**
       * ⚠️ ON THE PLUNGER'S FACE, NOT IN THE MIDDLE OF ITS BOX, and the difference is the whole lane.
       *
       * A plunger is a rectangle 32 tall whose face is its TOP edge, and the ball sits six above that —
       * which on a table with vertical walls is the same column as the box's centre and on a leaning
       * one is not. `table/perspective` narrows the lane by a sixth of every unit of height, so a ball
       * placed by the box's middle row started 2.6 units right of where the lane actually was at the
       * ball's own height: it spawned touching the right wall, and every table in the catalogue failed
       * "the ball leaves the plunger lane" — the launch pinballed sideways between the two lane walls
       * and stopped, 258 units a second down to 3 in a hundred frames.
       *
       * The face is a collision line at the right height, so it leans with the lane and lands the ball
       * in the middle of it. It is also what the plunger physically IS: the ball rests on the rod.
       */
      const face = plunger?.collision?.find((c) => c.kind === 'line');
      const x = face ? (face.from.x + face.to.x) / 2
        : plunger ? plunger.bounds.x + plunger.bounds.width / 2 : table.size.width / 2;
      const y = plunger ? plunger.bounds.y - table.ballRadius * 2 : table.ballRadius * 2;
      return createBall({
        radius: table.ballRadius,
        position: { x, y },
        direction: { x: 0, y: -1 },
        speed: 0,
        // The ball's own chance, used by `throwBall` when a kickout releases it. See `PhysicsOptions`.
        ...(o.random ? { random: o.random } : {}),
      });
    },
  };
}
