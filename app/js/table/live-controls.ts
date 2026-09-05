// SPDX-License-Identifier: AGPL-3.0-or-later
// table/live-controls — handing a hit to the behaviour the table named.
//
// ========================= THE CONTROL LAYER WAS REACHED FROM NOTHING =========================
// Phases 4 and 5 ported it in full: thirty-two missions, a hundred and forty-five components, every
// calibrated number, all under test. And the game collected the ball's hits into an array of STRINGS
// and dispatched none of them. No score, no lamp, no mission, in something that had been playable for
// several commits and looked right in the browser.
//
// This module is the join, and it is small. That is the finding rather than an apology for it: what
// was missing was never the behaviour, only the two lines that hand a hit to it. The same was true of
// the flipper's constructor and of the frame's flipper pass. A port can be complete and inert.
//
// ========================= WHAT AN AUTHORED TABLE CAN AND CANNOT SUPPLY =========================
// `control/registry` holds the line: an authored table asks for behaviour it can declare the arguments
// for, and `validateTable` refuses the rest by name. So this module builds a `ControlContext` out of
// what an authored table actually has — its lamps, a score, a set of flags — and nothing else.
//
// The mission machine is deliberately absent. `control/dispatch.handler` calls it on EVERY event and
// that is transcribed behaviour, so the hook stays; for an authored table it is a function that does
// nothing, declared as such rather than left out. Wiring the 1995 mission machine to a table with no
// missions would mean inventing the missions.

import { createLight, type Light } from './light.js';
import { createScoreState, type ScoreState } from '../control/score.js';
import { handler, type ControlContext, type ControlledComponent, type TableFlags } from '../control/dispatch.js';
import { authoredSelf, controlNamed } from '../control/registry.js';
import type { AuthoredTable } from './authored.js';

/** Seconds a lamp spends dark and lit while flashing. Authoring decisions, not transcribed numbers. */
const LAMP_DARK_DELAY = 0.15;
const LAMP_LIT_DELAY = 0.15;

export interface LiveControlsOptions {
  /** Where a component's sound name goes. Absent = the table is silent, which is a valid table. */
  readonly playSound?: (name: string) => void;
  readonly playMusic?: (track: string) => void;
  /** Text for the HUD's hint block. Absent = nothing is shown, and nothing is lost. */
  readonly showInfo?: (text: string, seconds: number) => void;
  readonly showMission?: (text: string, seconds: number) => void;
}

export interface LiveControls {
  readonly score: ScoreState;
  readonly flags: TableFlags;
  readonly context: ControlContext;
  /** Every lamp the table declared, by name. */
  readonly lamps: ReadonlyMap<string, Light>;
  /** The components as the control layer sees them. */
  readonly components: ReadonlyMap<string, ControlledComponent>;
  /**
   * The ball touched this component. One message code, because a `ControlCollision` is the only thing
   * an authored table's physics can currently report — timers and mission events have no source yet.
   */
  hit(componentName: string): void;
  /** Drives the lamps' own timers. Seconds, like everything in `physics/step`. */
  advance(seconds: number): void;
  /** The lit lamps, which is what a HUD or a test asks for. */
  litLamps(): string[];
  /**
   * ⚠️ THE BALL IS LOST. Takes one off the count, clears what belongs to the ball, and says whether
   * that was the last one.
   *
   * `control/drain`'s four-question cascade is NOT used here and that is not an oversight: it is
   * transcribed, correct, and written for the 1995 table — it wants `lite200`, `lite199`, `lite58` and
   * `lite198`, a mission lamp with a message field, and hand-written lists of per-ball lamps and
   * components. An authored table cannot declare any of that, exactly as it could not declare the
   * arguments to the 1995 control functions.
   */
  endBall(): { readonly gameOver: boolean; readonly ballsLeft: number };
}

/** How many balls a game is. The 1995 table reads it from its own data; an authored table says so here. */
export const BALLS_PER_GAME = 3;

export function createLiveControls(table: AuthoredTable, o: LiveControlsOptions = {}): LiveControls {
  const score = createScoreState();
  const flags: TableFlags = {
    extraBalls: 0, multiballCount: 1, ballCount: BALLS_PER_GAME, tiltLocked: false,
  };

  // A timer service of our own rather than the game's: lamps are the only thing here that keeps time,
  // and `advance` below is the one place it moves.
  let now = 0;
  let nextTimerId = 1;
  const pending = new Map<number, { at: number; run: () => void }>();
  const timer = {
    set(seconds: number, callback: () => void): number {
      const id = nextTimerId++;
      pending.set(id, { at: now + seconds, run: callback });
      return id;
    },
    kill(id: number): void { pending.delete(id); },
  };

  const lamps = new Map<string, Light>();
  for (const name of table.lamps) {
    lamps.set(name, createLight({
      timer, frameCount: 1, darkDelay: LAMP_DARK_DELAY, litDelay: LAMP_LIT_DELAY,
    }));
  }

  const components = new Map<string, ControlledComponent>();
  for (const component of table.components) {
    components.set(component.name, {
      name: component.name,
      scores: component.scores ?? [],
      control: component.control ? controlNamed(component.control) ?? null : null,
      self: authoredSelf(component.lamps ?? []),
    });
  }

  const context: ControlContext = {
    score,
    table: flags,
    light: (name) => lamps.get(name),
    // An authored table has no light GROUPS yet. Absent rather than empty: every control reaches for
    // one with `?.`, so saying "there is none" is a complete answer.
    group: () => undefined,
    showInfo: (text, seconds) => o.showInfo?.(text, seconds),
    showMission: (text, seconds) => o.showMission?.(text, seconds),
    playSound: (name) => o.playSound?.(name),
    playMusic: (track) => o.playMusic?.(track),
    // ⚠️ THE MISSION MACHINE IS ABSENT, AND THE HOOK STAYS. `handler` calls it on every event and that
    // is transcribed behaviour. An authored table has no missions, and wiring the 1995 machine to it
    // would mean inventing some.
    missionControl: () => {},
  };

  return {
    score, flags, context, lamps, components,
    hit(componentName) {
      const component = components.get(componentName);
      if (!component) return;
      handler('ControlCollision', component, context);
    },
    advance(seconds) {
      now += seconds;
      for (const [id, entry] of [...pending]) {
        if (entry.at > now) continue;
        pending.delete(id);
        entry.run();
      }
    },
    litLamps: () => [...lamps].filter(([, light]) => light.on).map(([name]) => name),
    endBall() {
      // Clamped: the game loop calls this from a POSITION test, and a ball sitting in a drain would be
      // reported again on the next frame. Cheaper to hold the floor here than to be sure elsewhere.
      flags.ballCount = Math.max(0, flags.ballCount - 1);

      // ⚠️ THE SCORE SURVIVES AND THE REST DOES NOT. The score is the player's; a lamp lit by the last
      // ball would tell the next one that work was already done, and a target that kept its level would
      // open at its top price. In the 1995 table which lamps survive is a hand-written list and the
      // OMISSIONS are the design — an authored table has no such list, so the rule is everything, said
      // outright rather than half-copied.
      for (const light of lamps.values()) { light.resetTimed(); light.reset(); }
      for (const component of components.values()) {
        const self = component.self as { level?: number } | undefined;
        if (self && typeof self.level === 'number') self.level = 0;
      }

      return { gameOver: flags.ballCount === 0, ballsLeft: flags.ballCount };
    },
  };
}
