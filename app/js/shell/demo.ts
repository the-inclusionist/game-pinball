// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/demo — the 1995 table, on screen, from a file the player supplies.
//
// ========================= THE PLAYER BRINGS THE ARCHIVE =========================
// `PINBALL.DAT` is Microsoft's. `docs/LICENSES.md` § 3 keeps it out of the repository's history and
// `tests/build-carries-no-original-data` keeps it out of `dist`, which is the folder that gets
// uploaded. So the demonstration does not fetch it, does not bundle it, and does not look for it on a
// server: it asks, and the file never leaves the machine it was already on.
//
// That is not a limitation to work around. It is the shape the licence imposes, and any arrangement
// where the file arrives over HTTP is a redistribution with extra steps.
//
// ========================= WHAT THIS SHOWS, AND WHAT IT DOES NOT =========================
// The real playfield, the real 143 walls, the real gravity and drag, and a ball obeying them. Nothing
// scores, no lamp lights and no mission runs: that needs the forty `T*` components built from the
// archive's object manifest, which is its own piece of work. Said here rather than discovered.

import { buildOriginalTable, type OriginalTable } from '../table/original.js';
import { decodePlayfield, readCamera, type OriginalCamera } from '../gfx/original-view.js';
import { readGroups, type Group } from '../dat/partman.js';
import { advanceFrame, type Ball } from '../physics/step.js';
import { fillCircle } from '../gfx/table-view.js';
import { pack, type Framebuffer } from '../gfx/framebuffer.js';

/** The ball, which the archive draws as a sprite this build does not composite. */
export const DEMO_BALL_COLOR = pack(240, 240, 250, 255);

export interface Demo {
  readonly playfield: Framebuffer;
  readonly camera: OriginalCamera;
  readonly table: OriginalTable;
  readonly ball: Ball;
  /** One frame. Seconds, like every other stepper in this project. */
  step(frames: number): void;
  /** The ball drawn over a fresh copy of the playfield, ready to blit. */
  render(): Framebuffer;
  /** Where the ball is IN PIXELS, which is the only place the projection is used. */
  ballOnScreen(): { x: number; y: number };
  /** Everything the ball has touched, by group name. */
  readonly touched: string[];
  drop(): void;
}

export function createDemo(archive: ArrayBuffer): Demo {
  const groups: readonly Group[] = readGroups(new Uint8Array(archive));
  const touched: string[] = [];
  const table = buildOriginalTable(groups, { onHit: (hit) => touched.push(hit.group) });
  const camera = readCamera(groups);
  const playfield = decodePlayfield(groups);

  // The frame the ball is drawn into. Copied from the playfield each frame rather than redrawn,
  // because the playfield is a still picture and the ball is the only thing that moves.
  const frame: Framebuffer = {
    width: playfield.width,
    height: playfield.height,
    pixels: new Uint32Array(playfield.pixels.length),
    bytes: new Uint8ClampedArray(playfield.pixels.length * 4),
  };

  let ball = table.spawnBall();

  /**
   * ⚠️ THE BALL'S RADIUS IS IN TABLE UNITS AND THE SCREEN IS IN PIXELS. 0.3 units on a table sixteen
   * wide, drawn on a bitmap 365 wide, is about seven pixels. Projecting the radius properly would mean
   * projecting a second point; this scales it, and says so, because a ball drawn a third of a pixel
   * across is not a demonstration of anything.
   */
  const pixelsPerUnit = playfield.width / (table.bounds.xMax - table.bounds.xMin);

  return {
    playfield,
    camera,
    table,
    touched,
    get ball() { return ball; },

    step(frames: number): void {
      for (let i = 0; i < frames; i++) advanceFrame([ball], table.context, 1 / 60);
    },

    ballOnScreen() {
      return camera.projection.toScreen({ x: ball.position.x, y: ball.position.y, z: table.ballRadius });
    },

    render(): Framebuffer {
      frame.pixels.set(playfield.pixels);
      const at = this.ballOnScreen();
      fillCircle(frame, at.x, at.y, table.ballRadius * pixelsPerUnit, DEMO_BALL_COLOR);
      return frame;
    },

    drop(): void {
      ball = table.spawnBall();
      touched.length = 0;
    },
  };
}
