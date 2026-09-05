// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  createCamera, stepCamera, stepAxis, maxOffsetOf, DEFAULT_CAMERA,
  type CameraConfig,
} from '../app/js/shell/camera.js';

const config = (over: Partial<CameraConfig> = {}): CameraConfig => ({ ...DEFAULT_CAMERA, ...over });

/** Runs the camera until it settles, and reports how it got there. */
function settle(c: CameraConfig, ballY: number, speed: number, from = createCamera(c), frames = 400) {
  let state = from;
  const offsets: number[] = [];
  for (let i = 0; i < frames; i++) {
    state = stepCamera(state, c, { y: ballY, speedY: speed });
    offsets.push(state.offset);
  }
  return { state, offsets };
}

describe('the screen and the table are the sizes that were decided', () => {
  test('the view is 180 tall and the halved playfield is 235', () => {
    expect(DEFAULT_CAMERA.viewHeight).toBe(180);
    expect(DEFAULT_CAMERA.worldHeight).toBe(235);
  });

  test('which leaves exactly 55 pixels of travel', () => {
    expect(maxOffsetOf(DEFAULT_CAMERA)).toBe(55);
  });

  test('and it starts at the BOTTOM, looking at the flippers', () => {
    expect(createCamera(DEFAULT_CAMERA).offset).toBe(55);
  });

  test('the damping never covers more than the whole error in one frame', () => {
    // Pinned because the final clamp in `stepAxis` relies on it: a step that cannot exceed the error
    // cannot overshoot a target that is already inside the range. Raise this past 1 and the clamp
    // stops being unreachable, which is exactly when it starts earning its keep.
    expect(DEFAULT_CAMERA.damping).toBeGreaterThan(0);
    expect(DEFAULT_CAMERA.damping).toBeLessThanOrEqual(1);
  });
});

describe('THE GATE: the two thresholds must differ', () => {
  test('the tolerance to start moving is strictly larger than the one to stop', () => {
    // This is the defect the plan named: equal thresholds make the camera chatter on the boundary,
    // starting and stopping every frame. The test exists to fail if anybody ever equalizes them.
    expect(DEFAULT_CAMERA.startTolerance).toBeGreaterThan(DEFAULT_CAMERA.stopTolerance);
  });

  test('a ball wobbling inside the start tolerance moves NOTHING', () => {
    const c = config();
    const rest = createCamera(c);

    // Ball just above the resting anchor: the error is real but under the start tolerance.
    const after = stepCamera(rest, c, { y: c.anchor + maxOffsetOf(c) - 2, speedY: 5 });

    expect(after.offset).toBe(rest.offset);
    expect(after.moving).toBe(false);
  });

  test('once moving it keeps moving past the point that would not have started it', () => {
    // The whole purpose of two thresholds. Without them the camera would stop the instant the error
    // dropped below the start tolerance, and the next wobble would start it again.
    const c = config();
    const moving = settle(c, 100, 5, createCamera(c), 30).state;
    expect(moving.moving).toBe(true);

    const near = stepCamera(moving, c, { y: moving.offset + c.anchor + 1.5, speedY: 5 });

    expect(near.moving).toBe(true);
  });

  test('and it does stop, once the error is under the SMALLER threshold', () => {
    const c = config();

    const { state } = settle(c, 100, 5);

    expect(state.moving).toBe(false);
    expect(Math.abs(state.offset - (100 - c.anchor))).toBeLessThanOrEqual(c.stopTolerance);
  });

  test('it settles NEAR the target, never exactly on it', () => {
    // The residual is the dead zone doing its job, and it is why nothing in these tests asks for an
    // exact offset. Demanding the exact value would be demanding a camera with no dead zone.
    const c = config();

    const { state } = settle(c, 20, 6);

    expect(state.offset).toBeGreaterThan(0);
    expect(state.offset).toBeLessThanOrEqual(c.stopTolerance);
  });
});

describe('THE GATE: the camera is never as fast as the ball', () => {
  test('no single frame moves the view further than the ball moved', () => {
    // Motion sickness is the reason. The cap is a fraction of the ball's own vertical speed, so the
    // view can never overtake what the player is following.
    const c = config();
    let state = createCamera(c);

    for (let i = 0; i < 200; i++) {
      const previous = state.offset;
      const speed = 3;
      state = stepCamera(state, c, { y: 40, speedY: speed });
      expect(Math.abs(state.offset - previous)).toBeLessThanOrEqual(speed * c.maxSpeedFactor + 1e-9);
    }
  });

  test('the cap is strictly below the ball’s speed, not equal to it', () => {
    expect(DEFAULT_CAMERA.maxSpeedFactor).toBeLessThan(1);
    expect(DEFAULT_CAMERA.maxSpeedFactor).toBeGreaterThan(0);
  });

  test('a SLOW ball drags the camera slowly, however large the error', () => {
    const c = config();

    const fast = settle(c, 0, 20, createCamera(c), 5).state;
    const slow = settle(c, 0, 0.5, createCamera(c), 5).state;

    expect(55 - fast.offset).toBeGreaterThan(55 - slow.offset);
  });

  test('a ball that is not moving cannot move the camera at all', () => {
    // A direct consequence of the rule, stated rather than smoothed over: with `speedY` zero the cap
    // is zero. In play the ball is only still when it is held or stuck, and both are handled
    // elsewhere; if this ever looks wrong on the table it is a tuning decision, not a bug.
    const c = config();

    const { state } = settle(c, 0, 0);

    expect(state.offset).toBe(55);
  });
});

describe('following the ball up the table', () => {
  test('a ball low on the table leaves the camera at rest', () => {
    const c = config();

    const { state } = settle(c, 200, 6);

    expect(state.offset).toBe(55);
  });

  test('a ball at the top of the table scrolls the view all the way up', () => {
    const c = config();

    const { state } = settle(c, 20, 6);

    expect(state.offset).toBeLessThanOrEqual(c.stopTolerance);
  });

  test('the view never scrolls past either end', () => {
    const c = config();

    expect(settle(c, -500, 50).state.offset).toBeLessThanOrEqual(c.stopTolerance);
    expect(settle(c, 900, 50).state.offset).toBeGreaterThanOrEqual(55 - c.stopTolerance);
  });

  test('the ball is held at a fixed distance from the top of the view while following', () => {
    const c = config();

    const { state } = settle(c, 120, 6);

    expect(Math.abs((120 - state.offset) - c.anchor)).toBeLessThanOrEqual(c.stopTolerance);
  });

  test('the approach is gradual, never a jump', () => {
    // Every frame covers a fraction of what is left, so the view eases in rather than snapping.
    const c = config();

    const { offsets } = settle(c, 20, 6, createCamera(c), 12);

    const steps = offsets.map((o, i) => (i ? offsets[i - 1]! - o : 55 - o));
    expect(steps.every((s) => s >= 0)).toBe(true);
    expect(steps[0]!).toBeGreaterThan(steps.at(-1)!);
  });
});

describe('losing the flippers is intentional', () => {
  test('the flippers leave the view once the camera has scrolled past them', () => {
    // Decided deliberately: the table is taller than the screen, and when the ball is high the player
    // gives up the base of the table for as long as it takes to come down. It is a rule of this
    // version of the game, not a defect of the camera.
    const c = config();
    const flipperY = 225;

    const high = settle(c, 20, 6).state;
    const low = settle(c, 200, 6).state;

    expect(flipperY).toBeGreaterThan(high.offset + c.viewHeight);
    expect(flipperY).toBeLessThanOrEqual(low.offset + c.viewHeight);
  });

  test('and they come back when the ball does', () => {
    const c = config();
    const high = settle(c, 20, 6).state;

    const { state } = settle(c, 220, 6, high);

    expect(state.offset).toBeGreaterThanOrEqual(55 - c.stopTolerance);
  });
});

describe('the axis solver is reusable, which is what phase 8 needs', () => {
  test('a table WIDER than the screen scrolls the same way', () => {
    // The plan says a wider authored table scrolls horizontally by this same algorithm. It is one
    // axis solver called twice, not two cameras.
    const horizontal = config({ viewHeight: 320, worldHeight: 420, anchor: 160 });

    let state = { offset: maxOffsetOf(horizontal), moving: false };
    for (let i = 0; i < 400; i++) state = stepAxis(state, horizontal, 50, 6);

    expect(state.offset).toBeLessThanOrEqual(horizontal.stopTolerance);
  });

  test('an axis with nothing to scroll never moves', () => {
    const fits = config({ viewHeight: 235, worldHeight: 235 });

    const { state } = settle(fits, 0, 20);

    expect(maxOffsetOf(fits)).toBe(0);
    expect(state.offset).toBe(0);
  });
});
