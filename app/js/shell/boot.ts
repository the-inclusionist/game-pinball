// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/boot — where the table, the contract and the engine are joined.
//
// ========================= THE SEAM IS AN ADAPTER, NOT A COPY =========================
// `shell/declaration` takes a `PinballWorld` and reads its fields inside every method, so what it
// needs is a LIVE view of the table rather than a snapshot. `createPinballWorld` is that view: an
// object of getters over whatever the running game holds. Nothing is copied, so nothing goes stale,
// and the declaration keeps answering `focusOf` with where the ball is NOW.
//
// The alternative — rebuilding the declaration every frame — would allocate sixty objects a second to
// say the same thing; and passing a snapshot instead would have the sonar point at where the ball was.
//
// ========================= WHY `createGame` IS INJECTED AND NOT IMPORTED =========================
// ⚠️ THE ENGINE SHIPS RAW `.ts` THROUGH ITS EXPORTS MAP, AND THIS PROJECT IS STRICTER THAN IT IS.
// Importing `@the-inclusionist/engine` here puts the engine's own source into this repository's
// type-check, which then reports SIXTY errors across seven engine files — every one of them from
// `noUncheckedIndexedAccess`, which this project enables and the engine does not.
//
// None of those is a defect in the engine. They are the difference between two tsconfigs, and the
// options are: weaken this project to match, edit somebody else's repository, or move the boundary.
// The boundary moves. `bootPinball` takes `createGame` as an argument, so `tsc` here checks THIS code
// and the engine's source is checked by the engine's own build, which is where it belongs.
//
// What is still imported for real is `core/contract.ts` — the seven fields, which do compile under
// these settings and are the part that must not drift. The entry point in `app/main.ts` holds the real
// engine types and is outside this project's `include` for exactly this reason.
//
// ========================= WHAT THIS GAME DECLINES: NOTHING =========================
// The engine lets a game declare what it does not have. A quiz declines the pause menu because it has
// no phases and the pad assistant because it has no pad. A pinball has both, so it declines nothing,
// and that empty object is the honest answer rather than an oversight.
//
// ========================= BUT IT IS ONLY NAVIGABLE WHEN PAUSED =========================
// `isNavigable` answers "is it menu time?". The engine's default is `true`, which suits a game with no
// phases. A pinball's tick belongs to the CLOCK — the contract's own sixth field says so — and a ball
// in play does not wait while somebody walks a menu. So this answers `true` only while paused.
//
// ========================= TWO THINGS ABOUT THE ENGINE THAT ARE EASY TO GET WRONG =========================
//   · `update(dt)` COUNTS IN FRAMES, not seconds. `shell/camera`'s damping is per frame for that
//     reason, and `advance` below passes the number through untouched. Reading it as seconds makes the
//     camera about sixty times too slow, and nothing errors.
//   · THE KEYBOARD BINDS TO `#game-region`, never to `window` — and `createGame` does that binding
//     itself. This module must not add listeners of its own, or every key arrives twice.
//
// ========================= A MALFORMED DECLARATION THROWS; MISSING MARKUP DOES NOT =========================
// That asymmetry is the engine's and it is deliberate: a wrong declaration is a defect in the program
// and a half-declared game is worse than one that refuses to open, while a missing element id is a gap
// in the HOST document. So `problems` comes back as a list, and this module hands it on rather than
// swallowing it.

import type { GameDeclaration, Speakable } from '@the-inclusionist/engine/core/contract.ts';
import { createDeclaration, type DeclaredBall, type DeclaredComponent } from './declaration.js';
import {
  createCamera, stepCamera, DEFAULT_CAMERA, type CameraConfig, type CameraState,
} from './camera.js';
import { layoutHud, DEFAULT_HUD, type HudConfig, type HudLayout } from './hud.js';
import { createTranslator, type Locale, type Translate } from '../i18n/index.js';
import { createNamer } from '../i18n/names.js';
import { keyOf } from '../i18n/keys.js';

/** The ids `createGame` looks for. Named here so this game can be checked against them. */
export const REQUIRED_MARKUP: readonly string[] = ['#game-region', '#sr-status', '#sr-alert'];

export type Phase = 'title' | 'playing' | 'paused';

/** The engine's `EngineHost`, restated at the boundary — see this module's header. */
export interface HostLike {
  readonly doc: Document;
  readonly win: Window;
  readonly cvdHost?: Element | null;
}

/** The slice of `CreateGameOptions` this game fills in. */
export interface PinballGameOptions {
  readonly declaration: GameDeclaration;
  readonly host: HostLike;
  readonly declines: Record<string, boolean>;
  readonly isNavigable: () => boolean;
  readonly isBlindMode?: () => boolean;
}

/** The only part of the engine's `Engine` this module reads. The caller keeps the rest, fully typed. */
export interface EngineLike {
  readonly problems: readonly string[];
}

/**
 * The running table, as the shell needs to see it. This is the seam phase 8's authored table has to
 * satisfy, and the 1995 one satisfies through the loader.
 */
export interface LiveTable {
  readonly playfieldWidth: number;
  readonly playfieldHeight: number;
  readonly ballRadius: number;
  readonly balls: readonly DeclaredBall[];
  readonly components: readonly DeclaredComponent[];
  /** The resource identifier of the running mission's text — see `i18n/keys`. */
  readonly missionTextId: string;
  readonly missionHave: number;
  readonly missionNeed: number;
  readonly missionTargets: readonly string[];
}

export interface BootOptions {
  readonly locale: Locale;
  readonly table: LiveTable;
  readonly host: HostLike;
  readonly phase: () => Phase;
  readonly isBlindMode?: () => boolean;
  readonly camera?: CameraConfig;
  readonly hud?: HudConfig;
}

/**
 * A live view of the table. Getters, not fields — see this module's header for why that matters more
 * than it looks.
 */
export function createPinballWorld(table: LiveTable, locale: Locale) {
  const speakName = createNamer(locale);
  const t = createTranslator(locale);

  return {
    get playfield() { return { width: table.playfieldWidth, height: table.playfieldHeight }; },
    get ballRadius() { return table.ballRadius; },
    get balls() { return table.balls; },
    get components() { return table.components; },
    speak: (componentName: string): Speakable | null => speakName(componentName),
    get mission() {
      return {
        // The objective is spoken, so it is a `Speakable` rather than a bare string.
        objective: {
          text: t(keyOf(table.missionTextId), { n: table.missionNeed - table.missionHave }),
          gender: 'n' as const,
          plural: false,
        },
        have: table.missionHave,
        need: table.missionNeed,
        targets: table.missionTargets,
      };
    },
  };
}

/** This game declines nothing. See this module's header. */
export function pinballDeclines(): Record<string, boolean> {
  return {};
}

/** Everything `createGame` is handed, built without calling it — which is what makes this testable. */
export function createPinballOptions(o: BootOptions): PinballGameOptions {
  const declaration = createDeclaration(createPinballWorld(o.table, o.locale));

  return {
    declaration,
    host: o.host,
    declines: pinballDeclines(),
    // A ball in play does not wait while somebody walks a menu.
    isNavigable: () => o.phase() === 'paused',
    ...(o.isBlindMode ? { isBlindMode: o.isBlindMode } : {}),
  };
}

export interface PinballShell<E extends EngineLike> {
  readonly engine: E;
  readonly declaration: GameDeclaration;
  readonly t: Translate;
  readonly hud: HudLayout;
  /** Where the view is. Read by the renderer every frame. */
  readonly camera: CameraState;
  /** ⚠️ `frames`, not seconds. See this module's header. */
  advance(frames: number): void;
  /** What the host document failed to provide. Empty is the good case. */
  readonly problems: readonly string[];
}

/**
 * Boots the game. `createGame` is the engine's, passed in by the entry point — see this module's
 * header for the type-check boundary that forces it, and note that the caller keeps the engine's full
 * API because `E` is inferred from what it hands over.
 */
export function bootPinball<E extends EngineLike>(
  o: BootOptions, createGame: (options: PinballGameOptions) => E,
): PinballShell<E> {
  const cameraConfig = o.camera ?? DEFAULT_CAMERA;
  const hudConfig = o.hud ?? { ...DEFAULT_HUD, playfieldWidth: o.table.playfieldWidth };

  const options = createPinballOptions(o);
  // Throws on a malformed declaration; reports missing markup instead of throwing.
  const engine = createGame(options);

  let camera = createCamera(cameraConfig);

  return {
    engine,
    declaration: options.declaration,
    t: createTranslator(o.locale),
    hud: layoutHud(hudConfig),
    get camera() { return camera; },
    advance(frames: number): void {
      const ball = o.table.balls.find((b) => b.active);
      if (!ball) return;
      // One camera step per frame, so the damping means what `shell/camera` says it means.
      for (let i = 0; i < frames; i++) {
        camera = stepCamera(camera, cameraConfig, {
          y: ball.position.y,
          speedY: Math.abs(ball.direction.y) * ball.speed,
        });
      }
    },
    problems: engine.problems,
  };
}
