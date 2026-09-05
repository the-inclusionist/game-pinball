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
// ========================= THE CAMERA IS A WINDOW, NOT A TRANSFORM =========================
// The table is drawn once at its own size, and the screen shows a rectangle of it. Nothing is scaled
// and nothing is translated during drawing: `blitView` copies rows. That keeps the pixel grid exact —
// a half-pixel camera offset would smear a 3-pixel ball across two rows and there is no art here yet
// to hide it — so the offset is FLOORED, once, at the window.

import type { Role } from '@the-inclusionist/engine/core/contract.js';
import { createFramebuffer, pack, type Framebuffer } from './framebuffer.js';
import type { AuthoredTable } from '../table/authored.js';
import type { Rect } from '../shell/hud.js';

/** One colour per role. See this module's header for why it is not one per kind. */
export const ROLE_COLORS: Readonly<Record<Role, number>> = {
  // The only warm colour on the table, and used for nothing else.
  hazard: pack(200, 60, 50, 255),
  goal: pack(240, 210, 90, 255),
  key: pack(120, 200, 140, 255),
  gate: pack(110, 140, 210, 255),
  structure: pack(90, 96, 110, 255),
  climb: pack(150, 120, 190, 255),
  water: pack(70, 150, 190, 255),
  free: pack(52, 58, 70, 255),
};

export const PLAYFIELD_COLOR = pack(26, 30, 38, 255);
export const BALL_COLOR = pack(235, 240, 245, 255);

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

export interface DrawnBall {
  readonly active: boolean;
  readonly position: { readonly x: number; readonly y: number };
}

export interface TableViewOptions {
  readonly table: AuthoredTable;
  /** The components the running mission is counting. They are drawn as goals whatever they are. */
  readonly missionTargets?: readonly string[];
}

/**
 * The whole table, at its own size. Drawn once per change rather than per frame — the camera moves
 * over this, it does not redraw it.
 */
export function drawTable(o: TableViewOptions): Framebuffer {
  const { table } = o;
  const fb = createFramebuffer(table.size.width, table.size.height);
  const targets = new Set(o.missionTargets ?? []);

  fillRect(fb, { x: 0, y: 0, width: table.size.width, height: table.size.height }, PLAYFIELD_COLOR);

  for (const component of table.components) {
    // THE ROLE MOVES WITH THE MISSION, in the picture as well as in the contract: a bumper the
    // mission is counting is drawn as a goal, and goes back to furniture when it stops counting.
    const role = targets.has(component.name) ? 'goal' : component.role;
    fillRect(fb, component.bounds, ROLE_COLORS[role]);
  }

  return fb;
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
