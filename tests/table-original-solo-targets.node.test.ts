// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { buildOriginalSoloTargets } from '../app/js/table/original-solo-targets.js';
import { buildOriginalPopupTargets } from '../app/js/table/original-popup-targets.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { loadTable } from '../app/js/dat/loader.js';
import type { TimerService } from '../app/js/table/bumper.js';
import type { BallState } from '../app/js/physics/collision.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ THE THIRTEEN RED TARGETS, WHICH ARE THE FUEL SET, THE MISSION SET, THE TWO HAZARD SETS AND THE
 * WORMHOLE'S DESTINATION. Every one of them counts hits towards something, so being paid for a graze
 * matters here more than anywhere else on the table.
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
  const targets = buildOriginalSoloTargets(table, geometry, {
    table: { tiltLocked: false }, timer: t.timer, onStruck: (name) => struck.push(name),
  });
  const popups = buildOriginalPopupTargets(table, geometry, {
    table: { tiltLocked: false }, timer: t.timer,
  });
  return { table, geometry, targets, popups, t, struck };
}

const ball = (speed: number): BallState =>
  ({ position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed });
const UP = { x: 0, y: 1 };
const AT = { x: 0, y: 0 };

describe('the thirteen solo targets', () => {
  test('⚠️ thirteen of them, and none is one of the nine that a bank puts back', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect(b.targets.size).toBe(13);
    for (const name of b.targets.keys()) expect(b.popups.has(name), name).toBe(false);
    // The fuel set, the mission set, the hazard sets and the wormhole's destination are all here.
    for (const name of ['a_targ10', 'a_targ13', 'a_targ16', 'a_targ19', 'a_targ22']) {
      expect(b.targets.has(name), name).toBe(true);
    }
  });

  test('a hard hit ducks it and reports it', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const target = b.targets.get('a_targ10')!;

    target.collision(ball(200), AT, UP, 0, null);

    expect(target.standing).toBe(false);
    expect(b.struck).toEqual(['a_targ10']);
  });

  test('⚠️ and a GRAZE pays nothing, which is the whole reason these are built', () => {
    // Reached through the table's wall wrapper alone, every collision was reported — so a ball rolling
    // past a target was paid for it once per frame, and each of those payments counted towards a set.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const target = b.targets.get('a_targ11')!;

    target.collision(ball(0.5), AT, UP, 0, null);

    expect(target.standing).toBe(true);
    expect(b.struck).toEqual([]);
  });

  test('⚠️ and it comes back BY ITSELF, unlike the nine yellow ones', () => {
    // A tenth of a second, and no bank asks for it. That is the difference between the two kinds.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const target = b.targets.get('a_targ12')!;
    target.collision(ball(200), AT, UP, 0, null);

    b.t.fire();

    expect(target.standing).toBe(true);
    expect(b.geometry.edgesOf('a_targ12').every((edge) => edge.active)).toBe(true);
  });
});
