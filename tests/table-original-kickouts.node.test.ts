// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  buildOriginalKickouts, kickoutGeometry, kickoutNames, KICKOUT_MOUTH_RECORD, KICKOUT_HOLD_SECONDS,
} from '../app/js/table/original-kickouts.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { loadTable } from '../app/js/dat/loader.js';
import { floatAttribute } from '../app/js/dat/attributes.js';
import type { TimerService } from '../app/js/table/bumper.js';

/**
 * ⚠️ THE MOUTH IS NOT THE CIRCLE THAT IS DRAWN.
 *
 * `TKickout` multiplies the wall record's radius by record 306, and in the shipped file that record is
 * 0.9, 0.2 and 0.05. Installing the drawn circle swallows the ball from up to twenty times too far
 * away — and it would read as a bug in the collision search rather than in the geometry.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

function fakeTimer() {
  const pending = new Map<number, { seconds: number; run: () => void }>();
  let next = 1;
  const timer: TimerService = {
    set: (seconds, run) => { const id = next++; pending.set(id, { seconds, run }); return id; },
    kill: (id) => { pending.delete(id); },
  };
  return {
    timer,
    delays: () => [...pending.values()].map((p) => p.seconds),
    fire: () => { const all = [...pending.values()]; pending.clear(); for (const p of all) p.run(); },
  };
}

function build() {
  const table = manifest();
  if (!table) return null;
  const t = fakeTimer();
  const geometry = buildOriginalTable(table.groups, { geometryFor: kickoutGeometry(table) });
  const kickouts = buildOriginalKickouts(table, geometry, {
    table: { tiltLocked: false }, timer: t.timer,
  });
  return { table, geometry, kickouts, t };
}

describe('the three kickouts of the 1995 table', () => {
  test('all three are built, by the archive\u2019s own names', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect([...b.kickouts.keys()].sort()).toEqual(['a_kout1', 'a_kout2', 'a_kout3']);
    expect(kickoutNames(b.table).size).toBe(3);
  });

  test('\u26a0\ufe0f and the installed circle is the MOUTH, not the drawn one', () => {
    // The geometry the table installs carries the scaled radius. `a_kout1`'s record 306 is 0.05, so
    // the difference is a factor of twenty — big enough to change where the ball can be caught from,
    // and invisible in anything that only asks whether the hole exists.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const group = b.table.groups[b.table.tableObjects
      .find((object) => b.table.groups[object.group]?.name === 'a_kout1')!.group]!;
    const drawn = floatAttribute(group, 600)!;
    const mouth = floatAttribute(group, KICKOUT_MOUTH_RECORD)![0]!;

    const installed = kickoutGeometry(b.table)('a_kout1', drawn)!;

    expect(mouth).toBeLessThan(0.1);
    expect(installed[3]).toBeCloseTo(drawn[3]! * mouth);
    expect(installed.slice(0, 3)).toEqual(drawn.slice(0, 3));
  });

  test('\u26a0\ufe0f and everything else on the table keeps the record the file gave it', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect(kickoutGeometry(b.table)('a_bump1', [1, 10, 20, 5])).toBeUndefined();
  });

  test('a ball that touches one is CAPTURED and moved to the centre', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const kickout = b.kickouts.get('a_kout2')!;
    const ball = {
      position: { x: 999, y: 999, z: 0 }, direction: { x: 0, y: 1 }, speed: 10,
      collisionDisabled: false, component: null as unknown,
      memory: { record: () => {} },
      throwBall: () => {},
    };

    kickout.collision(ball, { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);

    expect(kickout.captured).toBe(true);
    expect(ball.collisionDisabled, 'the grid must not touch a held ball').toBe(true);
    expect(ball.position.x).not.toBe(999);
  });

  test('\u26a0\ufe0f and thrown back after a second and a half, which the file does not say', () => {
    // `TimerTime1 = 1.5` is written by the constructor over whatever the record held. A kickout is the
    // one component here whose hold time is the code's rather than the table's.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const kickout = b.kickouts.get('a_kout2')!;
    const thrown: number[] = [];
    const ball = {
      position: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1 }, speed: 10,
      collisionDisabled: false, component: null as unknown,
      memory: { record: () => {} },
      throwBall: (_d: unknown, _a: number, speed: number) => thrown.push(speed),
    };

    kickout.collision(ball, { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);
    kickout.restartTimer();
    expect(b.t.delays()).toContain(KICKOUT_HOLD_SECONDS);

    b.t.fire();

    expect(thrown).toHaveLength(1);
    expect(thrown[0], 'thrown at the boost the archive gives it').toBe(35);
  });
});
