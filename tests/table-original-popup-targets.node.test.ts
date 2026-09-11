// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { buildOriginalPopupTargets } from '../app/js/table/original-popup-targets.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { loadTable } from '../app/js/dat/loader.js';
import type { TimerService } from '../app/js/table/bumper.js';
import type { BallState } from '../app/js/physics/collision.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ A POPUP TARGET DROPS ITSELF BEFORE IT REPORTS, AND ONLY ON A HARD HIT.
 *
 * `TPopupTarget::Collision` bounces the ball, and only if the rebound beat the threshold does it
 * disable its own edges and call `control::handler`. A graze is a bounce and nothing else — the same
 * rule the bumper has, and the same one the table's wall wrapper cannot see.
 */

const DAT = resource('PINBALL.DAT');
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

function fakeTimer() {
  const pending: (() => void)[] = [];
  const timer: TimerService = { set: (_s, run) => { pending.push(run); return pending.length; }, kill: () => {} };
  return { timer, fire: () => { const all = [...pending]; pending.length = 0; for (const run of all) run(); } };
}

function build() {
  const table = manifest();
  if (!table) return null;
  const t = fakeTimer();
  const struck: string[] = [];
  const geometry = buildOriginalTable(table.groups);
  const targets = buildOriginalPopupTargets(table, geometry, {
    table: { tiltLocked: false }, timer: t.timer, onStruck: (name) => struck.push(name),
  });
  return { table, geometry, targets, t, struck };
}

/** A ball heading straight down into a surface whose normal points up. */
const ball = (speed: number): BallState =>
  ({ position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed });
const UP = { x: 0, y: 1 };
const AT = { x: 0, y: 0 };

describe('the nine popup targets of the 1995 table', () => {
  test('⚠️ nine of them, and the thirteen SOLO targets are not among them', () => {
    // The file tells them apart by colour: the popup targets are yellow and the solo ones are red.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect([...b.targets.keys()].sort()).toEqual([
      'a_targ1', 'a_targ2', 'a_targ3', 'a_targ4', 'a_targ5', 'a_targ6',
      'a_targ7', 'a_targ8', 'a_targ9',
    ]);
    expect(b.targets.has('a_targ10')).toBe(false);
  });

  test('a hard hit drops it and reports it', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const target = b.targets.get('a_targ1')!;
    expect(target.standing).toBe(true);

    target.collision(ball(200), AT, UP, 0, null);

    expect(target.standing, 'down').toBe(false);
    expect(b.struck).toEqual(['a_targ1']);
    expect(b.geometry.edgesOf('a_targ1').some((edge) => edge.active), 'and out of the way').toBe(false);
  });

  test('⚠️ and a GRAZE is a bounce and nothing else', () => {
    // The threshold in the archive is what says which is which. A wrapper that reported every
    // collision would pay a ball rolling along the target once per frame of the roll.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const target = b.targets.get('a_targ2')!;

    target.collision(ball(0.5), AT, UP, 0, null);

    expect(target.standing).toBe(true);
    expect(b.struck).toEqual([]);
  });

  test('⚠️ and it stays down until a BANK puts it back', () => {
    // Three targets have to be struck to fill a bank, and a target that stayed up could be struck
    // three times by one bounce. The drop is what stops the ball reaching it again; the bank's
    // `TPopupTargetEnable` is the only thing that undoes it.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const target = b.targets.get('a_targ3')!;
    target.collision(ball(200), AT, UP, 0, null);

    target.popUp();
    expect(target.standing, 'not at once: it rises after its own quarter second').toBe(false);
    b.t.fire();

    expect(target.standing).toBe(true);
    expect(b.geometry.edgesOf('a_targ3').every((edge) => edge.active)).toBe(true);
  });
});
