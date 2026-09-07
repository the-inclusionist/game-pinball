// SPDX-License-Identifier: AGPL-3.0-or-later
// control/power-ups — the capsules that fall out of a burst comet.
//
// ⚠️ THE DEV: "O jogo deve ter itens comuns no arkanoid: triplicar a quantidade de bolinhas (só perde
// quando a última bolinha cair), bolinha mais lenta, bolinha mais rápida, quando a bolinha estiver no
// ar, sumir com os cometas errados por 5s, etc."
//
// ========================= WHERE THEY COME FROM, WHICH HE DID NOT SAY =========================
// In Arkanoid a capsule falls out of a broken brick. The thing that breaks here is a comet, so that is
// where these come from — and it makes the drill's own arithmetic the way to earn them rather than a
// second system beside it. A wrong answer bursts a comet too, so it can drop one as well: being handed
// a slower ball after a mistake is the game helping rather than punishing twice.
//
// ⚠️ AND NOT EVERY BURST DROPS ONE. `RELEASE_CHANCE` is a fifth. A capsule from every comet would mean
// three on screen at once with the drill barely started, and a screen of capsules is a screen where the
// numbers — which are the point — are the least interesting thing on it.
//
// ========================= THEY ARE CAUGHT WITH THE BALL =========================
// Arkanoid catches them with the paddle. This has flippers at the very bottom and a ball that goes
// everywhere, so the ball is the catcher: touch a capsule and it is taken. That is the same contact the
// comets use, for the same reason — nothing collides, because making a capsule a physics body would put
// mass into a core this port keeps faithful.
//
// ========================= AND THE RULES ARE HERE, NOT IN THE LOOP =========================
// What each kind DOES is the shell's business — a ball is slowed by a force, and `main` owns the ball.
// What lives here is which kinds exist, how long each lasts, when one is dropped, and whether the ball
// is touching one. Every part of that is a decision, and a decision inside a frame loop is a decision
// nothing can check.

/** The four the Dev named. `etc.` is left as room rather than filled in by guessing. */
export type PowerUpKind = 'multiball' | 'slow' | 'fast' | 'clear';

export const POWER_UP_KINDS: readonly PowerUpKind[] = ['multiball', 'slow', 'fast', 'clear'];

/** How many extra balls `multiball` puts on the table. Three in total, which is what he asked for. */
export const MULTIBALL_EXTRA = 2;

/**
 * How long each timed kind lasts, in seconds.
 *
 * ⚠️ `clear` IS FIVE BECAUSE HE SAID FIVE: "sumir com os cometas errados por 5s". The other two are
 * eight, which is a little under a comet's own ten seconds on screen — long enough to change a shot,
 * short enough that the table is not a different table for a whole comet's life.
 *
 * ⚠️ AND `multiball` HAS NO DURATION. It ends when the balls do, which is the rule he stated: "só perde
 * quando a última bolinha cair." A timer on it would take a ball out of play mid-shot.
 */
export const POWER_UP_SECONDS: Readonly<Record<PowerUpKind, number>> = {
  multiball: 0,
  slow: 8,
  fast: 8,
  clear: 5,
};

/** Table units a second. Slower than a comet, so a capsule is a thing you have time to go for. */
export const CAPSULE_FALL = 3.5;

/** Table units. Half a comet: a capsule is a bonus, not an obstacle. */
export const CAPSULE_RADIUS = 5;

/** How long a capsule stays before it is gone, and how long it takes to shrink away. */
export const CAPSULE_LIFETIME = 9;
export const CAPSULE_FADE = 0.9;

/** One burst in five drops one. See this module's header. */
export const RELEASE_CHANCE = 0.2;

export type CapsuleState = 'falling' | 'fading';

export interface Capsule {
  readonly id: number;
  readonly kind: PowerUpKind;
  readonly x: number;
  readonly y: number;
  readonly state: CapsuleState;
  /** The multiple of `CAPSULE_RADIUS` to draw it at. */
  readonly scale: number;
}

/** Where capsules may be. The same rectangle the comets fall through. */
export interface CapsuleSky {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface PowerUpField {
  readonly capsules: readonly Capsule[];
  /** Which kinds are running now, and for how much longer. `multiball` never appears here. */
  readonly active: Readonly<Partial<Record<PowerUpKind, number>>>;
  advance(dt: number, sky: CapsuleSky): void;
  /** A comet burst here. Sometimes drops a capsule; answers whether it did. */
  release(x: number, y: number): boolean;
  /** The ball is at (x, y). Answers what it caught, or `null`. */
  take(x: number, y: number, radius: number): PowerUpKind | null;
  /** Whether a kind is running right now. */
  isActive(kind: PowerUpKind): boolean;
}

interface MutableCapsule {
  id: number;
  kind: PowerUpKind;
  x: number;
  y: number;
  state: CapsuleState;
  age: number;
  since: number;
}

export interface PowerUpOptions {
  readonly random?: () => number;
}

export function powerUpField(o: PowerUpOptions = {}): PowerUpField {
  const random = o.random ?? Math.random;
  const live: MutableCapsule[] = [];
  const running = new Map<PowerUpKind, number>();
  let nextId = 1;

  const view = (c: MutableCapsule): Capsule => ({
    id: c.id,
    kind: c.kind,
    x: c.x,
    y: c.y,
    state: c.state,
    scale: c.state === 'fading' ? Math.max(0, 1 - c.since / CAPSULE_FADE) : 1,
  });

  return {
    get capsules() { return live.map(view); },
    get active() { return Object.fromEntries(running) as Partial<Record<PowerUpKind, number>>; },

    advance(dt: number, sky: CapsuleSky): void {
      if (!(dt > 0)) return;

      for (const c of live) {
        c.age += dt;
        c.y += CAPSULE_FALL * dt;
        if (c.state === 'falling' && c.age >= CAPSULE_LIFETIME) {
          c.state = 'fading';
          c.since = 0;
        } else if (c.state === 'fading') {
          c.since += dt;
        }
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const c = live[i]!;
        if ((c.state === 'fading' && c.since >= CAPSULE_FADE) || c.y - CAPSULE_RADIUS > sky.bottom) {
          live.splice(i, 1);
        }
      }

      /**
       * ⚠️ THE TIMERS RUN DOWN HERE AND NOT WHERE THEY ARE READ. A duration counted at the point of
       * use is a duration that stops when nothing is looking — and `clear` is read by the comet field
       * while `slow` is read by the physics, so "the point of use" is two different places running at
       * two different times.
       */
      for (const [kind, left] of [...running]) {
        const now = left - dt;
        if (now <= 0) running.delete(kind);
        else running.set(kind, now);
      }
    },

    release(x: number, y: number): boolean {
      if (random() >= RELEASE_CHANCE) return false;
      const kind = POWER_UP_KINDS[Math.min(
        POWER_UP_KINDS.length - 1, Math.floor(random() * POWER_UP_KINDS.length),
      )]!;
      live.push({ id: nextId++, kind, x, y, state: 'falling', age: 0, since: 0 });
      return true;
    },

    take(x: number, y: number, radius: number): PowerUpKind | null {
      /**
       * ⚠️ ONLY A FALLING CAPSULE IS THERE TO BE CAUGHT, and the nearest one only — the same two rules
       * `control/comet-mission.strike` states, for the same reasons: one that is shrinking away has
       * been given its time, and two capsules taken from one touch would pay twice for one contact.
       */
      let best: MutableCapsule | null = null;
      let bestDistance = Infinity;
      for (const c of live) {
        if (c.state !== 'falling') continue;
        const distance = Math.hypot(c.x - x, c.y - y);
        if (distance <= CAPSULE_RADIUS + radius && distance < bestDistance) {
          best = c;
          bestDistance = distance;
        }
      }
      if (!best) return null;

      live.splice(live.indexOf(best), 1);
      const seconds = POWER_UP_SECONDS[best.kind];
      /**
       * ⚠️ CATCHING ONE THAT IS ALREADY RUNNING RESTARTS IT RATHER THAN ADDING TO IT. Stacking would
       * let a lucky run bank half a minute of a slow ball, and the point of a timed bonus is that it
       * runs out while you are still using it.
       *
       * ⚠️ AND `slow` AND `fast` CANCEL EACH OTHER, because they are the same axis read from two ends.
       * Holding both at once is a state with no meaning, and whichever the shell asked about first
       * would silently win.
       */
      if (seconds > 0) {
        if (best.kind === 'slow') running.delete('fast');
        if (best.kind === 'fast') running.delete('slow');
        running.set(best.kind, seconds);
      }
      return best.kind;
    },

    isActive(kind: PowerUpKind): boolean {
      return (running.get(kind) ?? 0) > 0;
    },
  };
}
