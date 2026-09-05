// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createCollisionComponent } from '../app/js/table/collision-component.js';
import type { BallState } from '../app/js/physics/collision.js';

const HARD = 7;
const SOFT = 9;

function build(overrides: { tiltLocked?: boolean; threshold?: number; boost?: number; elasticity?: number } = {}) {
  const played: number[] = [];
  const table = { tiltLocked: overrides.tiltLocked ?? false };
  const c = createCollisionComponent({
    table,
    elasticity: overrides.elasticity ?? 1,
    smoothness: 1,
    threshold: overrides.threshold ?? 5,
    boost: overrides.boost ?? 0,
    hardHitSoundId: HARD,
    softHitSoundId: SOFT,
    sound: { play: (id) => played.push(id) },
  });
  return { c, played, table };
}

/** A ball heading straight down into a surface whose normal points up. */
const ball = (speed: number): BallState => ({ position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed });
const UP = { x: 0, y: 1 };
const AT = { x: 0, y: 0 };

describe('collision component — the bounce', () => {
  test('bounces with the component elasticity', () => {
    const { c } = build({ elasticity: 0.5 });
    const b = ball(10);

    c.collision(b, AT, UP, 0, null);

    expect(b.direction.y).toBeCloseTo(1);
    expect(b.speed).toBeCloseTo(5);
  });
});

describe('collision component — sound by how hard the hit was', () => {
  test('above the threshold it plays the HARD sound', () => {
    const { c, played } = build({ threshold: 5 });

    c.collision(ball(10), AT, UP, 0, null);

    expect(played).toEqual([HARD]);
  });

  test('below the threshold but audible it plays the SOFT sound', () => {
    const { c, played } = build({ threshold: 5 });

    c.collision(ball(1), AT, UP, 0, null);

    expect(played).toEqual([SOFT]);
  });

  test('a rebound under 0.2 plays nothing at all', () => {
    // The original's literal cutoff. Without it every grazing contact would tick.
    const { c, played } = build({ threshold: 5 });

    c.collision(ball(0.1), AT, UP, 0, null);

    expect(played).toEqual([]);
  });
});

describe('collision component — tilt', () => {
  test('TILT kills the kick, not just the sound', () => {
    // A tilted table stops answering: a bumper stops kicking. Handling only the sound would leave the
    // bumpers firing on a dead table.
    const alive = build({ threshold: 1, boost: 20 });
    const bAlive = ball(10);
    alive.c.collision(bAlive, AT, UP, 0, null);

    const tilted = build({ threshold: 1, boost: 20, tiltLocked: true });
    const bTilted = ball(10);
    tilted.c.collision(bTilted, AT, UP, 0, null);

    expect(bAlive.speed).toBeCloseTo(30); // 10 back plus 20 of kick
    expect(bTilted.speed).toBeCloseTo(10); // just the bounce
  });

  test('TILT also silences the hit', () => {
    const { c, played } = build({ threshold: 1, tiltLocked: true });

    c.collision(ball(10), AT, UP, 0, null);

    expect(played).toEqual([]);
  });

  test('the ball still bounces on a tilted table — it is dead, not open', () => {
    const { c } = build({ tiltLocked: true });
    const b = ball(10);

    c.collision(b, AT, UP, 0, null);

    expect(b.direction.y).toBeCloseTo(1);
  });
});

describe('collision component — reporting a hard hit', () => {
  test('defaultCollision returns true only above the threshold', () => {
    // Subclasses use the boolean to decide whether the hit counts: a target only registers on a hard
    // hit, and a graze must not score.
    const { c } = build({ threshold: 5 });

    expect(c.defaultCollision(ball(10), AT, UP)).toBe(true);
    expect(c.defaultCollision(ball(1), AT, UP)).toBe(false);
  });

  test('on a tilted table nothing ever counts as a hard hit', () => {
    const { c } = build({ threshold: 1, tiltLocked: true });

    expect(c.defaultCollision(ball(100), AT, UP)).toBe(false);
  });
});
