// SPDX-License-Identifier: AGPL-3.0-or-later
// A BANK OF DROP TARGETS, WHICH IS THE MECHANIC AN AUTHORED TABLE COULD NOT EXPRESS.
//
// ⚠️ THE DEV, ON THE GAME AS A WHOLE: "o resultado são mesas tão simples... o que tem jogável são
// demos." Measured: the 1995 table has ninety components carrying a score row; six authored tables
// have seventy-two components BETWEEN THEM, and most of those are walls and lanes. The gap is not
// only how many things are on a table — it is how many KINDS of thing a table can say.
//
// `crater-run` already declares a five-target BANK and the i18n has said "derrube o banco de alvos"
// since the day it was written. Both were prose: the five behaved as five unrelated targets, each
// paying again every time the ball touched it, none of them ever going down.
//
// ========================= WHAT A BANK IS, AS AGAINST FIVE TARGETS =========================
// A drop target SINKS when it is hit and stops being part of the table. The bank is finished when the
// last one is down, and only then does it pay and stand its targets back up. That is what makes it a
// route rather than a rattle: you cannot farm one target, because after the first hit it is not there.
//
// ⚠️ AND THIS IS NOT `control/banks`. That is `makeTargetBankControl`, transcribed from the archive,
// which addresses its members through `make_component_link` and group tags that exist only inside
// `PINBALL.DAT`. The rule it implements is four lines; the machinery around it does not generalise.
// This is the rule, said for a table authored this morning — the same bargain `table/missions` struck.
import { describe, test, expect } from 'vitest';
import { createTargetBank } from '../app/js/table/target-bank.js';
import { validateTable, type AuthoredComponent, type AuthoredTable } from '../app/js/table/authored.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';
import { createLiveControls } from '../app/js/table/live-controls.js';

const bank = () => createTargetBank({ members: ['t1', 't2', 't3'], award: 15000 });

describe('a bank of three', () => {
  test('it starts with everything standing', () => {
    const b = bank();

    expect(b.standing).toEqual(['t1', 't2', 't3']);
    expect(b.isDown('t1')).toBe(false);
  });

  test('hitting one drops it, and pays nothing yet', () => {
    const b = bank();

    const hit = b.drop('t1');

    expect(b.isDown('t1')).toBe(true);
    expect(b.standing).toEqual(['t2', 't3']);
    expect(hit.completed, 'the bank is not finished').toBe(false);
    expect(hit.award).toBe(0);
  });

  test('⚠️ and hitting one that is already DOWN does nothing at all', () => {
    // The whole point of a drop target. A dropped one is below the playfield: the ball passes over
    // where it was. Letting a downed target report again would make a bank a rattle — hit the nearest
    // one five times and collect — which is exactly what the five targets of `crater-run` did.
    const b = bank();
    b.drop('t1');

    const again = b.drop('t1');

    expect(again.completed).toBe(false);
    expect(again.award).toBe(0);
    expect(b.standing, 'and nothing else moved').toEqual(['t2', 't3']);
  });

  test('a name that is not in the bank is not a member of it', () => {
    const b = bank();

    expect(b.drop('elsewhere').completed).toBe(false);
    expect(b.standing).toEqual(['t1', 't2', 't3']);
  });

  test('⚠️ the LAST one pays the award and stands them all up again', () => {
    // Reset-on-completion is what makes a bank playable more than once in a ball. A bank that stayed
    // down would be a one-shot decoration for the rest of the game.
    const b = bank();
    b.drop('t1');
    b.drop('t2');

    const last = b.drop('t3');

    expect(last.completed).toBe(true);
    expect(last.award).toBe(15000);
    expect(b.standing, 'and the bank is ready again').toEqual(['t1', 't2', 't3']);
  });

  test('and it can be cleared twice, which is the point of standing back up', () => {
    const b = bank();
    for (const t of ['t1', 't2', 't3']) b.drop(t);

    const second = ['t1', 't2', 't3'].map((t) => b.drop(t));

    expect(second[2]!.completed).toBe(true);
    expect(second[2]!.award).toBe(15000);
  });

  test('⚠️ a new BALL does not stand them up, and a new game does', () => {
    // A ball lost mid-bank leaves the work where the player left it — that is the tension a bank
    // creates. `reset` is the game's, the same distinction `table/missions` draws for its own progress.
    const b = bank();
    b.drop('t1');

    b.reset();

    expect(b.standing).toEqual(['t1', 't2', 't3']);
  });
});

/**
 * ⚠️ AND A TABLE HAS TO BE ABLE TO SAY IT, which is the half a pure module cannot check.
 *
 * The rules below all exist because a bank is a promise made in two places at once — the table
 * declares the group, each target says which group it is in — and a promise split in two is a promise
 * that can be made by half. This repository has paid for that shape often enough to gate it: the
 * validator refuses the table rather than letting a player meet a bank that pays nothing, or a target
 * that drops out of a bank nothing else belongs to.
 */
describe('⚠️ a table declaring a bank', () => {
  // ⚠️ `low-orbit`'s OWN bank is kept, and leaving it out is what these fixtures did first: overriding
  // `banks` with just this one orphaned the table's three drop targets and every case here failed with
  // somebody else's error. A fixture built by spreading a real table inherits its promises too.
  const withBanks = (over: Partial<AuthoredTable>): AuthoredTable => ({
    ...LOW_ORBIT,
    banks: [...(LOW_ORBIT.banks ?? []), { name: 'bank.north', award: 15000 }],
    ...over,
  });

  const targetIn = (name: string, bank?: string): AuthoredComponent => ({
    name, kind: 'target', role: 'goal', bounds: { x: 20, y: 20, width: 8, height: 6 },
    scores: [500], control: 'TargetBankControl', ...(bank ? { bank } : {}),
    collision: [{ kind: 'line', from: { x: 28, y: 26 }, to: { x: 20, y: 26 } }],
  });

  test('the shipped tables still validate, which is what says these rules are not too strict', () => {
    for (const table of CATALOG) {
      expect(validateTable(table, { viewHeight: 180 }), table.name).toEqual([]);
    }
  });

  test('⚠️ a target naming a bank the table never declared is refused', () => {
    // The commonest half-made promise: rename the bank on the table and leave the targets pointing at
    // the old name. Nothing would error — the targets would simply never be a bank.
    const broken = withBanks({
      components: [...LOW_ORBIT.components, targetIn('t1', 'bank.south'), targetIn('t2', 'bank.south')],
    });

    expect(validateTable(broken, { viewHeight: 180 }).join(' ')).toContain('bank.south');
  });

  test('⚠️ a bank with only one target is refused, because that is a target', () => {
    // A bank of one is cleared by its own first hit and pays its award every time the ball touches it.
    // It is not a stricter version of a target; it is a target that pays the bank's prize on contact.
    const broken = withBanks({
      components: [...LOW_ORBIT.components, targetIn('t1', 'bank.north')],
    });

    expect(validateTable(broken, { viewHeight: 180 }).join(' ')).toContain('at least two');
  });

  test('⚠️ and a bank nothing belongs to is refused as well', () => {
    // The other direction of the same split promise: the table declares a group and no target joined
    // it, so the award can never be paid and nothing on screen says why.
    const broken = withBanks({ components: [...LOW_ORBIT.components] });

    expect(validateTable(broken, { viewHeight: 180 }).join(' ')).toContain('at least two');
  });

  test('a member that is not a target is refused', () => {
    // A bank of ramps is not a mechanic anybody meant. Drop targets drop.
    const lane = { ...targetIn('t1', 'bank.north'), kind: 'lane' as const };
    const broken = withBanks({
      components: [...LOW_ORBIT.components, lane, targetIn('t2', 'bank.north')],
    });

    expect(validateTable(broken, { viewHeight: 180 }).join(' ')).toContain('only a target');
  });

  test('⚠️ and a member that is not driven by TargetBankControl is refused', () => {
    // The subtlest of the four, and the one that would have shipped: a target in a bank whose control
    // is the ordinary `TargetControl` pays its own score, never drops, and keeps the bank one short
    // for ever. The bank would be unclearable and every other member would look broken.
    const plain = { ...targetIn('t1', 'bank.north'), control: 'TargetControl' };
    const broken = withBanks({
      components: [...LOW_ORBIT.components, plain, targetIn('t2', 'bank.north')],
    });

    expect(validateTable(broken, { viewHeight: 180 }).join(' ')).toContain('TargetBankControl');
  });
});

/**
 * ⚠️ AND THE CONTROL, WHICH IS WHERE A BANK STOPS BEING A DATA STRUCTURE.
 *
 * `createTargetBank` is a rule about names and `validateTable` refuses a table that says it wrong.
 * Neither of them makes a ball do anything. This is the join, and it is the join this repository keeps
 * finding broken: a capability declared, tested on its own, and never reached from the game.
 */
describe('⚠️ TargetBankControl, through the live control layer', () => {
  const member = (name: string): AuthoredComponent => ({
    name, kind: 'target', role: 'goal', bounds: { x: 20, y: 20, width: 8, height: 6 },
    scores: [500], control: 'TargetBankControl', bank: 'bank.north', lamps: [],
    collision: [{ kind: 'line', from: { x: 28, y: 26 }, to: { x: 20, y: 26 } }],
  });

  const banked = (): AuthoredTable => ({
    ...LOW_ORBIT,
    banks: [...(LOW_ORBIT.banks ?? []), { name: 'bank.north', award: 15000 }],
    components: [...LOW_ORBIT.components, member('t1'), member('t2')],
  });

  test('the table it is built from is legal', () => {
    expect(validateTable(banked(), { viewHeight: 180 })).toEqual([]);
  });

  test('hitting one member scores its own value and no award', () => {
    const live = createLiveControls(banked());

    live.hit('t1');

    expect(live.score.curScore, 'the target paid its own 500').toBe(500);
  });

  test('⚠️ hitting the SAME member again pays nothing, because it is down', () => {
    // The defect a bank exists to prevent, and what `crater-run`'s five targets did: rattle the
    // nearest one and collect for ever.
    const live = createLiveControls(banked());
    live.hit('t1');

    live.hit('t1');

    expect(live.score.curScore).toBe(500);
  });

  test('⚠️ and clearing the bank pays the award on top of the last target', () => {
    const live = createLiveControls(banked());

    live.hit('t1');
    live.hit('t2');

    expect(live.score.curScore, '500 + 500 + the bank"s 15000').toBe(16000);
  });

  test('⚠️ the bank stands back up, so the same work counts twice in a ball', () => {
    const live = createLiveControls(banked());
    live.hit('t1');
    live.hit('t2');

    live.hit('t1');

    expect(live.score.curScore, 't1 is standing again and paid again').toBe(16500);
  });

  test('⚠️ and the live layer says which members are DOWN, or nothing can hide them', () => {
    // The renderer and the physics both need this list every frame: a target that is down must stop
    // being drawn and stop being a wall. A bank that only kept score would be a mechanic the player
    // cannot see and the ball cannot feel.
    const live = createLiveControls(banked());

    live.hit('t1');

    expect([...live.downTargets()]).toEqual(['t1']);
  });
});
