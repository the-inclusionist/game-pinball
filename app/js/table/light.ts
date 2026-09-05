// SPDX-License-Identifier: AGPL-3.0-or-later
// table/light — one lamp on the table. Port of `TLight`.
//
// ========================= THREE LAYERS OF STATE, STACKED =========================
// A lamp is not on or off. It carries three answers at once, and each layer hides the one beneath:
//
//   1. WHAT THE GAME MEANS — `lightOn`, the persistent state. A mission sets it and it survives
//      everything above.
//   2. WHAT IT IS DOING NOW — a timed override (`toggledOn`/`toggledOff`) or a flash. Temporary; when
//      the timeout fires the lamp falls back to layer 1 rather than to "off".
//   3. WHAT IS BEING SHOWN — `temporaryOverride`, a display-only layer. While it is up, the lamp keeps
//      computing layers 1 and 2 into `previousFrame` and simply does not draw them, so releasing the
//      override restores the truth without anyone having to remember it.
//
// That is why `setSpriteBmp` always records and only sometimes draws. The lamp always knows what it
// WOULD be showing.
//
// ========================= THE FLASHER HAS TWO DELAYS, NOT ONE =========================
// `FlashDelay[0]` is how long it stays dark and `FlashDelay[1]` how long it stays lit, and the callback
// picks by the phase it just entered. A lamp can blink briefly bright against a long dark, or the
// reverse. Collapsing them into one period would make every lamp on the table blink the same way.
//
// And any timed command calls `scheduleTimeout`, which FIRST restores both delays from their sources.
// So a multiplier applied to the rhythm lasts exactly until the next timed command, and never leaks.

import type { TimerService } from './bumper.js';

/** The frame that means "dark". The original's BmpArr[0] is -1: no sprite at all. */
const DARK_FRAME = -1;

export interface LightOptions {
  readonly timer: TimerService;
  /** How many "on" frames this lamp has. */
  readonly frameCount: number;
  /** Seconds the lamp stays dark during a flash. `SourceDelay[0]`. */
  readonly darkDelay: number;
  /** Seconds it stays lit during a flash. `SourceDelay[1]`. */
  readonly litDelay: number;
  readonly setSprite?: (index: number) => void;
  /** Fired when a timed command runs out. The mission logic listens for it. */

}

export interface Light {
  /**
   * ⚠️ `control::handler(ControlTimerExpired, this)`, WHICH IS HOW AN AWARD ENDS. A lamp lit with
   * `TLightTurnOnTimed` is an award with a clock — `table_set_bonus` lights `lite59` for sixty seconds
   * — and the lamp going dark is only half of it. The other half is the FLAG being cleared, and that
   * happens here. Without it the bonus keeps accumulating long after the player can see any reason to
   * think it should.
   *
   * A field rather than an option, like `Gate.control` and `Kickback.control`: the lamp is built from
   * the archive and its control is bound later, by the dispatcher.
   */
  control: (() => void) | null;
  /**
   * Layer 1 alone: `LightOnFlag`. What the GAME means, and the only thing a light GROUP reads —
   * `next_light_up`, `next_light_down` and `TLightGroupGetOnCount` all count this flag and nothing
   * else, so an animation can run over live state without changing any count.
   */
  readonly on: boolean;
  /**
   * ⚠️ `TLight::light_on()`, WHICH IS THREE FLAGS: `LightOnFlag || ToggledOnFlag || FlasherOnFlag`.
   * This is the question the CONTROL layer asks, and it is not the same question as `on`.
   *
   * Nearly every award in the game lights its lamp with `TLightTurnOnTimed` — the lamp's own sixty
   * seconds ARE the award — so a control reading `on` would find every one of those lamps dark. The
   * booster chain would never advance past its first rung and an out lane would never notice the extra
   * ball it is standing on, both without an error.
   *
   * A timed-OFF lamp over a lit one still reports lit: `light_on()` does not subtract `ToggledOffFlag`.
   * Transcribed rather than tidied.
   */
  readonly lit: boolean;
  readonly flashing: boolean;
  /** Layer 2 is holding it lit. The group reads this to rotate an animation without touching layer 1. */
  readonly timedOn: boolean;
  /** Layer 2 is holding it dark. */
  readonly timedOff: boolean;
  /** Which frame "on" currently means. */
  readonly onFrame: number;
  /** An integer the mission logic parks on the lamp. The group carries it along when it rotates. */
  messageField: number;

  turnOn(): void;
  turnOff(): void;
  /** Flips the persistent state and reports the new one. */
  toggle(): boolean;

  turnOnTimed(seconds: number): void;
  turnOffTimed(seconds: number): void;

  flasherStart(): void;
  flasherStartTimed(seconds: number): void;
  /** Flash for a while, then settle LIT regardless of what the persistent state was. */
  flasherStartTimedThenStayOn(seconds: number): void;
  /** Flash for a while, then settle DARK. */
  flasherStartTimedThenStayOff(seconds: number): void;

  setOnFrame(index: number): void;
  incOnFrame(): void;
  decOnFrame(): void;

  /** Scales both flash delays. Lasts until the next timed command. */
  applyDelayMultiplier(multiplier: number): void;
  /** Restores both delays from source. */
  applyDelay(): void;

  /** Cancels any timed override and returns to the persistent state. */
  resetTimed(): void;
  reset(): void;

  /** Layer 3: show this frame and nothing else until released. */
  temporaryOverride(lit: boolean, seconds: number): void;
  releaseOverride(): void;
}

export function createLight(o: LightOptions): Light {
  let lightOn = false;
  let onFrame = 0;
  let flashing = false;
  let flashLit = false;
  let toggledOn = false;
  let toggledOff = false;
  let overriding = false;
  let turnOffAfterFlashing = false;
  let previousFrame = DARK_FRAME;

  let timeoutTimer = 0;
  let flashTimer = 0;
  let overrideTimer = 0;

  let delays = [o.darkDelay, o.litDelay];

  /** Layer 3 lives here: always record, draw only when nothing is overriding. */
  function setSpriteFrame(frame: number): void {
    previousFrame = frame;
    if (!overriding) o.setSprite?.(frame);
  }

  const frameFor = (lit: boolean): number => (lit ? onFrame : DARK_FRAME);

  function flashTick(): void {
    flashLit = !flashLit;
    setSpriteFrame(frameFor(flashLit));
    // The delay for the phase just ENTERED — which is what makes the two halves independent.
    flashTimer = o.timer.set(delays[flashLit ? 1 : 0]!, flashTick);
  }

  function flasherStop(settleLit: boolean | null): void {
    if (flashTimer) o.timer.kill(flashTimer);
    flashTimer = 0;
    if (settleLit !== null) {
      flashLit = settleLit;
      setSpriteFrame(frameFor(flashLit));
    }
  }

  function scheduleTimeout(seconds: number): void {
    // Restore the rhythm FIRST: a multiplier lasts exactly until the next timed command.
    delays = [o.darkDelay, o.litDelay];
    if (timeoutTimer) o.timer.kill(timeoutTimer);
    timeoutTimer = 0;
    if (seconds > 0) timeoutTimer = o.timer.set(seconds, timeoutExpired);
  }

  function timeoutExpired(): void {
    if (flashing) flasherStop(null);
    // FALL BACK TO LAYER 1, not to dark. A timed override always returns to what the lamp really is.
    setSpriteFrame(frameFor(lightOn));
    toggledOff = false;
    toggledOn = false;
    flashing = false;
    timeoutTimer = 0;
    if (turnOffAfterFlashing) {
      turnOffAfterFlashing = false;
      light.turnOff();
      light.resetTimed();
    }
    light.control?.();
  }

  /** True while some layer-2 override is hiding the persistent state. */
  const overridden = (): boolean => flashing || toggledOff || toggledOn;

  const light: Light = {
    control: null,
    get on() { return lightOn; },
    get lit() { return lightOn || toggledOn || flashing; },
    get flashing() { return flashing; },
    get timedOn() { return toggledOn; },
    get timedOff() { return toggledOff; },
    get onFrame() { return onFrame; },
    messageField: 0,

    turnOn(): void {
      lightOn = true;
      if (!overridden()) setSpriteFrame(frameFor(true));
    },

    turnOff(): void {
      lightOn = false;
      if (!overridden()) setSpriteFrame(frameFor(false));
    },

    toggle(): boolean {
      if (lightOn) light.turnOff(); else light.turnOn();
      return lightOn;
    },

    turnOnTimed(seconds: number): void {
      if (!toggledOn) {
        if (flashing) { flasherStop(true); flashing = false; } else { setSpriteFrame(frameFor(true)); }
        toggledOn = true;
        toggledOff = false;
      }
      scheduleTimeout(seconds);
    },

    turnOffTimed(seconds: number): void {
      if (!toggledOff) {
        if (flashing) { flasherStop(false); flashing = false; } else { setSpriteFrame(frameFor(false)); }
        toggledOff = true;
        toggledOn = false;
      }
      scheduleTimeout(seconds);
    },

    flasherStart(): void {
      scheduleTimeout(0);
      if (!flashing || !flashTimer) {
        flashing = true;
        toggledOn = false;
        toggledOff = false;
        turnOffAfterFlashing = false;
        flashLit = lightOn;
        flashTick();
      }
    },

    flasherStartTimed(seconds: number): void {
      if (!flashing) { flashLit = lightOn; flashTick(); }
      flashing = true;
      toggledOn = false;
      toggledOff = false;
      turnOffAfterFlashing = false;
      scheduleTimeout(seconds);
    },

    flasherStartTimedThenStayOn(seconds: number): void {
      turnOffAfterFlashing = false;
      if (overrideTimer) o.timer.kill(overrideTimer);
      overrideTimer = 0;
      light.turnOn();
      light.flasherStartTimed(seconds);
    },

    flasherStartTimedThenStayOff(seconds: number): void {
      if (overrideTimer) o.timer.kill(overrideTimer);
      overrideTimer = 0;
      light.flasherStartTimed(seconds);
      turnOffAfterFlashing = true;
    },

    setOnFrame(index: number): void {
      onFrame = Math.max(0, Math.min(Math.floor(index), o.frameCount - 1));
      // Redraw at once, choosing by whichever layer is currently in charge.
      const lit = flashing ? flashLit : toggledOff ? false : toggledOn ? true : lightOn;
      setSpriteFrame(frameFor(lit));
    },

    incOnFrame(): void { light.setOnFrame(onFrame + 1); },
    decOnFrame(): void { light.setOnFrame(onFrame - 1); },

    applyDelayMultiplier(multiplier: number): void {
      delays = [o.darkDelay * multiplier, o.litDelay * multiplier];
    },

    applyDelay(): void {
      delays = [o.darkDelay, o.litDelay];
    },

    resetTimed(): void {
      if (timeoutTimer) o.timer.kill(timeoutTimer);
      timeoutTimer = 0;
      if (flashing) flasherStop(null);
      flashing = false;
      toggledOff = false;
      toggledOn = false;
      setSpriteFrame(frameFor(lightOn));
    },

    reset(): void {
      if (timeoutTimer) o.timer.kill(timeoutTimer);
      if (overrideTimer) o.timer.kill(overrideTimer);
      if (flashing) flasherStop(null);
      timeoutTimer = 0;
      overrideTimer = 0;
      lightOn = false;
      onFrame = 0;
      toggledOff = false;
      toggledOn = false;
      flashing = false;
      overriding = false;
      turnOffAfterFlashing = false;
      previousFrame = DARK_FRAME;
      delays = [o.darkDelay, o.litDelay];
      setSpriteFrame(DARK_FRAME);
    },

    temporaryOverride(lit: boolean, seconds: number): void {
      o.setSprite?.(frameFor(lit));
      if (overrideTimer) o.timer.kill(overrideTimer);
      overrideTimer = 0;
      if (seconds > 0) {
        overriding = true;
        overrideTimer = o.timer.set(seconds, () => { light.releaseOverride(); });
      }
    },

    releaseOverride(): void {
      if (overrideTimer) o.timer.kill(overrideTimer);
      overrideTimer = 0;
      overriding = false;
      // The truth was being recorded all along — no one had to remember it.
      o.setSprite?.(previousFrame);
    },
  };

  return light;
}
