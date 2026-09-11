// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createTripwire } from '../app/js/table/tripwire.js';
import { buildOriginalTripwires } from '../app/js/table/original-tripwires.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { loadTable } from '../app/js/dat/loader.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ A TRIPWIRE IS AN ORDINARY WALL RECORD WITH A COMPONENT THAT DOES NOT BOUNCE.
 *
 * `TTripwire` derives from `TRollover` with `createWall = true`, so the geometry comes from the wall
 * loop like any other — and then its `Collision` moves the ball to the contact point, marks the edge
 * and returns. No bounce, no state, no second boundary: unlike the lane it inherits from, it has no
 * `RolloverFlag` behaviour at all, so crossing it twice reports twice.
 *
 * Until this existed the five skill-shot trip lines were walls the ball came back off.
 */

const DAT = resource('PINBALL.DAT');
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

function crossingBall() {
  const seen: unknown[] = [];
  return {
    position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed: 9,
    memory: { record: (edge: unknown) => { seen.push(edge); } },
    seen,
  };
}

describe('the wire the ball trips', () => {
  test('crossing it does not touch the ball’s speed or heading', () => {
    const crossed: number[] = [];
    const played: number[] = [];
    const wire = createTripwire({
      table: { tiltLocked: false },
      softHitSoundId: 12,
      sound: { play: (id) => played.push(id) },
      onCross: () => crossed.push(1),
    });
    const ball = crossingBall();

    wire.collision(ball, { x: 4, y: 5 }, { x: 0, y: 1 }, 0, 'edge');

    expect(ball.speed, 'untouched').toBe(9);
    expect(ball.direction).toEqual({ x: 0, y: -1 });
    expect(ball.position).toEqual({ x: 4, y: 5 });
    expect(ball.seen, 'marked, so the same frame does not trip it twice').toEqual(['edge']);
    expect(played).toEqual([12]);
    expect(crossed).toEqual([1]);
  });

  test('⚠️ it has no state: crossing it twice reports twice', () => {
    // The lane it derives from toggles a flag and only counts going IN. `TTripwire::Collision`
    // overrides all of that and counts every crossing — which is what makes it a trip WIRE.
    const crossed: number[] = [];
    const wire = createTripwire({ table: { tiltLocked: false }, onCross: () => crossed.push(1) });

    wire.collision(crossingBall(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, 'edge');
    wire.collision(crossingBall(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, 'edge');

    expect(crossed).toEqual([1, 1]);
  });

  test('⚠️ a TILTED table still lets the ball across and says nothing', () => {
    const crossed: number[] = [];
    const played: number[] = [];
    const wire = createTripwire({
      table: { tiltLocked: true },
      softHitSoundId: 12,
      sound: { play: (id) => played.push(id) },
      onCross: () => crossed.push(1),
    });
    const ball = crossingBall();

    wire.collision(ball, { x: 4, y: 5 }, { x: 0, y: 1 }, 0, 'edge');

    expect(ball.position, 'across it goes').toEqual({ x: 4, y: 5 });
    expect(crossed).toEqual([]);
    expect(played).toEqual([]);
  });

  test('⚠️ zero is silence, not voice number nought', () => {
    const played: number[] = [];
    const wire = createTripwire({
      table: { tiltLocked: false }, softHitSoundId: 0, sound: { play: (id) => played.push(id) },
    });

    wire.collision(crossingBall(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, 'edge');

    expect(played).toEqual([]);
  });
});

describe('the five trip lines of the 1995 table', () => {
  function build() {
    const table = manifest();
    if (!table) return null;
    const crossed: string[] = [];
    const geometry = buildOriginalTable(table.groups);
    const wires = buildOriginalTripwires(table, {
      table: { tiltLocked: false },
      onCross: (name) => crossed.push(name),
    });
    return { table, geometry, wires, crossed };
  }

  test('all five are built, by the archive’s own names', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect([...b.wires.keys()].sort()).toEqual(['s_trip1', 's_trip2', 's_trip3', 's_trip4', 's_trip5']);
  });

  test('⚠️ and their geometry stays in the ordinary wall loop, which a lane’s does not', () => {
    // `TTripwire` derives from `TRollover` with `createWall = true`. It is only the COMPONENT that
    // differs from a wall, so the record is installed exactly as any other — skipping it would leave
    // the trip line with nothing for the ball to cross.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    for (const name of b.wires.keys()) {
      expect(b.geometry.wallGroups.includes(name), name).toBe(true);
      expect(b.geometry.edgesOf(name).length, name).toBeGreaterThan(0);
    }
  });

  test('⚠️ and all five are SILENT, because the file gives them no sound', () => {
    // Every one of the five carries zero in record 304, and `loader::play_sound` returns immediately
    // for anything at or below zero. The trip lines are meant to be quiet and the archive says so by
    // omission — the same situation the two 1995 gates are in.
    //
    // ⚠️ WHICH MEANS THIS FILE CANNOT TELL THE SOUND FIELD FROM NOTHING AT ALL. Dropping the id
    // entirely is an EQUIVALENT MUTANT here; it is read anyway, because the field is what the original
    // reads and an authored table may well fill it in.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);
    const played: number[] = [];
    const wires = buildOriginalTripwires(table, {
      table: { tiltLocked: false }, sound: { play: (id) => played.push(id) },
    });

    for (const wire of wires.values()) {
      wire.collision(crossingBall(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, 'edge');
    }

    expect(played).toEqual([]);
  });

  test('⚠️ each one reports under its own name', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    b.wires.get('s_trip3')!.collision(crossingBall(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, 'edge');

    expect(b.crossed).toEqual(['s_trip3']);
  });
});
