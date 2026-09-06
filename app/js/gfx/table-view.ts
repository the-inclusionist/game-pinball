// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/table-view — drawing an authored table, before it has any art.
//
// ========================= SHAPES FIRST, ART LATER, AND ON PURPOSE =========================
// `table/authored` deliberately carries no sprites, no colours and no z-order: a table says what
// things ARE and where. This module is the other half of that decision — it draws a table from its
// ROLES, so the five authored tables can be looked at, played and judged before a single pixel of art
// exists.
//
// That ordering is not laziness. The plan's own risk list says the 1995 art at half scale is
// "andaime de validação"; the authored art is a separate piece of work with its own licence regime
// (pillar 10). Drawing from roles means the geometry can be wrong and FIXED while it is still cheap,
// and when art arrives it replaces a colour without touching a table file.
//
// ========================= THE COLOURS SAY WHAT A THING DOES =========================
// One colour per contract role, not per component kind. That is the same choice the engine's high
// contrast makes and for the same reason: a player learns "red takes your ball" once, and it holds on
// every table. A palette by KIND would have to be relearned per table and would say nothing to the
// colour-blind filters, which read roles.
//
// `hazard` is the only warm colour on the table, and it is used for nothing else.
//
// ========================= A COMPONENT IS DRAWN AS WHAT IT COLLIDES WITH =========================
// This module used to fill every component's `bounds`, and for a wall that is nearly true: the
// collision line runs along the edge of a four-pixel rectangle, so a player aiming at the rectangle is
// wrong by at most four pixels.
//
// A DIAGONAL breaks it outright. `wide-arc`'s ramp is a line from (250, 170) to (330, 90) inside bounds
// of 84x84, and the drawing filled a solid yellow square whose far corner is eighty pixels from
// anything the ball can touch. Booting the built page showed it: a block the ball flies through. No
// art style makes a picture that lies about the geometry fair to play, so this is not a style question
// and was not left for one.
//
// So: a component that declares `collision` is drawn as that collision — circles filled, lines stroked
// at `EDGE_THICKNESS`. A component that declares none is drawn as its bounds, because for a drain, a
// lane or a plunger the bounds is not an approximation of something else, it IS the thing.
//
// The stroke is thinner than the old rectangles and that is the honest width: the ball bounces on the
// line, not on the rectangle somebody drew around it.
//
// ========================= THE CAMERA IS A WINDOW, NOT A TRANSFORM =========================
// The table is drawn once at its own size, and the screen shows a rectangle of it. Nothing is scaled
// and nothing is translated during drawing: `blitView` copies rows. That keeps the pixel grid exact —
// a half-pixel camera offset would smear a 3-pixel ball across two rows and there is no art here yet
// to hide it — so the offset is FLOORED, once, at the window.

import type { Role } from '@the-inclusionist/engine/core/contract.js';
import { createFramebuffer, pack, type Framebuffer } from './framebuffer.js';
import type { AuthoredTable } from '../table/authored.js';
import { flareGrip } from '../table/storm.js';
import { glowInto, type Light } from './lighting.js';
import { LANE_SEGMENTS } from '../table/lane-progress.js';
import {
  paletteFor, sceneOf, shade, backdropAt, flareColor, SHADE_HEADROOM, type Rgb, type TablePalette,
} from './table-palette.js';
import type { Rect } from '../shell/hud.js';

/** A palette colour as the framebuffer wants it. Opaque: nothing on the table is see-through. */
export const packRgb = (c: Rgb): number => pack(c.r, c.g, c.b, 255);

/**
 * ⚠️ THE COLOURS MOVED OUT OF THIS FILE, to `gfx/table-palette`, and the reason is not tidiness.
 *
 * There is no longer ONE set of them. Each table stands in a world of its own — the Dev asked for the
 * 1995 table's blue sky, the black of space, the earthy red of Mars — and beside every world there is
 * a CB-Safe alternative the player can choose. A module constant cannot answer "what colour is the
 * ground" any more, because the honest answer is "on which table, for which player".
 *
 * What is left here is the packing, and these three, which mean exactly what they say: the colours of
 * the NORMAL palette on the NEUTRAL ground. `bare-minimum` is drawn in them and so is anything that
 * needs a colour without having a table to ask about.
 */
export const ROLE_COLORS: Readonly<Record<Role, number>> = Object.fromEntries(
  Object.entries(paletteFor('slate', { cbSafe: false }).roles).map(([role, c]) => [role, packRgb(c)]),
) as Record<Role, number>;

export const PLAYFIELD_COLOR = packRgb(paletteFor('slate', { cbSafe: false }).ground);

/**
 * How wide a collision line is drawn. Two pixels rather than one: a single-pixel edge disappears against
 * the playfield at this size, and rather than one, because the ball has radius 3 and a wall it cannot
 * see is the same defect this whole module was just fixed for, pointing the other way.
 */
export const EDGE_THICKNESS = 2;
export const BALL_COLOR = packRgb(paletteFor('slate', { cbSafe: false }).ball);

/**
 * ⚠️ WHERE THE LIGHT COMES FROM, and it is one answer for the whole table.
 *
 * Lighter along the top edge, darker along the bottom, which is what makes a flat rectangle read as a
 * raised bumper rather than a hole cut in the floor. One direction for everything, because a table lit
 * from two directions reads as a table with two of something rather than as a table with depth.
 *
 * ⚠️ AND THE AMOUNT IS THE ROLE'S OWN. See `SHADE_HEADROOM`: a single amount for every colour was tried
 * first and failed at every value, because `free` and `structure` clear this palette's threshold by a
 * fraction and a highlight is a colour like any other. The signals end up with real depth and the
 * world nearly flat, which was a measurement before it was a look.
 */
export interface Lit {
  readonly body: number;
  readonly top: number;
  readonly bottom: number;
}

export function litColors(colour: Rgb, role: Role): Lit {
  const amount = SHADE_HEADROOM[role];
  return {
    body: packRgb(colour),
    top: packRgb(shade(colour, amount)),
    bottom: packRgb(shade(colour, -amount)),
  };
}

/**
 * A rectangle with the light on it. The edges are ONE pixel: at this size a component is a handful of
 * pixels across, and a two-pixel edge on a four-pixel shape is not shading, it is a stripe.
 */
export function fillLitRect(fb: Framebuffer, rect: Rect, lit: Lit): void {
  fillRect(fb, rect, lit.body);
  if (rect.height < 3) return;
  fillRect(fb, { ...rect, height: 1 }, lit.top);
  fillRect(fb, { ...rect, y: rect.y + rect.height - 1, height: 1 }, lit.bottom);
}

/**
 * A LANE: two rails along its long axis, and the floor between them left showing.
 *
 * ⚠️ THE DEV, PLAYING: "Você está desenhando artefatos embaixo das pás e continuidade das pás: não tem
 * como interagir com estes itens." Things the ball cannot interact with, drawn as though it could —
 * and the inlanes, twenty-two pixels tall on each flipper's pivot and filled in the same family of
 * grey as the paddle, read as the paddle continuing upward.
 *
 * Fill is mass. A lane has none: `table/authored` calls it "a stretch of table the ball rolls over"
 * and leaves it out of `STRUCK_KINDS` on purpose. What was wrong was never the placement — an inlane
 * IS the strip between the guide and the paddle it feeds — it was the mark.
 *
 * ⚠️ RAILS AND NOT AN OUTLINE, because an outline is still a closed shape and a closed shape is still
 * an object. The ends being open is the whole of it: that is where the ball comes in and goes out.
 *
 * ⚠️ AND THE RAILS ARE ONE FLAT COLOUR. `fillLitRect` above records why — at this size a lit edge on a
 * small shape is a stripe rather than shading — and a rail IS the edge, so there is nothing left to
 * shade. A lit lane arrives here already brightened, in `lit.body`.
 */
export function drawLaneRails(fb: Framebuffer, rect: Rect, lit: Lit, depth = 0): void {
  const x = Math.floor(rect.x);
  const y = Math.floor(rect.y);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  // Along the LONG side, which is the direction the ball travels. Railed on the short sides it would
  // be two dashes with a gap between them, which is a gate rather than a lane.
  const down = height >= width;
  const span = down ? height : width;
  const litSegments = Math.round(depth * LANE_SEGMENTS);

  /**
   * ⚠️ BROKEN INTO SEGMENTS WHETHER OR NOT ANYTHING IS LIT, because a row of lamps is a row of lamps
   * when it is dark. A rail that only broke up once the ball had been down it would appear out of
   * nowhere at the moment the player is least able to look at it.
   *
   * ⚠️ AND ONE PIXEL OF GAP, NOT A FRACTION. The shortest lane in the catalogue is twenty-two pixels
   * over five segments, so a proportional gap would round to nothing on some of them and the row would
   * be a stripe again on exactly the lanes it matters least to notice.
   */
  for (let i = 0; i < LANE_SEGMENTS; i++) {
    const from = Math.round((i * span) / LANE_SEGMENTS);
    const to = Math.round(((i + 1) * span) / LANE_SEGMENTS) - 1;
    const length = Math.max(1, to - from);
    // Brightened by exactly this role's own headroom, so a lit lane cannot start reading as another
    // role — the same rule and the same number `drawTable` lights a component by.
    const colour = i < litSegments ? lit.top : lit.body;

    if (down) {
      fillRect(fb, { x, y: y + from, width: 1, height: length }, colour);
      fillRect(fb, { x: x + width - 1, y: y + from, width: 1, height: length }, colour);
    } else {
      fillRect(fb, { x: x + from, y, width: length, height: 1 }, colour);
      fillRect(fb, { x: x + from, y: y + height - 1, width: length, height: 1 }, colour);
    }
  }
}

/**
 * A ball or a bumper with the light on it: the top third catches it, the bottom quarter loses it.
 * Fractions of the radius rather than pixel counts, so a 3-pixel ball and a 12-pixel bumper are lit
 * the same way instead of the small one being all edge.
 */
export function fillLitCircle(
  fb: Framebuffer, cx: number, cy: number, radius: number, lit: Lit,
): void {
  fillCircle(fb, cx, cy, radius, lit.body);
  if (radius < 2) return;
  const r2 = radius * radius;
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(fb.height, Math.ceil(cy + radius) + 1);
  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    const above = dy < -radius * 0.45;
    const below = dy > radius * 0.55;
    if (!above && !below) continue;
    const row = y * fb.width;
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(fb.width, Math.ceil(cx + radius) + 1); x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy <= r2) fb.pixels[row + x] = above ? lit.top : lit.bottom;
    }
  }
}

/** Fills a rectangle, clipped to the buffer. Nothing here draws outside its target. */
export function fillRect(fb: Framebuffer, rect: Rect, color: number): void {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(fb.width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(fb.height, Math.ceil(rect.y + rect.height));

  for (let y = y0; y < y1; y++) {
    const row = y * fb.width;
    for (let x = x0; x < x1; x++) fb.pixels[row + x] = color;
  }
}

/** A filled circle, which is what a ball is until it has art. */
export function fillCircle(fb: Framebuffer, cx: number, cy: number, radius: number, color: number): void {
  const r2 = radius * radius;
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(fb.height, Math.ceil(cy + radius) + 1);

  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    const row = y * fb.width;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(fb.width, Math.ceil(cx + radius) + 1);
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy <= r2) fb.pixels[row + x] = color;
    }
  }
}

/**
 * A line, stroked at `EDGE_THICKNESS`. Walks the long axis a pixel at a time and stamps a square, which
 * is enough for a straight segment and keeps the two ends square rather than pointed — a rounded cap
 * would suggest the ball can slide off an end that the physics treats as a hard stop.
 */
export function strokeLine(
  fb: Framebuffer, ax: number, ay: number, bx: number, by: number, color: number,
): void {
  const dx = bx - ax;
  const dy = by - ay;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const half = EDGE_THICKNESS / 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillRect(fb, { x: ax + dx * t - half, y: ay + dy * t - half, width: EDGE_THICKNESS, height: EDGE_THICKNESS }, color);
  }
}

export interface DrawnBall {
  readonly active: boolean;
  readonly position: { readonly x: number; readonly y: number };
}

export interface TableViewOptions {
  readonly table: AuthoredTable;
  /** The components the running mission is counting. They are drawn as goals whatever they are. */
  readonly missionTargets?: readonly string[];
  /**
   * The lamps that are lit right now.
   *
   * ⚠️ WITHOUT THIS THE TABLE NEVER SHOWED A LAMP AT ALL. Every scoring component on every authored
   * table declares one, the control layer lights them constantly, and `table/objective` decides what
   * is FINISHED by reading them — so a player completing a lane saw the score move and the table sit
   * still. The same class of defect as the flippers drawn at rest: state that changes and nothing
   * draws.
   */
  readonly litLamps?: readonly string[];
  /**
   * The alternative palette, which the player chooses and nothing else may choose for them.
   *
   * ⚠️ ABSENT MEANS THE NORMAL ONE, never "work out which is better". A caller that forgets to pass
   * the player's setting draws the table they did not ask for, and that is a defect to find rather
   * than a preference to infer.
   */
  readonly cbSafe?: boolean;
  /**
   * Where the solar flare's band is centred right now, in table pixels down from the top.
   *
   * ⚠️ A POSITION, NOT A PERMISSION — a table declaring no `storm` ignores it entirely. And absent
   * means NO FLARE rather than "at the top": a picture composed without it is the table's calm
   * appearance, which is what every gate that counts its pixels was written against.
   */
  readonly flareAt?: number;
  /**
   * How far down each lane the ball has been on this ball, by component name, 0 to 1.
   *
   * ⚠️ THE DEV: "deve haver luzes que vão acendendo conforme ela sai da pista lateral." A lane is
   * drawn as a row of segments and this says how many of them are lit. Absent means none — a picture
   * composed without it is the table at the start of a ball, which is what every gate counting its
   * pixels was written against.
   *
   * `table/lane-progress` is what keeps it, and it quantises to `LANE_SEGMENTS` so that this changes a
   * handful of times per trip rather than on every frame the ball spends in a lane.
   */
  readonly laneDepth?: Readonly<Record<string, number>>;
  /**
   * Components NOT to draw, by name — a drop target that is currently down.
   *
   * ⚠️ THE PICTURE HAS TO AGREE WITH THE PHYSICS, and this is the half that makes a bank visible.
   * `table/target-bank` decides a target is down and `physics-build.setComponentActive` makes the ball
   * pass over it; if the picture still shows one, the player is looking at a target the ball goes
   * through. That is the same defect as flippers baked at rest and lamps that were never drawn, in a
   * new place — six of those have been found in this port.
   */
  readonly hidden?: readonly string[];
}

/**
 * The whole table, at its own size. Drawn once per change rather than per frame — the camera moves
 * over this, it does not redraw it.
 */
/**
 * The ground alone: the world's bands, the flare if one is passing, and every light that is on.
 *
 * ⚠️ EXPORTED BECAUSE `tests/table-view-honesty` HAS TO ASK THE SAME QUESTION `drawTable` ANSWERS.
 * That file's whole job is "is this pixel a component, or is it the ground here", and it computed the
 * ground from the bands itself — one rule with two copies, and the copies parted company the moment a
 * light could brighten the ground. Six tests went red saying the table claimed to be solid where it
 * was merely lit. Now there is one implementation and the gate calls it.
 */
export function drawBackground(
  fb: Framebuffer, table: AuthoredTable, palette: TablePalette, o: TableViewOptions,
): void {
  const lamps = new Set(o.litLamps ?? []);
  /**
   * ⚠️ THE GROUND IS A GRADIENT WHEN THE WORLD SAYS SO, and one flat colour when it does not.
   *
   * A scene may declare `bands` — colour stops down the table — because four of the Dev's themes are
   * backgrounds that change with height: the Earth's atmosphere to the halfway line, a white mine
   * with black shadows, a solar storm's colours, Saturn's rings. Painted row by row rather than as one
   * rectangle, which costs one `backdropAt` per row of a picture composed once per change.
   */
  /**
   * ⚠️ AND THE FLARE IS PAINTED HERE TOO, WHICH IS WHY THIS BRANCH IS ALSO TAKEN BY A FLAT WORLD.
   *
   * `flareAt` is a POSITION, not a permission: a table that declares no storm is untouched by it,
   * however the caller writes the frame loop. Otherwise the first tidy-up of `main` that passed the
   * argument unconditionally would put a solar flare on Saturn's rings.
   */
  /**
   * The table's lights with their palette colours resolved, and their reach scaled by intensity.
   *
   * Resolved once rather than per pixel: `paletteFor` builds an object, and doing that forty thousand
   * times to answer the same question is the kind of cost a composition made once per change is
   * supposed to be spending instead of a per-frame one.
   */
  const cast: Light[] = (table.lights ?? []).map((light) => {
    const role = palette.roles[light.role];
    return {
      at: light.at,
      radius: light.radius,
      color: {
        r: role.r * light.intensity, g: role.g * light.intensity, b: role.b * light.intensity,
      },
      ...(light.lamp === undefined ? {} : { lamp: light.lamp }),
    };
  });

  /** One scratch colour for every lit pixel of the table — see `glowInto`. */
  const glow = { r: 0, g: 0, b: 0 };

  const flare = table.storm !== undefined && o.flareAt !== undefined
    ? { at: o.flareAt, thickness: table.storm.thickness }
    : undefined;

  if (palette.bands || flare) {
    for (let y = 0; y < table.size.height; y++) {
      const at = table.size.height <= 1 ? 0 : y / (table.size.height - 1);
      let color = palette.bands ? backdropAt(palette.bands, at) : palette.ground;
      if (flare) {
        const grip = flareGrip(y, flare.at, flare.thickness);
        if (grip > 0) color = flareColor(color, grip);
      }
      /**
       * ⚠️ AND THE LIGHTS, WHICH ARE THE ONE THING HERE THAT IS NOT A ROW. Everything else about the
       * ground varies with HEIGHT and is therefore one `fillRect` per row; a light is round, so this
       * is the only per-pixel work in the composition. It is paid once per change, and only on the
       * columns a light actually reaches — `glowAt` returns the base colour untouched otherwise.
       */
      const reaching = cast.filter((light) => Math.abs(y - light.at.y) < light.radius
        && (light.lamp === undefined || lamps.has(light.lamp)));
      if (reaching.length === 0) {
        fillRect(fb, { x: 0, y, width: table.size.width, height: 1 }, packRgb(color));
      } else {
        /**
         * ⚠️ ONLY THE COLUMNS A LIGHT ACTUALLY REACHES, and the row is filled flat either side. A
         * light is round, so most rows of most tables meet none at all and the rest meet one over a
         * fraction of their width. Without this the composition pays a `hypot` for every pixel of
         * every table that has a lamp on it — and `ion-storm` recomposes forty times a second, because
         * its flare moves.
         */
        let from = table.size.width;
        let to = 0;
        for (const light of reaching) {
          const half = Math.sqrt(light.radius * light.radius - (y - light.at.y) ** 2);
          from = Math.min(from, Math.floor(light.at.x - half));
          to = Math.max(to, Math.ceil(light.at.x + half));
        }
        from = Math.max(0, from);
        to = Math.min(table.size.width, to);

        const row = y * fb.width;
        const flat = packRgb(color);
        for (let x = 0; x < from; x++) fb.pixels[row + x] = flat;
        for (let x = from; x < to; x++) {
          fb.pixels[row + x] = glowInto(color, reaching, x, y, lamps, glow)
            ? packRgb(glow)
            : flat;
        }
        for (let x = to; x < table.size.width; x++) fb.pixels[row + x] = flat;
      }
    }
  } else {
    fillRect(fb, { x: 0, y: 0, width: table.size.width, height: table.size.height },
      packRgb(palette.ground));
  }
}

export function drawTable(o: TableViewOptions): Framebuffer {
  const { table } = o;
  const fb = createFramebuffer(table.size.width, table.size.height);
  const targets = new Set(o.missionTargets ?? []);
  const lamps = new Set(o.litLamps ?? []);
  const palette = paletteOf(table, o.cbSafe ?? false);
  drawBackground(fb, table, palette, o);

  const hidden = new Set(o.hidden ?? []);

  for (const component of table.components) {
    // A dropped target is below the playfield: nothing of it is drawn, and the ground shows through.
    if (hidden.has(component.name)) continue;
    // THE ROLE MOVES WITH THE MISSION, in the picture as well as in the contract: a bumper the
    // mission is counting is drawn as a goal, and goes back to furniture when it stops counting.
    const role = targets.has(component.name) ? 'goal' : component.role;
    /**
     * ⚠️ EVERY LAMP, NOT ANY — which is what `table/objective` means by finished: "a component with two
     * lamps is half done after one, and the sonar should still point at it". If the picture lit on the
     * first of two, the screen and the sonar would be describing different tables.
     *
     * A component with no lamps is never lit rather than always: `every` over an empty list is true,
     * and a wall that brightened because it declared nothing would be the whole table lighting up.
     */
    const isLit = (component.lamps?.length ?? 0) > 0
      && component.lamps!.every((lamp) => lamps.has(lamp));
    // Brightened by exactly the headroom this colour is measured to have — see `SHADE_HEADROOM`. No
    // new colour is invented, so a lit component cannot start reading as another role.
    const body = isLit ? shade(palette.roles[role], SHADE_HEADROOM[role]) : palette.roles[role];
    const color = packRgb(body);
    const lit = litColors(body, role);

    /**
     * ⚠️ A FLIPPER IS NOT DRAWN HERE AT ALL, AND IT USED TO BE — AT REST, FOR EVER.
     *
     * The Dev: "As pás não movem! Você não fez pás que movem quando apertamos botões!" They move. The
     * physics swings them and `tests/table-playable` proves it — flapping changes where the ball ends
     * up on every table. What did not move was the PICTURE.
     *
     * This function composes `tablePicture` ONCE per change: the camera then slides a window over it,
     * which is what makes a software compositor affordable at this size. A flipper stroked in here is
     * therefore stroked at its resting angle and stays there, whatever the paddle does. The comment
     * that stood on this branch said "drawn at REST, because that is where it is until the player
     * moves it" — and never asked what draws it once they do.
     *
     * Nothing did. So the flipper is drawn per frame instead, from the live geometry the physics
     * already keeps, by `drawFlipper` below. Leaving the resting stroke here as well would paint a
     * second paddle that never moves underneath the one that does.
     */
    if (component.kind === 'flipper') continue;
    /**
     * ⚠️ AND NOR IS THE PLUNGER, FOR THE SAME REASON. It slides down its lane as it is drawn back, so
     * a plunger stroked into the composition made once per change is a plunger that never moves — the
     * flippers' defect, and the one the Dev found next: "o lançador de bola não se mexe".
     */
    if (component.kind === 'plunger') continue;
    /**
     * ⚠️ AND NOR IS A BODY THAT TRAVELS, WHICH IS THE THIRD OF THESE. A component declaring a `mover`
     * is somewhere different every frame, so stroking it into a composition made once per change
     * paints it where it STARTED and leaves it there — the flippers' defect, which the Dev found by
     * playing ("as pás não movem!"), and then the plunger's. `drawMover` draws it per frame from the
     * position `table/mover` keeps, the same arrangement the other two ended up with.
     */
    if (component.mover) continue;

    /**
     * ⚠️ A LANE IS FLOOR, AND FLOOR IS NOT FILLED. See `drawLaneRails`: the Dev found the inlanes
     * reading as an extension of the paddles, and a filled rectangle is the mark this renderer uses
     * for everything the ball bounces off.
     *
     * ⚠️ THE RULE IS THE KIND AND NOT THE ABSENCE OF A COLLISION. A well, a hole and a drain declare
     * none either, and each is a MOUTH — a filled shape is exactly right for something that swallows
     * the ball, and the drain reading as a red bar across the floor is the table telling the truth.
     */
    if (component.kind === 'lane') {
      drawLaneRails(fb, component.bounds, lit, o.laneDepth?.[component.name] ?? 0);
      continue;
    }

    if (!component.collision?.length) {
      // Nothing solid was declared, so the bounds is the whole claim and there is nothing to overstate.
      fillLitRect(fb, component.bounds, lit);
      continue;
    }

    for (const shape of component.collision) {
      if (shape.kind === 'circle') fillLitCircle(fb, shape.at.x, shape.at.y, shape.radius, lit);
      // See the flipper above: a two-pixel stroke has no room for light and shade.
      else strokeLine(fb, shape.from.x, shape.from.y, shape.to.x, shape.to.y, color);
    }
  }

  return fb;
}

/**
 * The palette a table is drawn in: its own world, in the variant the player asked for.
 *
 * An unplaced table falls to `slate`, the neutral, and `tests/gfx-table-palette` is what stops that
 * from becoming how a new table gets its colours.
 */
export function paletteOf(table: AuthoredTable, cbSafe: boolean): TablePalette {
  return paletteFor(sceneOf(table.name) ?? 'slate', { cbSafe });
}

/**
 * Copies the camera's window of the table onto the screen. Rows, not a transform — see this module's
 * header for why the offset is floored exactly once, here.
 */
export function blitView(
  screen: Framebuffer, table: Framebuffer, into: Rect, offsetX: number, offsetY: number,
): void {
  const ox = Math.floor(offsetX);
  const oy = Math.floor(offsetY);
  const width = Math.min(into.width, table.width - ox);
  const height = Math.min(into.height, table.height - oy);

  for (let y = 0; y < height; y++) {
    const from = (oy + y) * table.width + ox;
    const to = (into.y + y) * screen.width + into.x;
    if (oy + y < 0 || oy + y >= table.height) continue;
    for (let x = 0; x < width; x++) {
      if (ox + x < 0 || ox + x >= table.width) continue;
      screen.pixels[to + x] = table.pixels[from + x]!;
    }
  }
}

/** The ball, drawn on the screen rather than on the table, because it moves every frame. */
export function drawBall(
  screen: Framebuffer, ball: DrawnBall, radius: number, into: Rect, offsetX: number, offsetY: number,
): void {
  if (!ball.active) return;
  const x = into.x + ball.position.x - Math.floor(offsetX);
  const y = into.y + ball.position.y - Math.floor(offsetY);
  // Off the visible window is not an error: the camera gives up the base of the table on purpose.
  if (x + radius < into.x || x - radius > into.x + into.width) return;
  if (y + radius < into.y || y - radius > into.y + into.height) return;
  fillCircle(screen, x, y, radius, BALL_COLOR);
}

/**
 * A lit rectangle, drawn straight onto the screen and clipped to the camera's window.
 *
 * ⚠️ THE SAME JOB AS `fillLitRect` AND NOT THE SAME FUNCTION. That one paints into the table's own
 * picture, in table coordinates, with the whole buffer to play in. This paints into the SCREEN, after
 * the blit, and must be clipped to the playfield window — a rectangle drawn past it lands on the HUD's
 * columns, which is the rule ADR-0002 exists for.
 *
 * It exists because the plunger moves: anything that changes every frame cannot live in a composition
 * made once per change.
 */
export function drawLitRect(
  screen: Framebuffer, rect: Rect, lit: Lit, into: Rect, offsetX: number, offsetY: number,
): void {
  const x0 = Math.round(into.x + rect.x - Math.floor(offsetX));
  const y0 = Math.round(into.y + rect.y - Math.floor(offsetY));
  const x1 = x0 + Math.round(rect.width);
  const y1 = y0 + Math.round(rect.height);

  for (let y = Math.max(y0, into.y, 0); y < Math.min(y1, into.y + into.height, screen.height); y++) {
    for (let x = Math.max(x0, into.x, 0); x < Math.min(x1, into.x + into.width, screen.width); x++) {
      // The same light the static picture puts on a raised thing: top edge bright, bottom edge dark.
      const shade = y === y0 ? lit.top : (y === y1 - 1 ? lit.bottom : lit.body);
      screen.pixels[y * screen.width + x] = rect.height < 3 ? lit.body : shade;
    }
  }
}

/**
 * A travelling body, drawn where it is now.
 *
 * ⚠️ TAKES A POSITION RATHER THAN A COMPONENT, for the reason `drawFlipper` takes two ends: the live
 * position lives in `table/mover`, and this module has no business knowing how a path is walked.
 *
 * ⚠️ AND IT IS CLIPPED TO THE WINDOW, NOT TO THE SCREEN. The HUD's blocks sit outside `into` on every
 * table with columns, and a body drawn across them would be ADR-0002's defect arriving from the one
 * thing that draws AFTER the blit rather than into it.
 */
export function drawMover(
  screen: Framebuffer, at: { x: number; y: number }, radius: number,
  color: number, into: Rect, offsetX: number, offsetY: number,
): void {
  const cx = into.x + at.x - Math.floor(offsetX);
  const cy = into.y + at.y - Math.floor(offsetY);
  const r = Math.max(1, Math.round(radius));

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const px = Math.round(cx + dx);
      const py = Math.round(cy + dy);
      if (px < into.x || px >= into.x + into.width) continue;
      if (py < into.y || py >= into.y + into.height) continue;
      if (px < 0 || px >= screen.width || py < 0 || py >= screen.height) continue;
      screen.pixels[py * screen.width + px] = color;
    }
  }
}

/**
 * One flipper, at the angle it is at right now, drawn straight onto the screen.
 *
 * ⚠️ PER FRAME, WHICH IS THE WHOLE POINT. `drawTable` composes the table once and the camera slides a
 * window over it; a flipper changes every frame the player holds a button, so it belongs with the ball
 * in the things drawn after the blit rather than baked into what is blitted.
 *
 * Takes the two ENDS rather than a component, because the live geometry lives in `physics/flipper` —
 * `rotOrigin` and `t1`, the tip already rotated by `currentAngle` — and this module has no business
 * knowing how a swing is computed.
 */
export function drawFlipper(
  screen: Framebuffer, from: { x: number; y: number }, to: { x: number; y: number },
  color: number, into: Rect, offsetX: number, offsetY: number,
): void {
  const ax = into.x + from.x - Math.floor(offsetX);
  const ay = into.y + from.y - Math.floor(offsetY);
  const bx = into.x + to.x - Math.floor(offsetX);
  const by = into.y + to.y - Math.floor(offsetY);

  // ⚠️ CLIPPED TO THE WINDOW, NOT TO THE SCREEN. The HUD's blocks sit outside `into` on every table
  // that has columns, and a paddle drawn across them would be the defect ADR-0002 exists to prevent —
  // arriving from the one thing that draws after the blit instead of into it.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  const half = EDGE_THICKNESS / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const px = Math.round(x + dx);
        const py = Math.round(y + dy);
        if (px < into.x || px >= into.x + into.width) continue;
        if (py < into.y || py >= into.y + into.height) continue;
        if (px < 0 || px >= screen.width || py < 0 || py >= screen.height) continue;
        screen.pixels[py * screen.width + px] = color;
      }
    }
  }
}

/**
 * The ball, drawn only where the scene behind it is FARTHER AWAY. `zdrv::paint_flat`'s comparison, on
 * a circle instead of a bitmap.
 *
 * ⚠️ SMALLER IS NEARER. Turn the test round and the ball is drawn only where it is hidden: it would
 * vanish on the open table and show through the ramps it is under.
 *
 * ⚠️ AND THE DEPTH MAP IS READ BY ITS STRIDE, NOT BY THE PICTURE'S WIDTH. The two are different
 * numbers — the surplus cells are padding at the end of each row — and reading one for the other
 * drifts a pixel further off with every row down the table.
 */
export function fillCircleBehind(
  fb: Framebuffer,
  scene: { readonly depths: Uint16Array; readonly stride: number },
  cx: number, cy: number, radius: number, depth: number, color: number,
): void {
  const r2 = radius * radius;
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(fb.height, Math.ceil(cy + radius) + 1);

  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    const row = y * fb.width;
    const depthRow = y * scene.stride;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(fb.width, Math.ceil(cx + radius) + 1);
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy > r2) continue;
      if ((scene.depths[depthRow + x] ?? 0) <= depth) continue;
      fb.pixels[row + x] = color;
    }
  }
}
