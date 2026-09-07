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
// ========================= WHY `createGame` IS STILL INJECTED =========================
// It began as a workaround. The engine used to publish raw `.ts`, so importing it dragged the engine's
// own source into this repository's stricter type-check and produced sixty errors that were not
// defects — only the difference between two tsconfigs. The boundary moved instead of the strictness.
//
// ⚠️ THAT REASON IS GONE. The engine now publishes `dist-pkg/` with a `.d.ts` beside each module,
// `skipLibCheck` skips them, and `app/js/main.ts` imports `createGame` directly and IS type-checked.
// The tsconfig exclusion that used to protect it has been deleted.
//
// The injection stays anyway, and for a better reason than the one that created it: it is what lets
// every rule in this module be exercised in a node test with no DOM. Keeping it is now a choice about
// testability rather than a way around somebody else's build.
//
// ========================= WHAT THIS GAME DECLINES: NOTHING =========================
// The engine lets a game declare what it does not have. A quiz declines the pause menu because it has
// no phases and the pad assistant because it has no pad. A pinball has both, so it declines nothing,
// and that empty object is the honest answer rather than an oversight.
//
// ========================= AND IT IS NAVIGABLE FOR NOBODY, WHICH IS A CORRECTION =========================
// `isNavigable` answers "is it menu time?". The engine's default is `true`, which suits a game with no
// phases. A pinball's tick belongs to the CLOCK — the contract's own sixth field says so — and a ball
// in play does not wait while somebody walks a menu. So this answered `true` while paused.
//
// ⚠️ AND THAT IS WHAT MADE THE PAUSE MENU IMPOSSIBLE TO OPERATE. The Dev: "O jogo não tem pause com
// h/enter ainda, para acessar um menu com opções de voltar, editar controle, modos de acessibilidade
// para visão etc." Measured in a real browser before anything was changed: Enter DID pause and the
// menu DID open with the focus on "Continuar", and then no cabinet key did anything. The game paused
// and could not be un-paused.
//
// ⚠️ THE MECHANISM, TRACED RATHER THAN GUESSED. The engine's `ui/menu-nav` attaches
// `win.addEventListener('keydown', menuNavKey, true)` — a WINDOW CAPTURE listener — and its first act
// is `if (!ctx.isNavigable()) return;`. Capture at the window runs before every listener in the page,
// so while this game said "navigable" the engine consumed Enter, A, D, J, K and H before they reached
// anything. Instrumented: the codes arrive at `window` and never reach `#game-region`, let alone the
// menu inside it. `KeyU` survived, which is why the plunger alone still worked and made the failure
// look arbitrary.
//
// ⚠️ AND WHAT THAT BOUGHT WAS NOTHING, WHICH IS THE PART I HAD NEVER CHECKED. The comment that put it
// there said the engine's menus "have been waiting on a state nothing could ever enter" — reasoning,
// not a measurement. This port draws its OWN pause menu, in its own DOM; the engine has nothing on
// screen to navigate while it is up. So the declaration handed away the cabinet in exchange for
// walking a menu that does not exist.
//
// ⚠️ AND THIS IS THE SEAM TO REOPEN, NOT A DEAD END. The Dev asked for "editar controle" and "modos de
// acessibilidade para visão" — the engine HAS a binding wizard and colour-blindness filters, and
// reaching them means letting `menu-nav` run while an ENGINE menu is showing. The predicate then
// becomes "an engine menu is up", which is a fact about the engine's state and not about this game's
// phase. That is the shape of the fix; what it is not is `phase === 'paused'`.
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

import type { GameDeclaration, Speakable } from '@the-inclusionist/engine/core/contract.js';
import { createDeclaration, type DeclaredBall, type DeclaredComponent } from './declaration.js';
import {
  createCamera, stepCamera, stepAxis, DEFAULT_CAMERA, type CameraConfig, type CameraState,
} from './camera.js';
import { layoutHud, DEFAULT_HUD, type HudConfig, type HudLayout } from './hud.js';
import { createTranslator, type Locale, type Translate } from '../i18n/index.js';
import { createNamer, nameTableOf, type ComponentKind } from '../i18n/names.js';
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
  /**
   * ⚠️ A STABLE ARRAY, NOT A FRESH ONE. `audio-sonar.updateGuide` counts frames on `guideT`, a field it
   * writes ONTO the player object, and pings when it reaches 48. Returning a new object each call resets
   * that counter every frame and the guide never fires — which is the engine's own default behaviour,
   * since it derives a fresh player from `focusOf` when a game supplies no list.
   */
  readonly sonarPlayers?: () => SonarPlayerLike[];
}

/** The sonar's view of a player. `guideT` is the engine's scratch space and is written by it. */
export interface SonarPlayerLike {
  readonly i: number;
  x: number;
  y: number;
  readonly viz: string;
  guideT?: number;
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
  /**
   * ⚠️ What each component IS, when the table knows. An authored table declares its kinds; the 1995
   * one does not, and there the kind can only be guessed from the `.DAT` group name.
   *
   * This exists because a real boot found the outlanes SILENT. `i18n/names.kindOf` reads a prefix, and
   * `outlane.left` starts with neither `oneway` nor `roll`, so the blind mode announced nothing over
   * the one hazard a blind player most needs to hear about. Guessing is the fallback, not the rule.
   */
  readonly kindOfComponent?: (name: string) => ComponentKind | null;
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
  /**
   * ⚠️ GONE, AND ITS ABSENCE IS THE DECISION. This was here for `isNavigable`, which answered
   * `phase === 'paused'` and by doing so handed the engine every navigation key at window-capture —
   * see this module's header for the measurement. `isNavigable` is constant now, so the phase is not
   * a thing the engine needs to be told, and a declared option nothing reads is a promise this
   * interface cannot keep. When engine menus become reachable the predicate will ask whether ONE IS
   * ON SCREEN, which is a different question and takes a different argument.
   */
  readonly isBlindMode?: () => boolean;
  readonly sonarPlayers?: () => SonarPlayerLike[];
  readonly camera?: CameraConfig;
  readonly hud?: HudConfig;
}

/**
 * A live view of the table. Getters, not fields — see this module's header for why that matters more
 * than it looks.
 */
export function createPinballWorld(table: LiveTable, locale: Locale) {
  const guessName = createNamer(locale);
  const names = nameTableOf(locale);
  const t = createTranslator(locale);

  // A DECLARED kind wins over a guessed one, always. See `kindOfComponent` for what the guess costs.
  const speakName = (componentName: string) => {
    const declared = table.kindOfComponent?.(componentName);
    return declared ? names[declared] : guessName(componentName);
  };

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
    /**
     * ⚠️ NEVER, UNTIL AN ENGINE MENU IS ACTUALLY ON SCREEN. See this module's header: answering `true`
     * while paused handed the engine every navigation key at window-capture, for menus this game does
     * not show, and left its own pause menu inoperable. A ball in play does not wait while somebody
     * walks a menu either — both halves of the old comment were right about the game and wrong about
     * who was listening.
     */
    isNavigable: () => false,
    ...(o.isBlindMode ? { isBlindMode: o.isBlindMode } : {}),
    ...(o.sonarPlayers ? { sonarPlayers: o.sonarPlayers } : {}),
  };
}

export interface PinballShell<E extends EngineLike> {
  readonly engine: E;
  readonly declaration: GameDeclaration;
  readonly t: Translate;
  readonly hud: HudLayout;
  /** Where the view is, up and down the table. Read by the renderer every frame. */
  readonly camera: CameraState;
  /**
   * ⚠️ AND SIDEWAYS, WHICH ONLY MOVES ON A TABLE WIDER THAN THE WINDOW. Phase 8 of the plan asks for it
   * in one line — a table wider than the screen scrolls horizontally by the same algorithm — and
   * `shell/camera` was built for it: `stepAxis` knows nothing about vertical and its own header says
   * the horizontal axis calls it "with a different `anchor` and a different pair of sizes".
   *
   * `wide-arc` is 360 wide against a window of 183. Without this, a hundred and seventy-seven columns
   * of it could never be looked at, and nothing said so.
   *
   * On every other table the maximum offset is zero and this stays at zero for ever, which is what
   * makes it safe to read unconditionally.
   */
  readonly cameraX: CameraState;
  /** ⚠️ `frames`, not seconds. See this module's header. */
  advance(frames: number): void;
  /**
   * Puts both views back where a game starts: on the flippers, and at the left.
   *
   * ⚠️ THE CAMERA CANNOT DO THIS BY ITSELF, and that is not an oversight in `shell/camera` — it is
   * that module's speed cap, which holds each step to a fraction of the BALL'S OWN SPEED so the view
   * can never outrun the thing the player is watching. A ball waiting in the plunger lane has a speed
   * of nought, so the cap is nought, so the offset stays exactly where the LAST ball left it.
   *
   * Which is the defect: a ball that drains from high on the table leaves the window up there, and
   * the next one is placed at the plunger — off the bottom of the view, with the flippers off it too.
   * Nothing in the picture then belongs to the ball the player is holding.
   *
   * Called by the drain, where a new ball is put on the table. Not called by `advance`: while a ball
   * is in play the camera's own rules are the ones that should decide where the view goes.
   */
  resetCamera(): void;
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

  /**
   * ⚠️ THE SAME RULE ON THE OTHER AXIS, and only the sizes and the anchor differ. The window is the
   * HUD's playfield rect, the world is the table's own width, and the anchor is the MIDDLE of the
   * window rather than the vertical's — a player following a ball sideways is not looking ahead of it
   * the way they look up the table, and an off-centre anchor would swing the view every time the ball
   * changed direction.
   */
  const hud = layoutHud(hudConfig);
  const cameraXConfig: CameraConfig = {
    ...cameraConfig,
    viewHeight: hud.playfield.width,
    worldHeight: o.table.playfieldWidth,
    anchor: hud.playfield.width / 2,
  };
  let cameraX = createCamera(cameraXConfig);

  return {
    engine,
    declaration: options.declaration,
    t: createTranslator(o.locale),
    hud,
    get camera() { return camera; },
    get cameraX() { return cameraX; },
    advance(frames: number): void {
      const ball = o.table.balls.find((b) => b.active);
      if (!ball) return;
      // One camera step per frame, so the damping means what `shell/camera` says it means.
      for (let i = 0; i < frames; i++) {
        camera = stepCamera(camera, cameraConfig, {
          y: ball.position.y,
          speedY: Math.abs(ball.direction.y) * ball.speed,
        });
        cameraX = stepAxis(
          cameraX, cameraXConfig, ball.position.x, Math.abs(ball.direction.x) * ball.speed,
        );
      }
    },
    resetCamera(): void {
      // The same call the boot made. `createCamera` is where "a view starts on the flippers" is
      // written down, and a new ball is a new start — so this asks it again rather than restating 55.
      camera = createCamera(cameraConfig);
      cameraX = createCamera(cameraXConfig);
    },
    problems: engine.problems,
  };
}
