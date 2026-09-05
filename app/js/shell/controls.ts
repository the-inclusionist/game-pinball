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
export type PinballAction = 'left' | 'right' | 'plunger' | 'blindMode' | 'sweep';

/**
 * ⚠️ THE ACCESSIBILITY KEYS ARE KEYS, and that is the point of them. `createGame` reads blind mode
 * through a callback the game owns, and until this existed `main.ts` supplied none — so the engine's
 * default `() => false` stood and the audio guide never fired, two commits after the contract's target
 * list had been filled in for exactly that guide to use. A switch nobody can flip is not a switch.
 *
 * A player who needs blind mode is not the player who is going to find it in a settings panel.
 */
export const DEFAULT_BINDINGS: Readonly<Record<PinballAction, readonly string[]>> = {
  left: ['ArrowLeft', 'KeyZ'],
  right: ['ArrowRight', 'Period'],
  plunger: ['Space', 'Enter'],
  blindMode: ['KeyB'],
  // The guide pings by itself every 0.8s; a sweep is the player ASKING, which is what makes a table
  // explorable rather than merely announced at.
  sweep: ['KeyS'],
};

/**
 * The three things this module reads off a key event. A `Pick` of the real one rather than a shape of
 * its own: the handlers stay assignable to a DOM listener, so `#game-region` needs no cast, and a test
 * still only has to supply three fields.
 */
type KeyLikeEvent = Pick<KeyboardEvent, 'code' | 'repeat' | 'preventDefault'>;

/** The subset of an element this module uses. Narrow on purpose — see the header. */
export interface KeyTarget {
  addEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEvent) => void): void;
}

export interface ControlOptions {
  readonly region: KeyTarget;
  readonly setFlipper: (side: FlipperSide, extended: boolean) => void;
  readonly launch: () => void;
  /** Optional, because a table under construction has no engine behind it. */
  readonly toggleBlindMode?: () => void;
  readonly sweep?: () => void;
  /**
   * The engine's remapper, when the pinball's scheme is registered with it. Given a key code it returns
   * the action, and `DEFAULT_BINDINGS` is consulted only when it says nothing.
   */
  readonly actionOf?: (code: string) => string | null;
  readonly bindings?: Readonly<Record<PinballAction, readonly string[]>>;
}

/** Binds the keys. Returns the undo, because a game that cannot be unbound cannot be torn down. */
export function bindPinballControls(o: ControlOptions): () => void {
  const bindings = o.bindings ?? DEFAULT_BINDINGS;

  const ACTIONS: readonly PinballAction[] = ['left', 'right', 'plunger', 'blindMode', 'sweep'];

  const actionFor = (code: string): PinballAction | null => {
    const mapped = o.actionOf?.(code);
    if (mapped && (ACTIONS as readonly string[]).includes(mapped)) return mapped as PinballAction;
    return ACTIONS.find((action) => bindings[action].includes(code)) ?? null;
  };

  const onDown = (event: KeyLikeEvent): void => {
    const action = actionFor(event.code);
    if (!action) return;
    // Swallowed so the arrows and space do not scroll the document out from under the table.
    event.preventDefault();
    // ⚠️ A HELD KEY REPEATS, and `setFlipperMotion` on an already-extended flipper leaves it STILL —
    // right there, wrong here. Without this a player holding the button would have the flipper stop
    // kicking a few milliseconds in, and nothing would look broken.
    if (event.repeat) return;

    if (action === 'plunger') o.launch();
    else if (action === 'blindMode') o.toggleBlindMode?.();
    else if (action === 'sweep') o.sweep?.();
    else o.setFlipper(action, true);
  };

  const onUp = (event: KeyLikeEvent): void => {
    const action = actionFor(event.code);
    // Only the flippers have a release. The rest happen once, on the way down.
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
