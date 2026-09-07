// SPDX-License-Identifier: AGPL-3.0-or-later
// main — the entry point, and the ONE file that touches the engine's runtime.
//
// ========================= IT ASSEMBLES, AND DECIDES AS LITTLE AS IT CAN =========================
// This file used to be excluded from `tsc`, because the engine published raw `.ts` and importing it
// dragged the engine's own source under this project's stricter settings. The engine now ships
// `dist-pkg/` with declarations, the exclusion is gone, and this file is type-checked like everything
// else.
//
// It stays small anyway. Every rule about how the game behaves lives in `shell/boot`, `table/*` and
// `gfx/*`, which are exercised in node; what is left here is wiring, and wiring is the part a browser
// has to prove.

/**
 * ⚠️ THE PAGE'S OWN STYLESHEET, AND THERE WAS NONE. Measured in the running game:
 * `document.styleSheets.length === 0` — so `html` and `body` were the user agent's white, its 8px
 * margin was a band above the game, and `#sr-status` rendered as ordinary text under it, reading the
 * screen reader's announcements to everybody. The Dev's words: "Ao entrar no jogo temos laterais
 * brancas horríveis."
 *
 * Imported HERE rather than linked from `index.html` so the bundler carries it: a `<link>` to a file
 * outside the module graph is a file that ships in dev and vanishes from `dist`, which is exactly the
 * kind of difference this port has already paid for once with the art.
 */
import '../css/style.css';

import { createGame } from '@the-inclusionist/engine';
import { bootPinball, type LiveTable, type Phase } from './shell/boot.js';
import { CATALOG, DEFAULT_TABLE, tableNamed } from './table/catalog.js';
import { toLiveTable, validateTable, type TableState } from './table/authored.js';
import { DEFAULT_CAMERA } from './shell/camera.js';
import { DEFAULT_HUD } from './shell/hud.js';
import { createFramebuffer } from './gfx/framebuffer.js';
import {
  drawTable, blitView, drawBall, drawFlipper, drawMover, drawLitRect, litColors, packRgb,
  paletteOf, ROLE_COLORS,
} from './gfx/table-view.js';
import {
  buildPhysics, drainedBy, inPlungerLane, launchSpeedFor, FRAME_SECONDS,
} from './table/physics-build.js';
import { advanceFrame } from './physics/step.js';
import { createLaneProgress } from './table/lane-progress.js';
import { openSecrets } from './table/secret.js';
import { loadBackdrop } from './gfx/backdrop.js';
import { cometMission, reportOf, WINNING_POINTS, type CometMission, type CometSky, type CometStrike }
  from './control/comet-mission.js';
import { drawComet } from './gfx/comet-view.js';
import { MISSION_DRAG } from './table/ball-assist.js';
import { plungerLaneOf } from './table/cabinet.js';
import { powerUpField, MULTIBALL_EXTRA, type PowerUpField, type PowerUpKind }
  from './control/power-ups.js';
import { drawCapsule } from './gfx/capsule-view.js';
import { endGame, type EndOfGameOptions } from './shell/end-of-game.js';
import { bindPinballControls } from './shell/controls.js';
import {
  readPalette, writePalette, nextPalette, isCbSafe, PALETTE_LABEL, PALETTE_CHOICES,
  OPTIONS_DIALOG_ID, type PaletteChoice,
} from './shell/options.js';
import { mountChoiceDialog } from './shell/choice-dialog.js';
import {
  readVision, writeVision, visionFilter, VISION_CHOICES, VISION_LABEL, VISION_DIALOG_ID,
} from './shell/vision.js';
import { readBindings, writeBindings, type BindingTable } from './shell/keymap.js';
import { mountKeymapDialog } from './shell/keymap-dialog.js';
import { titleScreen } from './shell/title.js';
import { integerScale } from './shell/present.js';
import { createPadReader, CABINET_OF_ENGINE_ACTION } from './shell/pad.js';
import { createPlunger } from './shell/plunger.js';
import { mountTitle } from './shell/title-dom.js';
import { mountPauseMenu } from './shell/pause-menu.js';
import { mountHighScoreDialog } from './shell/high-score-dialog.js';
import { createLiveControls } from './table/live-controls.js';
import { createRolloverWatch } from './table/rollovers.js';
import { objectiveOf, AUTHORED_OBJECTIVE_ID } from './table/objective.js';
import { runMissions } from './table/missions.js';
import { addScore } from './control/score.js';
import { mountHud } from './shell/hud-dom.js';
import { mountDemoPage } from './shell/demo-page.js';
import { demoWorld, groupsOf } from './shell/demo-world.js';
import { MUSIC_WINDOW, MUSIC_LOOKAHEAD } from './shell/demo.js';
import { playSchedule } from './audio/midi-player.js';
import { createDemo, hintFor, type Demo } from './shell/demo.js';
import { keyOf } from './i18n/keys.js';
import { createSoundBoard, releaseVoice } from './audio/sfx.js';
import { soundEntriesOf, VOICES } from './audio/voices.js';
import { createWebAudioOutput } from './audio/web-audio.js';
import { ensureAC } from '@the-inclusionist/engine/platform/audio.js';

/**
 * ⚠️ READ ONCE, AT BOOT, AND FROM A STORE THAT MAY REFUSE. `shell/options` swallows the throw a private
 * window raises on `localStorage`, so a browser that will not remember the choice still opens the
 * table in the normal palette rather than not opening at all.
 */
let palette: PaletteChoice = readPalette(localStorage);

// `?table=wide-arc` opens another one of the five. There is no menu yet, and a query parameter is
// enough to look at all of them without one.
const requested = new URLSearchParams(location.search).get('table');
/**
 * The times table, carried in the address beside the table for the same reason the table is.
 *
 * ⚠️ BECAUSE CHOOSING A DIFFERENT TABLE RELOADS THE PAGE. `onStart` reloads with `?table=` when the
 * player picks a table other than the booted one — the honest way to rebuild a world this entry point
 * resolves at module scope — and a mission number left behind by that reload would put the player back
 * on the number screen for a drill they had just chosen.
 */
const requestedTimes = Number(new URLSearchParams(location.search).get('times'));
const authored = (requested && tableNamed(requested)) || DEFAULT_TABLE;

// A table that does not validate must not open. The rules are in `table/authored` and every one of
// them is there because this port hit the failure it prevents.
const tableProblems = validateTable(authored, { viewHeight: DEFAULT_CAMERA.viewHeight });
if (tableProblems.length) {
  throw new Error(`[pinball] table "${authored.name}" cannot open:\n  ${tableProblems.join('\n  ')}`);
}

/* ===================== THE BALL ===================== */
//
// The physics is built from the table's declared geometry and stepped here. The ball object the
// physics owns is handed STRAIGHT to the declaration and the renderer — the same object, not a copy —
// which is the same "a view, never a snapshot" rule `shell/boot` follows, at one level down.

/**
 * The player leaning on the ball with the directional. Held state, so it lives here.
 *
 * ⚠️ AND IT IS ONLY WORTH ANYTHING WHILE A DRILL IS RUNNING — see `extraField` below. The Dev asked for
 * it as part of the comet mission: "Com missões de cometa, a bolinha precisa ser mais lenta, e deve ser
 * possível ter um leve controle sobre ela." Leaving the push on a table with no drill would change how
 * every one of the six plays, which is not what was asked and is not this game's to decide.
 */
const thrust: { up: boolean; left: boolean; right: boolean } = {
  up: false, left: false, right: false,
};

const physics = buildPhysics(authored, {
  // Twenty nudges having failed, the ball goes back to the plunger rather than being nudged for ever.
  relaunch: () => { phase = 'title'; },
  /**
   * ⚠️ A FUNCTION READ EVERY FRAME, because both halves change: the drill starts and stops, and the
   * player is holding a key or not. `table/ball-assist` carries the arithmetic and the argument for why
   * slower is drag rather than a speed cap.
   */
  extraField: (moving) => {
    if (!comets) return { drag: 0, thrust: { up: false, left: false, right: false } };
    /**
     * ⚠️ NOTHING SLOWS A BALL CLIMBING THE TUNNEL, and this is the fix for what the Dev reported as a
     * weak plunger: "a bola não consegue sair do túnel."
     *
     * The drill's drag is a force on every ball everywhere, and the plunger lane is the one place with
     * a long climb and nothing to help it — so a proportional drag shows up there first and worst.
     * Measured with the drill on, a full draw climbed 121 of the 160 `low-orbit` needs and 145 of
     * `factory`'s 229: not one table in the catalogue could launch, and since the mission screen
     * shipped a drill is always running.
     *
     * ⚠️ AND THE ANSWER IS NOT A STRONGER PLUNGER, which was tried and measured. See `LAUNCH_MARGIN`:
     * at twice the force five gates go red because the ball enters the play faster and takes different
     * routes, and at one and a half `narrow-tower` STILL cannot launch, because a proportional force
     * costs a tall table disproportionately more. A drill that slows PLAY has no business slowing the
     * LAUNCH, and this is that sentence as an `if`.
     */
    const lane = plungerLaneOf(authored.size);
    const inTheLane = moving.position.x > lane.divider && moving.position.y > lane.dividerTop;
    if (inTheLane) return { drag: 0, thrust };
    /**
     * ⚠️ THE TWO CAPSULES ARE THE SAME KNOB TURNED EITHER WAY, which is why they cancel in
     * `control/power-ups` and why neither adds a force of its own here. `slow` triples the drill's own
     * drag; `fast` lifts it entirely, so the ball keeps the speed the table gave it. A NEGATIVE drag
     * would have been the obvious way to make "faster" and it is an exponential: a force proportional
     * to speed, pointing the way the ball is already going, has no bound at all.
     */
    const drag = powerUps?.isActive('slow') === true ? MISSION_DRAG * 3
      : powerUps?.isActive('fast') === true ? 0
        : MISSION_DRAG;
    return { drag, thrust };
  },
});
const ball = physics.spawnBall();

/**
 * ⚠️ THESE WERE NOUGHT AND EMPTY AND NOTHING EVER WROTE TO THEM, so the contract's fifth field returned
 * no targets on every frame and blind mode was silence over a table full of things to hit. That field
 * is what makes the sonar work, and it is most of the reason this game consumes the engine at all.
 *
 * An authored table has no missions, so the objective is read off the table itself — see
 * `table/objective`, and note that inventing a mission to fill the field would have been worse than the
 * silence it replaced.
 */
/**
 * Every ball on the table: the primary, and whatever `multiball` has added.
 *
 * ⚠️ ONE ARRAY OBJECT FOR THE LIFE OF THE PAGE, mutated rather than replaced. `state.balls` is read by
 * the renderer and by the engine's declaration, and both took this reference at boot — handing them a
 * new array each frame would leave the declaration answering about the ball that was in play when the
 * game started.
 */
const allBalls: typeof ball[] = [ball];

let state: TableState = {
  balls: allBalls,
  // ⚠️ AN i18n KEY, NOT A 1995 RESOURCE ID. `keyOf` maps the STRINGnnn identifiers the original's data
  // uses and returns anything else unchanged, so an authored table's id IS its key. Getting this wrong
  // is not a crash: the translator returns the key it was given, and `STRING151` was once on screen for
  // exactly that reason. A test walks all three languages.
  missionTextId: AUTHORED_OBJECTIVE_ID,
  missionHave: 0,
  missionNeed: 0,
  missionTargets: [],
};

/**
 * Recomputed when a lamp changes, which is the only thing that can finish a target.
 *
 * ⚠️ AND ONCE AT STARTUP, because the declaration is read before the first frame. Without that call the
 * contract answers "no targets, nought of nought" to anything that asks between boot and the first
 * `step` — and a player who turns blind mode on at the title screen is exactly that reader.
 */
/**
 * The table's own campaign, or nothing on a table that declares none.
 *
 * ⚠️ AND `objectiveOf` IS NOT REPLACED BY IT. A table with no missions still needs something for the
 * sonar to point at, which is what that module derives from the `goal` and `key` roles — `bare-minimum`
 * exists to be the floor of the format and will never have a campaign. The two answer the same
 * question for different tables, and which one answers is the table's declaration, not a preference.
 */
const missions = runMissions(authored.missions ?? []);

let lastLit = '';
/** The drop targets that were down when the picture was last composed. See `refreshObjective`. */
let lastDown = '';
/**
 * Where the flare was, to the pixel, when the picture was last composed.
 *
 * ⚠️ THE FOURTH ANSWER TO "WHAT HAS CHANGED", and the comments above it record the first three
 * arriving one at a time, each on the day something started changing that the picture did not follow.
 * This one differs only in how often: the band moves about forty pixels a second, so the table is
 * recomposed about forty times a second on `ion-storm` and not at all on the other five.
 *
 * ⚠️ ROUNDED, AND THE PICTURE IS COMPOSED FROM THE ROUNDED VALUE. Keying on the pixel and drawing
 * from the float would be a picture that is not a function of its own staleness key — the same
 * fraction of a pixel, recomposed or not, giving two different tables.
 */
let lastFlare = -1;
/** The lane depths, as a string, when the picture was last composed. See `refreshObjective`. */
let lastLanes = '';

function refreshObjective(force = false): void {
  // A table with missions is asked about its mission; one without is asked about its roles.
  //
  // ⚠️ THE ACT, NOT THE MISSION. A mission is a sequence now, and "have 1 of 3" is a question about
  // the act on screen — counting the whole mission's targets would show a player progress towards
  // things they have not been asked for yet, and point the sonar at them.
  const stage = missions.stage;
  const objective = stage
    ? {
      targets: missions.remaining,
      have: stage.targets.length - missions.remaining.length,
      need: stage.targets.length,
    }
    : objectiveOf(authored, live);
  /**
   * ⚠️ AND THE LIT LAMPS ARE PART OF WHAT MAKES THE PICTURE STALE.
   *
   * The objective alone was the trigger, so a lamp lighting without changing the objective repainted
   * nothing — and until this commit that did not matter, because the picture never drew lamps. It does
   * now, which turns "what has changed" into a question with two answers.
   */
  const litNow = live.litLamps().join(',');
  /**
   * ⚠️ AND A DROPPED TARGET IS THE THIRD ANSWER TO "WHAT HAS CHANGED".
   *
   * The objective was the first, the lit lamps the second, and each was added the day something
   * started changing that the picture did not follow. A drop target that goes down and is still drawn
   * is a target the ball passes through while the player looks at it — the flippers' defect and the
   * lamps' defect, arriving a third time in the same place.
   */
  /**
   * ⚠️ THE SECRET DOORS, WHICH ARE HIDDEN THE SAME WAY A DROPPED TARGET IS. Both answers to "what is
   * not there right now" go into one list, because the picture and the physics each take one list and
   * the two must agree — `table/cabinet` records what it cost to learn that.
   */
  const hiddenNow = notThere();
  const downNow = hiddenNow.join(',');
  const flareNow = physics.flare ? Math.round(physics.flare.at.y) : -1;
  /**
   * ⚠️ THE FIFTH ANSWER TO "WHAT HAS CHANGED", and the cheapest of the five to get wrong. The depths
   * are quantised to `LANE_SEGMENTS` by `table/lane-progress`, so this string changes a handful of
   * times per trip down a lane; keying on a continuous depth would recompose the whole table on every
   * frame the ball spent in one.
   */
  const lanesNow = Object.entries(laneDepths()).map(([name, depth]) => `${name}=${depth}`).join(',');
  if (!force && objective.have === state.missionHave
    && objective.targets.length === state.missionTargets.length
    && litNow === lastLit && downNow === lastDown && flareNow === lastFlare
    && lanesNow === lastLanes) {
    return;
  }
  lastLit = litNow;
  lastDown = downNow;
  lastFlare = flareNow;
  lastLanes = lanesNow;
  // The physics has to agree with the picture, and this is the line that makes it: a target that is
  // not drawn is not a wall either.
  for (const component of authored.components) {
    if (component.bank === undefined && !component.secret) continue;
    physics.setComponentActive(component.name, !hiddenNow.includes(component.name));
  }
  state = {
    ...state,
    missionTextId: missions.stage?.id ?? AUTHORED_OBJECTIVE_ID,
    missionHave: objective.have,
    missionNeed: objective.need,
    missionTargets: objective.targets,
  };
  composePicture();
}

/**
 * ⚠️ THE ONE PLACE THE TABLE IS DRAWN, AND THERE WERE FOUR.
 *
 * `drawTable` grew an option every time something started changing that the picture had to follow —
 * the mission's targets, the lit lamps, the dropped targets, the flare's position, the lane lights,
 * the open secret doors, and now the table's own artwork. Seven arguments, and only ONE of the four
 * call sites in this file had learnt all of them.
 *
 * ⚠️ SO SWITCHING THE PALETTE WIPED THE TABLE. The colour menu recomposed with three arguments, which
 * put back a table with no lamps lit, its dropped targets standing again, its secret passage sealed,
 * its lane lights out and its storm frozen at the top — until the next thing happened to repaint it.
 * On `ion-storm` that is a fortieth of a second, because the flare moves; on `long-climb` it is never.
 *
 * That is how the artwork was found not to appear at all: the boot sequence recomposed through one of
 * the short call sites AFTER the picture had been painted, and the art was thrown away without a
 * trace. `tests/shell-boot` now holds this file to exactly one `drawTable` call.
 */
function composePicture(): void {
  tablePicture = drawTable({
    table: authored,
    missionTargets: state.missionTargets,
    litLamps: live.litLamps(),
    cbSafe: isCbSafe(palette),
    hidden: notThere(),
    laneDepth: laneDepths(),
    ...(backdrop ? { backdrop } : {}),
    // Absent on a table with no storm, which is what leaves the other five composed as they were.
    ...(physics.flare ? { flareAt: Math.round(physics.flare.at.y) } : {}),
  });
}

/**
 * Launches from the plunger. Up the table, which is toward y = 0.
 *
 * ⚠️ THIS SAID 260, AND 260 IS THE NUMBER THE PLAYABILITY TEST WAS WRITTEN TO KILL. A ball at speed v
 * against gravity g rises v² / 2g: 260 against 120 is 282 pixels, enough for this table's 235 and 75
 * short of `narrow-tower`'s 420. `launchSpeedFor` was added for exactly that and the test used it — and
 * this line, the only launch a PLAYER ever performs, went on using the constant. The gate was green and
 * the game was broken, which is the worst arrangement of the two.
 */
/**
 * ⚠️ THE SPEED IS AN ARGUMENT NOW, BECAUSE THE PLUNGER DECIDES IT.
 *
 * It used to be `launchSpeedFor(authored)` every time: every launch identical, and no way to place a
 * ball anywhere but as hard as the table allows. The Dev, playing: "não permitindo controlar a força
 * com que a bolinha será lançada". A full draw is still exactly that speed — the weaker ones are the
 * new part.
 */
function launch(speed = launchSpeedFor(authored)): void {
  // ⚠️ A FINISHED GAME DOES NOT GET ANOTHER BALL. Without this the plunger key restarts play from a
  // game-over screen, and the count stays at zero while the ball goes round again.
  if (live.flags.ballCount === 0) return;
  ball.active = true;
  ball.direction = { x: 0, y: -1 };
  ball.speed = speed;
  phase = 'playing';
  announceMission();
}

/**
 * The authored tables' plunger.
 *
 * ⚠️ ONE PER GAME AND NOT ONE PER TABLE, because `main.ts` boots a single table — the reload seam. Its
 * full-draw speed is that table's, so a taller table still gets a launch that can reach its top.
 */
const plunger = createPlunger({ maxSpeed: launchSpeedFor(authored) });

/**
 * Puts the running mission where a player can read it.
 *
 * ⚠️ WITHOUT THIS A SIGHTED PLAYER NEVER SAW THE FIRST ONE. `missionTextId` reaches the engine's
 * declaration, so blind mode could speak it — and the HUD has no mission block, so the only time the
 * text appeared on screen was the moment one was COMPLETED, when the hint was set to the next. The
 * first mission of every game went unannounced, and a lost ball or a pause overwrote whatever was
 * there.
 *
 * The hint block is the right home: it is where the HUD already puts what the player should do next,
 * and ADR-0002 gave it four lines for exactly this kind of sentence.
 *
 * A table with no missions says nothing rather than something empty — `bare-minimum` has none by
 * design, and "objective: " with a blank after it is worse than a quiet HUD.
 */
function announceMission(): void {
  const stage = missions.stage;
  if (!stage) return;
  hint = shell.t(stage.id);
}

/**
 * The part of the table a comet may be in: what the player can actually see.
 *
 * ⚠️ THE VIEW AND NOT THE WHOLE TABLE, and that is a playability decision rather than an optimisation.
 * A comet spawned at the top of a 300-pixel table falls ninety pixels in its ten seconds and expires
 * while the ball is still two hundred below it — the player would watch numbers they can never reach.
 * Entering at the top of the CAMERA'S window means every comet falls through the ball's own stretch of
 * the table, which is what "caindo do céu" means from where the player is sitting.
 */
function cometSky(): CometSky {
  return {
    left: 0,
    right: authored.size.width,
    top: shell.camera.offset,
    bottom: shell.camera.offset + shell.hud.playfield.height,
  };
}

/**
 * The four things every deliberate end of a game does, wired once.
 *
 * ⚠️ ONE OBJECT AND NOT THREE COPIES, and the reason is that the third copy was untested. A game ends
 * three ways — the last ball drains, the player chooses "Encerrar partida", or the comet drill reaches
 * twenty — and the third was written out here where nothing could drive it. `shell/end-of-game` carries
 * the sequence and `tests/shell-end-of-game` calls it; what is left at each site is one line naming it.
 *
 * The drained last ball is NOT one of these. It offers the board and stays on the table: the game is
 * over and the player is still looking at it, with "Fim de jogo" in the corner. That is a different
 * ending and forcing it through here would mean sending them to the title screen mid-drain.
 */
const endOfGame: EndOfGameOptions = {
  offer: (score) => highScores.offer(score),
  leave: () => leaveGame(),
  toTitle: () => { screens.show('title'); title.refresh(); },
  /**
   * ⚠️ `#sr-alert` AND NOT `#sr-status`. The end of a game is the one thing on this screen that
   * interrupts: `aria-live="assertive"` is what says so, and a polite announcement would queue behind
   * whatever the last comet or the last bumper had to say.
   */
  announce: (words) => {
    const alert = document.getElementById('sr-alert');
    if (alert) alert.textContent = words;
  },
};

/**
 * What a comet strike says, and to whom.
 *
 * ⚠️ THE LIVE REGION AND NOT THE HINT BLOCK, which is the split `shell/hud-dom` already argues. A
 * sighted player has just watched a comet burst and the counter in the corner change — saying it again
 * in words would be the screen repeating itself. A player who cannot see either needs the sentence, and
 * needs it as an EVENT, which is what `#sr-status` is.
 *
 * ⚠️ AND THE DECISION IS NOT HERE. Which sentence, with which numbers, and whether this was the
 * twentieth point are `control/comet-mission`'s `reportOf` — because `main.ts` cannot be imported by a
 * node test and four lines of judgement written here would be four lines nothing checks. This function
 * is the adapter: it says the words out loud and ends the game when it is told to.
 */
/**
 * What catching a capsule does.
 *
 * ⚠️ THE TIMED ONES DO NOTHING HERE, and that is not an omission. `slow`, `fast` and `clear` are STATES:
 * `control/power-ups` is already counting them down, and the two places that care ask it — the physics
 * through `extraField`, and the comet strike through `wrongHidden`. Reaching in to change something now
 * would be a second copy of a fact that already has an owner.
 *
 * `multiball` is the one that is an EVENT, so it is the only one with a body.
 */
function takePowerUp(kind: PowerUpKind, at: typeof ball): void {
  const status = document.getElementById('sr-status');
  if (status) status.textContent = shell.t(`pinball.powerUp.${kind}`);
  if (kind !== 'multiball') return;

  /**
   * ⚠️ THEY ARE BORN WHERE THE CAPSULE WAS CAUGHT AND FANNED OUT, rather than at the plunger. A ball
   * that appears at the bottom of the table is a ball the player did not earn and cannot use; two that
   * appear beside the one they just caught it with are the shot they took, three times over.
   */
  for (let i = 0; i < MULTIBALL_EXTRA; i++) {
    const extra = physics.spawnBall();
    extra.position = { x: at.position.x, y: at.position.y };
    const spread = (i === 0 ? -0.5 : 0.5);
    const length = Math.hypot(at.direction.x + spread, at.direction.y);
    extra.direction = {
      x: (at.direction.x + spread) / (length || 1),
      y: at.direction.y / (length || 1),
    };
    /**
     * ⚠️ NOT A NUMBER TYPED HERE, and `tests/table-playable` is what says so: "the entry point never
     * hard-codes a launch speed." A ball caught at rest — the capsule taken while the primary is
     * trickling — would otherwise spawn two balls that sit where they were born, so there is a floor,
     * and the floor is a fraction of the table's OWN launch speed rather than a constant that happens
     * to suit `low-orbit`.
     */
    extra.speed = Math.max(at.speed, launchSpeedFor(authored) * 0.25);
    extra.active = true;
    extraBalls.push(extra);
    allBalls.push(extra);
  }
}

function reportComet(struck: CometStrike): void {
  const drill = comets;
  if (!drill) return;
  const report = reportOf(struck, drill.number);
  const status = document.getElementById('sr-status');
  if (status) status.textContent = shell.t(report.key, report.params);
  if (!report.ended) return;

  // ⚠️ "O jogador ganha o jogo ao completar 20 pontos de missão." — so the GAME ends, not just the
  // drill. It ends the way Quit does, because the score is final and the board is owed it.
  endGame(endOfGame, live.score.curScore,
    shell.t('pinball.comets.won', { need: WINNING_POINTS, times: drill.number }));
}

const authoredTable = toLiveTable(authored, () => state);

/**
 * ⚠️ THE DECLARATION FOLLOWS WHAT IS ON SCREEN, and until now it could not.
 *
 * `bootPinball` reads the table once, at boot, and the demonstration arrives later — the player has to
 * hand over their own archive first. So with the 1995 table showing, every accessibility question was
 * answered about the AUTHORED table: the sonar's targets, the guide's focus, the name and role under a
 * point. Blind mode was refused rather than allowed to answer wrongly.
 *
 * This is a view over BOTH, and the switch is which one exists. Every field is a getter, which is the
 * same rule `createPinballWorld` follows one level down: a snapshot taken at boot would answer about
 * the first frame for ever, and here it would answer about the wrong table for ever.
 */
let demoView: ReturnType<typeof demoWorld> | null = null;
const table: LiveTable = {
  get playfieldWidth() { return (demoView ?? authoredTable).playfieldWidth; },
  get playfieldHeight() { return (demoView ?? authoredTable).playfieldHeight; },
  get ballRadius() { return (demoView ?? authoredTable).ballRadius; },
  get balls() { return (demoView ?? authoredTable).balls; },
  get components() { return (demoView ?? authoredTable).components; },
  kindOfComponent: (name) => (demoView ?? authoredTable).kindOfComponent?.(name) ?? null,
  get missionTextId() { return (demoView ?? authoredTable).missionTextId; },
  get missionHave() { return (demoView ?? authoredTable).missionHave; },
  get missionNeed() { return (demoView ?? authoredTable).missionNeed; },
  get missionTargets() { return (demoView ?? authoredTable).missionTargets; },
};

let phase: Phase = 'title';

/**
 * The comet drill, once the player has picked a number. `null` until then, and in the demonstration.
 *
 * ⚠️ THE DEV'S FOURTH ITEM, and the biggest: "Após escolher a tela, a próxima tela é a da missão
 * principal. o jogador deve escolher um número de 2 a 9. Uma vez escolhido o número, aparecerá na fase
 * cometas caindo do céu com um número dentro." The rules are `control/comet-mission`, the drawing is
 * `gfx/comet-view`, and what is left here is the wiring: seconds in, the ball's position in, points and
 * a picture out.
 */
let comets: CometMission | null = null;

/**
 * The capsules, which exist only while a drill does.
 *
 * ⚠️ THE DEV: "O jogo deve ter itens comuns no arkanoid: triplicar a quantidade de bolinhas (só perde
 * quando a última bolinha cair), bolinha mais lenta, bolinha mais rápida... sumir com os cometas
 * errados por 5s." They fall out of burst comets, so they belong to the drill and go with it — a
 * capsule on a table with no comets is a bonus for a game nobody is playing.
 */
let powerUps: PowerUpField | null = null;

/**
 * The extra balls a `multiball` capsule puts on the table.
 *
 * ⚠️ SEPARATE FROM `ball`, AND THAT IS DELIBERATE RATHER THAN LAZY. Every part of this file is written
 * around ONE ball — the camera follows it, the sonar reports it, the stuck watch checks it, the drain
 * ends the ball on it. Making the primary one of a list would mean answering "which one" at each of
 * those, four times, for a bonus that is on screen for a few seconds at a time.
 *
 * So the primary stays the primary and these ride alongside. When the primary drains while one of
 * these is still up, the primary ADOPTS it — takes its position and speed and carries on — which is
 * the Dev's rule ("só perde quando a última bolinha cair") with no second answer to "which ball is the
 * one the camera is for".
 */
const extraBalls: typeof ball[] = [];

/**
 * What pausing interrupted, so that resuming can put it back.
 *
 * ⚠️ WITHOUT THIS, MAKING PAUSE WORK BEFORE THE LAUNCH BREAKS THE LAUNCH. `phase` is `'title'` in
 * three ordinary places — before the first ball, between balls, and after the last one — and the
 * plunger is guarded by `if (phase !== 'playing')`. A game resumed unconditionally into `'playing'`
 * with the ball still sitting on the plunger refuses the plunger key from then on, which is a worse
 * dead key than the one being fixed.
 */
let resumeTo: Phase = 'playing';

/**
 * ⚠️ BLIND MODE HAD NO SWITCH. `createGame` reads it through a callback the game owns and `main.ts`
 * supplied none, so the engine's default `() => false` stood and the audio guide never fired — two
 * commits after the contract's target list was filled in for that guide to use.
 */
let blind = false;

/**
 * ⚠️ ONE OBJECT, REUSED. `audio-sonar.updateGuide` counts frames on `guideT`, a field it writes onto
 * this object, and pings when it reaches 48. A fresh object each call resets the counter every frame and
 * the guide never fires at all.
 */
const sonarPlayer = { i: 0, x: 0, y: 0, viz: 'normal' as const, guideT: 0 };

/**
 * Says, through the host's own live region, that the accessibility layer has nothing to describe here.
 * The same channel the blind-mode announcement uses — an EVENT belongs in the live region, while the
 * HUD blocks are readable on request and deliberately not live. See `shell/hud-dom`.
 */
function sayUnavailable(): void {
  const status = document.getElementById('sr-status');
  if (status) status.textContent = shell.t('pinball.a11y.unavailableInDemo');
}

const shell = bootPinball({
  locale: 'pt',
  table,
  /**
   * ⚠️ THE TABLE'S OWN HEIGHT, AND WITHOUT THIS EVERY TALL TABLE LOSES ITS BOTTOM.
   *
   * `DEFAULT_CAMERA.worldHeight` is 235 — `low-orbit`'s height, and correct for exactly one table. It
   * was never overridden, so the camera's travel was 235 - 180 = 55 on every table, and everything
   * below that line was unreachable by the view:
   *
   *     ring-belt 240 → 5 rows lost      ion-storm 250 → 15
   *     slipstream 245 → 10              crater-run 260 → 25
   *                                      long-climb 300 → 65
   *
   * The Dev found it by playing: "crater run está sendo cortada na parte de baixo (mal dá pra
   * enxergar as pás), long climb está mais coartada ainda". The flippers and the drain sat below the
   * furthest the camera could scroll, so the bottom of the table — the part a pinball player reads the
   * ball's line off — was never on screen.
   *
   * With the real height the maximum offset is `height - viewHeight`, which puts the LAST row of the
   * table on the LAST row of the view: the base is aligned with the base, which is what was asked for.
   */
  camera: { ...DEFAULT_CAMERA, worldHeight: authored.size.height },
  // `cvdHost` is where the engine mounts its six colour-vision filters. Omitting it is not an error —
  // `createGame` reports it in `problems` instead of throwing — which is exactly how it went unnoticed
  // until the game was actually booted.
  host: { doc: document, win: window, cvdHost: document.getElementById('cvd-filters') },
  isBlindMode: () => blind,
  sonarPlayers: () => [sonarPlayer],
}, createGame);

// What the host document failed to provide. Empty is the good case; the engine does not throw for it,
// so somebody has to look.
if (shell.problems.length) {
  console.warn('[pinball] host markup incomplete:', shell.problems.join(', '));
}

/* ===================== THE PICTURE ===================== */
//
// The screen is a 320x180 framebuffer put on a canvas with nearest-neighbour scaling. The TABLE is
// drawn once, at its own size, and the camera copies a window of it every frame — see `gfx/table-view`
// for why that is a window rather than a transform.

const screen = createFramebuffer(DEFAULT_HUD.screenWidth, DEFAULT_HUD.screenHeight);
const canvas = document.createElement('canvas');
canvas.width = screen.width;
canvas.height = screen.height;
canvas.style.imageRendering = 'pixelated';
// ⚠️ NOT `width: 100%`, WHICH IS WHAT IT WAS AND WHAT THE DEV CAUGHT. Stretching a 320x180 buffer to
// whatever the page offers gave a scale of 1.4688 in the running game: with `pixelated` that makes some
// source pixels one screen pixel wide and others two, so the grid goes uneven, a one-pixel highlight
// vanishes in one place and doubles in another, and the ball changes size as it crosses the table.
canvas.style.display = 'block';
canvas.style.margin = '0 auto';
const region = document.getElementById('game-region')!;
// ⚠️ RELATIVE, because the HUD's four blocks are absolutely positioned INSIDE it. Without this they
// would be placed against the page and land wherever the document happens to put them.
region.style.position = 'relative';

/**
 * Sizes the canvas at a WHOLE multiple of its buffer, and again whenever the window changes.
 *
 * ⚠️ THE PARENT IS MEASURED, NOT THE WINDOW. `#game-region` is what the page gives the game, and a page
 * that puts the game in a column would otherwise get a canvas sized for the whole viewport and a
 * horizontal scrollbar. `clientWidth` is zero before layout, which `integerScale` answers with 1 rather
 * than with a canvas of no size.
 */
function fitCanvas(): void {
  const parent = region.parentElement ?? region;
  const times = integerScale(
    { width: parent.clientWidth, height: window.innerHeight },
    { width: screen.width, height: screen.height },
  );
  canvas.style.width = `${screen.width * times}px`;
  canvas.style.height = `${screen.height * times}px`;
  region.style.width = `${screen.width * times}px`;
  region.style.height = `${screen.height * times}px`;
  region.style.margin = '0 auto';
}
region.appendChild(canvas);
fitCanvas();
window.addEventListener('resize', fitCanvas);

/**
 * ⚠️ THE KEYBOARD DIES WHEN THE PLAYER CLICKS THE PAGE, AND THIS IS WHAT STOPS IT.
 *
 * The Dev: "o START não funciona para pausar e abrir o menu AINDA." Measured in the running game:
 * press START with the region focused and the phase changes; click anywhere on the page first — the
 * area around the game — and `document.activeElement` is `BODY`, and START does nothing at all. No
 * error, no warning. Every key stops working and stays stopped until the player happens to click the
 * canvas again.
 *
 * `bindPinballControls` binds to `#game-region` and never to `window`. That is the engine's own rule
 * and the right one — a game that listens on the whole document steals keys from the page around it —
 * and `CLAUDE.md` records the first time this bit, when nothing focused the region at all: "every key
 * did nothing until the player happened to click the canvas". Focusing it when a table starts fixed
 * that day's version and nothing kept the focus there afterwards.
 *
 * ⚠️ AND A POINTER INSIDE THE GAME IS LEFT ALONE, which is the whole difficulty. The pause menu, the
 * score alphabet and the three dialogs are real `<button>`s that take the focus when clicked, and a
 * rule that dragged it back to the region would break every one of them — the alphabet most of all,
 * where the focus IS the cursor.
 *
 * `pointerdown` rather than `click`, because the focus moves on the down and a `click` handler would
 * be arguing with it after the fact.
 */
document.addEventListener('pointerdown', (event) => {
  /**
   * ⚠️ THE TEST IS "IS THIS A CONTROL", NOT "IS THIS INSIDE THE GAME", AND THAT DISTINCTION IS THE
   * FOURTH REPORT OF THIS DEFECT. It read `region.contains(target)` and left everything inside alone
   * — and THE CANVAS IS INSIDE AND IS NOT FOCUSABLE. So clicking the game, which is the first and
   * commonest thing a player does, matched "inside", was left alone, and left the focus on `body`
   * with every key dead.
   *
   * It never showed here because Chromium had already put the focus on the region at load. A page may
   * not rely on that, and the Dev's own browsers do not: "Pausa ainda não funciona fora daqui, testei
   * no Brave e no Firefox."
   *
   * What must keep its focus is a CONTROL — the pause menu's entries, the alphabet's letters, the
   * dialogs' choices, where the focus IS the cursor. Everything else on the page, canvas included,
   * hands the keyboard back to the game.
   */
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')) return;
  region.focus();
});
const context = canvas.getContext('2d')!;
const image = context.createImageData(screen.width, screen.height);

/**
 * Redrawn when what it shows changes: the mission's targets, the palette, or which lamps are lit.
 *
 * ⚠️ NO LAMPS HERE, AND NOT BECAUSE THEY ARE FORGOTTEN. This runs before `live` exists — the control
 * layer is built from the table below — and at boot nothing is lit anyway. `refreshObjective` composes
 * it again with the real set before the first frame.
 */
/**
 * ⚠️ BORN EMPTY AND FILLED BY `composePicture` AT BOOT, because this ran before `live` and `physics`
 * existed and could therefore only ever be one of the short compositions the comment on
 * `composePicture` is about. An empty framebuffer that is never seen is honest; a partial table that
 * is never seen is a fifth call site waiting to be forgotten.
 */
let tablePicture = createFramebuffer(authored.size.width, authored.size.height);

// `update(dt)` counts FRAMES, not seconds — see `shell/boot`. The engine hands the count through and
// the camera's damping is per frame, so this passes it on untouched.
/**
 * ⚠️ THIS COMMENT USED TO SAY "what a control layer WOULD dispatch", and that was the whole defect.
 *
 * The control layer was ported in full in phases 4 and 5 and reached from nothing: the hits went into
 * this array and stopped there. No score, no lamp, in a game that had been playable for commits. The
 * list stays because a check needs to see what was touched; the dispatch below is the part that was
 * missing, and it is two lines.
 */
const hits: string[] = [];

/**
 * ⚠️ THE AUDIO CONTEXT IS BUILT LAZILY, BECAUSE A BROWSER REFUSES TO START ONE WITHOUT A GESTURE.
 *
 * Constructing it at load leaves it `suspended`, and every sound before the first key press is silently
 * dropped — silently being the word: nothing errors and nothing plays. So it is created on the first
 * sound after the player has touched something, and resumed if the browser suspended it anyway.
 */
/** Every voice the mixer has sent to the output. Exposed so a check can see sound happen. */
const voicesPlayed: string[] = [];
let audio: AudioContext | null = null;
let audioOutput: ((voice: import('./audio/sfx.js').Voice) => void) | null = null;

function ensureAudio(): void {
  // ⚠️ THE ENGINE HAS ITS OWN AUDIO CONTEXT AND IT ALSO NEEDS THE GESTURE. `audio-sonar.updateGuide`
  // returns immediately when `getAudioCtx()` is null, and the engine only builds one when something
  // calls `ensureAC` — so blind mode toggled on, the sweep answered, and the automatic guide stayed
  // silent through two hundred frames. Nothing errored; it simply never fired.
  //
  // `platform/*.js` is a declared export of the package, so this is a published API rather than a reach
  // past the facade. It is still coupling to a moving target, which the plan lists as a known risk.
  ensureAC();

  if (audio) {
    if (audio.state === 'suspended') void audio.resume();
    return;
  }
  const Ctor = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctor) return;
  audio = new Ctor();
  audioOutput = createWebAudioOutput(audio);
}

/**
 * ⚠️ THE MIXER AND THE VOICES SHARE ONE LIST. `sfx.play` returns a duration whether or not anything is
 * audible and the control layer schedules on the answer, so a board built from a different list would
 * time the game against sounds that do not exist.
 */
const board = createSoundBoard({
  sounds: soundEntriesOf(),
  channels: 8,
  now: () => performance.now() / 1000,
  output: (voice) => {
    voicesPlayed.push(voice.name);
    audioOutput?.(voice);
    // ⚠️ THE MIXER DOES NOT POLL: a channel is held until the HOST says the sound ended, and a channel
    // never released is a channel the eighth sound steals from the ninth for the rest of the game.
    const duration = VOICES[voice.name]?.duration ?? 0;
    setTimeout(() => releaseVoice(board, voice.channel), duration * 1000);
  },
});

/**
 * How far down each lane the ball has been on this ball, which is what lights them.
 *
 * ⚠️ NOT A LAMP, AND THAT IS THE POINT. `laneControl` lights every lamp a lane declares the moment the
 * ball touches it, and `table/objective` reads lamps to decide what is finished — so a lane declaring
 * four would come on all at once AND tell the sonar it was three-quarters done. See
 * `table/lane-progress`. This is a position test the loop owns, beside `drainedBy` and
 * `inPlungerLane`.
 */
const laneProgress = createLaneProgress(authored);

/**
 * The table's own picture, once it has been fetched and decoded.
 *
 * ⚠️ LATE, AND ON PURPOSE. The game boots synchronously — a table, a ball and working flippers in the
 * first frame — so the picture arrives after and the composition is redone when it does. A decode that
 * fails leaves `undefined` here and a table drawn in the world's colour bands, which is a table that
 * plays. See `gfx/backdrop`.
 */
let backdrop: Uint32Array | undefined;

/**
 * Everything that is not there right now, by component name.
 *
 * ⚠️ TWO ANSWERS AND ONE LIST. A drop target that has gone down, and a secret door that has opened —
 * different mechanisms on different clocks, and the picture and the physics each take the whole list,
 * because `table/cabinet` records what it cost to learn that those two must agree. Written once
 * because the alternative is two expressions that start identical and drift, which is what put four
 * `drawTable` calls in this file.
 */
function notThere(): string[] {
  return [...live.downTargets(), ...openSecrets(authored, ballsLost)];
}

/** The depths in the shape the renderer and the staleness check both want. */
function laneDepths(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const component of authored.components) {
    if (component.kind === 'lane') out[component.name] = laneProgress.depthOf(component.name);
  }
  return out;
}

const live = createLiveControls(authored, {
  showInfo: (text) => { hint = text; },
  showMission: (text) => { hint = text; },
  playSound: (name, source) => {
    ensureAudio();
    board.play(name, source);
  },
});
let hint = '';

/**
 * ⚠️ THE COMPONENTS THE BALL CROSSES RATHER THAN STRIKES. The physics only reports EDGES, so seven
 * components across the catalogue — lanes, wells, a kicker, three landings — were painted, scored and
 * lamped and said nothing when the ball went through them. See `table/rollovers`.
 */
const rollovers = createRolloverWatch(authored);
let frameCount = 0;
let ballsLost = 0;
let lastFrames = 0;
let previous = performance.now();
/**
 * ⚠️ ONE FRAME, CALLABLE. The loop below drives it, and so can a test.
 *
 * Splitting it out is not tidiness. A browser pauses `requestAnimationFrame` when its tab is not
 * compositing — which is exactly what a headless check does — and a game whose only way forward is
 * that callback cannot be verified at all: the first attempt to watch the ball move reported zero
 * frames in six hundred milliseconds, and the code was fine. A loop that can be stepped by hand is a
 * loop that can be proved.
 */
function step(frames: number): void {
  frameCount++;
  lastFrames = frames;

  // The demonstration has its own table, its own physics context and its own picture. It shares the
  // canvas and nothing else, which is why it is an early return rather than a branch through the whole
  // frame: an authored table's HUD, objective and controls mean nothing here.
  if (demoRequested) {
    if (demo) {
      demo.step(frames);
      // ⚠️ AND THE GUIDE FOLLOWS THIS BALL. `sonarPlayer` is the position the engine pings from, and in
      // the demonstration's early return nothing had ever moved it: the guide pointed from wherever the
      // authored table left it at boot.
      const at = demo.ballOnScreen();
      sonarPlayer.x = at.x;
      sonarPlayer.y = at.y;
      shell.engine.sonar.updateGuide();
      topUpMusic();
      demoPage!.blit(demo);
      paint();
      // The 1995 score and ball count in ADR-0002's corners. ⚠️ THE BALL COUNT USED TO BE A LITERAL
      // ONE, with a comment saying nothing here could lose a ball — true until the drain was wired,
      // and the kind of stale comment that keeps a screen wrong long after the code is right.
      //
      // ⚠️ AND THE FOOTER CARRIES THE TABLE'S OWN WORDS NOW. It was empty with a comment saying the
      // mission machine does not run here — true when it was written, false for a while: all
      // twenty-three missions run. `hintFor` picks between the table's two text boxes.
      hud.update({
        score: demo.score.curScore,
        ballCount: demo.ballsLeft,
        playerNumber: 1,
        hint: hintFor(demo, shell.t('pinball.demo.gameOver')),
      });
    }
    return;
  }

  /**
   * ⚠️ THE PAD AND THE PLUNGER RUN WHETHER OR NOT A BALL IS IN PLAY, and both were inside the branch
   * that only runs while playing — which is the one phase in which neither can do anything.
   *
   * The plunger is drawn back BEFORE a launch, so a charge that only accumulated during play was a
   * charge that never accumulated at all: every ball left at the minimum, however long the key was
   * held. The Dev asked for a launcher whose force a player controls, and the model was right, the
   * wiring was right, and the one line that advances it was in the wrong block.
   *
   * The pad had the same fault for a different reason: a player pressing a button on the title screen
   * was not heard, so a controller could not start a game.
   *
   * ⚠️ AND IT IS THE SAME MISTAKE THE COMMENT BELOW RECORDS ABOUT THE FLIPPERS, made again three
   * paragraphs above it.
   */
  pad.poll();
  plunger.advance(frames * FRAME_SECONDS);
  /**
   * ⚠️ AND THE TRAVELLING BODIES MOVE WHETHER OR NOT A BALL IS IN PLAY, which is why they are here and
   * not in the playing-only block below. A drone that stopped between balls would be a table holding
   * its breath while the player reads the score — and it is the same reasoning that moved the
   * flippers' own step out of that branch, after a player pressing a button on the title screen got
   * nothing back at all.
   */
  for (const { mover } of physics.movers) mover.advance(frames * FRAME_SECONDS);
  // ⚠️ AND THE FLARE, for the same reason and one more: it is the BACKGROUND. A storm that stopped
  // between balls would be a sky frozen mid-sweep while the player reads the score.
  physics.flare?.advance(frames * FRAME_SECONDS);
  /**
   * ⚠️ AND THE PICTURE FOLLOWS IT, HERE RATHER THAN IN THE PLAYING BRANCH. The flare is the
   * BACKGROUND: a storm that only moved while a ball was in play would freeze mid-sweep the moment
   * one drained, with the player looking straight at it. `refreshObjective` is a no-op when nothing
   * has changed, and on a table with no flare nothing here has.
   */
  if (physics.flare) refreshObjective();

  // ⚠️ THE FLIPPERS MOVE WHETHER OR NOT A BALL IS IN PLAY, and this used to run only while playing.
  // A player pressing the button on the title screen got nothing back — no movement, no sound, no way
  // to find out what the controls are before committing a ball to them. Found by pressing a real key
  // in the browser and watching the angle stay at zero while the motion said `extending`.
  //
  // The BALL is what depends on the phase. `advanceFrame` takes an empty list and steps the flippers
  // alone, which is the same path a test uses.
  {
    // ⚠️ The physics wants TIME, not a frame count — see `FRAME_SECONDS`. The camera wants frames.
    // They are two different units in the same loop and mixing them is silent in both directions.
    /**
     * ⚠️ EVERY BALL, WHICH UNTIL `multiball` WAS ALWAYS EXACTLY ONE. `advanceFrame` has taken a list
     * since the physics was ported — the 1995 table has multiball too — so this is the list finally
     * having more than one thing in it rather than a new capability.
     */
    advanceFrame(phase === 'playing' ? allBalls : [], physics.context, frames * FRAME_SECONDS);
    for (const hit of physics.takeHits()) {
      hits.push(hit.name);
      live.hit(hit.name);
      // ⚠️ THE MISSION IS TOLD BEFORE THE OBJECTIVE IS REFRESHED, so the hit that finishes one shows
      // the NEXT mission's targets rather than an empty list for a frame. The award is paid through
      // the same score state every other point goes through.
      const progress = missions.hit(hit.name);
      if (progress.completed) {
        addScore(live.score, progress.award);
        // The same announcement the launch makes, so a mission is described one way and not two.
        announceMission();
      }
    }
    // ⚠️ AND THE LANES LIGHT UP BEHIND IT. The Dev: "deve haver luzes que vão acendendo conforme ela
    // sai da pista lateral." Polled here for the same reason the rollovers below are: nothing
    // collides with a lane, so being in one is a question about a position and only the loop can ask.
    if (phase === 'playing') laneProgress.advance(ball.position);
    // Crossings are polled rather than reported, because nothing collides to report them.
    if (phase === 'playing') {
      for (const name of rollovers.poll(ball)) {
        hits.push(name);
        live.hit(name);
        /**
         * ⚠️ AND THE MISSIONS, WHICH THIS LINE DID NOT TELL FOR AS LONG AS THERE HAVE BEEN MISSIONS.
         *
         * Half of what an authored table offers is regions the ball rolls OVER, and nothing collides
         * to report one — that is why `table/rollovers` polls. The crossings went into the score and
         * stopped there. `low-orbit`'s third mission names three LANES, so it could never be
         * completed and the campaign stopped at it for the rest of the game: the mission stayed on
         * screen and the sonar went on pointing at three lanes the player kept crossing.
         *
         * The collision path four blocks up has always done this. One of the two ways a component can
         * be hit was wired and the other was not, which is the shape of half the defects in this port.
         */
        const crossed = missions.hit(name);
        if (crossed.completed) {
          addScore(live.score, crossed.award);
          announceMission();
        }
      }
    }
    /**
     * ⚠️ THE COMET DRILL, STEPPED AND STRUCK IN THE SAME BREATH, and only while a ball is in play.
     *
     * Between balls the sky would go on filling and emptying with nothing able to reach it, so a
     * player watching their last ball drain would lose ten seconds of comets they never had a shot at.
     * The flippers and the movers deliberately keep going without a ball — they are the table being
     * alive — but a comet is a TARGET, and a target nobody can hit is a countdown against the player.
     *
     * ⚠️ AND THE STRIKE IS POLLED, not reported. Nothing collides with a comet: `control/comet-mission`
     * records the decision — making one a physics body would put mass into the core this port exists to
     * keep faithful, and would change how every table plays the moment a mission is on. So the question
     * "is the ball inside one" is asked here, the way `table/rollovers` asks about lanes.
     */
    if (comets && phase === 'playing') {
      const sky = cometSky();
      const seconds = frames * FRAME_SECONDS;
      comets.advance(seconds, sky);
      powerUps?.advance(seconds, sky);

      /**
       * ⚠️ EVERY BALL STRIKES, NOT JUST THE PRIMARY. A multiball whose extra balls pass through the
       * comets would be three balls on the table and one of them playing the game.
       */
      const hidden = powerUps?.isActive('clear') === true;
      for (const one of allBalls) {
        const struck = comets.strike(one.position.x, one.position.y, authored.ballRadius,
          { wrongHidden: hidden });
        if (struck) reportComet(struck);
        const caught = powerUps?.take(one.position.x, one.position.y, authored.ballRadius);
        if (caught) takePowerUp(caught, one);
      }
    }

    live.advance(frames * FRAME_SECONDS);
    refreshObjective();

    // ⚠️ IN MILLISECONDS. `STUCK_IDLE_TICKS` is 500 and the original's `time_ticks` is the SDL clock, so
    // half a second of stillness is the bar. Feeding frames would make it eight seconds.
    physics.stuck.check(ball, frameCount * (1000 / 60));
  }

  {
    // The sonar's guide follows the BALL, which is what `focusOf` answers and what a player listening
    // rather than looking is trying to find their way around.
    sonarPlayer.x = ball.position.x;
    sonarPlayer.y = ball.position.y;
    shell.engine.sonar.updateGuide();
  }

  if (phase === 'playing') {
    // The drain is a POSITION, not a collision — see `drainedBy`. Without this the ball leaves the
    // table and is simulated forever, which is what the first run did.
    /**
     * ⚠️ AN EXTRA BALL DRAINING COSTS NOTHING, which is the Dev's rule: "só perde quando a última
     * bolinha cair." They go quietly, and only the primary can end a ball.
     */
    for (let i = extraBalls.length - 1; i >= 0; i--) {
      const extra = extraBalls[i]!;
      if (!drainedBy(authored, extra)) continue;
      extraBalls.splice(i, 1);
      allBalls.splice(allBalls.indexOf(extra), 1);
    }

    const drained = drainedBy(authored, ball);
    /**
     * ⚠️ AND WHEN THE PRIMARY DRAINS WITH AN EXTRA STILL UP, IT ADOPTS ONE. The primary is the ball
     * the camera follows, the sonar reports and the stuck watch checks; promoting an extra to primary
     * would mean answering "which one" at each of those. Taking over its position and speed is the
     * same thing from the player's side — the ball they were watching carries on — with no second
     * answer anywhere.
     */
    if (drained && extraBalls.length > 0) {
      const heir = extraBalls.pop()!;
      allBalls.splice(allBalls.indexOf(heir), 1);
      ball.position = { x: heir.position.x, y: heir.position.y };
      ball.direction = { x: heir.direction.x, y: heir.direction.y };
      ball.speed = heir.speed;
    } else if (drained) {
      hits.push(`drained:${drained}`);
      ballsLost++;
      // The next ball gets a fresh lane. Lights left over from the last one would be a table telling
      // this ball about a trip it did not make.
      laneProgress.reset();
      // ⚠️ AND THE PICTURE IS REDRAWN, because losing a ball is what OPENS a secret passage. Without
      // this the door is gone from the physics and still painted, which is the drop target's oldest
      // defect arriving by a new road.
      refreshObjective(true);

      // ⚠️ LOSING A BALL COSTS A BALL, which it did not until now: the count sat at three in the corner
      // of the screen for every commit since the HUD reached it, and the player could not lose.
      const { gameOver } = live.endBall();
      hint = shell.t(gameOver ? 'pinball.hud.gameOver' : 'pinball.hud.waiting');
      // ⚠️ ONLY WHEN THE GAME IS OVER, not on every lost ball: a scoreboard records a GAME. And only
      // if it places — `offer` asks the board and shows nothing when it does not, because being told
      // you failed to make the top five is not information anybody asked for.
      if (gameOver) highScores.offer(live.score.curScore);

      const fresh = physics.spawnBall();
      ball.position = fresh.position;
      ball.direction = { x: 0, y: -1 };
      ball.speed = 0;
      // The ball is only put back if there is one to put back. `launch` refuses on a finished game.
      phase = 'title';

      /**
       * ⚠️ AND THE VIEW COMES BACK DOWN WITH IT.
       *
       * The camera cannot bring itself back. Its step is capped at a fraction of the BALL'S OWN
       * SPEED — that cap is the rule that stops the view outrunning what the player is watching —
       * and a ball waiting at the plunger has a speed of nought, so the cap is nought and the offset
       * stays wherever the lost ball dragged it. The player was left looking at a stretch of empty
       * mid-table with no flippers and no plunger in the window, holding a key that appeared to do
       * nothing, until the launch scrolled them somewhere they had not asked to go.
       *
       * A new ball is a new start, and `createCamera` puts the view where a start belongs: on the
       * flippers. This is also what the Dev asked for in general terms after seeing `crater-run` and
       * `long-climb` cut off at the base — "a base sempre apareça".
       *
       * ⚠️ AND IT IS DELIBERATELY NOT `shell.advance` MOVED OUT OF THIS BRANCH, which was the first
       * attempt and was wrong twice over: the camera still could not move on a still ball, so it
       * changed nothing at all — and `paused` is not `playing` either, so it would have let the view
       * drift on while the game was stopped.
       */
      shell.resetCamera();
    }

    shell.advance(frames);
  }

  /**
   * ⚠️ THE MENU FOLLOWS THE PHASE RATHER THAN THE KEY, so every way of pausing opens it — the keyboard,
   * the pad's start button, and anything that pauses in future. A menu opened by a key handler is a
   * menu the gamepad does not have.
   *
   * ⚠️ EXCEPT WHILE ONE OF ITS OWN DIALOGS IS UP, AND THAT GUARD WAS MISSING. The phase is still
   * `paused` when the palette, the vision correction or the control editor is open — they are all
   * reached FROM this menu, over a stopped game — so the menu reopened on the very next frame, on top
   * of the dialog it had just opened. Found by screenshotting the vision dialog and seeing the pause
   * menu over it, with the dialog's edges showing either side.
   *
   * `onColours` below has carried a comment since it was written saying "the loop is told to leave
   * the menu alone while the dialog is up". Nothing told it. That comment described a fix that was
   * never made, and the palette was invisible for an unrelated reason — it laid out below the screen
   * — so nobody could see the one covering the other.
   */
  /**
   * ⚠️ STILL HERE AS WELL, AND THAT IS NOT A DUPLICATE. `enterPhase` opens it the instant the phase
   * changes, which is what makes the key work without waiting for a frame. This keeps it in step with
   * everything the loop itself can change while the phase does not — a dialog closing over a paused
   * game is the case that matters, and `showPauseMenu` is idempotent by construction because
   * `open` and `close` both are.
   */
  showPauseMenu();

  hud.update({
    score: live.score.curScore,
    ballCount: live.flags.ballCount,
    playerNumber: 1,
    hint,
    // ⚠️ SEPARATE FROM THE SCORE, IN THE DEV'S OWN WORDS: "pontos de missão são separados do ponto de
    // jogo." Absent when there is no drill, which is what keeps the demonstration from reporting one.
    mission: comets ? { have: comets.points, need: WINNING_POINTS } : undefined,
  });

  blitView(screen, tablePicture, shell.hud.playfield, shell.cameraX.offset, shell.camera.offset);
  // ⚠️ BOTH AXES, AND THE HORIZONTAL ONE WAS A LITERAL ZERO. `wide-arc` is 360 wide against a window
  // of 320, so forty columns of it could never be looked at — the ball rolled off the right of the
  // screen and came back. The camera has always been able to do this; nothing asked it to.
  /**
   * ⚠️ THE FLIPPERS, EVERY FRAME, FROM THE LIVE GEOMETRY.
   *
   * They used to be stroked into `tablePicture`, which is composed once per change — so the paddle
   * swung in the physics and the picture showed it at rest for ever. `rotOrigin` and `t1` are the
   * pivot and the tip as the physics has them right now, `t1` already rotated by `currentAngle`.
   */
  /**
   * ⚠️ THE PLUNGER, DRAWN WHERE IT IS DRAWN BACK TO. It slides down its own lane by the length of its
   * travel: at a full pull it sits a plunger's height lower than at rest, which is what tells a player
   * how hard the next launch will be. Without it the charge is a number nobody can see, and a control
   * you cannot see is the defect this game has now shipped five times.
   */
  const plungerPart = authored.components.find((c) => c.kind === 'plunger');
  if (plungerPart) {
    const travel = Math.round(plungerPart.bounds.height * 0.6 * plunger.pull);
    drawLitRect(
      screen,
      { ...plungerPart.bounds, y: plungerPart.bounds.y + travel },
      litColors(paletteOf(authored, isCbSafe(palette)).roles[plungerPart.role], plungerPart.role),
      shell.hud.playfield, shell.cameraX.offset, shell.camera.offset,
    );
  }

  for (const flipper of physics.flippers) {
    drawFlipper(
      screen, flipper.rotOrigin, flipper.t1, ROLE_COLORS.structure,
      shell.hud.playfield, shell.cameraX.offset, shell.camera.offset,
    );
  }

  /**
   * ⚠️ THE TRAVELLING BODIES, DRAWN WHERE THEY ARE. The fourth body in this game that a composition
   * made once per change cannot hold: the flippers were stroked in at their resting angle for weeks,
   * the plunger never slid, the lamps never reached a pixel. `drawTable` skips anything declaring a
   * `mover`, so a drone this loop does not draw is INVISIBLE rather than merely stale.
   */
  for (const { name, mover } of physics.movers) {
    const component = authored.components.find((c) => c.name === name)!;
    drawMover(
      screen, mover.at, mover.radius,
      packRgb(paletteOf(authored, isCbSafe(palette)).roles[component.role]),
      shell.hud.playfield, shell.cameraX.offset, shell.camera.offset,
    );
  }

  /**
   * ⚠️ THE COMETS, THEN THE BALL. The ball goes on top: it is the thing the player is steering, and a
   * comet drawn over it would hide the one object whose position they are reading every frame.
   *
   * ⚠️ AND `drawComet` DARKENS THE ART AROUND EACH ONE — see `gfx/comet-view`, which explains why no
   * single colour can clear 3:1 against art running from black to the ball's own ceiling. Drawn after
   * the ball, that darkening would fall on the ball as well.
   */
  if (comets) {
    // ⚠️ A HIDDEN COMET IS NOT DRAWN, and `strike` refuses it in the same breath — see the note on
    // `CometMission.strike`. Drawn but unhittable, or hittable but invisible, are both worse than
    // either half alone.
    const hidden = powerUps?.isActive('clear') === true;
    for (const comet of comets.comets) {
      if (hidden && !comet.multiple && comet.state === 'falling') continue;
      drawComet(screen, comet, shell.hud.playfield, shell.cameraX.offset, shell.camera.offset);
    }
  }
  if (powerUps) {
    for (const capsule of powerUps.capsules) {
      drawCapsule(screen, capsule, shell.hud.playfield, shell.cameraX.offset, shell.camera.offset);
    }
  }

  for (const ball of state.balls) {
    drawBall(
      screen, ball, authored.ballRadius, shell.hud.playfield,
      shell.cameraX.offset, shell.camera.offset,
    );
  }
  paint();
}

/** Hands the audio thread the next slice of music, while there is any left to hand. */
function topUpMusic(): void {
  if (!demo?.music) return;
  // The context may not exist yet: a browser refuses one until the player has touched something, and
  // the music is often chosen before that has happened.
  ensureAudio();
  if (!audio || audio.state !== 'running') return;

  musicStartedAt ??= audio.currentTime;
  const playhead = audio.currentTime - musicStartedAt;
  if (musicScheduledTo - playhead > MUSIC_LOOKAHEAD) return;
  if (musicScheduledTo >= demo.music.length) return;

  const until = musicScheduledTo + MUSIC_WINDOW;
  playSchedule(audio, demo.music.notes, {
    from: musicScheduledTo,
    until,
    startAt: musicStartedAt,
  });
  musicScheduledTo = until;
}

/**
 * The screen onto the canvas. Split out because the demonstration mode composes its own picture and
 * still needs this last step.
 *
 * One `ImageData`, reused. Allocating one per frame would be sixty allocations a second of the same
 * 230 KB, and the copy is what the canvas wants anyway.
 */
function paint(): void {
  image.data.set(screen.bytes);
  context.putImageData(image, 0, 0);
}

function frame(now: number): void {
  step(Math.min(4, (now - previous) / (1000 / 60)));
  previous = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/**
 * ⚠️ THE GAME HAD NO INPUT UNTIL THIS LINE, AND A THOUSAND TESTS WERE GREEN OVER IT.
 *
 * Bound to `#game-region` and not to `window`, so a table embedded in a page does not eat the reader's
 * arrow keys. See `shell/controls` for the rest, including why a held key is not a stream of presses.
 */
/**
 * ⚠️ THE CABINET, ONCE, SO THE KEYBOARD AND THE PAD CANNOT DRIFT.
 *
 * The Dev specified the controls as a machine and asked whether the engine supplies the gamepad. It
 * does — `input/gamepad` has the wizard, the analog thresholds and the persistence — so what is left
 * here is the four things the cabinet DOES, written once and handed to both readers. Two copies of
 * "what button 1 means" is how a game ends up launching on the keyboard and not on the pad.
 */
const cabinet = {
  setFlipper: (side: 'left' | 'right', extended: boolean) => {
    if (demo) demo.setFlippers(side, extended);
    else physics.setFlippers(side, extended);
  },
  /**
   * ⚠️ HELD, NOT PRESSED. The press draws the plunger back and the RELEASE launches — which is what a
   * plunger is, and what this had never been: `setPlunger` called `launch()` on the way down, so every
   * ball left at the same speed and the key was a trigger with a spring drawn on it.
   *
   * The demonstration keeps its own plunger, which has worked all along.
   */
  /**
   * ⚠️ AND IT ASKS WHERE THE BALL IS, NOT WHAT PHASE THE GAME IS IN.
   *
   * The Dev: "após lançar a bolinha o lançador deve continuar funcionando, visto que a bolinha pode
   * continuar acima dele." The guard was `if (phase === 'playing') return`, which is a question about
   * the GAME — and a plunger does not retract when the game starts. A launch that fails to clear the
   * return bend leaves the ball rolling back down the lane, which is the exact case the plunger's own
   * face was added for last week, and there was then no way to launch it again: the player watched it
   * settle onto the launcher with a key that had stopped answering.
   *
   * `inPlungerLane` is the question that should have been asked, and it is a position test for the
   * same reason `drainedBy` is one.
   */
  setPlunger: (pressed: boolean) => {
    if (demo) { demo.plunge(pressed); return; }
    if (!inPlungerLane(authored, ball)) return;
    if (pressed) plunger.press();
    else {
      const speed = plunger.release();
      if (speed > 0) launch(speed);
    }
  },
  launch: () => { if (phase !== 'playing') launch(); },
  /**
   * ⚠️ AND IT SAYS SO, IN BOTH CHANNELS, BECAUSE A SILENT PAUSE READS AS A HANG.
   *
   * The first version of this set the phase and stopped. The frame loop steps the ball only while
   * playing, so pressing start froze the table and told nobody why — which to a sighted player looks
   * like the game locking up, and to a blind one is silence where a state change belongs.
   *
   * The hint block carries it while it lasts, because pause is a STATE and the HUD is what shows
   * state. The live region carries the transition, because that is an EVENT — the same split
   * `shell/hud-dom` already makes and the same one blind mode announces through.
   */
  togglePause: () => {
    if (phase === 'paused') return enterPhase(resumeTo);
    /**
     * ⚠️ THE QUESTION IS WHETHER A TABLE IS ON THE SCREEN, NOT WHETHER A BALL IS MOVING, and getting
     * that wrong is what the Dev reported as "troquei de mesa e o menu de pausa já se tornou
     * inacessível".
     *
     * This used to read `if (phase === 'playing')`, so pause did nothing at all while the phase was
     * `'title'` — which is the state the game is in before the first launch, between balls, and after
     * the last one is lost. Changing tables lands the player in the first of those every single time:
     * "Mesas" reloads with `?table=`, and the new table opens with the ball parked on the plunger. The
     * pause menu is the ONLY way back to the selector, so the player who had just used it to change
     * tables could not use it again.
     *
     * The worst of the three is the finished game: `launch` refuses a fourth ball by design, so the
     * phase can never leave `'title'` again and the only exit left was reloading the page.
     *
     * ⚠️ AND IT STILL REFUSES ON THE TITLE AND THE SELECTOR, which is what `screens` answers and
     * `phase` cannot: there the game is not merely between balls, there is no game. A pause menu over
     * the table selector would offer "Continuar" with nothing to continue.
     */
    if (screens.current !== 'playing') return;
    resumeTo = phase;
    enterPhase('paused');
  },
};

/**
 * Pausing and coming back, in one place, because it is TWO THINGS and one of them was being skipped.
 *
 * ⚠️ RESUMING FROM THE MENU WAS SILENT TO A SCREEN READER. `togglePause` set the phase AND announced
 * it; the pause menu's own "Continuar" set the phase and said nothing. So a player using the keyboard
 * pressed Enter, the game resumed, and `sr-status` still read "Pausado" — the game had come back and
 * the only person who could not tell was the one the announcement exists for.
 *
 * ⚠️ AND IT TOOK THE ENGINE BREAKING SOMETHING ELSE TO FIND IT. The gate had been green because the
 * test's own helper focused the game region before every key, which took the focus away from the menu
 * button that pause had just given it — so the second Enter went to the game and toggled, announcement
 * and all. The engine's new focus trap made that helper untenable, the helper was fixed to send keys
 * where the focus actually is, and the defect underneath came straight out. It is the third time today
 * that one rule with two copies has had one copy that was not keeping up.
 */
function enterPhase(next: Phase): void {
  phase = next;
  hint = next === 'paused' ? shell.t('pinball.hud.paused') : shell.t('pinball.hud.waiting');
  const status = document.getElementById('sr-status');
  if (status) status.textContent = hint;
  showPauseMenu();
}

/**
 * The pause menu follows the phase — HERE, at the moment the phase changes.
 *
 * ⚠️ IT USED TO FOLLOW IT FROM THE FRAME LOOP, and that is the defect the Dev has now reported three
 * times: "botão H e Enter devem pausar o jogo, fazendo aparecer o menu de pausa... Perdi a conta de
 * quantas vezes pedi para implementar o pause e ainda não funciona."
 *
 * The key worked every time it was measured: press it and `phase` becomes `paused`. What did not
 * happen is the MENU, because opening it was the frame loop's job and the menu therefore existed only
 * as long as animation frames kept arriving. Measured in a browser whose tab is not compositing:
 * `H -> phase=paused menu=none`. The game pauses and shows nothing, which from the outside is a pause
 * key that does not work — and no test saw it, because every test that presses the key also drives
 * the frames.
 *
 * ⚠️ AND THE PROPERTY THE LOOP WAS THERE FOR IS KEPT, WHICH IS WHY IT MOVED HERE RATHER THAN INTO THE
 * KEY HANDLER. The old comment: "the menu follows the phase rather than the key, so every way of
 * pausing opens it — the keyboard, the pad's start button, and anything that pauses in future." This
 * function is the ONE place the phase changes; anything that pauses goes through it.
 *
 * ⚠️ AND NOT WHILE ONE OF ITS OWN DIALOGS IS UP. The phase is still `paused` when the palette, the
 * vision correction or the control editor is open — they are all reached from this menu, over a
 * stopped game — and reopening it would put it on top of the dialog it just opened.
 */
function showPauseMenu(): void {
  const overMenu = optionsDialog.isOpen() || visionDialog.isOpen() || keymapDialog.isOpen();
  if (phase !== 'paused') pauseMenu.close();
  else if (!overMenu) pauseMenu.open();
}

/**
 * ⚠️ AND THE PAD IS THE ENGINE'S, NOT THIS PORT'S. `shell/pad` translates the engine's action
 * vocabulary into the cabinet and does nothing else; every reason a stick counts as "left" past one
 * threshold stays in `input/gamepad`, where it was written and tested.
 *
 * `navigator.getGamepads` is read through a function rather than captured, because a pad connected
 * after boot appears in a later call and never in an earlier one.
 */
const pad = createPadReader({
  getGamepads: () => navigator.getGamepads?.() ?? [],
  on: cabinet,
});

/**
 * ⚠️ THE CABINET AS THE PLAYER LEFT IT, READ ONCE AND KEPT LIVE. `bindPinballControls` takes
 * `bindings` and `shell/pad` derives the cabinet from the same table, so both read this one object —
 * the seam was already there and nothing about how a key is read had to change. See `shell/bindings`
 * for why this game keeps its own table rather than the engine's keyboard config.
 */
let bindings: BindingTable = readBindings(localStorage);

const unbindControls = bindPinballControls({
  bindings: () => bindings,
  /**
   * ⚠️ THE ENGINE'S REMAPPER, WHICH THIS SEAM WAS BUILT FOR AND NOTHING HAD EVER PASSED.
   *
   * `ControlOptions.actionOf` is documented as "the engine's remapper, when the pinball's scheme is
   * registered with it", and it was never given one — so the settings panel could rebind the keyboard
   * and the pinball would go on reading its own table, which is a remap that does nothing.
   *
   * `KeyboardRuntime.actionOf` answers in the ENGINE's vocabulary, so it goes through the same table
   * the pad uses. Player 0: this game has one player, and the engine's per-player schemes are for a
   * game that does not.
   *
   * ⚠️ AND `DEFAULT_BINDINGS` IS STILL CONSULTED, because the engine's scheme has no room for the
   * three keys that are not cabinet controls. Blind mode, the sweep and the palette are switches for
   * how the game is PERCEIVED — `KeyScheme` has no slot for them, and inventing one in a shared
   * vocabulary to hold a pinball's accessibility keys would be the wrong place to put them.
   */
  actionOf: (code) => {
    const engineAction = shell.engine.keyboard?.actionOf(code, 0);
    return engineAction ? CABINET_OF_ENGINE_ACTION[engineAction] ?? null : null;
  },
  region,
  // ⚠️ THE DEMONSTRATION HAS ITS OWN FLIPPERS, and one key binding serves both tables. Routing to the
  // authored physics while the 1995 table is on screen leaves the player pressing a key that moves
  // something they cannot see.
  setFlipper: cabinet.setFlipper,
  /**
   * ⚠️ GUARDED ON THE PHASE, NOT ON `ball.active`, AND THE DIFFERENCE MADE THE GAME UNSTARTABLE.
   *
   * `physics.spawnBall()` returns a ball with `active: true` — it is a ball that exists, sitting in the
   * plunger lane. So `!ball.active` was FALSE from the first frame, `launch()` was never called, and
   * the plunger key did nothing at all. Not "nothing until the table was ready": nothing, ever. The
   * frame loop steps the ball only while `phase === 'playing'`, and the only thing that sets that is
   * the launch that never ran.
   *
   * The question the guard is asking is "is a game already in progress", and that is what `phase`
   * answers. `active` answers "does a ball exist", which was true before the player touched anything.
   */
  launch: cabinet.launch,
  /**
   * ⚠️ AND THE HOLD, WHICH ONLY THE 1995 TABLE HAS. Its plunger is drawn back while the key is
   * down and fires at whatever was drawn; the authored table has no plunger component at all, so this
   * falls back to the one-shot on the way down.
   *
   * ⚠️ THE FALLBACK IS NOT OPTIONAL. `bindPinballControls` calls `setPlunger` INSTEAD of
   * `launch` whenever it is given one, so a version of this that only forwarded to the demonstration
   * would leave the authored table with a launch key that does nothing at all.
   */
  setPlunger: cabinet.setPlunger,
  /**
   * ⚠️ AND NOT WHILE THE 1995 TABLE IS ON SCREEN, which is a gap being named rather than closed.
   *
   * The declaration the engine reads is built once at boot from the AUTHORED table, and the
   * demonstration is an early return through the frame loop — `refreshObjective` is never called there
   * and `sonarPlayer` is never moved. So in `?demo=original` the contract still answers with the
   * authored table's targets and a ball position that stopped updating at boot.
   *
   * Blind mode and the sweep would therefore describe a table that is not on screen and point at
   * components that are not there. A switch that gives a confident wrong answer is worse than one that
   * says it cannot answer, so both are refused here and the reason is announced.
   *
   * Closing it properly means the demonstration presenting itself as a `LiveTable` so the declaration
   * follows it — its components, its ball, its mission's remaining targets, which `control/mission` can
   * already name. That is a piece of work, not a line.
   */
  toggleBlindMode: () => {
    // ⚠️ REFUSED ONLY WHILE THERE IS NOTHING TO DESCRIBE. The demonstration answers for itself once the
    // player's archive is loaded and `demoView` exists; before that — and if the file is never handed
    // over — the contract still holds the authored table, and a guide describing it over a blank
    // screen is the confident wrong answer this refusal was added for.
    if (demoRequested && !demoView) return sayUnavailable();
    blind = !blind;
    // Announced through the host's own live region, which is where an EVENT belongs — the HUD blocks
    // are readable on request and deliberately not live. See `shell/hud-dom`.
    const status = document.getElementById('sr-status');
    if (status) status.textContent = shell.t(blind ? 'pinball.a11y.blindOn' : 'pinball.a11y.blindOff');
  },
  /**
   * ⚠️ THE SWEEP IS THE PART THAT ANSWERS TODAY, AND THE AUTOMATIC GUIDE IS OFF BY THE ENGINE'S OWN
   * DECISION. `platform/audio-mixer` lists `guide` in `NASCEM_DESLIGADAS` — born off, "por decisão do
   * Dev, 2026-08-26", and described there as a deliberate measure. So `updateGuide` returning without
   * pinging is correct behaviour and not a fault in this wiring; a player turns the beacon on in the
   * engine's audio mixer. I chased that to zero twice before reading the reason, and it is written here
   * so nobody chases it a third time.
   */
  sweep: () => {
    if (demoRequested && !demoView) return sayUnavailable();
    shell.engine.sonar.sonar(sonarPlayer);
  },
  /**
   * ⚠️ AND THE TABLE IS REDRAWN, not merely marked. `tablePicture` is composed once per change and the
   * camera moves a window over it — so a palette that changed a variable and nothing else would take
   * effect on the next mission event and look like a bug until then.
   *
   * The demonstration keeps the 1995 artwork whatever this says: those are Microsoft's pixels, and
   * recolouring them is not something this port is entitled to do.
   */
  cyclePalette: () => choosePalette(nextPalette(palette)),
  /**
   * ⚠️ START, AND THE PAUSED PHASE HAS EXISTED SINCE BOOT WITH NOTHING TO ENTER IT. `bootPinball` tells
   * the engine `isNavigable: () => phase === 'paused'` — that is how the engine knows it may walk its
   * own menus — so until now the engine has been asking a question whose answer was always no.
   *
   * Only a running game pauses. Pressing it on the title would put the game into a state the title
   * screen has no way out of.
   */
  togglePause: cabinet.togglePause,
  // ⚠️ REPORTED WHETHER OR NOT A DRILL IS ON, and `extraField` is what decides it is worth anything. A
  // key that stops being reported while nothing uses it is a key that is stuck down the moment one does.
  setThrust: (direction, pressed) => { thrust[direction] = pressed; },
  /**
   * ⚠️ THE BACK DOOR, AND ONLY THE 1995 TABLE HAS ONE. `bmax`, `rmax`, `gmax`, `1max`, `easy mode` and
   * `hidden test` are the Space Cadet's own codes and mean nothing on an authored table, so a
   * character typed while the authored one is on screen goes nowhere rather than somewhere wrong.
   *
   * ⚠️ AND THE LETTER STILL WORKS ITS OWN KEY. `b` is blind mode and `s` is the sweep, so typing
   * `bmax` toggles blind mode on the way past — the accessibility keys keep their letters and the
   * cheat is spelled around them. See `shell/controls`.
   */
  typeCharacter: (character) => { demo?.typeCheat(character); },
});

/**
 * ⚠️ ADR-0002'S FOUR BLOCKS, ON SCREEN FOR THE FIRST TIME. `layoutHud` computed them from phase 6 and
 * nothing drew them. Words rather than pixels: see `shell/hud-dom` for the engine rule that decides it.
 */
/**
 * ⚠️ THE DEMONSTRATION MODE, WHICH SHOWS THE 1995 TABLE AND ASKS THE PLAYER FOR IT.
 *
 * `?demo=original` replaces the authored table with the real one, read from a file the player chooses.
 * It is never fetched and never bundled — `tests/build-carries-no-original-data` holds the second half
 * of that — because any arrangement where Microsoft's archive arrives over HTTP is a redistribution
 * with extra steps.
 */
let demo: Demo | null = null;
/**
 * ⚠️ THE MUSIC IS SCHEDULED IN SLICES, AND THIS IS HOW FAR IT HAS GOT. `PINBALL.MID` is fourteen
 * thousand notes; handing them all to the audio thread at once stops the page. Each frame tops the
 * schedule up while the playhead is closer than the look-ahead, and every note still gets its own
 * `start(at)` on the audio clock — so the timing is the audio thread's and only the SCHEDULING is the
 * frame loop's.
 *
 * ⚠️ AND THE PIECE'S CLOCK STARTS AT ITS FIRST SLICE, NOT WHEN THE FILE ARRIVED. I set it at load time
 * first, and that is wrong whenever the audio context is not running yet — which is the normal case,
 * because a browser will not start one without a gesture. The playhead would advance while nothing
 * played, and the music would begin somewhere in its own middle.
 */
let musicScheduledTo = 0;
let musicStartedAt: number | null = null;
/**
 * ⚠️ THE TABLE'S OWN SOUNDS, BY THE GROUP INDEX ITS COMPONENTS CARRY. The archive names forty-seven
 * WAVs and holds none of them; the player hands the files over the way they hand over the table and
 * the tune, and this is where the two are matched by NAME — case-insensitively, because the archive
 * spells them lower case and the files on a disc are upper.
 *
 * A component whose file was not given keeps the synthesised voice instead of falling silent: the
 * roles are what let this port be played by somebody who does not own the original, and they do not
 * stop being useful because somebody does.
 */
const archiveSounds = new Map<number, AudioBuffer>();
const demoRequested = new URLSearchParams(location.search).get('demo') === 'original';
const demoPage = demoRequested
  ? mountDemoPage({
    doc: document,
    host: region,
    screen,
    playfield: shell.hud.playfield,
    t: shell.t,
    onReady: (ready, archive) => {
      demo = ready;
      // ⚠️ AND THE DECLARATION SWITCHES HERE, which is the moment the 1995 table becomes describable.
      // Before it, the contract holds the authored table and the accessibility keys refuse.
      demoView = demoWorld({ demo: ready, groups: groupsOf(archive) });
    },
    // ⚠️ THE SAME BOARD THE AUTHORED TABLE USES, so the demonstration is mixed, channel-limited and
    // released like everything else rather than given a second path to the speakers. `ensureAudio` is
    // called per sound because a browser will not start a context before a gesture, and the first
    // collision may well BE the gesture.
    onSound: (name) => { ensureAudio(); board.play(name); },
    // ⚠️ THE REAL NOISE WHEN THERE IS ONE. A component reports the index of a group in the archive,
    // and that group names a file. Played straight through the audio context rather than through the
    // synthesised board, because there is nothing to synthesise: it is a recording.
    onSoundId: (id) => {
      const buffer = archiveSounds.get(id);
      if (!buffer) return;
      ensureAudio();
      const context = ensureAC();
      if (!context) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start();
    },
    onSounds: async (files) => {
      ensureAudio();
      const context = ensureAC();
      if (!context || !demo) return { loaded: 0, stranding: [] };
      const byName = new Map(files.map((file) => [file.name.toLowerCase(), file]));

      const taken: string[] = [];
      let loaded = 0;
      for (const [groupIndex, fileName] of demo.soundFiles) {
        const file = byName.get(fileName.toLowerCase());
        if (!file) continue;
        try {
          archiveSounds.set(groupIndex, await context.decodeAudioData(await file.arrayBuffer()));
          taken.push(fileName);
          loaded++;
        } catch {
          // A file the browser cannot decode is skipped and counted as missing, which is what the
          // original does with one it cannot open: the game is quieter, not broken.
        }
      }
      // ⚠️ AND THE PLAYER IS TOLD WHICH KIND OF SILENCE THEY BOUGHT. A missing file among the seven
      // that time a hole holds the ball for ever; anywhere else it is only quieter.
      return { loaded, stranding: demo.soundReport(taken).stranding };
    },
    onMusic: (bytes) => {
      ensureAudio();
      if (!demo?.loadMusic(bytes)) return false;
      musicScheduledTo = 0;
      musicStartedAt = null;
      return true;
    },
    onError: (message) => {
      const alert = document.getElementById('sr-alert');
      if (alert) alert.textContent = shell.t('pinball.demo.failed', { n: message });
    },
  })
  : null;

refreshObjective(true);

/**
 * ⚠️ AND THE PICTURE IS REDRAWN WHEN THE ART LANDS, which is the join this whole feature turns on.
 * Without the `refreshObjective` the image would be fetched, decoded, stored and never looked at
 * again — the shape of defect found here in the lamps, the gamepad, the mission text and the movers.
 */
void loadBackdrop(authored.name, authored.size).then((pixels) => {
  if (!pixels) return;
  backdrop = pixels;
  refreshObjective(true);
});

/**
 * ⚠️ ONE PLACE THAT APPLIES A CHOICE, and the key and the menu both call it.
 *
 * Two callers doing this separately is the failure mode with no symptom: the key would redraw and the
 * menu would not, or one would remember the choice and the other would forget it, and the difference
 * only shows up for the player who used both. Announcing here means the menu speaks too, which it
 * should — a button that changes the table silently tells a blind player nothing happened.
 *
 * The demonstration keeps the 1995 artwork whatever this says. Those are Microsoft's pixels, and
 * recolouring them is not something this port is entitled to do.
 */
function choosePalette(choice: PaletteChoice): void {
  palette = choice;
  writePalette(localStorage, palette);
  composePicture();
  const status = document.getElementById('sr-status');
  if (status) status.textContent = shell.t(PALETTE_LABEL[palette]);
}

/**
 * The menu, which is what the Dev asked for; the key on C is the shortcut beside it.
 *
 * ⚠️ IT GOES IN `region`, WHICH IS `#game-region`. The engine's overlay machinery scopes itself to
 * that element — the Escape chain, the z-stack, the focus restoration — so a dialog mounted anywhere
 * else registers for a chain it is not in.
 */
const optionsDialog = mountChoiceDialog<PaletteChoice>({
  id: OPTIONS_DIALOG_ID,
  titleKey: 'pinball.palette.title',
  choices: PALETTE_CHOICES,
  labelOf: PALETTE_LABEL,
  doc: document,
  host: region,
  overlays: shell.engine.overlays,
  t: shell.t,
  current: () => palette,
  onChoose: choosePalette,
  // ⚠️ BACK TO THE BUTTON THAT OPENED IT. Hiding the element the focus is inside leaves the focus
  // nowhere: the next Tab starts at the top of the document. `optionsButton` is declared below and
  // read at call time, which is the only order that works — the button's own handler needs the dialog.
  // ⚠️ BACK TO THE ENTRY THAT OPENED IT. Hiding the element the focus is inside leaves the focus
  // nowhere: the next Tab starts at the top of the document. `pauseMenu` is declared below and read at
  // call time, which is the only order that works — the menu's own handler needs the dialog.
  restoreFocus: () => pauseMenu.focusEntry('colours'),
});


/**
 * ⚠️ THE FIRST SCREEN, AND THE ONE COMPROMISE IN IT, NAMED RATHER THAN HIDDEN.
 *
 * The Dev asked for a title that opens a table selector. The selector is real and it lists the
 * catalogue — but choosing a table that is not the one already booted RELOADS the page with
 * `?table=`, because this entry point resolves `authored` at module scope and builds the physics, the
 * live controls, the rollover watch and the picture from it before any of this runs. Switching tables
 * in place means lifting all of that into a function that can be called twice.
 *
 * That refactor is worth doing and is not being done in the same commit as the screen: the Dev has
 * asked for five more tables and a mission machine for each, and every one of those makes the seam
 * clearer. A reload costs a blink and is honest; a half-reinitialised table would be the kind of
 * defect this port spends its nights on.
 *
 * A game already running is not disturbed: choosing the table that is already booted just hides the
 * screen.
 */
const screens = titleScreen({
  onStart: (table, times) => {
    if (table !== authored.name) {
      const url = new URL(location.href);
      url.searchParams.set('table', table);
      // ⚠️ AND THE NUMBER GOES WITH IT, or the reload lands back on the screen it was just chosen on.
      url.searchParams.set('times', String(times));
      location.assign(url.toString());
      return;
    }
    /**
     * ⚠️ A NEW MISSION EVERY TIME, not a number set on an existing one. Mission points are per GAME —
     * "O jogador ganha o jogo ao completar 20 pontos de missão" — so a player who leaves for the
     * selector and comes back has started again, and carrying nineteen points across that would be a
     * win they did not play for.
     *
     * ⚠️ AND NOT IN THE DEMONSTRATION. That is the 1995 table, being validated against the player's
     * own archive; comets falling through it would be this project's mission on Microsoft's playfield.
     */
    comets = demoRequested ? null : cometMission({ number: times });
    powerUps = comets ? powerUpField() : null;
  },
});

const title = mountTitle({
  doc: document,
  host: region,
  screen: screens,
  t: shell.t,
  store: localStorage,
  /**
   * ⚠️ THE LIVE TABLE, so the legend on the selector is the cabinet the player HAS. It read
   * `DEFAULT_BINDINGS` for ever — correct until the pause menu learned to edit the keys, and a lie
   * from that moment on, to the one player most likely to be reading it.
   */
  bindings: () => bindings,
  onStarted: () => {
    // The HUD is about a game in progress. Until one is, it has nothing to say.
    hud.setVisible(true);
    /**
     * ⚠️ AND THE FOCUS GOES TO THE REGION, OR THE GAME IS UNPLAYABLE.
     *
     * `bindPinballControls` listens on `#game-region` and never on `window` — the engine trap the plan
     * names in advance, and the right choice. But a player reaches the table by CLICKING A BUTTON, and
     * after that click the focus is on the button; when the selector hides, it falls to `<body>`. A
     * keydown on the body never reaches a listener on a descendant, so every key did nothing until the
     * player happened to click the canvas.
     *
     * The controls were implemented and browser-tested. The title screen made them unreachable, which
     * is worse than not having them: the game looks finished and does not respond.
     */
    region.focus();
  },
});

/**
 * ⚠️ AND THE DEMONSTRATION SKIPS IT. `?demo=original` is the validation configuration — it asks for
 * the player's own archive through a file picker — and putting a title in front of that would be a
 * screen between somebody and the thing they came to the URL for.
 */

/**
 * ⚠️ THE WAY OUT OF A GAME, WHICH THERE HAS NEVER BEEN ONE OF.
 *
 * The Dev: "menu de pausa deve permitir dar quit, voltar à tela inicial e escolher outras mesas."
 * Pause stopped the world and wrote "Paused" in the footer, and the only exits from a table were
 * draining three balls or reloading the page.
 *
 * Mounted AFTER the title screen because three of its four entries hand the player back to it, and
 * because the last element appended to `#game-region` is the one on top — a pause menu under the
 * title screen would be a menu nobody can click.
 */
const leaveGame = (): void => {
  phase = 'title';
  hud.setVisible(false);
  ball.speed = 0;
  shell.resetCamera();
  // ⚠️ AND THE COMETS GO WITH THE GAME. Left behind, they would go on falling behind the title screen
  // and the player's points would still be there when somebody else sat down.
  comets = null;
  powerUps = null;
  // The extra balls go too, or the next game starts with somebody else's multiball still running.
  extraBalls.length = 0;
  allBalls.length = 1;
};

/**
 * ⚠️ THE PLAN PROMISED THIS AND NOTHING HAD COLLECTED IT: "o pinball herda de graça os filtros de
 * daltonismo... nada disso precisa ser escrito." `createGame` returns `aplicarFiltroDeVisao` and this
 * file referenced it nowhere. The filters were installed at every boot and nothing ever asked for one.
 *
 * ⚠️ `'mundo-e-menus'` AND NOT `'mundo'`. The engine's own `render/port` records the distinction as a
 * product decision of the Dev's on issue #82: a filter that falls only on the canvas leaves the menus
 * raw, "a criança daltônica recebia o jogo corrigido e as palavras não". A CORRECTION is exactly the
 * mode that must reach the words too — this game's HUD, pause menu and alphabet are all DOM.
 */
let vision = readVision(localStorage);

function applyVision(choice: string): void {
  vision = choice;
  writeVision(localStorage, choice);
  shell.engine.aplicarFiltroDeVisao(visionFilter(choice), 'mundo-e-menus');
}

const keymapDialog = mountKeymapDialog({
  doc: document,
  host: region,
  overlays: shell.engine.overlays,
  t: shell.t,
  keys: window,
  current: () => bindings,
  onChange: (table) => {
    bindings = table;
    writeBindings(localStorage, table);
  },
  restoreFocus: () => pauseMenu.focusEntry('controls'),
});

const visionDialog = mountChoiceDialog<string>({
  id: VISION_DIALOG_ID,
  titleKey: 'pinball.vision.title',
  choices: VISION_CHOICES,
  labelOf: VISION_LABEL,
  doc: document,
  host: region,
  overlays: shell.engine.overlays,
  t: shell.t,
  current: () => vision,
  onChoose: applyVision,
  restoreFocus: () => pauseMenu.focusEntry('vision'),
});

// Applied at boot, not only when it is chosen: a setting that has to be re-picked every session is a
// setting the player has to remember they need.
applyVision(vision);

const pauseMenu = mountPauseMenu({
  doc: document,
  host: region,
  t: shell.t,
  score: () => live.score.curScore,
  bindings: () => bindings,
  // ⚠️ `resumeTo`, NOT `'playing'`, FOR THE REASON THE KEY USES IT: "Continuar" on a game paused
  // before the launch has to give the ball back to the plunger, not declare it in play.
  onResume: () => { enterPhase(resumeTo); region.focus(); },
  /**
   * ⚠️ AND THE MENU STAYS SHUT BEHIND IT. `mountPauseMenu` hides itself before calling a handler so
   * that whatever opens next is not drawing under it — but the phase is still `paused`, and the frame
   * loop reopens the menu on the next draw. So the dialog would appear and be buried a sixtieth of a
   * second later. Resuming first is wrong too: the ball would be moving while the player picks a
   * colour. The loop is told to leave the menu alone while the dialog is up.
   */
  onColours: () => { optionsDialog.open(); },
  onVision: () => { visionDialog.open(); },
  onControls: () => { keymapDialog.open(); },
  onTables: () => { leaveGame(); screens.show('select'); title.refresh(); },
  onTitle: () => { leaveGame(); screens.show('title'); title.refresh(); },
  /**
   * ⚠️ THE ONLY EXIT THAT RECORDS THE GAME. See `shell/pause-menu`'s header for why Quit and Title are
   * not one entry: a page cannot close its own window, so Quit means "I am done" — the score is final
   * and the board is offered if it places. Leaving by the other two abandons the game instead.
   */
  onQuit: () => endGame(endOfGame, live.score.curScore),
});


/**
 * ⚠️ WITHOUT THIS THE SCOREBOARD WAS READ AND NEVER WRITTEN. `control/high-score` was transcribed,
 * tested and shown under the selector, and nothing in the game called `writeTable` — so every game
 * ended and the board said "nobody has played yet", for ever. Its orphan-ledger entry had been retired
 * on the grounds that the title screen READS it, which is half of a scoreboard.
 */
const highScores = mountHighScoreDialog({
  doc: document,
  host: region,
  store: localStorage,
  t: shell.t,
  // Once the name is in, the board behind the selector has changed — so the screen is redrawn rather
  // than showing the state it was built with.
  onDone: () => title.refresh(),
});

const hud = mountHud({
  doc: document, host: region, layout: shell.hud, screen: { ...DEFAULT_HUD, playfieldWidth: authored.size.width },
  t: shell.t,
});

// ⚠️ PUT AWAY UNTIL A GAME STARTS. The title and the selector cover the canvas, and "Jogador 1,
// Bolas: 3" printed over a menu is the HUD answering a question nobody asked. The demonstration skips
// the screens entirely, so it turns the HUD straight back on.
hud.setVisible(screens.current === 'playing');

/**
 * ⚠️ A TABLE ALREADY CHOSEN DOES NOT ASK AGAIN.
 *
 * Choosing a table that is not the booted one reloads with `?table=`, and the reload brought the player
 * back to the TITLE — so picking `slipstream` meant clicking through the title and the selector a
 * second time to reach the table you had just picked. Measured in the browser: the URL was right, the
 * table was right, the missions were running, and the player was looking at the front screen.
 *
 * `?table=` in the address IS a choice. `?demo=original` is the validation configuration and skips the
 * screens for the same reason: a file picker is what somebody came to that URL for.
 */
if (demoRequested || requested) {
  screens.advance();
  screens.choose(authored.name);
  /**
   * ⚠️ AND THE NUMBER, WHEN THE ADDRESS CARRIES ONE. `choose` now stops on the mission screen, so a
   * reload from changing tables would otherwise ask for the number a second time — the player picks
   * `slipstream` and the drill of 7, the page comes back, and it wants the 7 again.
   *
   * ⚠️ `pick` REFUSES A NUMBER NOBODY OFFERED, which is what makes a typed `?times=99` land on the
   * mission screen rather than booting a drill on it. `NaN` from an absent parameter takes the same
   * path, and that is the ordinary case: `?table=` typed by hand, with the number still to choose.
   */
  screens.pick(requestedTimes);
  /**
   * ⚠️ THE DEMONSTRATION HAS NO DRILL AND MAY NOT STOP ON ITS SCREEN. `?demo=original` is the
   * validation configuration — a file picker is what somebody came to that URL for — so it goes
   * straight past the question, and `onStart` leaves `comets` null for it.
   */
  if (demoRequested && screens.current !== 'playing') screens.pick(screens.numbers[0]!);
  title.refresh();
  hud.setVisible(screens.current === 'playing');
  region.focus();
}

// Exposed so the browser gate can confirm a real boot rather than a screenshot.
Object.assign(window as unknown as Record<string, unknown>, {
  __pinball: {
    get camera() { return shell.camera; },
    // ⚠️ AND THE SIDEWAYS ONE, or the browser gate cannot see half the camera. A table wider than the
    // window scrolls on both axes and only one of them was in the state the gate reads.
    get cameraX() { return shell.cameraX; },
    get problems() { return shell.problems; },
    hud: shell.hud,
    table: authored.name,
    tables: CATALOG.map((t) => t.name),
    declaration: shell.declaration,
    setPhase(next: Phase) { phase = next; },
    /**
     * Puts the view back where a new game starts, which is what `leaveGame` does.
     *
     * ⚠️ ADDED FOR `tests/frame-follows-state`, AND IT IS THE FLAKE. Those tests stop the world with
     * `setPhase('title')` — which freezes the ball but leaves the CAMERA wherever the last ball
     * dragged it, because `setPhase` is not `leaveGame`. With the view scrolled, the flippers sit
     * partly below the visible window: the failing run measured the left paddle's box as fourteen
     * rows of a twenty-eight-row arc, clipped at the bottom edge, and the part still showing did not
     * change when the paddle moved. Zero differing pixels, and the test read that as "the paddle did
     * not come down".
     *
     * Reproduced at `--sequence.seed=24` and diagnosed from there. `leaveGame` already calls
     * `shell.resetCamera()`; this is the same call, reachable by a test that is not leaving a game.
     */
    resetView() { shell.resetCamera(); },
    /** Which phase the game is in. Read by the browser gate for the pause key the Dev reported. */
    get phase() { return phase; },
    /** Exposed so the browser gate can look at the pixels rather than at a screenshot. */
    get screen() { return screen; },
    get picture() { return tablePicture; },
    /**
     * Whether the table's own picture arrived.
     *
     * ⚠️ ADDED FOR `tests/art-reaches-the-screen`, AND BECAUSE THAT GATE WAS FLAKY WITHOUT IT. It
     * waited a fixed thirty frames for an ASYNCHRONOUS fetch-and-decode and then read the pixels —
     * green on its own, and about one run in twelve of the whole browser suite it read a playfield
     * with no art in it at all and reported 0.0%. A fixed frame count is a bet on how busy the
     * machine is. This is the fact the test was inferring, so it can wait for it instead.
     */
    get backdropLoaded() { return backdrop !== undefined; },
    get ball() { return { x: ball.position.x, y: ball.position.y, speed: ball.speed, active: ball.active }; },
    /** What the ball has touched, and what the control layer made of it. */
    get hits() { return hits; },
    get score() { return live.score.curScore; },
    /**
     * The comet drill as it stands, for the browser gate.
     *
     * ⚠️ A VIEW AND NOT THE MISSION. The gate may look at what is falling and what the total is; it may
     * not pay itself a point. `control/comet-mission` is where the rules are proved, with a seeded
     * generator and no browser in sight — a gate that could reach in and set the score would be
     * checking that it can set a number.
     */
    get comets() { return comets?.comets ?? []; },
    get missionPoints() { return comets?.points ?? null; },
    get lamps() { return live.litLamps(); },
    /** How far the plunger is drawn back, so a check can see the charge rather than infer it. */
    get plungerPull() { return plunger.pull; },
    get plungerHeld() { return plunger.held; },
    get playfieldX() { return shell.hud.playfield.x; },
    get cameraY() { return Math.floor(shell.camera.offset); },
    get hint() { return hint; },
    /** Exposed so the browser gate can confirm sound rather than assume it. */
    get blind() { return blind; },
    get sonar() {
      return { guideCount: shell.engine.sonar.guideCount, sonarCount: shell.engine.sonar.sonarCount };
    },
    /** The demonstration, so a check can drive it without a file dialog it cannot open. */
    get demo() { return demo; },
    loadOriginal(bytes: ArrayBuffer) {
      // The SAME options the page passes. A check that took a different path would be checking a
      // different program, which is how a discrepancy hides.
      demo = createDemo(bytes, { textFor: (id) => shell.t(keyOf(id)) });
      demoPage?.destroy();
      return { walls: demo.table.wallCount, picture: [demo.playfield.width, demo.playfield.height] };
    },
    /** Exposed so a check can see the music advance rather than assume it. */
    get music() {
      return demo?.music
        ? { notes: demo.music.notes.length, length: demo.music.length, scheduledTo: musicScheduledTo }
        : null;
    },
    get sound() {
      return { context: audio?.state ?? 'none', played: voicesPlayed, live: board.voices.length };
    },
    get objective() { return { have: state.missionHave, need: state.missionNeed, targets: state.missionTargets }; },
    get balls() { return live.flags.ballCount; },
    launch,
    /** Steps the game by hand, for a check that cannot rely on the browser compositing. */
    step,
    /** The flippers, so a check can confirm a key press reached them. */
    /**
     * ⚠️ AND THE GEOMETRY, NOT ONLY THE MOTION. This reported `motion` and `currentAngle`, which say
     * that a paddle is moving and never where it IS — so a check could confirm the simulation and had
     * no way to ask whether the screen agreed. `rotOrigin` and `t1` are the pivot and the tip the
     * renderer draws between, which is what lets a test look at the right pixels rather than hunt a
     * paddle by colour and find the guides as well.
     */
    get flippers() {
      return physics.flippers.map((f) => ({
        motion: f.motion,
        angle: f.currentAngle,
        pivot: { x: f.rotOrigin.x, y: f.rotOrigin.y },
        tip: { x: f.t1.x, y: f.t1.y },
      }));
    },
    setFlippers: (side: 'left' | 'right', extended: boolean) => physics.setFlippers(side, extended),
    unbindControls,
    get diag() { return { frameCount, lastFrames, phase, ballsLost, speed: ball.speed, y: ball.position.y }; },
    setState(next: Partial<TableState>) {
      state = { ...state, ...next };
      composePicture();
    },
  },
});

