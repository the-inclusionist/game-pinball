// SPDX-License-Identifier: AGPL-3.0-or-later
// table/light-group — a row of lamps driven as one. Port of `TLightGroup`.
//
// ========================= TWO KINDS OF OPERATION, AND THAT IS THE DESIGN =========================
// Every command on a group falls into one of two families, and they act on DIFFERENT LAYERS of the
// lamps beneath (see `table/light` for the three layers):
//
//   · STEP (`stepForward` / `stepBackward`) rotates the PERSISTENT state around the ring. It changes
//     what the game MEANS. `animationFlag` is set.
//
//   · ANIMATE (`animateForward`, `lightShow`, `gameOverAnimation`…) rotates the TIMED OVERRIDE around
//     the ring. It changes what the lamps are DOING while leaving what they mean untouched.
//     `animationFlag` is cleared.
//
// `startAnimation` is the bridge between them: it copies every lamp's persistent state up into its
// timed-override layer, so an animation begins from a picture of the truth. That is why the group can
// run a light show over live game state and then restore it exactly — `resetGroup` sends
// `resetTimed` to every lamp and the truth is simply still there underneath.
//
// This is what the lamp's three layers were built for. Without them, a light show would have to save
// and restore the game's state by hand, and any interruption would lose it.
//
// ========================= AN ANIMATION IS A MESSAGE THAT RE-SENDS ITSELF =========================
// `rescheduleAnimation` arms a timer that replays the CURRENT command. There is no animation loop and
// no frame handler: the group holds which command it is running in `mode`, and the timer keeps sending
// it. A period of zero stops everything, which is why `reschedule(0)` is also how an animation ends.
//
// ========================= THE GROUP IS A BARGRAPH =========================
// `nextLightUp` is the first lamp that is OFF scanning forward, `nextLightDown` the last that is ON
// scanning backward. So lighting fills from the start and unlighting empties from the end, and a row of
// lamps counts without anybody storing a count.

import type { Light } from './light.js';
import type { TimerService } from './bumper.js';

export type GroupMode =
  | 'none'
  | 'stepForward' | 'stepBackward'
  | 'animateForward' | 'animateBackward'
  | 'lightShow' | 'gameOver';

export interface LightGroupOptions {
  readonly timer: TimerService;
  readonly lights: readonly Light[];
  /** The period used when a command is given a non-positive one. `Timer1TimeDefault`. */
  readonly defaultPeriod: number;
  /** Injected so the random animations are testable. Defaults to Math.random. */
  readonly random?: () => number;
  readonly onNotify?: () => void;
}

export interface LightGroup {
  readonly mode: GroupMode;
  /** Set by STEP commands, cleared by ANIMATE ones. The mission logic reads it to tell them apart. */
  readonly animationFlag: boolean;
  readonly onCount: number;
  readonly lightCount: number;

  stepForward(period: number): void;
  stepBackward(period: number): void;
  animateForward(period: number): void;
  animateBackward(period: number): void;
  lightShow(period: number): void;
  gameOverAnimation(period: number): void;

  /** Lights one randomly chosen dark lamp. */
  saturate(): void;
  /** Darkens one randomly chosen lit lamp. */
  desaturate(): void;

  /** Lights the next dark lamp in order. Reports whether there was one. */
  turnOnNext(): boolean;
  /** Darkens the last lit lamp. Reports whether there was one. */
  turnOffNext(): boolean;

  turnOnAtIndex(index: number): void;
  turnOffAtIndex(index: number): void;
  /** Bargraph: everything up to `index` on, everything past it off. */
  toggleSplitIndex(index: number): void;

  /** Every lit lamp goes dark with a flash first. */
  flashWhenOn(seconds: number): void;
  /** Flashes the last lit lamp. */
  startFlasher(): void;

  restartNotifyTimer(seconds: number): void;
  /** Stops any animation and undoes its overrides, leaving the persistent state alone. */
  resetGroup(): void;
  reset(): void;
}

export function createLightGroup(o: LightGroupOptions): LightGroup {
  const random = o.random ?? Math.random;
  const lights = o.lights;
  let mode: GroupMode = 'none';
  let animationFlag = false;
  let period = o.defaultPeriod;
  let timerId = 0;
  let notifyTimerId = 0;

  const setLit = (light: Light, lit: boolean): void => { if (lit) light.turnOn(); else light.turnOff(); };
  const setLitTimed = (light: Light, lit: boolean): void => {
    if (lit) light.turnOnTimed(0); else light.turnOffTimed(0);
  };

  /** The last lamp being busy with its own override blocks a step — the ring would tear. */
  const lastIsBusy = (): boolean => {
    const last = lights[lights.length - 1];
    return !!last && (last.flashing || last.timedOn || last.timedOff);
  };

  function rescheduleAnimation(seconds: number): void {
    if (timerId) o.timer.kill(timerId);
    timerId = 0;
    if (seconds === 0) {
      // Zero is how an animation ends: the mode is cleared and nothing is rearmed.
      mode = 'none';
      animationFlag = false;
      return;
    }
    period = seconds > 0 ? seconds : o.defaultPeriod;
    timerId = o.timer.set(period, () => { timerId = 0; replay(); });
  }

  /** The bridge: lift every lamp's persistent state into its timed-override layer. */
  function startAnimation(): void {
    for (let i = lights.length - 1; i >= 0; i--) setLitTimed(lights[i]!, lights[i]!.on);
  }

  const nextLightUp = (): number => lights.findIndex((l) => !l.on);
  const nextLightDown = (): number => {
    for (let i = lights.length - 1; i >= 0; i--) if (lights[i]!.on) return i;
    return -1;
  };

  function beginAnimation(next: GroupMode): void {
    if (animationFlag || mode === 'none') startAnimation();
    mode = next;
    animationFlag = false;
  }

  /** Nudges a running animation's clock without changing which animation it is. */
  const keepGoing = (): void => { if (mode !== 'none') startAnimation(); };

  const group: LightGroup = {
    get mode() { return mode; },
    get animationFlag() { return animationFlag; },
    get onCount() { return lights.filter((l) => l.on).length; },
    get lightCount() { return lights.length; },

    stepForward(seconds: number): void {
      if (lastIsBusy()) return;
      if (mode !== 'none') group.resetGroup();
      animationFlag = true;
      mode = 'stepForward';

      const first = lights[0]!;
      const firstOn = first.on;
      const firstMessage = first.messageField;
      for (let i = 0; i < lights.length - 1; i++) {
        setLit(lights[i]!, lights[i + 1]!.on);
        lights[i]!.messageField = lights[i + 1]!.messageField;
      }
      const last = lights[lights.length - 1]!;
      setLit(last, firstOn);
      last.messageField = firstMessage;

      rescheduleAnimation(seconds);
    },

    stepBackward(seconds: number): void {
      if (lastIsBusy()) return;
      if (mode !== 'none') group.resetGroup();
      animationFlag = true;
      mode = 'stepBackward';

      const last = lights[lights.length - 1]!;
      const lastOn = last.on;
      const lastMessage = last.messageField;
      for (let i = lights.length - 1; i > 0; i--) {
        setLit(lights[i]!, lights[i - 1]!.on);
        lights[i]!.messageField = lights[i - 1]!.messageField;
      }
      const first = lights[0]!;
      setLit(first, lastOn);
      first.messageField = lastMessage;

      rescheduleAnimation(seconds);
    },

    animateForward(seconds: number): void {
      beginAnimation('animateForward');
      const firstTimedOn = lights[0]!.timedOn;
      for (let i = 0; i < lights.length - 1; i++) setLitTimed(lights[i]!, lights[i + 1]!.timedOn);
      setLitTimed(lights[lights.length - 1]!, firstTimedOn);
      rescheduleAnimation(seconds);
    },

    animateBackward(seconds: number): void {
      beginAnimation('animateBackward');
      const lastTimedOn = lights[lights.length - 1]!.timedOn;
      for (let i = lights.length - 1; i > 0; i--) setLitTimed(lights[i]!, lights[i - 1]!.timedOn);
      setLitTimed(lights[0]!, lastTimedOn);
      rescheduleAnimation(seconds);
    },

    lightShow(seconds: number): void {
      beginAnimation('lightShow');
      for (const light of lights) {
        // Roughly three lamps in ten, each for its own random slice of time.
        if (random() * 100 > 70) light.turnOnTimed(random() * seconds * 3 + 0.1);
      }
      rescheduleAnimation(seconds);
    },

    gameOverAnimation(seconds: number): void {
      beginAnimation('gameOver');
      for (const light of lights) {
        // Unlike the light show this writes the PERSISTENT state: the game is over, there is nothing
        // underneath left to protect.
        setLit(light, random() * 100 > 70);
        light.resetTimed();
      }
      rescheduleAnimation(seconds);
    },

    saturate(): void {
      const dark = lights.filter((l) => !l.on);
      if (!dark.length) return;
      // Counting down from the END among the candidates, as the original's reverse scan does.
      const nth = Math.floor(random() * dark.length);
      dark[dark.length - 1 - nth]!.turnOn();
      keepGoing();
    },

    desaturate(): void {
      const lit = lights.filter((l) => l.on);
      if (!lit.length) return;
      const nth = Math.floor(random() * lit.length);
      lit[lit.length - 1 - nth]!.turnOff();
      keepGoing();
    },

    turnOnNext(): boolean {
      const index = nextLightUp();
      if (index < 0) return false;
      lights[index]!.turnOn();
      keepGoing();
      return true;
    },

    turnOffNext(): boolean {
      const index = nextLightDown();
      if (index < 0) return false;
      lights[index]!.turnOff();
      keepGoing();
      return true;
    },

    turnOnAtIndex(index: number): void {
      if (index < 0 || index >= lights.length) return;
      lights[index]!.turnOn();
      keepGoing();
    },

    turnOffAtIndex(index: number): void {
      if (index < 0 || index >= lights.length) return;
      lights[index]!.turnOff();
      keepGoing();
    },

    toggleSplitIndex(index: number): void {
      if (index < 0 || index >= lights.length) return;
      for (let i = lights.length - 1; i > index; i--) { lights[i]!.turnOff(); lights[i]!.resetTimed(); }
      for (let i = index; i >= 0; i--) { lights[i]!.turnOn(); lights[i]!.resetTimed(); }
    },

    flashWhenOn(seconds: number): void {
      for (let i = lights.length - 1; i >= 0; i--) {
        const light = lights[i]!;
        if (!light.on) continue;
        light.turnOff();
        light.flasherStartTimedThenStayOff(seconds);
      }
    },

    startFlasher(): void {
      const index = nextLightDown();
      if (index >= 0) lights[index]!.flasherStart();
    },

    restartNotifyTimer(seconds: number): void {
      if (notifyTimerId) o.timer.kill(notifyTimerId);
      notifyTimerId = 0;
      if (seconds > 0) notifyTimerId = o.timer.set(seconds, () => { notifyTimerId = 0; o.onNotify?.(); });
    },

    resetGroup(): void {
      if (timerId) o.timer.kill(timerId);
      timerId = 0;
      // Only the ANIMATE family left overrides behind; the STEP family wrote the truth directly and
      // there is nothing to undo.
      if (mode === 'animateForward' || mode === 'animateBackward' || mode === 'lightShow') {
        for (const light of lights) light.resetTimed();
      }
      mode = 'none';
      animationFlag = false;
    },

    reset(): void {
      if (timerId) o.timer.kill(timerId);
      if (notifyTimerId) o.timer.kill(notifyTimerId);
      timerId = 0;
      notifyTimerId = 0;
      mode = 'none';
      animationFlag = false;
      period = o.defaultPeriod;
    },
  };

  /** The timer replays whichever command is running — see this module's header. */
  function replay(): void {
    switch (mode) {
      case 'stepForward': group.stepForward(period); break;
      case 'stepBackward': group.stepBackward(period); break;
      case 'animateForward': group.animateForward(period); break;
      case 'animateBackward': group.animateBackward(period); break;
      case 'lightShow': group.lightShow(period); break;
      case 'gameOver': group.gameOverAnimation(period); break;
      default: break;
    }
  }

  return group;
}
