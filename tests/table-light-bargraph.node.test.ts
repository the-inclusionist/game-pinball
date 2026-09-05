// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createLight, type Light } from '../app/js/table/light.js';
import { createLightGroup } from '../app/js/table/light-group.js';
import { createLightBargraph } from '../app/js/table/light-bargraph.js';
import type { TimerService } from '../app/js/table/bumper.js';

/**
 * ⚠️ A TIMER WITH REAL IDENTIFIERS, BECAUSE THE WHOLE COMPONENT IS ABOUT KILLING ONE TIMER.
 *
 * The other light tests use a fake whose `kill` empties everything, which is fine for a group that
 * only ever has one. Here the question under test is whether refilling the tank CANCELS the previous
 * decay — a fake that kills indiscriminately would answer yes no matter what the code did.
 */
function fakeTimer() {
  const pending = new Map<number, { seconds: number; run: () => void }>();
  let next = 1;
  const timer: TimerService = {
    set: (seconds, run) => { const id = next++; pending.set(id, { seconds, run }); return id; },
    kill: (id) => { pending.delete(id); },
  };
  return {
    timer,
    alive: () => [...pending.keys()],
    delays: () => [...pending.values()].map((p) => p.seconds),
    /** Fires every armed timer once, as the clock would. */
    fire: () => { const all = [...pending.entries()]; pending.clear(); for (const [, p] of all) p.run(); },
  };
}

/** Six lamps and twelve decay times, which is the shape of `fuel_bargraph`. */
function build(count = 6) {
  const t = fakeTimer();
  const lights: Light[] = [];
  for (let i = 0; i < count; i++) {
    lights.push(createLight({ timer: t.timer, frameCount: 1, darkDelay: 0.2, litDelay: 0.05 }));
  }
  const group = createLightGroup({ timer: t.timer, lights, defaultPeriod: 1 });
  const announced: string[] = [];
  // Distinct times so a test can tell WHICH entry was used: index n decays after n + 1 seconds.
  const times = Array.from({ length: count * 2 }, (_, i) => i + 1);
  const bargraph = createLightBargraph({
    timer: t.timer, group, lights, times,
    onTimerExpired: () => announced.push('ControlTimerExpired'),
    onCountdownEnded: () => announced.push('TLightGroupCountdownEnded'),
  });
  return { bargraph, group, lights, t, announced };
}

const lit = (lights: readonly Light[]) => lights.filter((l) => l.on).length;

describe('⚠️ the fuel bargraph counts in HALF LAMPS, and that is what onCount answers', () => {
  test('onCount is the time index, NOT the number of lit lamps', () => {
    const { bargraph, lights } = build();

    bargraph.toggleSplitIndex(11);

    // Eleven is the tank full: six lamps lit, and `TLightGroupGetOnCount` still answers eleven.
    expect(lit(lights)).toBe(6);
    expect(bargraph.onCount).toBe(11);
  });

  test('each lamp is worth two indices, so an index lights floor(n/2) + 1 of them', () => {
    const { bargraph, lights } = build();

    bargraph.toggleSplitIndex(1);
    expect(lit(lights)).toBe(1);

    bargraph.toggleSplitIndex(3);
    expect(lit(lights)).toBe(2);

    bargraph.toggleSplitIndex(4);
    expect(lit(lights)).toBe(3);
  });

  test('an index past the top is clamped to the last one rather than ignored', () => {
    const { bargraph, lights } = build();

    bargraph.toggleSplitIndex(99);

    expect(bargraph.onCount).toBe(11);
    expect(lit(lights)).toBe(6);
  });

  /**
   * ⚠️ TWELVE IS ONE PAST THE TOP, NOT THE TOP. Six lamps make levels 0 to 11, and the boundary is
   * where a `>=` written as a `>` survives every test that only ever asks about ninety-nine: the level
   * would be kept at twelve, `times[12]` would be undefined so nothing would ever drain, and the
   * underlying group would be handed a split of six and quietly ignore it — a tank that reads full,
   * never empties and answers a number no rollover can beat.
   */
  test('⚠️ and an index of exactly twice the lamp count is one PAST the top', () => {
    const { bargraph, lights, t } = build();

    bargraph.toggleSplitIndex(12);

    expect(bargraph.onCount).toBe(11);
    expect(lit(lights)).toBe(6);
    expect(t.delays()).toContain(12); // times[11], so the full tank still drains
  });

  test('a negative index empties the tank and puts the count back to zero', () => {
    const { bargraph, lights } = build();
    bargraph.toggleSplitIndex(11);

    bargraph.toggleSplitIndex(-1);

    expect(lit(lights)).toBe(0);
    expect(bargraph.onCount).toBe(0);
  });

  test('⚠️ an EVEN index flashes the topmost lamp, which is the half-full look', () => {
    const { bargraph, lights } = build();

    bargraph.toggleSplitIndex(4);
    expect(lights[2]!.flashing).toBe(true);

    bargraph.toggleSplitIndex(5);
    expect(lights[2]!.flashing).toBe(false);
  });
});

describe('⚠️ and the tank DRAINS, which is the whole reason it is not a light group', () => {
  test('the decay time is the one indexed by the current level, not a constant', () => {
    const { bargraph, t } = build();

    bargraph.toggleSplitIndex(7);

    expect(t.delays()).toContain(8); // times[7], which this fixture made 7 + 1
  });

  test('when it expires the level drops by one and a timer expiry is announced', () => {
    const { bargraph, t, announced } = build();
    bargraph.toggleSplitIndex(7);

    t.fire();

    expect(bargraph.onCount).toBe(6);
    expect(announced).toEqual(['ControlTimerExpired']);
  });

  test('⚠️ draining from the LAST level ends the countdown instead of announcing another tick', () => {
    const { bargraph, t, announced, lights } = build();
    bargraph.toggleSplitIndex(1);

    t.fire(); // 1 -> 0, still a tick
    announced.length = 0;
    t.fire(); // 0 -> the tank is empty

    expect(lit(lights)).toBe(0);
    expect(announced).toEqual(['TLightGroupCountdownEnded']);
  });

  test('⚠️ refilling KILLS the running decay, or the tank would drain twice as fast', () => {
    const { bargraph, t } = build();
    bargraph.toggleSplitIndex(3);
    const first = t.alive();

    bargraph.toggleSplitIndex(9);

    expect(t.alive().some((id) => first.includes(id))).toBe(false);
  });
});
