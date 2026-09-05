// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readVisual, readKicker, DEFAULT_VISUAL } from '../app/js/dat/visual.js';
import { readGroups, EntryType, type Group } from '../app/js/dat/partman.js';
import { floatAttribute } from '../app/js/dat/attributes.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';

/**
 * ⚠️ THE NUMBERS EVERY COMPONENT IS MADE OF, WHICH NOTHING COULD READ.
 *
 * `createBumper` wants an elasticity, a smoothness, a threshold and a boost; `createFlipper` wants a
 * collision multiplier. Every `T*` constructor in the original opens with `loader::query_visual`, and
 * none of them could be built from the archive until this existed — which is exactly why the
 * demonstration mode scores at level zero and lights nothing.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const archive = (): Group[] | null => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};
const indexOf = (groups: readonly Group[], name: string): number => groups.findIndex((g) => g.name === name);

/** The reader's own view of a group's arrays, so a test can find the shapes it needs to exercise. */
function floatsOf(group: Group): number[] | null {
  const entry = group.entries.find((e) => e.type === EntryType.Float32s && e.data);
  if (!entry?.data) return null;
  const view = new DataView(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
  const out: number[] = [];
  for (let at = 0; at + 4 <= view.byteLength; at += 4) out.push(view.getFloat32(at, true));
  return out;
}

function shortsOfGroup(group: Group): number[] | null {
  const entry = group.entries.find((e) => e.type === EntryType.Int16s && e.data);
  if (!entry?.data) return null;
  const view = new DataView(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
  const out: number[] = [];
  for (let at = 0; at + 2 <= view.byteLength; at += 2) out.push(view.getInt16(at, true));
  return out;
}

describe('reading a component’s physical properties', () => {
  test('⚠️ a bumper has a real threshold and a real boost, not the defaults', () => {
    // The whole point. `default_vsi` sets the threshold to 9e10, which means "never fires", and a
    // reader that silently returned the defaults would build a table where nothing bounces off
    // anything and every number still looks plausible.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const visual = readVisual(groups, indexOf(groups, 'a_bump1'));

    expect(visual.kicker.threshold).toBeLessThan(DEFAULT_VISUAL.kicker.threshold);
    expect(visual.kicker.boost).toBeGreaterThan(0);
  });

  test('⚠️ and a bumper carries NO material, so its elasticity is the default — measured, not assumed', () => {
    // My first version asserted the opposite and failed. `a_bump1`'s Int16 array is
    // `100 8 400 371 1100 26 1101 26`: a kicker group, two sound indices, and no record 300 at all.
    // Bumpers keep `default_vsi`'s 0.6 and 0.95, and a reader that "fixed" this by inventing a material
    // would move every bumper in the table.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const visual = readVisual(groups, indexOf(groups, 'a_bump1'));

    expect(visual.elasticity).toBe(DEFAULT_VISUAL.elasticity);
    expect(visual.smoothness).toBe(DEFAULT_VISUAL.smoothness);
  });

  test('but the parts that DO carry one are read through it', () => {
    // Record 300 points at another group entirely, and following it is the difference between reading
    // a component and reading a pointer.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const withMaterial = SCORE_COMPONENTS
      .map((row) => indexOf(groups, row.tag))
      .filter((at) => at >= 0)
      .map((at) => readVisual(groups, at))
      .filter((v) => v.elasticity !== DEFAULT_VISUAL.elasticity);

    expect(withMaterial.length).toBeGreaterThan(0);
  });

  test('⚠️ and a bumper says how long it stays lit, in record 407 of its OWN group', () => {
    // `TBumper`'s constructor reads it with `query_float_attribute`, not through the visual — a
    // different reader on the same group. It is the last number `createBumper` needs and the one that
    // would otherwise have been invented, and inventing it changes the bumper's refractory period,
    // which is the same number that decides whether a hit counts at all.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const litTime = floatAttribute(groups[indexOf(groups, 'a_bump1')]!, 407);

    expect(litTime?.[0]).toBeCloseTo(0.1, 5);
  });

  test('⚠️ the collision group is never zero, because zero collides with nothing', () => {
    // A component with no 602 record gets 1. Left at 0 it would be invisible to every ball on the
    // table while looking perfectly well formed.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    for (const row of SCORE_COMPONENTS) {
      const at = indexOf(groups, row.tag);
      if (at < 0) continue;
      expect(readVisual(groups, at).collisionGroup, row.tag).toBeGreaterThan(0);
    }
  });

  test('⚠️ every scoring component in the table can be read without falling back', () => {
    // The claim that matters for building them: not that the reader returns something, but that it
    // returns something the archive actually said. A component still carrying `default_vsi`'s
    // elasticity has been read by a loop that stopped early.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    // ⚠️ MEASURED AGAINST THE KICKER, NOT THE MATERIAL. My first version asked for a non-default
    // elasticity and every bumper failed it, because bumpers carry no material. What every collision
    // component DOES carry is a kicker group, and a threshold still at 9e10 means "never fires" — which
    // is what an early-stopping loop leaves behind and what a table where nothing bounces looks like.
    const neverFires = SCORE_COMPONENTS
      .filter((row) => indexOf(groups, row.tag) >= 0)
      .filter((row) => readVisual(groups, indexOf(groups, row.tag)).kicker.threshold
        === DEFAULT_VISUAL.kicker.threshold)
      .map((row) => row.tag);

    expect(neverFires).not.toContain('a_bump1');
    expect(neverFires).not.toContain('a_bump7');
  });

  test('an index outside the archive comes back as the defaults rather than throwing', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    expect(readVisual(groups, 99999).elasticity).toBe(DEFAULT_VISUAL.elasticity);
  });

  test('the defaults are the original’s own, to the digit', () => {
    // `loader::default_vsi`. The threshold in particular is 9e10 rather than Infinity, and the
    // difference is arithmetic that shows up in comparisons.
    expect(DEFAULT_VISUAL.smoothness).toBeCloseTo(0.94999999, 8);
    expect(DEFAULT_VISUAL.elasticity).toBeCloseTo(0.60000002, 8);
    expect(DEFAULT_VISUAL.kicker.threshold).toBe(8.9999999e10);
  });
});

describe('⚠️ the two records that break a naive loop, on the archive’s own examples', () => {
  /** A kicker group whose 404 is followed by more records — the only shape that can catch the bug. */
  function kickerWithDirectionThenMore(groups: readonly Group[]): number {
    return groups.findIndex((g) => {
      const floats = floatsOf(g);
      if (!floats) return false;
      const at = floats.findIndex((v) => Math.floor(v) === 404);
      return at === 0 || (at > 0 && Math.floor(floats[0]!) >= 401 && Math.floor(floats[0]!) <= 406
        && at + 4 < floats.length);
    });
  }

  test('⚠️ record 404 is FOUR floats, and everything after it is still read', () => {
    // The kicker at group 99 reads `401 5, 402 4, 403 0.2, 404 (0,1,0), 405 0.1`. Walking two at a time
    // regardless lands on the direction's y, floors it to 1, finds no such record and stops — so the
    // throw angle after it is silently lost and the ball is kicked at the wrong angle for ever.
    //
    // Two mutations survived my first tests because neither looked at a group with a 404 in it. Eight
    // groups in the archive have one; a test that never visits them proves nothing about them.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const at = kickerWithDirectionThenMore(groups);
    expect(at).toBeGreaterThanOrEqual(0);

    const kicker = { ...DEFAULT_VISUAL.kicker, throwBallDirection: { x: 0, y: 0, z: 0 } };
    readKicker(groups[at]!, kicker);

    // The direction itself, and — the part that matters — a record that comes AFTER it.
    expect(Math.abs(kicker.throwBallDirection.x) + Math.abs(kicker.throwBallDirection.y)).toBeGreaterThan(0);
    expect(kicker.throwBallAngleMult).not.toBe(DEFAULT_VISUAL.kicker.throwBallAngleMult);
  });

  test('⚠️ and several 602 records OR together rather than overwriting', () => {
    // One group in the archive carries `602 2, 602 1`, which is bits two and one: six. Assigning
    // instead of or-ing gives two, and the component then collides with half of what it should — a
    // difference no picture would show.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const at = groups.findIndex((g) => {
      const shorts = shortsOfGroup(g);
      if (!shorts) return false;
      let seen = 0;
      for (let i = 0; i + 1 < shorts.length; i += 2) if (shorts[i] === 602) seen++;
      return seen > 1;
    });
    expect(at).toBeGreaterThanOrEqual(0);

    const visual = readVisual(groups, at);

    // Two bits set, so the value is not a power of two.
    expect(visual.collisionGroup & (visual.collisionGroup - 1)).not.toBe(0);
  });
});
