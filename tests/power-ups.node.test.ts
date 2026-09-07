// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CAPSULES, AND THE RULES THAT MAKE THEM A BONUS RATHER THAN A SECOND GAME.
//
// ⚠️ THE DEV: "O jogo deve ter itens comuns no arkanoid: triplicar a quantidade de bolinhas (só perde
// quando a última bolinha cair), bolinha mais lenta, bolinha mais rápida, quando a bolinha estiver no
// ar, sumir com os cometas errados por 5s, etc."
//
// Four kinds and one number he gave outright — five seconds for the one that hides the wrong comets.
// Everything else here is a decision, and each is argued where it is made.
import { describe, test, expect } from 'vitest';
import {
  powerUpField, POWER_UP_KINDS, POWER_UP_SECONDS, RELEASE_CHANCE, CAPSULE_RADIUS,
  CAPSULE_FALL, CAPSULE_LIFETIME, CAPSULE_FADE, MULTIBALL_EXTRA, type CapsuleSky,
} from '../app/js/control/power-ups.js';

const SKY: CapsuleSky = { left: 0, right: 183, top: 0, bottom: 304 };

/** A generator that answers a fixed cycle, so every run below is the same run twice. */
function dice(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

const run = (field: ReturnType<typeof powerUpField>, seconds: number): void => {
  for (let i = 0, n = Math.round(seconds * 60); i < n; i++) field.advance(1 / 60, SKY);
};

describe('what the Dev asked for, as constants', () => {
  test('four kinds, and three balls in total', () => {
    expect([...POWER_UP_KINDS]).toEqual(['multiball', 'slow', 'fast', 'clear']);
    // "triplicar a quantidade de bolinhas" — one already in play plus two.
    expect(MULTIBALL_EXTRA + 1).toBe(3);
  });

  test('⚠️ and the one duration he gave is the one he gave', () => {
    // "sumir com os cometas errados por 5s".
    expect(POWER_UP_SECONDS.clear).toBe(5);
  });

  test('⚠️ multiball has no timer, because he said when it ends', () => {
    // "só perde quando a última bolinha cair." A timer would take a ball out of play mid-shot.
    expect(POWER_UP_SECONDS.multiball).toBe(0);
  });
});

describe('a burst comet sometimes drops one', () => {
  test('⚠️ sometimes, and not always', () => {
    // A capsule from every comet is three on screen with the drill barely started, and a screen of
    // capsules is one where the NUMBERS — which are the point — are the least interesting thing on it.
    const field = powerUpField({ random: dice([0.9]) });

    expect(field.release(50, 50), 'a roll above the chance still dropped one').toBe(false);
    expect(field.capsules).toEqual([]);
  });

  test('and when it does, the capsule is where the comet was', () => {
    const field = powerUpField({ random: dice([0.05, 0.4]) });

    expect(field.release(70, 90), 'a roll under the chance dropped nothing').toBe(true);
    expect(field.capsules[0]!.x).toBe(70);
    expect(field.capsules[0]!.y).toBe(90);
    expect(POWER_UP_KINDS, 'it is one of the four').toContain(field.capsules[0]!.kind);
  });

  test('⚠️ the chance is a real fraction, not a rounding of nought or one', () => {
    // The failure this catches is a comparison the wrong way round, which would make every burst drop
    // one or none of them — and either reads as "the feature is not implemented".
    expect(RELEASE_CHANCE).toBeGreaterThan(0.05);
    expect(RELEASE_CHANCE).toBeLessThan(0.5);
  });
});

describe('a capsule falls, and goes if nobody takes it', () => {
  const dropped = () => {
    const field = powerUpField({ random: dice([0.05, 0.4]) });
    field.release(90, 40);
    return field;
  };

  test('it falls more slowly than a comet, so there is time to go for it', () => {
    const field = dropped();
    const before = field.capsules[0]!.y;

    run(field, 2);

    expect(field.capsules[0]!.y - before).toBeCloseTo(CAPSULE_FALL * 2, 1);
  });

  test('⚠️ and it shrinks away rather than blinking out', () => {
    const field = dropped();

    run(field, CAPSULE_LIFETIME + 0.4);
    expect(field.capsules[0]?.state, 'it is still at full size past its lifetime').toBe('fading');
    expect(field.capsules[0]!.scale).toBeLessThan(1);
    expect(field.capsules[0]!.scale).toBeGreaterThan(0);

    run(field, CAPSULE_FADE);
    expect(field.capsules, 'it is still there well after the fade').toEqual([]);
  });

  test('and one that falls past the bottom is gone', () => {
    const field = powerUpField({ random: dice([0.05, 0.4]) });
    field.release(90, 300);

    // It leaves when its TOP edge clears the floor, so the journey is the gap plus a radius. At 3.5
    // units a second that is two and a half seconds; four gives it room without waiting for the fade.
    run(field, 4);

    expect(field.capsules).toEqual([]);
  });
});

describe('the ball catches them', () => {
  const withKind = (kind: string) => {
    // Walks the cycle until the roll picks the kind asked for, so each test names what it is about.
    for (let i = 0; i < 40; i++) {
      const field = powerUpField({ random: dice([0.05, i / 40]) });
      field.release(90, 90);
      if (field.capsules[0]?.kind === kind) return field;
    }
    throw new Error(`no ${kind} capsule could be rolled`);
  };

  test('touching one takes it, and it is gone from the sky', () => {
    const field = withKind('slow');

    expect(field.take(90, 90, 3), 'the ball was inside it and caught nothing').toBe('slow');
    expect(field.capsules, 'it was taken and is still falling').toEqual([]);
  });

  test('a ball that is not touching one catches nothing', () => {
    const field = withKind('slow');

    expect(field.take(90 + CAPSULE_RADIUS + 3 + 2, 90, 3)).toBeNull();
  });

  test('⚠️ a timed kind runs for its own time and then stops', () => {
    const field = withKind('clear');
    field.take(90, 90, 3);

    expect(field.isActive('clear'), 'it was caught and is not running').toBe(true);
    run(field, POWER_UP_SECONDS.clear - 0.5);
    expect(field.isActive('clear'), 'it stopped early').toBe(true);
    run(field, 1);
    expect(field.isActive('clear'), 'it is still running past its time').toBe(false);
  });

  test('⚠️ multiball never becomes a running effect, because it has no end of its own', () => {
    const field = withKind('multiball');

    expect(field.take(90, 90, 3)).toBe('multiball');
    expect(field.isActive('multiball'), 'it went on a timer').toBe(false);
    expect(field.active, 'it is in the running list').toEqual({});
  });

  test('⚠️ and slow and fast cancel each other rather than both running', () => {
    /**
     * They are the same axis read from two ends. Holding both is a state with no meaning, and whichever
     * the shell happened to ask about first would silently win — which is the shape of a defect that
     * shows up only as "sometimes the ball is the wrong speed".
     *
     * ⚠️ ONE FIELD, TAKING ONE THEN THE OTHER, because that is the only way the pair can ever exist. An
     * earlier version of this test built two separate fields and compared them, which is two questions
     * about one capsule each and says nothing at all about the two together.
     */
    // The kind is `floor(roll * 4)`: 0.3 lands on `slow` and 0.6 on `fast`. The 0.05 rolls are the
    // release itself, which is under `RELEASE_CHANCE`.
    const field = powerUpField({ random: dice([0.05, 0.3, 0.05, 0.6]) });

    field.release(90, 90);
    expect(field.capsules[0]!.kind, 'the dice did not roll a slow capsule first').toBe('slow');
    field.take(90, 90, 3);
    expect(field.isActive('slow')).toBe(true);

    field.release(90, 90);
    expect(field.capsules[0]!.kind, 'the dice did not roll a fast capsule second').toBe('fast');
    field.take(90, 90, 3);

    expect(field.isActive('fast'), 'the fast one did not take').toBe(true);
    expect(field.isActive('slow'), 'both are running at once').toBe(false);
  });
});
