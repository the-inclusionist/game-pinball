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
// ========================= WHAT THIS GAME DECLINES: THE NEURAL VOICE =========================
// The engine lets a game declare what it does not have, and until engine 8 this game declined NOTHING —
// an empty object described as "the honest answer rather than an oversight". It was neither, and the
// field that arrived in 8.0.0 is what says so: this port has never carried the neural voice, because
// `@mintplex-labs/piper-tts-web` drags `onnxruntime-web` in as a non-optional peer — 135 MB in the
// `node_modules` of a game that would never speak with it. What stood in for the sentence was a stub
// that THREW (`shims/piper-tts-web.ts`, deleted with this migration), because 6.36.1 imported the
// package by name and nothing could be declared about it.
//
// ⚠️ AND THE PAUSE MENU IS NOT DECLINED BECAUSE IT CAN NO LONGER BE. `semMenuDePausa` was retired, put
// back after measuring four of five games using it, and retired again on the Dev's own reason: the pause
// card and the accessibility icons belong in EVERY game. The engine's card is mounted hidden at
// `host.pauseHost ?? #game-region` and a mounted card eats no keys; only an open one owns the keyboard,
// and nothing here ever opens it. This game keeps `shell/pause-menu`.
//
// ========================= AND THE HEAVY THINGS ARE NOT FETCHED =========================
// ⚠️ `baixarPesados` DEFAULTS TO TRUE and `createGame` fires it on every boot: ~285 MB of neural voice
// models, a vision runtime and its three models, into Cache Storage in the background. This game says no,
// and the reason that settles it is not the size — it is that NOTHING HERE WOULD READ THEM. That cache is
// served by a service worker, and this repository has neither a service worker nor a web manifest.
//
// 📌 One line, reversible: the day this game becomes a PWA, or opens the voice door above, the reason
// stops holding and the flag comes out. ADR-0117 says those bytes should be the PLATFORM's to pay once
// per origin, which is not this repository's decision to take.
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
import { pinballPreset } from './preset.js';
import type { ActionPreset } from '@the-inclusionist/engine/core/actions.js';
import type { KeyScheme } from '@the-inclusionist/engine/core/entity.js';
import { KEYBOARD_SOLO } from '@the-inclusionist/engine/input/default-bindings.js';
import { cabinetKeyboard } from './cabinet-declaration.js';
import { createNamer, nameTableOf, type ComponentKind } from '../i18n/names.js';
import { keyOf } from '../i18n/keys.js';

/** The ids `createGame` looks for. Named here so this game can be checked against them. */
export const REQUIRED_MARKUP: readonly string[] = [
  '#game-region', '#sr-status', '#sr-alert',
  /**
   * ⚠️ THE ONE THE ENGINE WRITES INTO RATHER THAN READS, and it arrived with engine 8. `createGame`
   * mounts the first screen's accessibility bar into it: blind mode, the screen reader, Libras, the
   * autism adjustments and latching — four of which this game never offered at all.
   *
   * ⚠️ AND NOT HIGH CONTRAST OR COLOUR CORRECTION, WHICH IS A MEASUREMENT AND NOT AN OMISSION. Those two
   * icons are mounted only for a game that hands the engine a theme writer and a correction writer, and
   * this one has its own: `shell/options`'s palette and `shell/vision`'s dialog. The bar was read in a
   * real browser before this sentence was written; the earlier version of it named six and was wrong.
   * Without it the engine reports that the child cannot reach any of them before the game starts.
   */
  '#title-icons',
];

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
  /** ⚠️ FALSE, AND THE ENGINE'S DEFAULT IS TRUE. See this module's header for the three reasons. */
  readonly baixarPesados: boolean;
  /**
   * THE WORDS OF THIS GAME'S CONTROLS — see `shell/preset` for what they are and why they are derived.
   *
   * ⚠️ IT IS THE INPUT TO THE REACH ARITHMETIC AND NOT DECORATION. Without it `createGame` computes an
   * empty action set, never shows the card that tells a child on a two-finger phone what is short, and
   * answers `engine.alcance` with a permanent `{ ok: false, pedidas: 0 }` that nobody reads.
   */
  readonly preset: ActionPreset;
  /**
   * ⚠️ WITHOUT THIS THE ENGINE'S OWN PAUSE CARD IS A ROOM WITH NO DOOR. `ui/menu-nav`'s `navPause`
   * answers a root-level «no» with `ctx.setPhase('playing')`, and `createGame` defaults that to `() => {}`
   * for a game that declares none — so a child who opens the engine's card and presses Escape at its root
   * gets nothing at all. It is one line, and it is reached by exactly the child who most needs a way out.
   */
  readonly setPhase: (phase: Phase) => void;
  /**
   * THE SEATS, FOR THE ENGINE'S REMAPPER — `Pick<ControlledPlayer, 'ctrl'>`, a key scheme and nothing else.
   *
   * ⚠️ ONE, AND THE ONE IS THE STATEMENT. With no list at all `createGame` falls back to a throwaway
   * player whose scheme is `semAlcance` — fourteen declared absences — so the engine's remap screen was
   * editing a cabinet that reaches nothing. A pinball is one child at one machine; when it grows a second
   * seat, this is the line that says so, and `shell/cabinet-declaration` already takes the seat index.
   */
  readonly players: { ctrl: KeyScheme }[];
  readonly isNavigable: () => boolean;
  /**
   * WHAT EACH ITEM OF THE ENGINE'S PAUSE CARD DOES IN THIS GAME.
   *
   * ⚠️ THE CARD IS NOT THE POINT — THE BAR IS. `entrarNaBarra` calls `acts.resume?.()` to leave the card
   * before handing the four directions to the accessibility bar; with an empty table that `resume` is
   * `undefined`, the card stays over the game, and ADR-0044 item 7 — the directional driving the bar — was
   * unreachable from ANY game until engine 9.0.0 published this field.
   *
   * 📌 AND THE LIST IS SHORT BECAUSE `refrescarItensDaPausa` HIDES WHAT CANNOT ACT (ADR-0106 §5). This
   * cabinet answers `resume` and `quit`; `colours`, `tables` and `title` have no slot in the engine's
   * `PM_BTNS` at all, which is why this game keeps its own pause menu beside the card.
   */
  readonly getPauseActs?: () => Record<string, (() => void) | undefined>;
  /**
   * HOW THIS GAME CORRECTS COLOUR — the writer that makes the 🚥 icon mountable.
   *
   * ⚠️ AND ⚫ HAS NO COMPANION HERE, WHICH IS A STATEMENT RATHER THAN A GAP. `iconesQueAccionam` mounts the
   * high-contrast icon only for a game that supplies `setTemaDoJogador`, and high contrast is applied by
   * repainting TEXTURES. This game's picture is a 320×180 framebuffer with none, so the icon stays absent
   * because the game cannot honour it — an icon that does not act being worse than an icon fewer.
   */
  readonly setCorrecaoDoJogador?: (player: number, correcao: string) => void;
  readonly setTemaDoJogador?: never;
  readonly isBlindMode?: () => boolean;
}

/**
 * The sonar's view of a player: an index and a place, and nothing else.
 *
 * ⚠️ IT CARRIED A `viz` AND A `guideT` UNTIL ENGINE 8, AND THE ENGINE READS NEITHER. `guideT` went
 * when the beep became a continuous graph; `viz` went when the sonar stopped knowing what a visual mode
 * is — it asked the string "blindness or low vision?" and now receives the answer through
 * `visaoComprometida`. Fields nothing reads are the shape a stale comment takes in a type.
 */
export interface SonarPlayerLike {
  readonly i: number;
  x: number;
  y: number;
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
  /**
   * The translator to draw with, when whoever settled the language already built one.
   *
   * ⚠️ `ctx.t` IS «TRANSLATE, ALREADY SCOPED TO THE ACTIVE LOCALE», AND THE WORD IS *ALREADY*. Under
   * ADR-0117 the language belongs to the SITE: the host has chosen it and built a translator for it, and
   * handing the CODE over for the game to build a second one is two constructions of one fact — which
   * this repository has paid for often enough to name it at the field.
   *
   * 📌 OPTIONAL, BECAUSE `locale` IS STILL NEEDED FOR MORE THAN WORDS. `createPinballWorld` builds a
   * NAMER and a name table from the code, and neither is a `Translate`. So the code stays and the
   * translator joins it, rather than replacing it.
   */
  readonly t?: Translate;
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
  /**
   * IS A MENU ON SCREEN RIGHT NOW? — the argument this interface gave up and said it would want back.
   *
   * ⚠️ AND IT IS A DIFFERENT QUESTION FROM THE ONE THAT COST THE PAUSE MENU. That was
   * `phase === 'paused'`, which answers yes over a stopped game with nothing open — and the engine
   * listens at WINDOW CAPTURE, so it took every cabinet key before the game saw one. This asks whether
   * there is a MENU, and the engine only consumes a key when it has something to navigate.
   *
   * ⚠️ ABSENT MEANS `false`, which is the behaviour that was safe. A host that does not answer the
   * question does not get the engine's menu layer, rather than getting it on a guess.
   */
  readonly menuIsUp?: () => boolean;
  /** What the engine's pause card can action here. See `PinballGameOptions.getPauseActs`. */
  readonly pauseActs?: () => Record<string, (() => void) | undefined>;
  /**
   * Applies a colour correction, in THIS GAME's words.
   *
   * ⚠️ THE TRANSLATION BETWEEN THE TWO VOCABULARIES HAPPENS BELOW AND NOT IN THE CALLER, because it is one
   * fact about two names: the engine's `tricro` is "trichromatic vision", a NAME rather than an absence,
   * and this game calls the same thing `normal`. Everything else is `fix-*` on both sides already.
   */
  readonly setCorrection?: (choice: string) => void;
  /**
   * Where the engine's own pause card sends a child who asks to leave it.
   *
   * ⚠️ ABSENT IS A ROOM WITH NO DOOR, and the engine cannot tell: `navPause` answers a root-level «no»
   * with `setPhase('playing')` and `createGame` defaults it to `() => {}`. See `PinballGameOptions`.
   */
  readonly setPhase?: (phase: Phase) => void;
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

/** This game declines the neural voice, and nothing else. See this module's header. */
export function pinballDeclines(): Record<string, boolean> {
  return { semVozNeural: true };
}

/** Everything `createGame` is handed, built without calling it — which is what makes this testable. */
export function createPinballOptions(o: BootOptions): PinballGameOptions {
  const declaration = createDeclaration(createPinballWorld(o.table, o.locale));

  return {
    declaration,
    host: o.host,
    declines: pinballDeclines(),
    baixarPesados: false,
    /**
     * ⚠️ BUILT WITH THIS GAME'S TRANSLATOR, because `ActionWord.label` is a rendered STRING and not a
     * key: the engine has no dictionary of this game's words. It is read once, at boot, which is why a
     * language change is `§9` of the plan and not a thing this line can answer by itself.
     */
    preset: pinballPreset(createTranslator(o.locale)),
    /**
     * ⚠️ THE ENGINE'S FACTORY WITH THIS CABINET OVER IT, which is the same precedence `fabricaComOJogo`
     * applies — written here because `createGame` reads this list BEFORE it reads the declaration's mapping,
     * and a seat built from the bare factory would show the remap screen the engine's keys for one frame.
     */
    players: [{ ctrl: { ...KEYBOARD_SOLO, ...cabinetKeyboard(1, 0) } as KeyScheme }],
    /**
     * ⚠️ NEVER, UNTIL AN ENGINE MENU IS ACTUALLY ON SCREEN. See this module's header: answering `true`
     * while paused handed the engine every navigation key at window-capture, for menus this game does
     * not show, and left its own pause menu inoperable. A ball in play does not wait while somebody
     * walks a menu either — both halves of the old comment were right about the game and wrong about
     * who was listening.
     */
    isNavigable: o.menuIsUp ?? (() => false),
    ...(o.pauseActs ? { getPauseActs: o.pauseActs } : {}),
    ...(o.setCorrection
      ? {
        setCorrecaoDoJogador: (_player: number, correcao: string): void => {
          o.setCorrection!(correcao === 'tricro' ? 'normal' : `fix-${correcao}`);
        },
      }
      : {}),
    setPhase: o.setPhase ?? (() => {}),
    ...(o.isBlindMode ? { isBlindMode: o.isBlindMode } : {}),
    /**
     * 🔴 `sonarPlayers` USED TO BE FORWARDED HERE, AND THE ENGINE STOPPED READING IT (ADR-0258, note
     * EB). It fed the sonar's `getPlayers`, which only the engine's own continuous guide read — and that
     * guide left the engine for the games that want one (note DZ). This game grew its own,
     * `app/js/audio/guide`, which listens to the one reused `sonarPlayer` directly.
     *
     * 📏 MEASURED BEFORE REMOVING IT, because the obvious worry was two guides at once: nothing in
     * engine 9's `boot/` or `core/loop` calls `updateGuide`, and this game's frame loop calls only its
     * own. The option was already inert, so taking it out silences nothing.
     */
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
  o: BootOptions, engine: E,
): PinballShell<E> {
  const cameraConfig = o.camera ?? DEFAULT_CAMERA;
  const hudConfig = o.hud ?? { ...DEFAULT_HUD, playfieldWidth: o.table.playfieldWidth };

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
    /**
     * ⚠️ BUILT HERE RATHER THAN READ BACK FROM THE OPTIONS, because the shell no longer builds them: the
     * caller does, and hands over a finished engine (ADR-0139). `createPinballOptions` is pure, so asking
     * it again costs one object and keeps this property what it always was — the declaration for THIS
     * table, which is what the sonar and the screen reader describe.
     */
    declaration: createPinballOptions(o).declaration,
    /**
     * 📌 THE HOST'S IF THERE IS ONE, AND OTHERWISE THIS SHELL'S. The standalone page is its own host
     * and let the shell build it for a year; making the field required would be a breaking change to
     * `BootOptions` for no gain, and the fallback is exactly what it always did.
     */
    t: o.t ?? createTranslator(o.locale),
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
