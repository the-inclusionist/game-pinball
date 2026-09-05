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
import { createOriginalDispatch, type OriginalDispatch } from '../table/original-dispatch.js';
import { buildOriginalGates } from '../table/original-gates.js';
import { buildOriginalKickouts, kickoutGeometry } from '../table/original-kickouts.js';
import type { ControlContext } from '../control/dispatch.js';
import { loadTable } from '../dat/loader.js';
import { readMidiFile } from '../audio/midi.js';
import { scheduleMidi, scheduleLength, type ScheduledNote } from '../audio/midi-synth.js';
import { createScoreState, addScore, type ScoreState } from '../control/score.js';
import { decodePlayfield, readCamera, type OriginalCamera } from '../gfx/original-view.js';
import { readGroups, type Group } from '../dat/partman.js';
import { advanceFrame, type Ball } from '../physics/step.js';
import { fillCircle } from '../gfx/table-view.js';
import { pack, type Framebuffer } from '../gfx/framebuffer.js';
import { kindOf } from '../i18n/names.js';
import { soundForKind } from '../audio/voices.js';

/**
 * ⚠️ HOW MUCH MUSIC IS HANDED TO THE AUDIO THREAD AT ONCE, and how far ahead of the playhead the
 * handing happens. The window is bounded because `PINBALL.MID` is fourteen thousand notes; the
 * look-ahead is LARGER than the window so the audio thread never reaches the end of what it has before
 * the next slice arrives. Equal would open a gap every time it tops up — a click every few seconds
 * that sounds like a bad file rather than a bad player.
 */
export const MUSIC_WINDOW = 2;
export const MUSIC_LOOKAHEAD = 4;

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
  /** The archive names whose 1995 control function actually runs. */
  readonly wired: ReadonlySet<string>;
  /**
   * ⚠️ THE COMPONENTS PAID FLAT, which must never overlap `wired`. A wired component scores inside its
   * own control function, so paying it here as well would double every lane crossing — and doubling
   * looks like generous scoring rather than a bug, which is why the two lists are kept apart where a
   * test can see them rather than trusted to an early return nobody can observe.
   */
  readonly paidFlat: readonly string[];
  /** The last line a completed chain showed. */
  readonly info: string;
  /**
   * ⚠️ THE MUSIC, WHICH THE PLAYER ALSO BRINGS. `PINBALL.MID` is Microsoft's like everything else in
   * the original, so the demonstration asks for it and never fetches it. Null until it is given one,
   * because a table with no music is still a table.
   */
  readonly music: { readonly notes: readonly ScheduledNote[]; readonly length: number } | null;
  /** Returns false for a file that is not standard MIDI, rather than half-playing it. */
  loadMusic(bytes: ArrayBuffer): boolean;
  /** What the ball has scored on, by the control layer's name for it. */
  readonly scored: string[];
  drop(): void;
}

export interface DemoOptions {
  /**
   * Translates a line a control shows. Absent = the resource id itself, which is visible.
   *
   * ⚠️ AND IT TAKES PARAMETERS, because `STRING104` names the bonus it just paid. A translator that
   * could only take an id would have to show the amount separately or not at all.
   */
  readonly textFor?: (resourceId: string, params?: Record<string, string | number>) => string;
  /**
   * ⚠️ EVERY NOISE THE DEMONSTRATION MAKES, BY VOICE NAME. Two sources reach it: the KIND of whatever
   * the ball touched, and whatever a wired control asked for by name. Without it `playSound` was an
   * empty function and the whole 1995 table was mute — including the three controls that name a sound
   * explicitly, which is the loudest kind of silence to miss.
   */
  readonly onSound?: (name: string) => void;
}

export function createDemo(archive: ArrayBuffer, o: DemoOptions = {}): Demo {
  const bytes = new Uint8Array(archive);
  const groups: readonly Group[] = readGroups(bytes);
  /**
   * ⚠️ THE REAL BUMPERS AND LIGHTS. Until this, every wall in the table answered with one generic
   * bounce, so a bumper neither kicked nor debounced nor kept a level — and the score was paid at level
   * zero because nothing could raise it.
   */
  const manifest = loadTable(bytes);
  const components = buildOriginalComponents(manifest);
  const touched: string[] = [];
  const scored: string[] = [];
  const score = createScoreState();
  /** The line a completed chain last showed. The demo has no HUD hint of its own yet. */
  let info = '';
  const paidFlat: string[] = [];

  /**
   * ⚠️ BY TAG, NOT BY NAME. The archive calls a component `a_targ1` and the control layer calls it
   * `target1`; the tag is the bridge, and it is what `make_component_link` uses upstream. Without it
   * this map would be empty for eighty of the eighty-nine rows.
   */
  const scoringByTag = new Map(SCORE_COMPONENTS.map((row) => [row.tag, row]));

  /**
   * ⚠️ THE REAL CONTROL FUNCTIONS FOR THE SEVEN THAT ARE WIRED, AND THE FLAT PAYMENT FOR THE REST.
   *
   * A component the dispatcher handles runs its 1995 control function, which scores ITSELF — so paying
   * it again here would double every lane crossing. The two paths are exclusive on purpose, and the
   * `wired` set is what decides, rather than a flag somebody has to remember to set.
   */
  const context: ControlContext = {
    score,
    table: { extraBalls: 0, multiballCount: 1, ballCount: 1, tiltLocked: false },
    light: (name) => components.lights.get(name),
    group: () => undefined,
    showInfo: (text) => { info = text; },
    showMission: (text) => { info = text; },
    playSound: (name) => o.onSound?.(name),
    playMusic: () => {},
    missionControl: () => {},
  };
  /**
   * ⚠️ THE TABLE IS BUILT BEFORE THE DISPATCHER NOW, AND THE ORDER IS A DEPENDENCY. A gate is the
   * table's own edges plus a switch — `table/original-gates` needs the geometry to exist — and two
   * control functions reach for a gate. So: components, geometry, gates, dispatcher.
   *
   * `onHit` fires only from `step()`, which is why it can name a dispatcher declared after it.
   */
  let dispatch: OriginalDispatch | null = null;

  /**
   * ⚠️ THE HOLES ARE INSTALLED WITH THEIR OWN MOUTH, which is much smaller than the circle the file
   * draws — see `table/original-kickouts`. That much is right whoever owns the collision, so the
   * geometry goes in either way.
   *
   * ⚠️ BUT THEY DO NOT OWN THEIR COLLISIONS YET, AND THE REASON IS THAT A KICKOUT DOES NOT RELEASE
   * ITSELF. It swallows the ball and waits for its control function to call `restartTimer`; with no
   * control bound, the hole keeps the ball for the rest of the game. The ball does not drain, does not
   * score and does not count as lost — it stops existing, and the game goes on without it.
   *
   * Two of the three controls are not wired (`GravityWellKickoutControl` needs a settable active flag,
   * `HyperspaceKickOutControl` needs the hyperspace ladder), so the holes bounce like the small circles
   * they are until all three can let go. Half-wiring them would be worse than not wiring them: it
   * would eat the ball.
   */
  const kickouts: ReturnType<typeof buildOriginalKickouts> = new Map();

  const table = buildOriginalTable(groups, {
    geometryFor: kickoutGeometry(manifest),
    // The pull goes in with the collision, for the same reason: a hole that leans the ball in and then
    // never lets go is worse than one that does neither.
    fieldsFor: () => kickouts.values(),
    // ⚠️ EVERY COLLISION COMPONENT THIS PORT BUILDS, not only the bumpers. A kickback that the walls
    // never receive is a saver the ball goes straight past — it would arm nothing, because nothing
    // would ever touch it.
    componentFor: (name) => components.bumpers.get(name) ?? components.kickbacks.get(name)
      ?? kickouts.get(name),
    onHit: (hit) => {
      touched.push(hit.group);
      // ⚠️ BY KIND, NOT PER COLLISION. A ball resting against a wall collides many times a second, and
      // `SILENT_KINDS` is what keeps that from becoming a rattle — the original sounds each component
      // from its own data, and a wall's is silence. The kind comes from the archive's own name.
      const kind = kindOf(hit.group);
      const voice = kind ? soundForKind(kind) : undefined;
      if (voice) o.onSound?.(voice);

      if (dispatch?.wired.has(hit.group)) {
        dispatch.hit(hit.group);
        scored.push(scoringByTag.get(hit.group)?.name ?? hit.group);
        return;
      }

      const row = scoringByTag.get(hit.group);
      if (!row?.scores.length) return;
      paidFlat.push(hit.group);
      // ⚠️ THE FIRST SCORE, FLAT, because nothing here knows what else a component's table means.
      //
      // This branch used to read the bumper's level and index the table with it — a copy of
      // `BumperControl`, written before the dispatcher could run the real one. The bumpers are wired
      // now, so no bumper reaches this line any more, and the copy is gone. What is left is the
      // honest thing to do for a component whose control function this port has not wired: pay the
      // first entry and record that it was paid this way, where `paidFlat` can be compared against
      // `wired` and the two required not to overlap.
      //
      // ⚠️ AND IT DIFFERS FROM `getScoring` ON PURPOSE-LESS INPUT: `get_scoring` answers ZERO for an
      // index past the end, while this clamped to the last entry. That divergence went with the copy.
      addScore(score, row.scores[0]!);
      scored.push(row.name);
    },
  });
  const gates = buildOriginalGates(manifest, table);
  dispatch = createOriginalDispatch({
    components, context, gates,
    textFor: (id, params) => o.textFor?.(id, params) ?? id,
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
  let music: { notes: readonly ScheduledNote[]; length: number } | null = null;

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
    wired: dispatch.wired,
    paidFlat,
    get info() { return info; },
    get music() { return music; },

    loadMusic(bytes: ArrayBuffer): boolean {
      // ⚠️ REFUSED RATHER THAN GUESSED. `PINBALL2.MID` is the other format the original ships and
      // `isStandardMidi` says so; a parser that pressed on would schedule noise from a file it did not
      // understand, which is worse than silence because it sounds like the synthesizer's fault.
      const file = readMidiFile(new Uint8Array(bytes));
      if (!file) return false;

      const notes = scheduleMidi(file);
      music = { notes, length: scheduleLength(notes) };
      return true;
    },
    get ball() { return ball; },

    step(frames: number): void {
      for (let i = 0; i < frames; i++) {
        advanceFrame([ball], table.context, 1 / 60);
        // The components keep their own time: a bumper's lit period is what stops it firing again,
        // and a lane group's flash is what clears it.
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
      paidFlat.length = 0;
    },
  };
}
