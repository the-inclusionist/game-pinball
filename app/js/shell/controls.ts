// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/controls — the keyboard, which the game did not have.
//
// ========================= THE GAME HAD NO INPUT AT ALL, AND NOTHING SAID SO =========================
// `main.ts` booted, drew, launched a ball and watched it drain. It bound no key. A thousand tests were
// green over a game the player could not touch, because every one of them asks about physics, geometry,
// licence or layout, and none asks whether a button does anything.
//
// That is the shape of the gap this module closes, and the shape of the gap the rest of the project
// still has: a gate proves what it looks at.
//
// ========================= WHY `#game-region` AND NOT `window` =========================
// The engine binds its own keys to `#game-region`, and a game that reached for the window would take
// keys away from the page around it — a table embedded in a lesson would eat the reader's arrow keys.
// The element is passed in rather than looked up, which is also what makes this testable off a browser.
//
// ========================= REMAPPING BELONGS TO THE ENGINE, NOT HERE =========================
// `DEFAULT_BINDINGS` is a floor, not a policy. When the engine's settings panel owns the pinball's
// scheme, `actionOf` replaces the lookup below and these become the defaults it starts from.

/** Which flipper. A pinball has two sides and the control layer names them. */
export type FlipperSide = 'left' | 'right';

/**
 * ⚠️ TWO KEYS PER SIDE, AND THAT IS ACCESSIBILITY RATHER THAN CONVENIENCE. The arrows and Z / full stop
 * are the classic pinball pair; a player who cannot reach across a keyboard uses whichever half is
 * nearer, and a player using one hand has both sides within it.
 */
export type PinballAction = 'left' | 'right' | 'plunger' | 'pause';

/**
 * ⚠️ THE ACCESSIBILITY KEYS ARE KEYS, and that is the point of them. `createGame` reads blind mode
 * through a callback the game owns, and until this existed `main.ts` supplied none — so the engine's
 * default `() => false` stood and the audio guide never fired, two commits after the contract's target
 * list had been filled in for exactly that guide to use. A switch nobody can flip is not a switch.
 *
 * A player who needs blind mode is not the player who is going to find it in a settings panel.
 */
export const DEFAULT_BINDINGS: Readonly<Record<PinballAction, readonly string[]>> = {
  /**
   * ⚠️ THIS IS A CABINET, NOT A KEYBOARD, AND THE KEYS ARE ONE MAPPING OF IT.
   *
   * The Dev specified the controls as a machine: a direction each way, three buttons and a start.
   * Button 1 launches; buttons 2 and 3 are the flippers again, beside the directions, so a player can
   * use whichever half of the layout suits their hands. Start pauses.
   *
   *     esquerda → left flipper       botão 1 → launch
   *     direita  → right flipper      botão 2 → left flipper
   *                                   botão 3 → right flipper
   *                                   start   → pause
   *
   * And then the keyboard mapping of it, which is what this table holds:
   *
   *     a → esquerda   u → botão 1    enter → start
   *     d → direita    j → botão 2
   *                    k → botão 3
   *
   * ⚠️ THE PREVIOUS SCHEME IS GONE, not extended. It was the arrows with Z and full stop, Space and
   * Enter on the plunger — the classic PC pinball layout, and a reasonable guess that was never asked
   * for. The Dev's words: "E não o mapeamento atual." A binding kept "just in case" is a key that does
   * something nobody documented.
   *
   * ⚠️ AND THE DIRECTIONS CAME OFF THE PADDLES, WHICH IS THE DEV'S OWN CORRECTION.
   *
   * "IMPORTANTE: botões esquerda e direita não devem mais mover as pás."
   *
   * A and D were the flippers beside J and K, and the argument for the pair was written here: "A/D are
   * a direction pair for one hand; J/K are a button pair for the other." That reasoning is retired,
   * and what replaces it is better: the directions have a JOB — walking the menus, which is `wasd ou
   * xbox_direcional = movimento (pelos menus)` — and a key that flips a paddle in a game and moves a
   * cursor in a menu is a key a player has to think about before pressing.
   *
   * ⚠️ THREE KEYS PER FLIPPER, AND THEY ARE THE CABINET'S THREE POSITIONS. The Dev's table names them
   * as a button and two rails: `j` is action 2, `7` is the left shoulder and `Y` the left trigger; `k`,
   * `8` and `O` are the same three on the right. So a player still has more than one way to each
   * paddle — which was the accessibility argument all along — and every one of them is a BUTTON.
   *
   * ⚠️ AND `KeyY` IS NOT THE PAD'S Y BUTTON. The table has both: "i ou xbox_Y = action 5 = nada
   * atribuído por enquanto" is the pad's fourth face button and carries nothing; "Y, left trigger" is
   * the keyboard key. Two controls, one letter, and only one of them flips anything.
   */
  left: ['KeyJ', 'Digit7', 'KeyY'],
  right: ['KeyK', 'Digit8', 'KeyO'],
  plunger: ['KeyU'],
  /**
   * ⚠️ START, AND IT IS A NEW FEATURE RATHER THAN A REMAP. `Phase` has always had `'paused'` and
   * `bootPinball` has always told the engine `isNavigable: () => phase === 'paused'` — so the engine's
   * own menus have been waiting on a state nothing could ever enter. This is the key that enters it.
   */
  /**
   * ⚠️ AND `KeyH` BESIDE IT, BECAUSE THE ENGINE'S KEYBOARD HAS NO `start` YET AND THE DEV PRESSED IT.
   *
   * His report: "botão enter/H não está pausando." Measured in a real browser rather than reasoned
   * about — `tests/frame-follows-state` presses both — and the two halves came apart: Enter paused,
   * H did nothing at all.
   *
   * The engine's #103 migration has reached its keyboard, whose solo scheme is now
   * `action1: ['KeyU'], action2: ['KeyJ','Space'], action3: ['KeyK'], action4: ['KeyI']` — the
   * fourteen positions arriving exactly as ADR-0086 describes. What it does NOT yet carry is `start`,
   * although `input/default-bindings` declares it as `['KeyH','Enter']`: that table is the migration's
   * destination and the transport has not read it yet.
   *
   * So H is bound here, in this port's own table, which is where a key lives until the engine owns it.
   * When `start` reaches the transport, `actionOf` will answer first and this line becomes the floor
   * beneath it — the arrangement `DEFAULT_BINDINGS`'s header already describes for every other key.
   */
  pause: ['Enter', 'KeyH'],
  /**
   * ⚠️ AND BLIND MODE, THE SONAR AND THE PALETTE ARE NO LONGER KEYS AT ALL. The Dev: "remova modo cego
   * sonar e cores via teclado: eles devem aparecer no hud da mesma forma que aparecem no projeto
   * game-platformer."
   *
   * This module argued the opposite for months, and the argument was right about the danger and wrong
   * about the alternative: "a player who needs blind mode is not the player who is going to find it in
   * a settings panel." It assumed the other option was a panel. It is not — it is an ICON, on screen,
   * beside the score, all the time. `shell/a11y-bar` is that bar, and the engine's own
   * `ui/pause-icons` made the same move first: "desde o item 7 do ADR-0044 os ícones vivem no HUD."
   *
   * ⚠️ AND IT FREED THREE KEYS THAT WERE ALREADY WANTED. `KeyS` was the sonar AND the menus' "down"
   * since the cabinet was remapped, and the collision had to be written down as an exception. It is
   * not an exception any more.
   */
};

/**
 * The directions, while a ball is in play.
 *
 * ⚠️ THE SAME KEYS AS THE MENUS AND A DIFFERENT TABLE, for the reason `MENU_BINDINGS` is a different
 * table: one physical control, two meanings, chosen by whether a screen is up. The Dev asked for "um
 * leve controle sobre ela com o direcional" during a comet drill, and the directional is `wasd` — which
 * has nothing to do on a table until now.
 *
 * ⚠️ AND THERE IS NO DOWN. `KeyS` is the sonar sweep, an accessibility key `shell/controls` has argued
 * since it was written must work while a ball is in play — and a downward push duplicates gravity,
 * which is already the strongest force on the table. Trading the sonar for that would be the worst
 * exchange available.
 */
export const THRUST_BINDINGS: Readonly<Record<'up' | 'left' | 'right', readonly string[]>> = {
  up: ['KeyW'],
  left: ['KeyA'],
  right: ['KeyD'],
};

/**
 * The three things this module reads off a key event. A `Pick` of the real one rather than a shape of
 * its own: the handlers stay assignable to a DOM listener, so `#game-region` needs no cast, and a test
 * still only has to supply three fields.
 */
type KeyLikeEvent = Pick<KeyboardEvent, 'code' | 'key' | 'repeat' | 'preventDefault'>;

/** The subset of an element this module uses. Narrow on purpose — see the header. */
export interface KeyTarget {
  addEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEvent) => void): void;
}

export interface ControlOptions {
  readonly region: KeyTarget;
  readonly setFlipper: (side: FlipperSide, extended: boolean) => void;
  readonly launch: () => void;
  /**
   * ⚠️ THE 1995 PLUNGER IS HELD, NOT PRESSED. Holding it draws it back a hundredth at a time and
   * letting go launches at whatever was drawn, so the launch key has to report both edges. The
   * authored table's `launch` is a single call and stays one; a table that has a plunger takes this
   * instead, and a table that does not simply leaves it out.
   */
  readonly setPlunger?: (pressed: boolean) => void;
  /**
   * ⚠️ `toggleBlindMode`, `sweep` AND `cyclePalette` USED TO BE HERE AND ARE NOT ANY MORE. The Dev took
   * the three off the keyboard — "remova modo cego sonar e cores via teclado" — so this module has
   * nothing to dispatch to. They are wired straight from `shell/a11y-bar`'s buttons instead, which is
   * one hop rather than two and leaves no option here that nothing reads.
   */
  /** Start. Pauses a running game and resumes a paused one. */
  readonly togglePause?: () => void;
  /**
   * The player leaning on the ball. Reports both edges, like the flippers, because it is a HELD state.
   *
   * Absent on a table that does not offer it, which is every table until a comet drill is running —
   * `main` decides whether the push is worth anything, and this only reports the key.
   */
  readonly setThrust?: (direction: 'up' | 'left' | 'right', pressed: boolean) => void;
  /**
   * The engine's remapper, when the pinball's scheme is registered with it. Given a key code it returns
   * the action, and `DEFAULT_BINDINGS` is consulted only when it says nothing.
   */
  readonly actionOf?: (code: string) => string | null;
  /**
   * The cabinet, as the player has it now.
   *
   * ⚠️ A FUNCTION, NOT A VALUE, AND FOR THE REASON `shell/choice-dialog` gives for its own: the table
   * CHANGES while the game is running, because the pause menu can now edit it. A table captured at
   * bind time would leave a player who just remapped the launch key pressing the new one against a
   * cabinet that is still listening for the old — with nothing anywhere reporting a problem.
   */
  readonly bindings?: () => Readonly<Record<PinballAction, readonly string[]>>;
  /**
   * ⚠️ THE BACK DOOR IS TYPED, AND A KEY CODE IS NOT A CHARACTER. `control/cheats` is fed one character
   * at a time — the original reads WM_CHAR — while every binding above is read off `event.code`, which
   * says `KeyB` where the buffer needs `b`. Neither can stand in for the other: on a layout where
   * `KeyZ` types `y`, the left flipper answers Z and the cheat is spelled with y, and both are right.
   *
   * ⚠️ AND THE CHARACTER DOES NOT TAKE THE KEY AWAY. `bmax` begins with the blind-mode key and
   * `easy mode` contains the sweep key. A back door that swallowed them would trade a feature this
   * project exists for against an easter egg, so both happen and typing `bmax` toggles blind mode on
   * the way past. That is the price, and it is named rather than hidden.
   */
  readonly typeCharacter?: (character: string) => void;
}

/** Binds the keys. Returns the undo, because a game that cannot be unbound cannot be torn down. */
/**
 * What a MENU understands, which is not what the table understands.
 *
 * ⚠️ THIS IS THE OTHER HALF OF TAKING THE DIRECTIONS OFF THE PADDLES. The Dev's table gives them a job
 * — "wasd ou xbox_direcional = movimento (pelos menus)" — and gives the two buttons beside them a
 * second meaning that only applies here: "j ... = pá esquerda ou confirmação/seleção/ação" and "k ... =
 * pá direita ou negação". One physical control, two meanings, chosen by whether a screen is up.
 *
 * ⚠️ SO A MENU KEY IS NOT A `PinballAction`, and the two tables are deliberately separate. Putting
 * `confirm` in `DEFAULT_BINDINGS` beside `left` would put `KeyJ` in two entries of one table, and
 * `bindPinballControls` answers with whichever it reaches first — silently, for ever. The context is
 * the thing that decides, and the context is `ownCabinetKeys`: while a screen owns the cabinet, J
 * confirms; while it does not, J is a paddle.
 */
export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'pause';

/**
 * ⚠️ AND `KeyS` IS THE SONAR SWEEP IN THE GAME, which this takes precedence over while a menu is up.
 *
 * `ownCabinetKeys`'s header records that the accessibility keys are deliberately never swallowed —
 * "they must work everywhere. A screen that swallowed them would be the first place they did not."
 * That rule now has one exception, and it is worth naming rather than discovering: S walks a menu
 * downward, because the Dev's table says the directions move through menus and because a sonar sweep
 * describes THE TABLE, which is not what the player is looking at while a menu covers it. B and C are
 * untouched.
 */
export const MENU_BINDINGS: Readonly<Record<MenuAction, readonly string[]>> = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  confirm: ['KeyJ'],
  cancel: ['KeyK'],
  // Start opened the menu, so start closes it — the same key, which is what a start button means.
  pause: ['Enter', 'KeyH'],
};

export interface CabinetOwner {
  /** Whether this screen is up. A screen that is put away owns nothing. */
  isOpen(): boolean;
  /** What each cabinet key does here. An action with no entry is still SWALLOWED — see below. */
  readonly on?: Partial<Record<MenuAction, () => void>>;
}

/**
 * Gives one screen the cabinet for as long as it is up.
 *
 * ⚠️ THIS EXISTS BECAUSE EVERY OVERLAY IN THIS GAME LIVES INSIDE `#game-region`, WHICH IS WHERE
 * `bindPinballControls` BINDS. A keydown on a menu button therefore bubbles straight into the game,
 * and `preventDefault` says nothing about that — it speaks to the browser, not to a listener further
 * up the tree.
 *
 * ⚠️ AND IT WAS ALREADY COSTING SOMETHING. Measured in a real browser: pressing Enter on the pause
 * menu's "Cores da mesa" ran `togglePause` on the way past — so the game RESUMED, the ball started
 * moving, and the palette opened over a table that was playing. `Continuar` survived only by an
 * accident of ordering that is worth writing down, because it is what made this look fine: the
 * measured sequence for Enter on a button is `keydown` (which bubbled and toggled the pause on),
 * then the click, then `keyup`. So resume toggled to playing and then resumed again, and
 * `enterPhase` is idempotent. Two wrongs, in the one entry anybody tests.
 *
 * ⚠️ AND AN ACTION WITH NO HANDLER IS STILL TAKEN OFF THE GAME. That is the whole point: a pause menu
 * does not want the flippers, and precisely because it does not want them, the flippers must not
 * reach the paddles behind it. Swallowing is the service; handling is optional.
 *
 * ⚠️ BUT ONLY A HANDLED ACTION HAS ITS DEFAULT CANCELLED, AND THAT DISTINCTION IS A BUG BEING FIXED.
 * The first version called `preventDefault()` on every cabinet key it took — which on the pause menu
 * cancelled the BROWSER'S OWN activation of the focused button. So `Enter` opened the menu, put the
 * focus on "Continuar", and then did nothing at all: the second press was swallowed before the game
 * could toggle the pause and cancelled before the platform could press the button. The game paused
 * and could not be un-paused, which is what the Dev reported.
 *
 * `stopPropagation` is what "this screen owns the cabinet" means — the key does not reach the game.
 * `preventDefault` is a different claim: it says the browser should not do its own thing with this
 * key either, and that is only true when this screen has something of its own to do instead. A menu
 * of real `<button>`s is relying on the platform, exactly as whackwhack's rule says it should.
 *
 * ⚠️ THE ACCESSIBILITY KEYS ARE DELIBERATELY NOT HERE. Blind mode, the sonar sweep and the palette
 * are on B, S and C, and they are switches for how the game is PERCEIVED rather than controls of the
 * cabinet — this module has argued since it was written that they must work everywhere. A screen
 * that swallowed them would be the first place they did not.
 */
export function ownCabinetKeys(root: KeyTarget, owner: CabinetOwner): void {
  /**
   * ⚠️ READ OFF `MENU_BINDINGS` RATHER THAN OFF THE GAME'S TABLE, and that is the change the Dev's
   * `IMPORTANTE` line forces. It used to walk `DEFAULT_BINDINGS` for left/right/plunger/pause, which
   * worked only while the paddles WERE the directions: a menu asked the game's table what "left" was
   * bound to and got the key it wanted by coincidence. Now the two tables say different things, and
   * a menu that kept asking the game's would be walking on J and K — the paddles — while W and S did
   * nothing.
   */
  const ACTIONS = Object.keys(MENU_BINDINGS) as MenuAction[];

  root.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!owner.isOpen()) return;
    const action = ACTIONS.find((name) => MENU_BINDINGS[name].includes(event.code));
    if (!action) return;

    // Always: the key does not reach the game behind this screen.
    event.stopPropagation();

    const handler = owner.on?.[action];
    if (!handler) return;
    // Only when this screen does something of its own with it. See the header.
    event.preventDefault();
    handler();
  });
}

export function bindPinballControls(o: ControlOptions): () => void {
  const bindings = (): Readonly<Record<PinballAction, readonly string[]>> =>
    o.bindings?.() ?? DEFAULT_BINDINGS;

  /**
   * ⚠️ DERIVED FROM THE TABLE, NOT WRITTEN OUT AGAIN. This was a third copy of the same names — beside
   * `PinballAction` and beside `DEFAULT_BINDINGS` — and the failure it invited is silent: an action
   * added to the type and the table but forgotten here is bound to a key, matched by nothing, and does
   * nothing at all. No error, no warning, a key that simply does not work.
   *
   * The order is the table's, which is the order this list always had, and `find` below still takes
   * the first match.
   */
  const ACTIONS = Object.keys(bindings()) as PinballAction[];

  const actionFor = (code: string): PinballAction | null => {
    const mapped = o.actionOf?.(code);
    if (mapped && (ACTIONS as readonly string[]).includes(mapped)) return mapped as PinballAction;
    const table = bindings();
    return ACTIONS.find((action) => table[action].includes(code)) ?? null;
  };

  const thrustFor = (code: string): 'up' | 'left' | 'right' | null =>
    (Object.keys(THRUST_BINDINGS) as ('up' | 'left' | 'right')[])
      .find((name) => THRUST_BINDINGS[name].includes(code)) ?? null;

  const onDown = (event: KeyLikeEvent): void => {
    // ⚠️ BEFORE THE ACTION LOOKUP, AND BEFORE THE REPEAT GUARD. A character with no binding would
    // otherwise leave on the `!action` line and never reach the buffer, and a held letter IS that
    // letter typed again — the guard below exists for flippers, which re-extending leaves still.
    if (o.typeCharacter) {
      const character = characterOf(event.key);
      if (character !== null) o.typeCharacter(character);
    }

    /**
     * ⚠️ BEFORE THE ACTION LOOKUP AND NOT INSTEAD OF IT. A direction is not a `PinballAction` — it is
     * in its own table — so it would fall out of `actionFor` as "nothing" and the key would scroll the
     * document. It is also not exclusive: nothing else is bound to W or D, but `KeyS` IS the sonar, and
     * the day somebody puts a direction on a key that has a job the two must both happen rather than
     * one silently winning.
     */
    const pushed = thrustFor(event.code);
    if (pushed) {
      event.preventDefault();
      if (!event.repeat) o.setThrust?.(pushed, true);
    }

    const action = actionFor(event.code);
    if (!action) return;
    // Swallowed so the arrows and space do not scroll the document out from under the table.
    event.preventDefault();
    // ⚠️ A HELD KEY REPEATS, and `setFlipperMotion` on an already-extended flipper leaves it STILL —
    // right there, wrong here. Without this a player holding the button would have the flipper stop
    // kicking a few milliseconds in, and nothing would look broken.
    if (event.repeat) return;

    // ⚠️ A TABLE WITH A PLUNGER TAKES THE HOLD, and only falls back to the one-shot without one.
    // Calling both would launch twice: once at the minimum on the way down, once at whatever was
    // drawn on the way up.
    if (action === 'plunger') {
      if (o.setPlunger) o.setPlunger(true);
      else o.launch();
    }
    else if (action === 'pause') o.togglePause?.();
    else o.setFlipper(action, true);
  };

  const onUp = (event: KeyLikeEvent): void => {
    const released = thrustFor(event.code);
    if (released) {
      event.preventDefault();
      o.setThrust?.(released, false);
    }

    const action = actionFor(event.code);
    if (action === 'plunger' && o.setPlunger) {
      event.preventDefault();
      o.setPlunger(false);
      return;
    }
    // Otherwise only the flippers have a release. The rest happen once, on the way down.
    if (action !== 'left' && action !== 'right') return;
    event.preventDefault();
    o.setFlipper(action, false);
  };

  o.region.addEventListener('keydown', onDown);
  o.region.addEventListener('keyup', onUp);

  return () => {
    o.region.removeEventListener('keydown', onDown);
    o.region.removeEventListener('keyup', onUp);
  };
}

/**
 * The character a key event typed, or null when it typed none.
 *
 * `event.key` is one character for anything printable and a NAME — `ArrowLeft`, `Shift`, `Tab` — for
 * anything else, so the length is the test. Tab is the exception: `CHEAT_CODES` carries `hidden	test`
 * as well as `hidden test`, because of the character the original's handler reports between the two
 * words, and this is the only place that can put the tab back.
 *
 * ⚠️ AND THE CASE IS LEFT ALONE. The codes are lowercase and the original compares raw characters, so
 * `HIDDEN TEST` does not open the back door there and must not open it here.
 */
function characterOf(key: string): string | null {
  if (key === 'Tab') return '	';
  return [...key].length === 1 ? key : null;
}
