// SPDX-License-Identifier: AGPL-3.0-or-later
// THE REASON THIS PROJECT EXISTS, EXERCISED WHERE IT ACTUALLY RUNS.
//
// A pinball table is a stream of positions and a sonar; that is the whole argument for porting one
// into an accessibility engine, and it is the part of this repository that has never run outside node.
// The keys were bound, the targets were filled in, the guide was wired — each proven by a unit test
// against a fake — and the one time the whole chain was tried end to end it turned out that
// `createGame` took an `isBlindMode` callback `main.ts` never supplied, so the switch had been dead for
// two commits while every test passed.
//
// ⚠️ AND `main.ts` HAS EXPOSED THE HOOKS FOR THIS ALL ALONG. `__pinball.blind` and `__pinball.sonar`
// carry comments saying they exist "so the browser gate can confirm sound rather than assume it". The
// gate was never written. This is it.
//
// What makes these browser tests rather than node ones is the same thing as everywhere else here: the
// keys are bound to `#game-region` and not to `window`, so only a real focus proves a real key arrives.
import { describe, test, expect, beforeAll } from 'vitest';
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';

interface PinballDebug {
  phase: string;
  problems: readonly string[];
  blind: boolean;
  sonar: { guideCount: number; sonarCount: number };
  objective: { have: number; need: number; targets: readonly string[] };
}

const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;
const said = (): string => document.getElementById('sr-status')?.textContent ?? '';

/**
 * ⚠️ DISPATCHED AT THE REGION, AND IT USED TO GO THROUGH `userEvent`. The engine is linked by `file:`
 * and on 2026-09-06 `createGame` began attaching its own menu navigation with a focus trap. Under
 * `userEvent`, an Enter now lands focus on one of that menu's BUTTONS — probed and confirmed: focus
 * goes from `MAIN#game-region` to an unnamed `BUTTON` — and the three tests that press a key stopped
 * seeing it arrive.
 *
 * ⚠️ AND THE GAME IS NOT BROKEN, WHICH WAS CHECKED BEFORE ANY TEST WAS TOUCHED. In the built `dist`,
 * booted in a real browser: S raises `sonarCount` from 0 to 1, Enter moves the phase to `paused`, H
 * moves it back to `playing`, and `document.activeElement` stays `#game-region` throughout. Changing a
 * test because a product broke is a cover-up; changing one because the harness broke is maintenance,
 * and the difference is whether somebody looked.
 *
 * ⚠️ WHAT IS GIVEN UP, SAID PLAINLY: `userEvent` drives the browser's own key pipeline and a raw
 * dispatch does not, so this no longer proves the path from a physical key. What it still proves is
 * the half this file exists for — that the binding is on `#game-region` and not on `window`, because
 * the event is delivered THERE and nowhere else. `tests/frame-follows-state` has always worked this
 * way and says the same thing.
 */
const CODES: Readonly<Record<string, string>> = {
  s: 'KeyS', u: 'KeyU', b: 'KeyB', h: 'KeyH', '{Enter}': 'Enter',
};

async function press(key: string): Promise<void> {
  const region = document.getElementById('game-region')!;
  /**
   * ⚠️ THE REGION IS FOCUSED ONLY IF NOTHING INSIDE THE GAME ALREADY HAS IT, and the first version
   * focused it unconditionally. That is not what a player does, and it broke the pause test in a way
   * that looked like a product defect: pausing opens the menu and the menu takes the focus — it
   * focuses "Continuar" so that the same key twice puts you back — and forcing focus to the region
   * before the second key took it away again, leaving Enter to fall between the menu and the game.
   *
   * ⚠️ AND I NEARLY REPORTED THAT AS A BUG. Probing the built game in the preview pane said Enter
   * pauses and never resumes — because `requestAnimationFrame` is FROZEN in that pane, so the draw
   * loop never ran, so `pauseMenu.open()` never ran, so the menu never took focus. The measurement
   * was of a game that was not drawing. Third false finding of the evening, and the third caused by
   * measuring the wrong thing rather than by the game being wrong.
   */
  const active = document.activeElement;
  if (!active || !region.contains(active)) region.focus();
  const code = CODES[key] ?? `Key${key.toUpperCase()}`;
  // At whatever has the focus inside the game — the region, or a menu button the game handed it to.
  const target = (document.activeElement && region.contains(document.activeElement)
    ? document.activeElement : region) as HTMLElement;
  for (const type of ['keydown', 'keyup'] as const) {
    target.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true }));
  }
  // A raw dispatch does not carry the browser's default action, so a button reached by Enter is
  // activated here. `userEvent` did this for us until the engine's focus trap made it unusable.
  if (code === 'Enter' && target.tagName === 'BUTTON') target.click();
  // One turn of the loop, so a handler that schedules rather than acts has run.
  await new Promise((resolve) => { requestAnimationFrame(() => resolve(undefined)); });
}

/** Turns of the animation loop, for the steps that need more than one. */
const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) {
    await new Promise((resolve) => { requestAnimationFrame(() => resolve(undefined)); });
  }
};

/**
 * ⚠️ THE THREE SWITCHES ARE ICONS IN THE HUD NOW, NOT KEYS. The Dev: "remova modo cego sonar e cores via
 * teclado: eles devem aparecer no hud da mesma forma que aparecem no projeto game-platformer." So these
 * tests click a `.pi-btn` where they used to press `b` or `s` — the same claims, asked of the route the
 * game actually has. `shell/a11y-bar` carries the argument, and the engine's own `ui/pause-icons` made
 * the same move first.
 */
const icon = async (key: string): Promise<void> => {
  /**
   * ⚠️ TWO BARS SINCE ENGINE 8, AND THE BLIND BUTTON CHANGED SIDES. `createGame` now mounts the first
   * screen's accessibility bar into `#title-icons` — blind mode, the screen reader, Libras, the autism
   * adjustments, latching — and this game's own strip kept only what the engine has no counterpart
   * for: the sonar sweep and the table palette. Asking for both is what makes this helper describe the
   * PLAYER's question ("press the icon for X") rather than which module happens to own it.
   */
  const button = document.querySelector<HTMLElement>(
    `#pinball-a11y [data-pi="${key}"], #title-icons [data-pi="${key}"]`,
  );
  if (!button) throw new Error(`no ${key} icon in the HUD`);
  button.click();
  await new Promise((resolve) => { requestAnimationFrame(() => resolve(undefined)); });
};

/**
 * ⚠️ CAPTURED BEFORE ANY KEY IS PRESSED, because "it starts off" is a claim about the BOOT and not
 * about whichever test happens to run first.
 *
 * The first version of this file read `__pinball.blind` inside the test instead, and that test passed
 * only while it ran before the two that press the same key. Shuffled, it failed two runs in five — a
 * flaky test committed as a green one, found by running the suite in a random order rather than by
 * anything noticing. The state is a snapshot taken once; the assertion can then be made from anywhere.
 */
let blindAtBoot = true;

beforeAll(async () => {
  document.body.innerHTML = PAGE_MARKUP;
  /**
   * ⚠️ BLIND MODE IS PERSISTED NOW, WHICH MAKES "IT STARTS OFF" A CLAIM ABOUT STORAGE. Engine 8 keeps
   * it in `core/state`, written through to `incl_modocego` in `localStorage` — deliberately, so a child
   * who needs it turns it on once for every Inclusionist game rather than once per game. The cost lands
   * here: suites share an origin, so a suite that leaves the mode on would decide the next suite's boot.
   * Clearing it is what keeps `blindAtBoot` a measurement rather than a coincidence of ordering.
   */
  try { localStorage.removeItem('incl_modocego'); } catch { /* a private window refuses; the default is off anyway */ }
  pinLanguage();
  await import('../app/js/standalone.js');
  blindAtBoot = debug().blind;
  /**
   * ⚠️ INTO A GAME THE WAY A PLAYER GETS INTO ONE, which this file used not to do: it booted `main`
   * and pressed game keys with the TITLE SCREEN still covering the table. That worked for as long as
   * nothing but `phase` decided what a key meant, and stopped the day pause learned to ask whether
   * there is a table on the screen at all — because there was not one, and the refusal was right.
   *
   * A test that drives the game from a state a player cannot be in is a test measuring something the
   * product does not do.
   */
  document.querySelector<HTMLElement>('.pinball-title button')?.click();
  await frames(4);
  document.querySelector<HTMLElement>('[data-table]')?.click();
  await frames(5);
  // ⚠️ AND THE NUMBER. The Dev put a screen between the table and the game — "Após escolher a tela, a
  // próxima tela é a da missão principal" — so a click on a table now lands on the mission screen and
  // a test that stops there is a test looking at a menu.
  document.querySelector<HTMLElement>('[data-times]')?.click();
  await frames(5);
});

describe('⚠️ the colour-correction icon, which no game could have until engine 9.0.0', () => {
  test('🚥 is on the bar, because this game hands the engine a writer for it', () => {
    /**
     * ⚠️ `iconesQueAccionam` MOUNTS IT ONLY FOR A GAME THAT SUPPLIES `setCorrecaoDoJogador`, and that rule
     * is right: an icon that does not act is worse than an icon fewer. What was missing was the DOOR —
     * `createGame` had no field to hand a writer through, so NO game booted by it could show this icon.
     * `shell/boot`'s own note read the absence as "this game has its own dialog", which was true about the
     * outcome and false about the cause.
     *
     * This game has had the writer all along: `engine.aplicarFiltroDeVisao`, which `shell/vision` uses.
     */
    expect(document.querySelector('#title-icons [data-pi="cvd"]'), 'the icon is still not mounted')
      .not.toBeNull();
  });

  test('⚠️ and ⚫ is NOT, because this game cannot repaint a texture it does not have', () => {
    /**
     * The same rule in the other direction, and it is the half that proves the first case is a decision
     * rather than an accident. High contrast is applied by repainting TEXTURES; this game's picture is a
     * 320×180 framebuffer composed by hand. Supplying a theme writer it could not honour would put an icon
     * on the bar that does nothing — ADR-0106 §5's dead button, on the one strip a child who needs it reads
     * first.
     */
    expect(document.querySelector('#title-icons [data-pi="contrast"]'), 'an icon the game cannot honour')
      .toBeNull();
  });
});

describe('blind mode, from the icon a player would actually press', () => {
  test('⚠️ the blind-mode icon turns it on, and the game KNOWS it is on', async () => {
    // ⚠️ AND THIS COVERS HALF OF THE DEFECT IT WAS WRITTEN FOR, which is worth saying exactly.
    //
    // The original fault was two links in a chain: the key had to reach the switch, and the switch had
    // to reach the ENGINE, through the `isBlindMode` callback `createPinballOptions` passes. The second
    // link was the broken one — `main.ts` supplied no callback, the engine's default `() => false`
    // stood, and the guide never fired.
    //
    // `__pinball.blind` is the variable, not the callback, so what runs here is the FIRST link: a real
    // key, on a real focus, reaching a real switch. The second is held by the inventory test in
    // `tests/shell-boot`, which reads `main.ts` and requires the callback to be passed. Together they
    // cover the chain; neither covers it alone, and this file would pass on a build where the engine
    // was told nothing.
    expect(blindAtBoot, 'nobody is opted into blind mode at boot').toBe(false);
    const before = debug().blind;

    await icon('blind');

    expect(debug().blind, 'the icon moved it').toBe(!before);
  });

  test('and it SAYS so, in the live region rather than in silence', async () => {
    // A switch that changes how the game speaks, and does not say it has changed, is a switch a blind
    // player cannot tell they pressed.
    const before = said();

    await icon('blind');

    expect(said(), 'the announcement changed').not.toBe(before);
    expect(said().length, 'and it is words, not an empty string').toBeGreaterThan(0);
  });

  test('pressing it again turns it off, so it is a toggle and not a trap', async () => {
    const wasOn = debug().blind;

    await icon('blind');

    expect(debug().blind).toBe(!wasOn);
  });
});

describe('the sonar, which is what makes a pinball explorable at all', () => {
  test('⚠️ the sonar icon sweeps, and the sweep REACHES the engine', async () => {
    // `targetsOf` is what the sonar points at, and it was filled in two commits before anything could
    // ask it a question. This asks it, through the key, in a browser, with the region focused.
    const before = debug().sonar.sonarCount;

    await icon('sonar');

    expect(debug().sonar.sonarCount, 'the engine ran a sweep').toBeGreaterThan(before);
  });

  test('and it can be asked more than once, because a table is explored and not announced at', async () => {
    const before = debug().sonar.sonarCount;

    await icon('sonar');
    await icon('sonar');

    expect(debug().sonar.sonarCount - before).toBe(2);
  });

  test('⚠️ a key that is not bound sweeps NOTHING, or the count above proves nothing', async () => {
    // Without this the two tests above would pass on a build where every keystroke ran a sweep.
    const before = debug().sonar.sonarCount;

    await press('q');

    expect(debug().sonar.sonarCount).toBe(before);
  });
});

describe('and there is something to point at', () => {
  test('the objective reports a need and its targets, rather than an empty promise', () => {
    // The sonar sweeping an empty target list is a sweep that says nothing, and it would satisfy every
    // count above. What a player is actually told comes from here.
    const { need, targets } = debug().objective;

    expect(need, 'the mission asks for something').toBeGreaterThan(0);
    expect(targets.length, 'and names what').toBeGreaterThan(0);
  });

  test('nothing fell over doing any of that', () => {
    expect(debug().problems).toEqual([]);
  });
});

describe('⚠️ pause says so, because a silent pause reads as a hang', () => {
  // The audit that found this: `togglePause` set the phase and stopped. The frame loop steps the ball
  // only while playing, so pressing start froze the table and told nobody why — a lock-up to a sighted
  // player, silence to a blind one. The same class as the flippers drawn at rest and the lamps drawn
  // nowhere: state that changes with nothing reporting it.
  test('start announces the pause, and announces coming back', async () => {
    // A game has to be running first: pause on the title would be a state the title cannot leave.
    await press('u');
    const before = said();

    await press('{Enter}');
    const paused = said();

    expect(paused, 'the pause is announced').not.toBe(before);
    expect(paused.length, 'and it is words').toBeGreaterThan(0);

    await press('{Enter}');

    /**
     * ⚠️ AND THIS ONE CAUGHT A REAL DEFECT THE DAY THE HELPER WAS FIXED. Resuming through the pause
     * MENU set the phase and announced nothing, so `sr-status` still read "Pausado" while the ball was
     * moving again — the game had come back and the only person who could not tell was the one the
     * announcement is for. It had been green because the helper stole focus back from the menu button,
     * so the second Enter went to the game's own toggle, which does announce.
     */
    expect(debug().phase, 'the game is actually running again').toBe('playing');
    expect(said(), 'and so is the resume').not.toBe(paused);
  });
});
