// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createLight, type Light } from '../app/js/table/light.js';
import { createLightGroup } from '../app/js/table/light-group.js';
import type { TimerService } from '../app/js/table/bumper.js';

function fakeTimer() {
  let pending: (() => void)[] = [];
  const timer: TimerService = {
    set: (_s, cb) => { pending.push(cb); return pending.length; },
    kill: () => { pending = []; },
  };
  return { timer, tick: () => { const r = pending; pending = []; r.forEach((cb) => cb()); }, pendingCount: () => pending.length };
}

function build(count = 4, random = () => 0) {
  const t = fakeTimer();
  const lights: Light[] = [];
  for (let i = 0; i < count; i++) {
    lights.push(createLight({ timer: t.timer, frameCount: 1, darkDelay: 0.2, litDelay: 0.05 }));
  }
  const notifies: number[] = [];
  const group = createLightGroup({
    timer: t.timer, lights, defaultPeriod: 1, random,
    onNotify: () => notifies.push(1),
  });
  return { group, lights, t, notifies };
}

/** The persistent state of every lamp, as a string of 0s and 1s. */
const persistent = (lights: readonly Light[]) => lights.map((l) => (l.on ? 1 : 0)).join('');
/** The timed-override state of every lamp. */
const timed = (lights: readonly Light[]) => lights.map((l) => (l.timedOn ? 1 : 0)).join('');

describe('light group — STEP moves the persistent state', () => {
  test('stepping forward rotates the ring', () => {
    const { group, lights } = build();
    lights[0]!.turnOn();
    lights[1]!.turnOn();
    expect(persistent(lights)).toBe('1100');

    group.stepForward(1);

    expect(persistent(lights)).toBe('1001'); // each takes its neighbor's, the first wraps to the end
  });

  test('stepping backward rotates the other way', () => {
    const { group, lights } = build();
    lights[0]!.turnOn();
    lights[1]!.turnOn();

    group.stepBackward(1);

    expect(persistent(lights)).toBe('0110');
  });

  test('the lamp’s message field travels with it', () => {
    // The group carries the mission's per-lamp integer along when it rotates; otherwise a rotating
    // row would keep its lights and lose their meaning.
    const { group, lights } = build();
    lights[0]!.messageField = 7;

    group.stepForward(1);

    expect(lights[3]!.messageField).toBe(7);
  });

  test('a step sets the animation flag, which is how the mission tells the two families apart', () => {
    const { group } = build();

    group.stepForward(1);

    expect(group.animationFlag).toBe(true);
  });

  test('a step is refused while the last lamp is busy with its own override', () => {
    // The ring would tear: that lamp's state is not its persistent one right now.
    const { group, lights } = build();
    lights[0]!.turnOn();
    lights[3]!.turnOnTimed(5);

    group.stepForward(1);

    expect(persistent(lights)).toBe('1000'); // unchanged
  });
});

describe('light group — ANIMATE moves the override and leaves the truth alone', () => {
  test('starting an animation lifts the persistent state into the override layer', () => {
    // The bridge. An animation begins from a picture of the truth, which is what lets it be undone.
    const { group, lights } = build();
    lights[0]!.turnOn();
    lights[2]!.turnOn();

    group.animateForward(1);

    expect(persistent(lights)).toBe('1010'); // untouched
    expect(timed(lights)).toBe('0101');      // the picture, rotated once
  });

  test('an animation clears the animation flag', () => {
    const { group } = build();

    group.animateForward(1);

    expect(group.animationFlag).toBe(false);
  });

  test('resetting an animation restores the truth exactly', () => {
    // Without the lamp's layering, a light show would have to save and restore game state by hand, and
    // any interruption would lose it.
    const { group, lights } = build();
    lights[0]!.turnOn();
    lights[2]!.turnOn();
    group.animateForward(1);

    group.resetGroup();

    expect(persistent(lights)).toBe('1010');
    expect(group.mode).toBe('none');
  });

  test('resetting after a STEP has nothing to undo', () => {
    const { group, lights } = build();
    lights[0]!.turnOn();
    group.stepForward(1);
    const after = persistent(lights);

    group.resetGroup();

    expect(persistent(lights)).toBe(after);
  });
});

describe('light group — an animation is a message that re-sends itself', () => {
  test('the timer replays the current command', () => {
    // There is no animation loop and no frame handler: the group holds which command it is running and
    // the timer keeps sending it.
    const { group, lights, t } = build();
    lights[0]!.turnOn();
    group.stepForward(1);
    expect(persistent(lights)).toBe('0001');

    t.tick();

    expect(persistent(lights)).toBe('0010');
  });

  test('a period of zero stops everything', () => {
    const { group, t } = build();
    group.animateForward(1);

    group.animateForward(0);

    expect(group.mode).toBe('none');
    expect(t.pendingCount()).toBe(0);
  });
});

describe('light group — the group is a bargraph', () => {
  test('lighting fills from the start', () => {
    const { group, lights } = build();

    group.turnOnNext();
    group.turnOnNext();

    expect(persistent(lights)).toBe('1100');
  });

  test('unlighting empties from the end', () => {
    const { group, lights } = build();
    group.turnOnNext(); group.turnOnNext(); group.turnOnNext();

    group.turnOffNext();

    expect(persistent(lights)).toBe('1100');
  });

  test('a full row reports that there is nothing left to light', () => {
    const { group } = build(2);
    group.turnOnNext();
    group.turnOnNext();

    expect(group.turnOnNext()).toBe(false);
  });

  test('an empty row reports that there is nothing left to darken', () => {
    const { group } = build(2);

    expect(group.turnOffNext()).toBe(false);
  });

  test('the split index sets the row to a level', () => {
    const { group, lights } = build();

    group.toggleSplitIndex(1);

    expect(persistent(lights)).toBe('1100');
  });

  test('counting is derived, never stored', () => {
    const { group } = build();
    group.turnOnNext();
    group.turnOnNext();

    expect(group.onCount).toBe(2);
    expect(group.lightCount).toBe(4);
  });
});

describe('light group — the random animations', () => {
  test('saturating lights exactly one dark lamp', () => {
    const { group, lights } = build(4, () => 0);

    group.saturate();

    expect(group.onCount).toBe(1);
    expect(persistent(lights)).toBe('0001'); // counted from the end among the candidates
  });

  test('saturating a full row does nothing', () => {
    const { group } = build(2);
    group.turnOnNext(); group.turnOnNext();

    group.saturate();

    expect(group.onCount).toBe(2);
  });

  test('desaturating darkens exactly one lit lamp', () => {
    const { group } = build(4, () => 0);
    group.turnOnNext(); group.turnOnNext();

    group.desaturate();

    expect(group.onCount).toBe(1);
  });
});

describe('light group — flashing', () => {
  test('flashWhenOn turns every lit lamp off, with a flash on the way', () => {
    const { group, lights, t } = build();
    lights[0]!.turnOn();
    lights[2]!.turnOn();

    group.flashWhenOn(2);
    expect(lights[0]!.flashing).toBe(true);
    t.tick();

    expect(persistent(lights)).toBe('0000');
  });

  test('startFlasher flashes the last lit lamp', () => {
    const { group, lights } = build();
    lights[0]!.turnOn();
    lights[2]!.turnOn();

    group.startFlasher();

    expect(lights[2]!.flashing).toBe(true);
    expect(lights[0]!.flashing).toBe(false);
  });
});

describe('light group — the notify timer', () => {
  test('it reports and does nothing else', () => {
    const { group, t, notifies } = build();

    group.restartNotifyTimer(3);
    t.tick();

    expect(notifies).toEqual([1]);
  });

  test('a non-positive delay cancels it', () => {
    const { group, t } = build();
    group.restartNotifyTimer(3);

    group.restartNotifyTimer(0);

    expect(t.pendingCount()).toBe(0);
  });
});
