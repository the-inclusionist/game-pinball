// SPDX-License-Identifier: AGPL-3.0-or-later
// THE COMET MISSION: THE RULES, WITH NO SCREEN AND NO BALL.
//
// ⚠️ THE DEV'S SPEC, VERBATIM AND IN FULL, because every constant below is a sentence of it:
//
//   "Após escolher a tela, a próxima tela é a da missão principal. o jogador deve escolher um número
//    de 2 a 9. Uma vez escolhido o número, aparecerá na fase cometas caindo do céu com um número
//    dentro, no máximo 3 por vez. Eles caem lentamente e após permanecerem na tela por 10s, eles
//    diminuem de tamanho até sumir em uma animação suave. Um, dois ou três dos cometas presentes na
//    tela contêm um número múltiplo do número da missão: se a bolinha bater nele, ganha-se um ponto e
//    ele explode de forma suave. Se a bolinha bater em um cometa com número que não é múltiplo, o
//    cometa também explode de forma suave, mas o jogador perde um ponto de missão (pontos de missão
//    são separados do ponto de jogo). O jogador ganha o jogo ao completar 20 pontos de missão."
//
// ========================= THE THREE THINGS THE SPEC LEAVES OPEN =========================
// Each is decided here, in the open, because a reader of this file is entitled to know which lines are
// the Dev's and which are mine:
//
//   1. ⚠️ MISSION POINTS DO NOT GO BELOW NOUGHT. "perde um ponto de missão" does not say what happens
//      at zero. A running total that goes negative tells a child who is guessing that they are worse
//      than nothing, which is not what a multiplication drill is for. Floored.
//   2. ⚠️ A COMET DOES NOT DEFLECT THE BALL. "se a bolinha bater nele" is a contact, and making it a
//      collision body would put mass into a physics core the whole port exists to keep faithful — and
//      would change how every table plays the moment the mission is on. The ball passes through and
//      the comet bursts.
//   3. ⚠️ ONE COMET PER CONTACT, the nearest. Three overlapping bursts from one touch would pay three
//      points for one piece of arithmetic.
import { describe, test, expect } from 'vitest';
import {
  cometMission, MAX_COMETS, COMET_LIFETIME, COMET_FADE, COMET_BURST, COMET_RADIUS,
  FALL_SPEED, WINNING_POINTS, MISSION_NUMBERS, type CometSky,
} from '../app/js/control/comet-mission.js';

const SKY: CometSky = { left: 10, right: 173, top: 0, bottom: 235 };

/** A generator that answers a fixed cycle, so every test below is the same run twice. */
function dice(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

/**
 * Steps the field in sixtieths, which is the unit the frame loop actually hands it.
 *
 * ⚠️ A COUNT OF FRAMES AND NOT `t += step; t < seconds`. Accumulating a sixtieth in floating point
 * lands either side of the target and runs 120 or 121 frames for the same two seconds — which is
 * 0.15 table units of fall, three times the tolerance the speed assertion uses.
 */
function run(mission: ReturnType<typeof cometMission>, seconds: number, sky: CometSky = SKY): void {
  const step = 1 / 60;
  for (let i = 0, n = Math.round(seconds * 60); i < n; i++) mission.advance(step, sky);
}

describe('the mission number', () => {
  test('is one of two to nine, and nothing else is accepted', () => {
    expect(MISSION_NUMBERS).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    for (const n of MISSION_NUMBERS) expect(cometMission({ number: n }).number).toBe(n);
    // ⚠️ A THROW AND NOT A CLAMP. The number comes from a screen this repository writes; a mission
    // silently running on 2 when the caller asked for 1 is a drill the player is not doing.
    for (const bad of [0, 1, 10, 2.5, -3, Number.NaN]) {
      expect(() => cometMission({ number: bad }), `${bad} was accepted as a mission number`).toThrow();
    }
  });
});

describe('the sky holds at most three comets, and always one worth hitting', () => {
  test('⚠️ never more than three, however long it runs', () => {
    const mission = cometMission({ number: 7, random: dice([0.1, 0.9, 0.35, 0.66, 0.5, 0.02]) });
    let worst = 0;
    for (let i = 0; i < 60 * 60; i++) {
      mission.advance(1 / 60, SKY);
      worst = Math.max(worst, mission.comets.length);
    }
    expect(worst, 'the sky filled past the three the Dev asked for').toBe(MAX_COMETS);
  });

  test('⚠️ and whenever there is a comet at all, one of them is a multiple', () => {
    /**
     * ⚠️ "Um, dois ou três dos cometas presentes na tela contêm um número múltiplo" — so the count is
     * never nought. A field that can show three wrong answers is a field where the only move is to
     * miss, and the player loses a point for playing.
     *
     * The hard case is not the spawn, it is the EXPIRY: the last multiple ages out while two
     * non-multiples are still falling. Sixty seconds at a sixtieth is long enough for that to happen
     * many times over.
     */
    const mission = cometMission({ number: 4, random: dice([0.8, 0.2, 0.55, 0.99, 0.31, 0.47]) });
    const empty: number[] = [];
    for (let i = 0; i < 60 * 60; i++) {
      mission.advance(1 / 60, SKY);
      const live = mission.comets.filter((c) => c.state === 'falling');
      if (live.length > 0 && !live.some((c) => c.multiple)) empty.push(i);
    }
    expect(empty.slice(0, 5), 'frames where every comet on screen was a wrong answer').toEqual([]);
  });

  test('every comet says truthfully whether its number is a multiple', () => {
    const mission = cometMission({ number: 6, random: dice([0.05, 0.7, 0.43, 0.88, 0.26]) });
    run(mission, 40);
    const wrong = mission.comets
      .filter((c) => c.multiple !== (c.value % 6 === 0))
      .map((c) => `${c.value} says multiple=${c.multiple}`);
    expect(wrong, 'a comet is lying about its own number').toEqual([]);
    expect(mission.comets.every((c) => c.value >= 2 && c.value <= 99),
      'a comet carries a number that will not fit in it').toBe(true);
  });
});

describe('a comet falls slowly, then goes', () => {
  test('⚠️ it falls at the declared speed and nothing else moves it', () => {
    const mission = cometMission({ number: 3, random: dice([0.5]) });
    mission.advance(1 / 60, SKY);
    const first = mission.comets[0]!;
    const startY = first.y;
    const startX = first.x;
    run(mission, 2);
    const now = mission.comets.find((c) => c.id === first.id)!;
    expect(now.y - startY, 'the fall is not at FALL_SPEED').toBeCloseTo(FALL_SPEED * 2, 1);
    expect(now.x, 'a comet drifted sideways, which nothing asked for').toBe(startX);
  });

  test('⚠️ it keeps its size for ten seconds, then shrinks away over the fade', () => {
    const mission = cometMission({ number: 5, random: dice([0.5]) });
    mission.advance(1 / 60, SKY);
    const id = mission.comets[0]!.id;
    const at = (): (typeof mission.comets)[number] | undefined =>
      mission.comets.find((c) => c.id === id);

    run(mission, COMET_LIFETIME - 1);
    expect(at()?.scale, 'it started shrinking before its ten seconds were up').toBeCloseTo(1, 2);
    expect(at()?.state).toBe('falling');

    run(mission, 1.5);
    const shrinking = at();
    expect(shrinking?.state, 'ten seconds passed and it is still at full size').toBe('fading');
    expect(shrinking!.scale, 'the fade is not a fade — it is still whole').toBeLessThan(0.9);
    expect(shrinking!.scale, 'it vanished instantly instead of shrinking').toBeGreaterThan(0);

    run(mission, COMET_FADE);
    expect(at(), 'it is still on screen well after the fade should have finished').toBeUndefined();
  });

  test('and one that falls past the bottom of the table is gone', () => {
    const shallow: CometSky = { left: 10, right: 173, top: 0, bottom: 30 };
    const mission = cometMission({ number: 9, random: dice([0.5]) });
    mission.advance(1 / 60, shallow);
    const id = mission.comets[0]!.id;
    // It enters at `top - COMET_RADIUS` and is gone once its top edge clears `bottom`, so the whole
    // journey is the sky plus two radii — with a second's slack, and still well inside the ten it lives.
    run(mission, (shallow.bottom + COMET_RADIUS * 2) / FALL_SPEED + 1, shallow);
    expect(mission.comets.some((c) => c.id === id), 'a comet is still falling below the table').toBe(false);
  });
});

describe('the ball, the comet and the point', () => {
  /** Puts a comet of a known kind on screen and hands back its position. */
  function fieldWith(number: number, want: boolean): {
    mission: ReturnType<typeof cometMission>; comet: { id: number; x: number; y: number };
  } {
    const mission = cometMission({ number, random: dice([0.5, 0.1, 0.9, 0.3]) });
    for (let i = 0; i < 60 * 12; i++) {
      mission.advance(1 / 60, SKY);
      const found = mission.comets.find((c) => c.state === 'falling' && c.multiple === want);
      if (found) return { mission, comet: { id: found.id, x: found.x, y: found.y } };
    }
    throw new Error(`no ${want ? 'multiple' : 'non-multiple'} comet appeared in twelve seconds`);
  }

  test('⚠️ hitting a multiple pays a point and bursts it', () => {
    const { mission, comet } = fieldWith(3, true);
    expect(mission.points).toBe(0);

    const strike = mission.strike(comet.x, comet.y, 3);
    expect(strike, 'the ball was inside the comet and nothing happened').not.toBeNull();
    expect(strike!.scored, 'a multiple was hit and it did not count').toBe(true);
    expect(strike!.points, 'the point was not paid').toBe(1);
    expect(mission.points).toBe(1);

    const hit = mission.comets.find((c) => c.id === comet.id);
    expect(hit?.state, 'it did not burst').toBe('bursting');
    // ⚠️ AND IT CANNOT BE HIT TWICE. A burst lasts a fraction of a second and the ball is still there.
    expect(mission.strike(comet.x, comet.y, 3), 'the same comet paid twice').toBeNull();

    run(mission, COMET_BURST + 0.1);
    expect(mission.comets.some((c) => c.id === comet.id), 'the burst never ended').toBe(false);
  });

  /** Advances until a wrong-numbered comet is on screen, and says where it is. */
  function untilWrong(mission: ReturnType<typeof cometMission>): { x: number; y: number } {
    for (let i = 0; i < 60 * 20; i++) {
      mission.advance(1 / 60, SKY);
      const bad = mission.comets.find((c) => c.state === 'falling' && !c.multiple);
      if (bad) return { x: bad.x, y: bad.y };
    }
    throw new Error('no wrong-numbered comet appeared in twenty seconds');
  }

  test('⚠️ hitting a wrong number costs a point, and never takes the total below nought', () => {
    const empty = fieldWith(4, false);
    const missed = empty.mission.strike(empty.comet.x, empty.comet.y, 3);
    expect(missed!.scored, 'a wrong answer counted as right').toBe(false);
    expect(missed!.points, 'the total went below nought').toBe(0);
    expect(empty.mission.comets.find((c) => c.id === empty.comet.id)?.state,
      'a wrong answer has to burst too — the Dev asked for it').toBe('bursting');

    // ⚠️ AND WITH A POINT IN HAND THE SAME MISTAKE COSTS IT, which is the half a floor could hide:
    // clamping at nought and never subtracting at all look identical from an empty scoreboard.
    const held = fieldWith(4, true);
    held.mission.strike(held.comet.x, held.comet.y, 3);
    expect(held.mission.points).toBe(1);
    const bad = untilWrong(held.mission);
    held.mission.strike(bad.x, bad.y, 3);
    expect(held.mission.points, 'the point was not taken').toBe(0);
  });

  test('a ball that is not touching anything strikes nothing', () => {
    const mission = cometMission({ number: 8, random: dice([0.5]) });
    run(mission, 3);
    const comet = mission.comets[0]!;
    // Just outside the sum of the radii, on the axis where it is unambiguous.
    expect(mission.strike(comet.x + COMET_RADIUS + 3 + 1, comet.y, 3),
      'the ball struck a comet it was not touching').toBeNull();
  });

  test('⚠️ twenty points wins the game', () => {
    const mission = cometMission({ number: 2, random: dice([0.5, 0.2, 0.8]) });
    expect(mission.won).toBe(false);
    for (let i = 0; i < WINNING_POINTS; i++) {
      expect(mission.won, `the game was won at ${i} points, before ${WINNING_POINTS}`).toBe(false);
      let paid = false;
      for (let f = 0; f < 60 * 20 && !paid; f++) {
        mission.advance(1 / 60, SKY);
        const good = mission.comets.find((c) => c.state === 'falling' && c.multiple);
        if (good) paid = mission.strike(good.x, good.y, 3)?.scored === true;
      }
      expect(paid, `no multiple could be reached to pay point ${i + 1}`).toBe(true);
    }
    expect(mission.points).toBe(WINNING_POINTS);
    expect(mission.won, 'twenty points and the game is not won').toBe(true);
  });
});

describe('the same seed is the same run', () => {
  test('⚠️ because a drill nobody can reproduce is a drill nobody can debug', () => {
    const shape = (): string => {
      const mission = cometMission({ number: 7, random: dice([0.11, 0.83, 0.47, 0.29, 0.62]) });
      run(mission, 25);
      return mission.comets.map((c) => `${c.value}@${c.x.toFixed(2)},${c.y.toFixed(2)}`).join('|');
    };
    expect(shape()).toBe(shape());
  });
});
