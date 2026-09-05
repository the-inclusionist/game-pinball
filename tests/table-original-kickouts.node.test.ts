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
  let kickouts = new Map<string, ReturnType<typeof buildOriginalKickouts> extends Map<string, infer V> ? V : never>();
  const geometry = buildOriginalTable(table.groups, {
    geometryFor: kickoutGeometry(table),
    fieldsFor: () => kickouts.values(),
    random: () => 0.5,
  });
  kickouts = buildOriginalKickouts(table, geometry, {
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

describe('⚠️ the field ADDS to gravity rather than replacing it', () => {
  /**
   * A ball at REST, which makes the comparison exact in both axes: the drag term is multiplied by the
   * ball’s speed, so at zero the random X jitter vanishes with it. Comparing two tables built with
   * different random sources would otherwise be comparing noise.
   */
  const restingBall = (x: number, y: number) => ({
    position: { x, y }, direction: { x: 0, y: 0 }, speed: 0,
  });

  test('far from every hole, the force is gravity alone', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const bare = buildOriginalTable(b.table.groups);
    const force = { x: 0, y: 0 };
    const away = { x: 0, y: 0 };

    b.geometry.context.fieldEffects(restingBall(0, 0) as never, force);
    bare.context.fieldEffects(restingBall(0, 0) as never, away);

    // The jitter is on X only, so Y is exactly comparable.
    expect(force.y).toBeCloseTo(away.y);
  });

  test('⚠️ inside a hole’s field the pull is ADDED, and gravity is still there', () => {
    // `TEdgeManager::FieldEffects` does `vector_add` for every field that answers, on top of
    // `TTableLayer::FieldEffect`. A field that REPLACED gravity would hold the ball up in mid-air on
    // the way past — and the hole would feel like a platform rather than a hole.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const group = b.table.groups[b.table.tableObjects
      .find((object) => b.table.groups[object.group]?.name === 'a_kout2')!.group]!;
    const drawn = floatAttribute(group, 600)!;
    // Just off the centre, well inside the drawn radius: the field is the DRAWN circle, not the mouth.
    const at = restingBall(drawn[1]! + drawn[3]! * 0.5, drawn[2]!);

    const withField = { x: 0, y: 0 };
    b.geometry.context.fieldEffects(at as never, withField);
    const gravityOnly = { x: 0, y: 0 };
    buildOriginalTable(b.table.groups).context.fieldEffects(at as never, gravityOnly);

    // The pull is toward the centre, which is to the LEFT of where the ball is sitting.
    expect(withField.x).toBeLessThan(gravityOnly.x);
    // ⚠️ AND GRAVITY IS UNTOUCHED, which is what tells ADD from REPLACE. The ball sits level with the
    // centre, so the pull is purely horizontal and Y must be exactly what gravity alone gives. A field
    // that replaced gravity would answer zero here — the hole would hold the ball up in mid-air.
    expect(withField.y).toBeCloseTo(gravityOnly.y);
    expect(gravityOnly.y).not.toBeCloseTo(0);
  });

  test('and a hole that is already full pulls nothing', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const group = b.table.groups[b.table.tableObjects
      .find((object) => b.table.groups[object.group]?.name === 'a_kout2')!.group]!;
    const drawn = floatAttribute(group, 600)!;
    const at = restingBall(drawn[1]! + drawn[3]! * 0.5, drawn[2]!);
    b.kickouts.get('a_kout2')!.collision(
      { position: { x: 0, y: 0, z: 0 }, memory: { record: () => {} }, throwBall: () => {} },
      { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null,
    );

    const force = { x: 0, y: 0 };
    b.geometry.context.fieldEffects(at as never, force);
    const gravityOnly = { x: 0, y: 0 };
    buildOriginalTable(b.table.groups).context.fieldEffects(at as never, gravityOnly);

    expect(force.x).toBeCloseTo(gravityOnly.x);
  });
});

describe('⚠️ a kickout with no control bound never lets the ball go', () => {
  test('it swallows, and nothing releases it — which is why the demo holds them back', () => {
    // A kickout does not schedule its own release: it captures and calls its control function, and
    // THAT is what calls `restartTimer`. With no control bound the hole keeps the ball for the rest of
    // the game — the ball does not drain, does not score and does not count as lost, it stops
    // existing.
    //
    // ⚠️ AND THE DEMONSTRATION CANNOT SEE THIS. A first version of this test stepped a whole ball's
    // life and asked whether the ball was still moving; it passed with the holes wired AND unwired,
    // because in nine hundred frames the ball rarely finds a hole and the stuck-ball watchdog frees it
    // when it does. The claim is about the component, so it is tested on the component.
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
    b.t.fire();
    b.t.fire();

    expect(kickout.captured, 'still holding it').toBe(true);
    expect(thrown, 'and nothing was ever thrown').toEqual([]);
  });

  test('and with a control that schedules the release, it lets go', () => {
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
    kickout.control = () => kickout.restartTimer(-1);

    kickout.collision(ball, { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);
    b.t.fire();

    expect(kickout.captured).toBe(false);
    expect(thrown).toHaveLength(1);
  });
});
