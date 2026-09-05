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
// The real playfield, the real 143 walls, the real gravity and drag, a ball obeying them — and the
// 1995 SCORES, because `control/score-table` can finally be addressed: its rows now carry the tag that
// names each component's group in the archive, which is what `make_component_link` uses upstream.
//
// ⚠️ STILL NO LAMPS AND NO MISSIONS. Those need the forty `T*` components built from the object
// manifest, each with its own state — a bumper that knows its own level, a target that knows it is
// down. This scores a hit at the component's FIRST level, which is what the original pays for a fresh
// one, and does not pretend the rest is there.

import { buildOriginalTable, type OriginalTable } from '../table/original.js';
import { SCORE_COMPONENTS } from '../control/score-table.js';
import { buildOriginalComponents, type OriginalComponents } from '../table/original-components.js';
import { loadTable } from '../dat/loader.js';
import { createScoreState, addScore, type ScoreState } from '../control/score.js';
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
  /** The 1995 score, paid from `control/score-table`'s own arrays. */
  readonly score: ScoreState;
  /** The table's own bumpers and lights, built from the archive. */
  readonly components: OriginalComponents;
  /** What the ball has scored on, by the control layer's name for it. */
  readonly scored: string[];
  drop(): void;
}

export function createDemo(archive: ArrayBuffer): Demo {
  const bytes = new Uint8Array(archive);
  const groups: readonly Group[] = readGroups(bytes);
  /**
   * ⚠️ THE REAL BUMPERS AND LIGHTS. Until this, every wall in the table answered with one generic
   * bounce, so a bumper neither kicked nor debounced nor kept a level — and the score was paid at level
   * zero because nothing could raise it.
   */
  const components = buildOriginalComponents(loadTable(bytes));
  const touched: string[] = [];
  const scored: string[] = [];
  const score = createScoreState();

  /**
   * ⚠️ BY TAG, NOT BY NAME. The archive calls a component `a_targ1` and the control layer calls it
   * `target1`; the tag is the bridge, and it is what `make_component_link` uses upstream. Without it
   * this map would be empty for eighty of the eighty-nine rows.
   */
  const scoringByTag = new Map(SCORE_COMPONENTS.map((row) => [row.tag, row]));

  const table = buildOriginalTable(groups, {
    componentFor: (name) => components.bumpers.get(name),
    onHit: (hit) => {
      touched.push(hit.group);
      const row = scoringByTag.get(hit.group);
      if (!row?.scores.length) return;
      // ⚠️ THE COMPONENT'S OWN LEVEL, where there is a component. `bumperControl` indexes the score
      // array by it and never advances it — the LANES do that, which this build does not wire yet, so a
      // bumper sits at level zero until it does. The indexing is right even while the raising is
      // missing, and doing it the other way round would have hidden the gap.
      const level = components.bumpers.get(hit.group)?.level ?? 0;
      addScore(score, row.scores[Math.min(level, row.scores.length - 1)]!);
      scored.push(row.name);
    },
  });
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
    score,
    scored,
    components,
    get ball() { return ball; },

    step(frames: number): void {
      for (let i = 0; i < frames; i++) {
        advanceFrame([ball], table.context, 1 / 60);
        // The components keep their own time: a bumper's lit period is what stops it firing again.
        components.advance(1 / 60);
      }
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
      scored.length = 0;
    },
  };
}
