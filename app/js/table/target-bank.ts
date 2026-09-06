// SPDX-License-Identifier: AGPL-3.0-or-later
// table/target-bank — drop targets that go down and stay down until the bank is cleared.
//
// ========================= WHY THIS EXISTS =========================
// ⚠️ THE DEV, ON THE GAME AS A WHOLE: "o resultado são mesas tão simples... o que tem jogável são
// demos." The gap he is pointing at is not only how many things sit on a table; it is how many KINDS
// of thing a table can say. Six authored tables had walls, bumpers, targets, ramps, lanes and wells,
// and every one of those is a thing the ball touches once and is paid for. Nothing had state that
// outlived the touch.
//
// `crater-run` already declares a five-target BANK, and `pinball.mission.craterRun.bank` has read
// "derrube o banco de alvos" since the day it was written. Both were prose: the five behaved as five
// unrelated targets, each paying again every time the ball came back, none of them ever going down.
//
// ========================= WHAT A BANK IS, AS AGAINST FIVE TARGETS =========================
// A drop target SINKS when it is hit and stops being part of the table until the bank is cleared. That
// one rule is what turns five targets into a route: you cannot farm the nearest one, because after the
// first hit it is not there. The bank pays when the LAST one goes down, and stands them all up again
// so the same work is worth doing twice in a ball.
//
// ========================= AND IT IS NOT `control/banks` =========================
// ⚠️ THAT ONE IS THE ARCHIVE'S. `makeTargetBankControl` addresses its members through
// `make_component_link` and group tags that exist only inside `PINBALL.DAT`, and reaches its reset
// through the same. The RULE it implements is four lines; the machinery around it does not generalise
// to a table authored this morning. This is the rule said plainly — the same bargain `table/missions`
// struck with `control/mission-runner`, and for the same reason.
//
// ========================= A LOST BALL DOES NOT STAND THEM UP =========================
// Deliberate, and it is where the tension lives: a player who drops four of five and loses the ball
// comes back to one target standing. `reset` is the GAME's, which is the same line `table/missions`
// draws between a lost ball and a new game.

export interface TargetBankOptions {
  /** The component names in the bank, in the order a table declared them. */
  readonly members: readonly string[];
  /** Paid once, on the hit that drops the last one standing. */
  readonly award: number;
}

export interface BankHit {
  /** Whether THIS hit cleared the bank. */
  readonly completed: boolean;
  /** The award, and nought on every hit that is not the last. */
  readonly award: number;
}

export interface TargetBank {
  /** Members still up, in the order the table declared them. What the ball can still hit. */
  readonly standing: readonly string[];
  isDown(member: string): boolean;
  /**
   * Knocks one down.
   *
   * A name that is not a member, or one already down, changes nothing and pays nothing — see the
   * header: a dropped target is below the playfield and the ball passes over where it was.
   */
  drop(member: string): BankHit;
  /** Everything back up, for a new GAME. Not for a new ball. */
  reset(): void;
}

export function createTargetBank(o: TargetBankOptions): TargetBank {
  const members = [...o.members];
  let down = new Set<string>();

  return {
    get standing() { return members.filter((name) => !down.has(name)); },

    isDown(member: string): boolean { return down.has(member); },

    drop(member: string): BankHit {
      if (!members.includes(member) || down.has(member)) return { completed: false, award: 0 };

      down.add(member);
      if (down.size < members.length) return { completed: false, award: 0 };

      // The last one. Pay, and stand the whole bank up so it can be cleared again this ball.
      down = new Set();
      return { completed: true, award: o.award };
    },

    reset(): void { down = new Set(); },
  };
}
