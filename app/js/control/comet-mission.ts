// SPDX-License-Identifier: AGPL-3.0-or-later
// control/comet-mission — the multiplication drill that falls out of the sky.
//
// ========================= WHAT THE DEV ASKED FOR =========================
// "Após escolher a tela, a próxima tela é a da missão principal. o jogador deve escolher um número de
//  2 a 9. Uma vez escolhido o número, aparecerá na fase cometas caindo do céu com um número dentro, no
//  máximo 3 por vez. Eles caem lentamente e após permanecerem na tela por 10s, eles diminuem de
//  tamanho até sumir em uma animação suave. Um, dois ou três dos cometas presentes na tela contêm um
//  número múltiplo do número da missão: se a bolinha bater nele, ganha-se um ponto e ele explode de
//  forma suave. Se a bolinha bater em um cometa com número que não é múltiplo, o cometa também explode
//  de forma suave, mas o jogador perde um ponto de missão (pontos de missão são separados do ponto de
//  jogo). O jogador ganha o jogo ao completar 20 pontos de missão."
//
// ========================= NO SCREEN AND NO BALL IN THIS FILE =========================
// The same split `control/mission` and `shell/title` already make, and for the same reason: everything
// worth arguing about is a rule, and a rule inside a draw call is a rule nothing can check. What
// arrives here is a number of seconds and a rectangle; what leaves is a list of comets with a position
// and a size. `gfx/comet-view` draws them and `main` asks whether the ball is touching one.
//
// ⚠️ AND THE RANDOMNESS IS AN ARGUMENT, not `Math.random` reached for in the middle of a function. A
// drill nobody can reproduce is a drill nobody can debug, and `table/physics-build` had to learn the
// same lesson when the survey gate needed the same run twice.

/** The numbers a player may drill. Two to nine, and the screen offers exactly these. */
export const MISSION_NUMBERS: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9];

/** "no máximo 3 por vez" — counting every comet on screen, including the ones on their way out. */
export const MAX_COMETS = 3;

/** "após permanecerem na tela por 10s" — seconds at full size before it starts to go. */
export const COMET_LIFETIME = 10;

/**
 * "eles diminuem de tamanho até sumir em uma animação suave" — seconds spent shrinking to nothing.
 *
 * ⚠️ A SHRINK AND NOT A FADE-OUT, whatever the state is called. The Dev wrote "diminuem de tamanho até
 * sumir": the comet stays solid and gets smaller, which reads as leaving. Dropping the opacity instead
 * would read as a rendering fault on a screen this size.
 */
export const COMET_FADE = 1.2;

/** "explode de forma suave" — seconds of the burst, which grows as it thins out. */
export const COMET_BURST = 0.45;

/** How big a burst gets before it is gone, as a multiple of the comet's own size. */
export const BURST_GROWTH = 1.9;

/** Seconds between arrivals, so three comets do not appear in the same instant. */
export const SPAWN_INTERVAL = 2.6;

/**
 * Table units. The ball's radius is 3, so a comet is six times across what the ball is — big enough to
 * hold two digits at 320x180 and to be worth aiming at, small enough that three of them do not fill
 * the playfield.
 */
export const COMET_RADIUS = 9;

/** "Eles caem lentamente" — table units a second. Ten seconds of falling is ninety units. */
export const FALL_SPEED = 9;

/** "O jogador ganha o jogo ao completar 20 pontos de missão." */
export const WINNING_POINTS = 20;

/**
 * The largest number a comet may carry.
 *
 * ⚠️ TWO DIGITS, BECAUSE THAT IS WHAT FITS. The comet is eighteen units across and the digits are
 * three units wide; a third digit would either not fit inside the circle or would have to be drawn
 * smaller than the ones beside it.
 */
export const LARGEST_VALUE = 99;

export type CometState = 'falling' | 'fading' | 'bursting';

export interface Comet {
  readonly id: number;
  /** The number written inside it. */
  readonly value: number;
  /** Whether `value` is a multiple of the mission's number — the whole question. */
  readonly multiple: boolean;
  readonly x: number;
  readonly y: number;
  readonly state: CometState;
  /** The multiple of `COMET_RADIUS` to draw it at: 1 while falling, down to 0, or out past 1 bursting. */
  readonly scale: number;
  /** How solid to draw it, 0 to 1. Only a burst thins out. */
  readonly alpha: number;
}

/** Where comets may be: the part of the table the player can see. */
export interface CometSky {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface CometStrike {
  readonly comet: Comet;
  /** True when the number was a multiple — a point paid rather than a point lost. */
  readonly scored: boolean;
  /** The mission total AFTER the strike, so the caller announces one number and not two. */
  readonly points: number;
}

/**
 * What one strike should cause: the sentence owed to a player who cannot see it, and whether that was
 * the twentieth point.
 *
 * ⚠️ A DECISION, SO IT LIVES WHERE DECISIONS CAN BE CHECKED. This used to be four lines inside
 * `main.ts` — pick a key, fill it in, and then end the game if the total had arrived. `main.ts` cannot
 * be imported by a node test (it reaches for a document and a canvas on its first line), so those four
 * lines were beyond every gate in the repository. The rule this module's header already states applies
 * to them: everything worth arguing about is a rule, and a rule inside a frame loop is a rule nothing
 * can check.
 */
export interface CometReport {
  /** The dictionary key for what to say. */
  readonly key: string;
  /** Its parameters, already filled in. */
  readonly params: Readonly<Record<string, number>>;
  /** True when this strike was the winning one, so the game is over. */
  readonly ended: boolean;
}

/**
 * ⚠️ IT NAMES THE ARITHMETIC RATHER THAN THE OUTCOME. "24 is a multiple of 6" teaches the thing the
 * drill is for; "right!" only says what happened. The running total goes with it, because the point of
 * a total is knowing where you are without having to ask.
 */
export function reportOf(strike: CometStrike, times: number): CometReport {
  return {
    key: strike.scored ? 'pinball.comets.hit' : 'pinball.comets.miss',
    params: {
      value: strike.comet.value, times, have: strike.points, need: WINNING_POINTS,
    },
    // ⚠️ ">=" AND NOT "===". A power-up that paid two points at once would step over an equality and
    // leave the game running past its own ending, with the corner reading 21 of 20.
    ended: strike.points >= WINNING_POINTS,
  };
}

export interface CometMission {
  readonly number: number;
  readonly points: number;
  readonly won: boolean;
  readonly comets: readonly Comet[];
  /** One step of the world: age, fall, expire, and let a new comet in when there is room. */
  advance(dt: number, sky: CometSky): void;
  /** The ball is at (x, y) with this radius. Answers what it touched, or `null`. */
  strike(x: number, y: number, radius: number): CometStrike | null;
}

export interface CometMissionOptions {
  /** Two to nine. Anything else throws — see below. */
  readonly number: number;
  readonly random?: () => number;
}

interface MutableComet {
  id: number;
  value: number;
  multiple: boolean;
  x: number;
  y: number;
  state: CometState;
  /** Seconds since it arrived. */
  age: number;
  /** Seconds since it entered `fading` or `bursting`. */
  since: number;
}

/**
 * The `i`-th number in 2..99 that is a multiple of `n`, and the `i`-th that is not.
 *
 * ⚠️ AN INDEX AND NOT A REJECTION LOOP. "Draw a number until it is not a multiple" is the obvious
 * shape and it can spin for ever on a generator that answers a fixed value — which is exactly what the
 * tests hand it, and what a seeded run in the browser gate would too.
 *
 * ⚠️ AND THE MULTIPLES STOP AT TWELVE TIMES. This is a times table: `9 x 11` is a question a child is
 * asked and `9 x 3.7` is not. The upper end is whichever of twelve or ninety-nine comes first.
 */
function nthMultiple(n: number, i: number): number {
  const highest = Math.min(12, Math.floor(LARGEST_VALUE / n));
  // Two upwards: `n x 1` is the mission's own number, which reads as a label rather than a question.
  const factors = highest - 2 + 1;
  return n * (2 + (i % Math.max(1, factors)));
}

function nthNonMultiple(n: number, i: number): number {
  const candidates: number[] = [];
  for (let v = 2; v <= LARGEST_VALUE; v++) if (v % n !== 0) candidates.push(v);
  return candidates[i % candidates.length]!;
}

export function cometMission(o: CometMissionOptions): CometMission {
  /**
   * ⚠️ A THROW AND NOT A CLAMP. The number comes from a screen this repository writes, so a bad one is
   * a bug here rather than a player's mistake — and a mission silently running on 2 when the caller
   * asked for 1 is a drill the player is not doing, with nothing on screen to say so.
   */
  if (!MISSION_NUMBERS.includes(o.number)) {
    throw new Error(`[pinball] mission number must be one of ${MISSION_NUMBERS.join(', ')}`
      + `, not ${String(o.number)}`);
  }

  const random = o.random ?? Math.random;
  const number = o.number;
  const live: MutableComet[] = [];
  let points = 0;
  let nextId = 1;
  // ⚠️ ALREADY DUE, SO THE FIRST COMET ARRIVES ON THE FIRST STEP. A mission that shows nothing for
  // its first two and a half seconds looks like a mission that failed to start.
  let sinceSpawn = SPAWN_INTERVAL;

  const view = (c: MutableComet): Comet => ({
    id: c.id,
    value: c.value,
    multiple: c.multiple,
    x: c.x,
    y: c.y,
    state: c.state,
    scale: c.state === 'fading'
      ? Math.max(0, 1 - c.since / COMET_FADE)
      : c.state === 'bursting'
        ? 1 + (BURST_GROWTH - 1) * Math.min(1, c.since / COMET_BURST)
        : 1,
    alpha: c.state === 'bursting' ? Math.max(0, 1 - c.since / COMET_BURST) : 1,
  });

  /**
   * Whether the next comet has to be a multiple.
   *
   * ⚠️ THE RULE IS ABOUT THE COMET THAT LEAVES NEXT, not about the count right now. "Um, dois ou três
   * dos cometas presentes na tela contêm um número múltiplo" — so a player looking at the sky always
   * has something worth hitting; a field of three wrong answers is one where the only move available
   * loses a point.
   *
   * Guarding the count alone is not enough, and this is where it comes apart: comets expire OLDEST
   * FIRST, and while one is shrinking away it still holds a slot, so nothing new can arrive to replace
   * it. If the shrinking one was the only multiple, the two comets left are both wrong and the player
   * is stuck with them for the rest of their ten seconds.
   *
   * So a spawn is forced to be a multiple when there is none — and also when the only one is the
   * OLDEST comet on screen, which is the one about to go.
   */
  const mustBeMultiple = (): boolean => {
    const falling = live.filter((c) => c.state === 'falling');
    const multiples = falling.filter((c) => c.multiple);
    if (multiples.length === 0) return true;
    if (multiples.length > 1) return false;
    const oldest = falling.reduce((old, c) => (c.age > old.age ? c : old), falling[0]!);
    return multiples[0]!.id === oldest.id;
  };

  const spawn = (sky: CometSky): void => {
    const span = Math.max(0, (sky.right - sky.left) - COMET_RADIUS * 2);
    const x = sky.left + COMET_RADIUS + random() * span;
    const multiple = mustBeMultiple() || random() < 0.5;
    const draw = Math.floor(random() * 1000);
    live.push({
      id: nextId++,
      value: multiple ? nthMultiple(number, draw) : nthNonMultiple(number, draw),
      multiple,
      x,
      // ⚠️ IT ENTERS FROM ABOVE THE VIEW, so it slides into the sky rather than appearing in it.
      y: sky.top - COMET_RADIUS,
      state: 'falling',
      age: 0,
      since: 0,
    });
  };

  return {
    get number() { return number; },
    get points() { return points; },
    get won() { return points >= WINNING_POINTS; },
    get comets() { return live.map(view); },

    advance(dt: number, sky: CometSky): void {
      if (!(dt > 0)) return;

      for (const c of live) {
        c.age += dt;
        if (c.state === 'falling') {
          c.y += FALL_SPEED * dt;
          if (c.age >= COMET_LIFETIME) {
            c.state = 'fading';
            c.since = 0;
          }
        } else {
          c.since += dt;
          // A comet on its way out keeps falling: stopping it dead is the one thing that would read
          // as a bug rather than as an animation.
          if (c.state === 'fading') c.y += FALL_SPEED * dt;
        }
      }

      for (let i = live.length - 1; i >= 0; i--) {
        const c = live[i]!;
        const gone = (c.state === 'fading' && c.since >= COMET_FADE)
          || (c.state === 'bursting' && c.since >= COMET_BURST)
          || c.y - COMET_RADIUS > sky.bottom;
        if (gone) live.splice(i, 1);
      }

      sinceSpawn += dt;
      if (live.length < MAX_COMETS && sinceSpawn >= SPAWN_INTERVAL) {
        sinceSpawn = 0;
        spawn(sky);
      }
    },

    strike(x: number, y: number, radius: number): CometStrike | null {
      /**
       * ⚠️ ONLY A FALLING COMET IS THERE TO BE HIT. One that is shrinking away has been given its ten
       * seconds and is leaving; charging a player a point for brushing something on its way out would
       * punish them for where the ball happened to be. It cannot pay one either, for the same reason
       * read the other way — the offer is over.
       *
       * ⚠️ AND THE NEAREST ONE ONLY. Comets can overlap, and three bursts from one touch would pay
       * three points for one piece of arithmetic.
       */
      let best: MutableComet | null = null;
      let bestDistance = Infinity;
      for (const c of live) {
        if (c.state !== 'falling') continue;
        const dx = c.x - x;
        const dy = c.y - y;
        const distance = Math.hypot(dx, dy);
        if (distance <= COMET_RADIUS + radius && distance < bestDistance) {
          best = c;
          bestDistance = distance;
        }
      }
      if (!best) return null;

      best.state = 'bursting';
      best.since = 0;
      /**
       * ⚠️ FLOORED AT NOUGHT, AND THAT IS A DECISION THE SPEC DOES NOT MAKE. "o jogador perde um ponto
       * de missão" says nothing about what happens at zero. A running total that goes negative tells a
       * child who is guessing that they are worse than nothing, which is not what a times-table drill
       * is for. The loss is still real the moment there is anything to lose, which is what the gate
       * checks — a floor and a subtraction that never happens look identical from an empty scoreboard.
       */
      points = best.multiple ? points + 1 : Math.max(0, points - 1);
      return { comet: view(best), scored: best.multiple, points };
    },
  };
}
