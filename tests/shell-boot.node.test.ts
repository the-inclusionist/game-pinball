// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PAGE_MARKUP } from './helpers/page.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conformanceProblems } from '@the-inclusionist/engine/core/contract.js';
import { presetActions, presetProblems } from '@the-inclusionist/engine/core/actions.js';
import { WIDE_ARC } from '../app/js/table/catalog.js';
import { layoutHud, DEFAULT_HUD } from '../app/js/shell/hud.js';
import {
  bootPinball, createPinballOptions, createPinballWorld, pinballDeclines, REQUIRED_MARKUP,
  type BootOptions, type LiveTable, type PinballGameOptions,
} from '../app/js/shell/boot.js';

function table(over: Partial<LiveTable> = {}): LiveTable {
  return {
    playfieldWidth: 183,
    playfieldHeight: 235,
    ballRadius: 3,
    balls: [{ active: true, position: { x: 90, y: 200 }, direction: { x: 0, y: -1 }, speed: 4 }],
    components: [
      { name: 'drain', role: 'hazard', bounds: { x: 80, y: 225, width: 20, height: 10 } },
      { name: 'bump1', role: 'structure', bounds: { x: 40, y: 60, width: 10, height: 10 } },
    ],
    missionTextId: 'STRING208',
    missionHave: 3,
    missionNeed: 8,
    missionTargets: ['bump1'],
    ...over,
  };
}

const host = { doc: {} as Document, win: {} as Window };

function options(over: Partial<BootOptions> = {}): BootOptions {
  return { locale: 'pt', table: table(), host, ...over };
}

/** Stands in for the engine's `createGame`, which the entry point supplies for real. */
const fakeEngine = (problems: readonly string[] = []) =>
  (o: PinballGameOptions) => ({ problems, received: o });

/**
 * ⚠️ A TABLE WIDER THAN THE VIEW SCROLLS SIDEWAYS TOO, which phase 8 of the plan asks for in one line:
 * "mesas mais largas que 320 passam a rolar também na horizontal, pelo mesmo algoritmo de câmera".
 *
 * `wide-arc` is 360 wide against a playfield window of 320, so FORTY columns of it could never be
 * looked at. `shell/camera` was built for this from the start: `stepAxis` knows nothing about
 * vertical, and its own header says the horizontal axis calls it "with a different `anchor` and a
 * different pair of sizes". Nothing ever called it.
 *
 * ⚠️ THIS PARAGRAPH SAID 183 AND A HUNDRED AND SEVENTY-SEVEN, and contradicted the line twelve rows
 * below it, which has always said 320 and forty. The code was right and the prose was wrong, so
 * nothing failed — it merely overstated the defect fourfold, from forty columns to "nearly half the
 * table", in the paragraph somebody reads to find out what the horizontal camera is for.
 *
 * WHERE THE WRONG NUMBER COMES FROM, because it is the one anybody would reach for again: 183 is
 * `low-orbit`'s window, and it is what you get by halving the 1995 playfield and forgetting that
 * `layoutHud` clamps — `width: Math.min(playfieldWidth, screenWidth)`. A table wider than the screen
 * does not get a narrow window with columns beside it; it takes the whole screen and the HUD moves on
 * top, which is what `overlaying` reports.
 *
 * AND IT WAS FOUND BY LOOKING. `shots/authored-wide-arc.png` shows the table spanning the full width
 * of the screen, which a 183-wide window cannot do. Two of the five authored tables had never been
 * opened; this was in the first one.
 */
describe('the camera on a table wider than the window', () => {
  const wideTable = (x: number, speed = 20) => table({
    playfieldWidth: 360,
    balls: [{ active: true, position: { x, y: 120 }, direction: { x: 1, y: 0 }, speed }],
  });

  /**
   * The width the fixture above is built at, and `wide-arc`'s own — pinned to each other by the first
   * test below rather than by two people remembering the same number.
   */
  const WIDE = 360;

  /**
   * How far the view can slide sideways.
   *
   * ⚠️ THE SECOND HALF IS DERIVED, not written down, and that is the whole reason the paragraph at the
   * top of this file was wrong for months. It said the window is 183; it is 320, because `layoutHud`
   * clamps a playfield to the screen. `360 - 320` is a sum by somebody who looked both up once, and it
   * goes on saying 40 however the clamp changes.
   *
   * ⚠️ AND IT IS DERIVED FROM THE FIXTURE, NOT FROM THE CATALOGUE, which is a correction to the first
   * attempt at this. Reading `WIDE_ARC.size.width` here couples the camera's arithmetic to a table
   * these tests do not use: narrowing `wide-arc` would then fail this describe with "expected 40 to be
   * 20" while nothing about the camera had changed. The test below is where the two are tied together,
   * and it says so in one line instead of failing four in riddles.
   */
  const TRAVEL = WIDE - layoutHud({ ...DEFAULT_HUD, playfieldWidth: WIDE }).playfield.width;

  test('⚠️ and the fixture is the width of the REAL wide-arc, or this describe tests nothing', () => {
    // Every claim in this describe is about a synthetic table. It is worth having — the camera should
    // be tested at a width, not at a catalogue entry — but it is only worth reading if that width is
    // the one the game actually ships. This is the single line that makes the paragraph at the top of
    // the file a statement about `wide-arc` rather than about a number somebody chose.
    expect(WIDE_ARC.size.width, 'the fixture matches the table it is named for').toBe(WIDE);
    expect(TRAVEL, 'and forty columns are what need scrolling to reach').toBe(40);
  });

  test('⚠️ it follows the ball sideways, and the offset is what the renderer reads', () => {
    // ⚠️ AND IT STARTS AT THE FAR END, which is `createCamera`'s rule for both axes: "the view starts
    // at the far end of its travel". On the vertical that is the flippers, where the ball is; on the
    // horizontal it is the right-hand edge and it settles onto the ball over the first frames.
    const shell = bootPinball(options({ table: wideTable(20) }), fakeEngine());
    expect(shell.cameraX.offset, 'the far end of its travel').toBe(TRAVEL);

    shell.advance(120);

    expect(shell.cameraX.offset, 'and comes back to a ball on the left').toBeLessThan(TRAVEL);
  });

  test('⚠️ and it NEVER shows past either edge of the table', () => {
    // The whole point of a maximum: a window that ran past the world would show whatever is in memory
    // after the last column, which on a 32-bit buffer is the next row of the table.
    const right = bootPinball(options({ table: wideTable(359) }), fakeEngine());
    const left = bootPinball(options({ table: wideTable(1) }), fakeEngine());

    right.advance(600);
    left.advance(600);

    expect(right.cameraX.offset).toBeLessThanOrEqual(TRAVEL);
    expect(left.cameraX.offset).toBeGreaterThanOrEqual(0);
  });

  test('⚠️ and the RENDERER is handed it, which is the half a camera test cannot see', () => {
    // An inventory rather than a run, and the reason is the same one the sound-player inventory in
    // `shell-demo` gives: `main.ts` is the browser entry point and no unit test drives it. The
    // horizontal offset was a literal `0` in both draw calls for as long as the camera could have
    // supplied one, and a camera that scrolls into a renderer that ignores it changes nothing at all.
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');

    expect(source, 'the table window takes it').toMatch(/blitView\([^)]*shell\.cameraX\.offset/s);
    expect(source, 'and so does the ball').toMatch(/drawBall\([^)]*shell\.cameraX\.offset/s);
    expect(source, 'and neither is passed a literal zero any more')
      .not.toMatch(/blitView\(screen, tablePicture, shell\.hud\.playfield, 0,/);
    // And the browser gate can SEE it: the plan asks for "canvas presente + estado do jogo", and a
    // camera axis missing from `__pinball` is an axis no boot check can confirm.
    expect(source, 'the debug surface carries both axes').toMatch(/get cameraX\(\) \{ return shell\.cameraX; \}/);
  });

  test('⚠️ and the engine is told the WORDS of this game’s controls', () => {
    /**
     * ⚠️ WITHOUT THIS THE REACH CARD CANNOT FIRE AT ALL. `createGame` computes `acoesDoJogo` from the
     * preset; with none it is empty, `mostrarAvisoDeAlcance` is skipped by a length guard, and
     * `engine.alcance` answers `{ ok: false, pedidas: 0 }` — a permanent "nothing fits" that reaches
     * nobody. A child on a tablet with no keyboard and no pad gets a table, a ball, and no sentence
     * saying nothing on it can move a flipper.
     *
     * The words themselves are `shell/preset`'s and are gated there; this is the wiring, which is the
     * half that was missing for two majors.
     */
    const preset = createPinballOptions(options()).preset;

    expect(presetProblems(preset), 'the engine accepts it').toEqual([]);
    expect(presetActions(preset).length, 'and it names the cabinet\u2019s positions').toBe(8);
  });

  test('⚠️ and the FRAME LOOP is handed the engine’s failure channel, which no unit test can see', () => {
    /**
     * An inventory rather than a run, for the reason this file's camera case gives two tests up: `main.ts`
     * is the browser entry point and nothing drives it. `tests/shell-frame-loop` proves that a frame which
     * throws reaches `aoFalhar` and that NOTHING is scheduled after it; what it cannot see is whether the
     * `aoFalhar` this game passes is the ENGINE'S — the one that writes the assertive live region, draws a
     * visible box and narrates — or a stub somebody left behind.
     *
     * ⚠️ AND THE SECOND CLAUSE IS THE ONE THAT MATTERS MOST. The loop was a bare
     * `requestAnimationFrame(frame)` recursion for the whole port; a `try` that got reverted, or a second
     * loop added beside this one, would leave the game stopping in silence again — and silence is exactly
     * what this game produces while it is thinking, so nobody would notice. The engine's own note: "parar
     * não é opcional; o que ele perde é dizer que parou."
     */
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');

    expect(source, 'the loop comes from the module that carries the reasoning')
      .toMatch(/startFrames\(\{/);
    expect(source, 'and the engine is what it tells when a frame throws')
      .toMatch(/aoFalhar: \(error\) => shell\.engine\.aoFalhar\(error\)/);
    expect(source, 'and no bare frame recursion is left to stop in silence')
      .not.toMatch(/requestAnimationFrame\(frame\)/);
  });

  test('⚠️ and the accessibility keys are refused only while there is NOTHING to describe', () => {
    // This test used to say the keys are refused for the whole demonstration, and that was right for
    // as long as it was true: the declaration was built once at boot from the AUTHORED table, so with
    // the 1995 table on screen the contract answered about a table that was not there. Blind mode and
    // the sweep were refused rather than allowed to give a confident wrong answer.
    //
    // `shell/demo-world` is the other half, and the refusal narrowed with it. The demonstration now
    // answers for itself — components, roles, rectangles, the ball where it is drawn, the running
    // mission's own targets — from the moment the player's archive is read. What survives is the
    // window BEFORE that: `?demo=original` shows a file picker, and until a file is handed over there
    // is no table at all. `demoView` is exactly that fact, so the guard reads it.
    //
    // ⚠️ AN INVENTORY, NOT A RUN, and weaker for it: `main.ts` is the browser entry point and no unit
    // test drives it. The same pattern the sound-player and camera checks use, for the same reason.
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');

    // Two guards and one announcement, as plain text: a regex spanning lines would be a cleverer way
    // of saying the same thing and a worse way of failing.
    expect(source.match(/if \(demoRequested && !demoView\) return sayUnavailable\(\);/g) ?? [],
      'both keys check before they act').toHaveLength(2);
    // ⚠️ AND THE OLD GUARD IS GONE, not merely joined. A leftover unconditional refusal on either key
    // would keep saying "not here" over a table the engine can now describe perfectly well, and the
    // count above would still pass with it sitting there.
    expect(source.match(/if \(demoRequested\) return sayUnavailable\(\);/g) ?? [],
      'no key refuses unconditionally any more').toHaveLength(0);
    expect(source, 'and the refusal is spoken, not silent')
      .toContain("shell.t('pinball.a11y.unavailableInDemo')");
    // ⚠️ AND THE THING THE GUARD READS IS ACTUALLY SET. A `demoView` that stayed null for ever would
    // make both guards above true, both assertions pass, and the refusal permanent — the test would be
    // reading the same never-taken branch the code does. It is assigned where the archive arrives.
    expect(source, 'the declaration is built when the archive is read')
      .toMatch(/demoView = demoWorld\(\{ demo: ready, groups: groupsOf\(archive\) \}\)/);
  });

  test('⚠️ a finished game is OFFERED to the scoreboard, which nothing did for two days', () => {
    // `control/high-score` was transcribed, tested to the checksum, shown under the selector — and
    // never written to. Its orphan-ledger entry was retired because the title screen READS it, and
    // "something imports it" is not "the feature works". The ledger only ever asked the first
    // question; this asks the second.
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');

    expect(source, 'a finished game reaches the board').toMatch(/if \(gameOver\) highScores\.offer\(/);
    // ⚠️ AND ON THE GAME, NOT ON EVERY BALL. A board that recorded each lost ball would hold three
    // entries per game and mean nothing.
    /**
     * ⚠️ TWICE, AND THE SECOND ONE IS A WIRE RATHER THAN A SITE. A game ends three ways — the last ball
     * drains, the player chooses "Encerrar partida", or the comet drill reaches twenty points — and the
     * last two now go through `shell/end-of-game`, which is a function a test can call and watch.
     * `tests/shell-end-of-game` is that test; this was the only thing looking at those lines before.
     *
     * So `highScores.offer(` appears at the DRAIN, which stays on the table with "Fim de jogo" in the
     * corner, and once inside the `endOfGame` wiring. What this still refuses is an offer per BALL,
     * which would put three entries on the board per game.
     */
    expect(source.match(/highScores\.offer\(/g) ?? [], 'offered at the drain and through the wire')
      .toHaveLength(2);
    expect(source.match(/endGame\(endOfGame/g) ?? [],
      'the deliberate ends of a game — Quit and the won drill — both go through one function')
      .toHaveLength(2);
  });

  test('⚠️ a lit lamp reaches the PICTURE, not only the control layer', () => {
    // The class of defect this belongs to has cost two player-visible failures already: the flippers
    // drawn at rest for ever, and the lamps that lit in `live` and appeared nowhere. Both were state
    // that changes with nothing drawing it, and no gate in this repository spans the simulation and
    // the screen — which is why this one reads the entry point as text, like the others here.
    //
    // Three things have to be true and all three are separately losable: the picture is composed WITH
    // the lit set, the staleness check NOTICES the set changing, and the check keeps what it saw.
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');

    expect(source, 'the picture is drawn with the lit lamps').toMatch(/litLamps: live\.litLamps\(\)/);
    expect(source, 'and a change in them counts as a change')
      .toMatch(/litNow !== lastLit|litNow === lastLit/);
    expect(source, 'and what was seen is remembered').toMatch(/lastLit = litNow/);
  });

  test('⚠️ the palette key is CONNECTED, and the table is redrawn when it turns', () => {
    // The defect this shape of test exists for: `createGame` took `isBlindMode` and `main.ts` supplied
    // none, so the engine's default stood and the audio guide never fired — a switch nobody could
    // flip, two commits after the thing it switches was built. The palette has the same shape and the
    // same three ways to be dead, so all three are named.
    //
    // ⚠️ AN INVENTORY, NOT A RUN. `main.ts` is the browser entry point and no unit test drives it.
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');

    // 1. The key reaches a handler at all.
    expect(source, 'the controls are given a palette handler').toMatch(/cyclePalette: \(\) =>/);
    // 2. ⚠️ AND THE KEY AND THE MENU GO THROUGH THE SAME PLACE. Two callers applying a choice
    // separately is the failure with no symptom: one redraws and the other does not, or one remembers
    // and the other forgets, and the difference shows up only for the player who used both.
    expect(source, 'the key applies through the one applier')
      .toMatch(/cyclePalette: \(\) => choosePalette\(nextPalette\(palette\)\)/);
    expect(source, 'and so does the menu').toMatch(/onChoose: choosePalette/);
    // 3. The choice is remembered, or it lasts until the page reloads and no further.
    expect(source, 'and the choice is written back').toMatch(/writePalette\(localStorage, palette\)/);
    // 4. The menu is mounted where the engine's Escape chain can reach it.
    expect(source, 'the dialog goes in the game region').toMatch(/mountChoiceDialog<PaletteChoice>\(\{[^}]*host: region/s);
    // 5. ⚠️ AND THE PICTURE IS REBUILT. `tablePicture` is composed once per change and the camera moves
    // a window over it, so a handler that changed the variable and stopped would take effect at the
    // next mission event — minutes later, looking like a bug in the mission machine.
    //
    // ⚠️ THIS COUNTED FOUR, AND FOUR WAS THE DEFECT. It asserted that every one of `main.ts`'s four
    // `drawTable` calls was told the palette — which they were, and which was the least of what the
    // other three were NOT told. There is one composition now (see the count in the drop-target test
    // below), so the palette reaching it is a statement about the whole picture rather than about a
    // quorum of copies.
    expect(source, 'the one composition is told which palette')
      .toMatch(/drawTable\(\{[\s\S]*?cbSafe: isCbSafe\(palette\)/s);
    expect(source, 'and the palette handler goes through it').toMatch(/composePicture\(\);/);
  });

  test('⚠️ and a table NO wider than the window does not move sideways at all', () => {
    // Which is every other authored table and the 1995 one. The horizontal camera is built for all of
    // them and is a no-op on all but `wide-arc`; a table that jittered sideways with nothing to show
    // would be worse than one that never scrolled.
    const shell = bootPinball(options({
      table: table({
        playfieldWidth: 183,
        balls: [{ active: true, position: { x: 180, y: 120 }, direction: { x: 1, y: 0 }, speed: 20 }],
      }),
    }), fakeEngine());

    shell.advance(600);

    expect(shell.cameraX.offset).toBe(0);
  });
});

describe('the world the declaration reads is LIVE, not a copy', () => {
  test('REPLACING the ball list changes what the declaration answers', () => {
    // The point of getters, and the reason this replaces the array rather than editing it in place: a
    // copied reference would still see an edit through the same array, so only a REPLACEMENT tells a
    // view apart from a snapshot. A snapshot would have the sonar point at where the ball was.
    let balls = table().balls;
    const mutable: LiveTable = { ...table(), get balls() { return balls; } };
    const world = createPinballWorld(mutable, 'pt');

    expect(world.balls[0]!.position.y).toBe(200);
    balls = [{ active: true, position: { x: 90, y: 40 }, direction: { x: 0, y: -1 }, speed: 4 }];

    expect(world.balls[0]!.position.y).toBe(40);
  });

  test('and so does replacing the component list', () => {
    let components = table().components;
    const mutable: LiveTable = { ...table(), get components() { return components; } };
    const world = createPinballWorld(mutable, 'pt');

    expect(world.components).toHaveLength(2);
    components = [];

    expect(world.components).toHaveLength(0);
  });

  test('the mission text is TRANSLATED and counts down', () => {
    const world = createPinballWorld(table(), 'pt');

    // 8 needed, 3 had: five to go.
    expect(world.mission.objective.text).toContain('5');
    expect(world.mission.objective.text).not.toContain('STRING208');
  });

  test('the same table in another locale says it in that language', () => {
    const ptText = createPinballWorld(table(), 'pt').mission.objective.text;
    const enText = createPinballWorld(table(), 'en').mission.objective.text;

    expect(ptText).not.toBe(enText);
    expect(enText).toContain('5');
  });

  test('component names come out spoken, with a gender', () => {
    const world = createPinballWorld(table(), 'pt');

    expect(world.speak('bump1')).toEqual({ text: 'para-choque', gender: 'm', plural: false });
    expect(world.speak('soundwave9')).toBeNull();
  });
});

describe('what is handed to the engine', () => {
  test('the declaration passes the engine’s own conformance check', () => {
    const problems = conformanceProblems(createPinballOptions(options()).declaration);

    expect(problems).toEqual([]);
  });

  test('⚠️ THIS GAME DECLINES THE NEURAL VOICE, AND NOTHING ELSE', () => {
    /**
     * ⚠️ IT USED TO DECLINE NOTHING, AND THE VOICE WAS MISSING ANYWAY — which is the difference this
     * field exists for. `@mintplex-labs/piper-tts-web` drags `onnxruntime-web` in as a non-optional
     * peer, 135 MB into the `node_modules` of a game that would never speak with it, so this port has
     * always gone without; until engine 8 there was no way to SAY so, and a stub that threw
     * (`shims/piper-tts-web.ts`) stood in for the sentence.
     *
     * The engine measured what silence costs on 2026-09-08: three of its six games had no neural voice
     * and nothing anywhere said which three. Declining is a decision a reader can find; not declaring is
     * an omission that reaches a child as a menu entry that never loads.
     *
     * ⚠️ AND THE PAUSE IS NOT DECLINED BECAUSE IT CAN NO LONGER BE. `semMenuDePausa` was retired, put
     * back, and retired again in the engine's own record: the pause card and the accessibility icons
     * belong to every game. This one keeps its own menu and never opens the engine's.
     */
    expect(pinballDeclines()).toEqual({ semVozNeural: true });
    expect(createPinballOptions(options()).declines).toEqual({ semVozNeural: true });
  });

  test('⚠️ and the 285 MB of heavy things are NOT fetched, because nothing here would read them', () => {
    /**
     * ⚠️ `baixarPesados` DEFAULTS TO TRUE, and `createGame` fires it on every boot — four neural voice
     * models, a vision runtime and its three models, ~285 MB into Cache Storage in the background.
     *
     * Three reasons this cartridge says no, and the first is the one that settles it:
     *   · NOTHING HERE READS THAT CACHE. It is served by a service worker, and this repository has no
     *     service worker and no web manifest. The bytes would arrive and be read by nobody.
     *   · The voices could not be spoken with anyway — see the decline above.
     *   · A BROWSER SUITE WOULD FIRE IT. In Node `caches` is undefined and the download fails
     *     harmlessly; under Playwright it is defined, and every booting suite would pull 285 MB from a
     *     CDN. The engine's own note says a real-browser case must not do that.
     *
     * 📌 One line, reversible: the day this game becomes a PWA, or opens the voice door, the reason
     * above stops holding and the flag comes out.
     */
    expect(createPinballOptions(options()).baixarPesados).toBe(false);
  });

  test('⚠️ and the REASON for that false is checked, because it is the kind that outlives itself', () => {
    /**
     * ⚠️ ADR-0010 NAMES THIS DEFECT AGAINST ITSELF: "`baixarPesados: false` IS A DEFAULT REFUSED, WHICH
     * IS THE KIND THAT ROTS QUIETLY. If this game gains a service worker and nobody reopens this record,
     * the flag will go on refusing a download that by then WOULD have a reader."
     *
     * The reason the flag is false is not the size of the download. It is that NOTHING HERE READS THAT
     * CACHE: `platform/pesados` fills a Cache Storage bucket a service worker serves from, and this
     * repository has neither a service worker nor a web manifest. The day one is committed, the reason
     * stops holding — and a reason that lives only in a comment is the one that ships stale.
     *
     * So the condition is a gate rather than a sentence. It cannot decide what the flag should become;
     * it can only refuse to let the question go unasked.
     *
     * ⚠️ AND IT READS `git ls-files` RATHER THAN THE FILESYSTEM, deliberately: a service worker built
     * into `dist` is not the thing that changes this decision. A service worker somebody COMMITTED is.
     */
    const tracked = execFileSync('git', ['ls-files'], {
      cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..'), encoding: 'utf8',
    }).split('\n').filter(Boolean);
    const readers = tracked.filter((f) => /(^|\/)(sw|service-worker)\.[cm]?[jt]s$|\.webmanifest$/.test(f));

    expect(readers, 'a service worker or manifest landed: ADR-0010 has to be reopened, because '
      + 'baixarPesados: false now refuses a download that has a reader').toEqual([]);
  });

  test('⚠️ and it is navigable WHEN A MENU IS ON SCREEN, which is what reopens the engine', () => {
    /**
     * ⚠️ THE PREDICATE STOPS BEING A CONSTANT. `shell/boot`'s own header named the shape this would take
     * when it became possible: "when engine menus become reachable the predicate will ask whether ONE IS
     * ON SCREEN, which is a different question and takes a different argument". This is that argument.
     *
     * ⚠️ IT IS NOT `phase === 'paused'`, WHICH IS WHAT IT USED TO BE AND WHAT COST THE PAUSE MENU. The
     * engine listens at WINDOW CAPTURE, so a predicate that says yes while nothing is open hands it every
     * cabinet key before the game sees them. The engine's own guard only consumes a key when there is
     * something to navigate — but the thing it asks is `sharedDialogOpen()`, and §6 is what made that
     * answer the truth.
     *
     * Absent, it is `false`: a host that does not answer the question gets the behaviour that was safe.
     */
    expect(createPinballOptions(options()).isNavigable(), 'no host answer means no navigation').toBe(false);
    expect(createPinballOptions(options({ menuIsUp: () => true })).isNavigable()).toBe(true);
    expect(createPinballOptions(options({ menuIsUp: () => false })).isNavigable()).toBe(false);
  });

  test('⚠️ it is navigable for NOBODY, and that is a correction', () => {
    /**
     * This asserted `paused -> true` and was the decision, not a description of one: the engine may
     * walk its own menus while the game is stopped. Measured in a real browser, what it actually did
     * was hand the engine every navigation key.
     *
     * `ui/menu-nav` attaches a WINDOW-CAPTURE keydown listener that begins `if (!ctx.isNavigable())
     * return;`. Window capture runs before every listener in the page, so while this game said
     * "navigable" the engine consumed Enter, A, D, J, K and H before they reached anything — and this
     * port draws its OWN pause menu, so the engine had nothing on screen to navigate with them. The
     * game paused and could not be un-paused, which is what the Dev reported.
     *
     * `KeyU` survived, which is why the plunger alone kept working and the failure looked arbitrary.
     *
     * ⚠️ AND THE REPLACEMENT IS NOT "false FOR EVER". The predicate that belongs here is "an ENGINE
     * menu is on screen", which is a fact about the engine's state rather than about this game's
     * phase — and it is what the Dev's "editar controle" and "modos de acessibilidade para visão"
     * will need, because those ARE the engine's own menus. `tests/pause-menu-cabinet.browser` is what
     * would go red if this came back as a phase test.
     */
    expect(createPinballOptions(options()).isNavigable(),
      'the engine must not take the keys, in any phase').toBe(false);
  });

  test('⚠️ and the PHASE is no longer among the things the engine is told', () => {
    /**
     * This was "the phase is asked EVERY time, not read once at boot" — a real property of a real
     * option, and the option is gone. `isNavigable` was the only reader, it is constant now (see the
     * test above for why), and a declared option nothing reads is a promise the interface cannot
     * keep. Deleting the assertion silently would leave the seam looking as though it still carried
     * the phase, so this is what replaced it: the fact itself.
     */
    expect(Object.keys(options())).not.toContain('phase');
    expect('phase' in createPinballOptions(options())).toBe(false);
  });

  test('blind mode is passed through only when the host offers it', () => {
    expect(createPinballOptions(options()).isBlindMode).toBeUndefined();
    expect(createPinballOptions(options({ isBlindMode: () => true })).isBlindMode?.()).toBe(true);
  });

  test('the markup the engine requires is named, so a host can be checked against it', () => {
    /**
     * ⚠️ `#title-icons` ARRIVED WITH ENGINE 8, and it is the one on this list the engine WRITES INTO
     * rather than reads. `createGame` mounts the first screen's accessibility bar there — blind mode,
     * the screen reader, Libras, the autism adjustments, latching — and a document without it
     * gets a line in `problems` saying the child cannot reach any of them before the game starts.
     */
    expect(REQUIRED_MARKUP).toEqual(['#game-region', '#sr-status', '#sr-alert', '#title-icons']);
  });

  test('⚠️ and the page this repository SHIPS has every one of them', () => {
    /**
     * ⚠️ NAMING THE MARKUP AND SHIPPING IT ARE TWO THINGS, and until engine 8 only the first was
     * checked. The engine does not throw for a missing id — it REPORTS, into a `problems` array that a
     * console warning is the only reader of — so a page that lost one would boot, look fine, and have
     * lost a feature nothing announces. That is how `#title-icons` was missing everywhere at once: five
     * of the engine's six games had no accessibility bar and nothing anywhere said so.
     */
    const page = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/index.html'), 'utf8');

    for (const selector of REQUIRED_MARKUP) {
      expect(page, `app/index.html is missing ${selector}`).toContain(`id="${selector.slice(1)}"`);
    }
  });

  test('⚠️ and so does the fixture every browser suite boots against', () => {
    /**
     * ⚠️ THE FIXTURE CLAIMED TO BE A COPY OF THAT PAGE, TWELVE TIMES OVER, and nothing checked the
     * claim. Each browser suite carried the markup inline under the same comment — "the page's own
     * markup, as app/index.html writes it" — so when engine 8 added one element, all twelve went stale
     * at once and every browser suite failed at import in both engines.
     *
     * They are one string now in tests/helpers/page, and this is what keeps that string honest.
     */
    for (const selector of REQUIRED_MARKUP) {
      expect(PAGE_MARKUP, `the browser fixture is missing ${selector}`)
        .toContain(`id="${selector.slice(1)}"`);
    }
  });
});

describe('booting', () => {
  test('what the host failed to provide is handed on, not swallowed', () => {
    const shell = bootPinball(options(), fakeEngine(['#sr-alert missing']));

    expect(shell.problems).toEqual(['#sr-alert missing']);
  });

  test('the caller keeps the engine it handed over, fully typed', () => {
    const shell = bootPinball(options(), (o) => ({ problems: [], received: o }));

    expect(shell.engine.received.declaration).toBe(shell.declaration);
  });

  test('the HUD is laid out for THIS table’s width', () => {
    const shell = bootPinball(options(), fakeEngine());

    expect(shell.hud.playfield.width).toBe(183);
    expect(shell.hud.overlaying).toBe(false);
  });

  test('a table as wide as the screen makes the HUD say it is overlaying', () => {
    const wide = options({ table: table({ playfieldWidth: 320 }) });

    expect(bootPinball(wide, fakeEngine()).hud.overlaying).toBe(true);
  });

  /**
   * ⚠️ A CROSSING IS A HIT, AND THE MISSION MACHINE WAS NEVER TOLD.
   *
   * Half of what an authored table offers is regions the ball rolls OVER — lanes, wells, kickers,
   * holes. Nothing collides to report one, so `table/rollovers` polls for them, and the frame loop
   * pushed the result into the SCORE and not into the missions. `low-orbit`'s third mission names
   * three lanes: it could never be completed, and the campaign stopped there for the rest of the game.
   *
   * In silence, as usual. The table validated, the lanes scored, the runner had tests of its own, and
   * the sonar went on pointing at three lanes the player kept crossing.
   *
   * ⚠️ THIS IS A SOURCE GATE BECAUSE THE LOOP IS THE ENTRY POINT. `table/rollovers` and
   * `table/missions` are both unit-tested and both were right; what was missing was the line between
   * them, and no unit can see a line that is not there. Proven by mutation instead: deleting the call
   * fails this and nothing else.
   */
  test('⚠️ a rollover crossing reaches the missions, not only the score', () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');
    const loop = source.slice(source.indexOf('for (const name of rollovers.poll('));
    const block = loop.slice(0, loop.indexOf('}'));

    expect(block, 'the crossing is scored').toMatch(/live\.hit\(name\)/);
    expect(block, 'and the missions are told about it too').toMatch(/missions\.hit\(name\)/);
  });

  /**
   * ⚠️ A DROPPED TARGET HAS TO REACH BOTH THE PICTURE AND THE PHYSICS, or a bank is half a mechanic.
   *
   * `table/target-bank` decides one is down, `drawTable`'s `hidden` stops drawing it and
   * `setComponentActive` stops it being a wall. All three are tested on their own. What no unit can
   * see is whether the frame loop tells the last two what the first one decided — and a bank that
   * scores while the target stays drawn and solid is the flippers' defect and the lamps' defect
   * arriving a third time.
   */
  test('⚠️ a dropped target leaves the picture AND the table', () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');

    /**
     * ⚠️ ONE LIST FOR BOTH, AND IT USED TO BE `live.downTargets()` TWICE. A secret passage is the
     * second answer to "what is not there right now" — a door that has opened — and the moment there
     * were two answers, two call sites reading the same expression became two call sites that could
     * come to differ. `hiddenNow` is built once and handed to the picture and to the physics, which is
     * what makes them agree by construction rather than by both being edited.
     */
    expect(source, 'the two answers are one list, written once')
      .toMatch(/function notThere\(\)[\s\S]*?live\.downTargets\(\), \.\.\.openSecrets\(/s);
    expect(source, 'the picture is told what is not there')
      .toMatch(/drawTable\(\{[\s\S]*?hidden: notThere\(\)/s);
    expect(source, 'and so is the physics')
      .toMatch(/const hiddenNow = notThere\(\)/s);
    expect(source, 'through that same list')
      .toMatch(/setComponentActive\([^)]*hiddenNow\.includes\(/s);
    /**
     * ⚠️ AND THE TABLE IS DRAWN IN EXACTLY ONE PLACE, WHICH IT WAS NOT.
     *
     * `drawTable` has grown an argument every time something started changing that the picture had to
     * follow — seven of them now — and this file had FOUR call sites, of which one had learnt them
     * all. Switching the palette recomposed with three, putting back a table with no lamps lit, its
     * dropped targets standing, its secret door sealed and its storm frozen. It is also how the
     * artwork was found not to appear: a short call site ran after the picture was painted and threw
     * it away.
     *
     * A count rather than an inspection, because the defect is not what any one call passes — it is
     * that there is more than one call to keep in step.
     */
    expect(source.match(/drawTable\(/g)?.length, 'the table is composed in exactly one place').toBe(1);
  });

  /**
   * ⚠️ THE PLUNGER ASKS WHERE THE BALL IS, AND IT USED TO ASK WHAT PHASE THE GAME WAS IN.
   *
   * `inPlungerLane` is unit-tested on all six tables and `main.ts` is the only place it can be
   * consulted from — the plunger lives in the entry point's cabinet, which no unit drives. A guard
   * that goes back to reading the phase is exactly the defect the Dev reported, and it would leave
   * every test green.
   */
  test('⚠️ the plunger is guarded on the lane, not on the phase', () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');
    const from = source.indexOf('setPlunger: (pressed: boolean)');
    const block = source.slice(from, source.indexOf('launch: ()', from));

    expect(block, 'it asks where the ball is').toMatch(/inPlungerLane\(authored, ball\)/);
    expect(block, 'and not what phase the game is in').not.toMatch(/phase === 'playing'/);
  });

  /**
   * ⚠️ A TRAVELLING BODY HAS TO BE ADVANCED AND DRAWN, and each half is useless alone.
   *
   * This is the fourth body in this game with the same requirement and the third time the requirement
   * has had to be discovered: the flippers were stroked into a composition made once per change and
   * stayed at their resting angle for weeks, the plunger never slid, and the lamps lit in the control
   * layer and reached no pixel. `drawTable` skips anything with a `mover`, so a drone that the frame
   * loop does not draw is INVISIBLE rather than merely stale — and one it does not advance sits at the
   * start of its path for ever while the ball bounces off it there.
   *
   * No unit can see either line. This is the gate written before the fourth instance instead of after.
   *
   * ⚠️ AND "WITH THE WORLD" IS `tableSeconds` NOW, NOT THE FRAME COUNT. The comet drill slows the
   * table's own clock, and a crane still sweeping at full speed past a ball at three fifths would hit
   * harder during a mission than outside one. The line this reads for is the one that keeps them in the
   * same time as the ball they can collide with; matching the old real-time expression would pass on a
   * mover that had fallen out of it.
   */
  test('⚠️ the frame loop advances the movers AND draws them', () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');

    expect(source, 'they are advanced with the world').toMatch(/mover\.advance\(tableSeconds\)/);
    expect(source, 'and drawn where they are').toMatch(/drawMover\(\s*screen, mover\.at/);
  });

  test('the camera starts on the flippers', () => {
    expect(bootPinball(options(), fakeEngine()).camera.offset).toBe(55);
  });
});

describe('⚠️ advance counts FRAMES, not seconds', () => {
  test('one call of sixty frames equals sixty calls of one', () => {
    // The engine's `update(dt)` is in frames and the camera's damping is per frame. Reading it as
    // seconds would make the camera about sixty times too slow, and nothing would error.
    const climbing = table({
      balls: [{ active: true, position: { x: 90, y: 60 }, direction: { x: 0, y: -1 }, speed: 4 }],
    });

    const inOneGo = bootPinball(options({ table: climbing }), fakeEngine());
    const oneByOne = bootPinball(options({ table: climbing }), fakeEngine());

    inOneGo.advance(60);
    for (let i = 0; i < 60; i++) oneByOne.advance(1);

    expect(inOneGo.camera.offset).toBeCloseTo(oneByOne.camera.offset, 9);
  });

  test('a frame actually moves the view when the ball is high', () => {
    const climbing = table({
      balls: [{ active: true, position: { x: 90, y: 60 }, direction: { x: 0, y: -1 }, speed: 4 }],
    });
    const shell = bootPinball(options({ table: climbing }), fakeEngine());

    shell.advance(30);

    expect(shell.camera.offset).toBeLessThan(55);
  });

  test('with no ball in play the view does not drift', () => {
    const shell = bootPinball(options({ table: table({ balls: [] }) }), fakeEngine());

    shell.advance(100);

    expect(shell.camera.offset).toBe(55);
  });

  test('a DRAINED ball does not drag the view, however high it is left', () => {
    // The ball list keeps the ball after it drains, inactive. Taking the first of the list instead of
    // the first ACTIVE one would follow a ball that is no longer in play.
    const drained = table({
      balls: [
        { active: false, position: { x: 90, y: 20 }, direction: { x: 0, y: -1 }, speed: 8 },
      ],
    });
    const shell = bootPinball(options({ table: drained }), fakeEngine());

    shell.advance(60);

    expect(shell.camera.offset).toBe(55);
  });

  test('and with one drained and one live ball, the LIVE one is followed', () => {
    const both = table({
      balls: [
        { active: false, position: { x: 10, y: 230 }, direction: { x: 0, y: 1 }, speed: 8 },
        { active: true, position: { x: 90, y: 40 }, direction: { x: 0, y: -1 }, speed: 4 },
      ],
    });
    const shell = bootPinball(options({ table: both }), fakeEngine());

    shell.advance(60);

    expect(shell.camera.offset).toBeLessThan(55);
  });

  test('the camera reads the ball’s VERTICAL speed, not its total', () => {
    // A ball moving fast sideways and barely upward must not drag the view at its full speed.
    const sideways = table({
      balls: [{ active: true, position: { x: 90, y: 60 }, direction: { x: 1, y: 0 }, speed: 20 }],
    });
    const shell = bootPinball(options({ table: sideways }), fakeEngine());

    shell.advance(30);

    expect(shell.camera.offset).toBe(55);
  });
});

/**
 * ⚠️ THE VIEW A LOST BALL LEAVES BEHIND.
 *
 * The camera's step is capped at a fraction of the BALL'S OWN SPEED — the rule that stops the view
 * outrunning the thing the player is watching, and `shell/camera`'s own header states the consequence
 * plainly: "with the ball still, the cap is zero and the camera cannot move". That consequence was
 * written down and never followed to where it bites.
 *
 * It bites between balls. A ball drains from high on the table with the view up there following it;
 * the next ball is placed at the plunger with a speed of nought; the cap is nought; the offset never
 * comes back. The player is looking at a stretch of empty mid-table — no flippers, no plunger — and
 * the plunger key looks broken because the lane it works in is off the bottom of the window. The
 * launch then scrolls them somewhere they did not ask to go.
 *
 * ⚠️ AND THE FIRST FIX WAS FOR THE WRONG CAUSE. `main.ts` advances the camera inside its
 * `phase === 'playing'` block, and after the plunger's charge and the pad poll turned out to be
 * stranded in that same block, this looked like the third of a set. Moving it out would have changed
 * NOTHING — a still ball caps the step at nought either way — and would have broken pause, which is
 * also not `playing` and is supposed to hold the picture still. The browser test written to prove the
 * move failed, which is the only reason any of that was found before it was committed.
 */
describe('a new ball gets the view back', () => {
  const highAndFast = () => table({
    balls: [{ active: true, position: { x: 90, y: 40 }, direction: { x: 0, y: -1 }, speed: 6 }],
  });

  test('⚠️ resetting puts the view back on the flippers, whatever the last ball did to it', () => {
    const shell = bootPinball(options({ table: highAndFast() }), fakeEngine());
    shell.advance(120);
    expect(shell.camera.offset, 'the ball dragged the view up first').toBeLessThan(55);

    shell.resetCamera();

    expect(shell.camera.offset, 'and a new ball starts where a start belongs').toBe(55);
  });

  test('⚠️ and the camera CANNOT do it on its own, which is why this exists at all', () => {
    // The evidence for the paragraph above rather than a restatement of it, and the exact sequence the
    // player lives through: a ball drags the view up, drains, and is replaced by a still one at the
    // plunger. Two seconds of frames later the view has not moved a pixel, because the cap is a
    // fraction of a speed of nought. Without `resetCamera` this is what a new ball looks like.
    // Declared here rather than read back out of the table, because `LiveTable`'s balls are readonly
    // to their reader — which is the shell. The entry point holds the mutable one, as this does.
    const climbing = { active: true, position: { x: 90, y: 40 }, direction: { x: 0, y: -1 }, speed: 6 };
    const shell = bootPinball(options({ table: table({ balls: [climbing] }) }), fakeEngine());
    shell.advance(120);
    const stranded = shell.camera.offset;
    expect(stranded, 'the view is up the table').toBeLessThan(55);

    // `physics.spawnBall` puts the next ball in the lane at rest, and `main.ts` copies exactly this.
    climbing.position = { x: 176, y: 225 };
    climbing.speed = 0;
    shell.advance(120);

    expect(shell.camera.offset, 'and it stays there, for ever').toBe(stranded);
  });

  test('both axes come back, because a wide table scrolls sideways too', () => {
    // ⚠️ AND THE HORIZONTAL AXIS RESTS AT THE FAR END, not at the left, which is what this test
    // claimed until it was run. `createCamera` starts every axis at `maxOffsetOf` — for the vertical
    // that is the bottom, where the flippers are, and for a 360-wide table against a 320 window it is
    // the 40 columns on the right, where the plunger lane is. Both are "the corner a ball starts in",
    // which is the rule; "the left" was my paraphrase of it and was wrong.
    const wide = table({
      playfieldWidth: 360,
      balls: [{ active: true, position: { x: 40, y: 40 }, direction: { x: -1, y: -1 }, speed: 6 }],
    });
    const shell = bootPinball(options({ table: wide }), fakeEngine());
    shell.advance(120);
    expect(shell.cameraX.offset, 'the view followed it left').toBeLessThan(40);

    shell.resetCamera();

    expect(shell.cameraX.offset, 'and comes back to the lane the next ball starts in').toBe(40);
  });

  test('⚠️ and the DRAIN is where it is called — the half no camera test can see', () => {
    // The pattern this repository keeps paying for: a capability that exists, is tested, and is never
    // reached. `resetCamera` with no caller is a method that passes its own tests for ever while the
    // player still stares at empty table.
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8');
    const drainBlock = source.slice(source.indexOf('const drained = drainedBy('));

    expect(drainBlock.slice(0, drainBlock.indexOf('shell.advance(')),
      'the lost ball puts the view back before the next frame is composed')
      .toMatch(/shell\.resetCamera\(\)/);
  });
});
