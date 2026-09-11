// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { blockerNames, buildOriginalBlockers } from '../app/js/table/original-blockers.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { loadTable } from '../app/js/dat/loader.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ A BLOCKER IS THE TABLE'S OWN EDGES PLUS A SWITCH THAT STARTS OFF.
 *
 * Like `TGate`, `TBlocker` has no collision override: enabling it sets `active` on the edges the grid
 * already holds. So it has to be handed those very objects — a copy would answer every question about
 * whether the barrier is up and never stop a single ball.
 *
 * And unlike a gate, it starts DOWN. `v_bloc1` sits across the drain; installed as ordinary geometry it
 * is a permanent wall in front of the only place a ball can be lost.
 */

const DAT = resource('PINBALL.DAT');
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

/** A clock that only moves when the test says so. */
function fakeTimers() {
  const pending = new Map<number, { at: number; run: () => void }>();
  let next = 1;
  let now = 0;
  return {
    now: () => now,
    pending,
    service: {
      set(seconds: number, callback: () => void): number {
        const id = next++;
        pending.set(id, { at: now + seconds, run: callback });
        return id;
      },
      kill(id: number): void { pending.delete(id); },
    },
    advance(seconds: number): void {
      now += seconds;
      for (const [id, entry] of [...pending]) {
        if (entry.at <= now) { pending.delete(id); entry.run(); }
      }
    },
  };
}

function build() {
  const table = manifest();
  if (!table) return null;
  const names = blockerNames(table);
  const clock = fakeTimers();
  const played: number[] = [];
  const timedOut: string[] = [];
  const geometry = buildOriginalTable(table.groups, { startsInactive: (name) => names.has(name) });
  const blockers = buildOriginalBlockers(table, geometry, {
    timer: clock.service,
    sound: { play: (id) => played.push(id) },
  });
  // The dispatcher's job, done here by hand: the deadline running out is a message to control.
  for (const [name, blocker] of blockers) blocker.control = () => timedOut.push(name);
  return { table, names, geometry, blockers, clock, played, timedOut };
}

describe('the barrier across the drain, built from the archive', () => {
  test('the one blocker the shipped file has is built, by its own name', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect([...b.blockers.keys()]).toEqual(['v_bloc1']);
  });

  test('⚠️ it starts DOWN, and so do the edges the grid holds', () => {
    // Up by default is a permanent wall in front of the drain: the ball can never be lost, so the game
    // can never end. That is exactly what happened here before `startsInactive` existed.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const edges = b.geometry.edgesOf('v_bloc1');
    expect(edges.length).toBeGreaterThan(0);

    expect(b.blockers.get('v_bloc1')!.active).toBe(false);
    expect(edges.some((edge) => edge.active)).toBe(false);
  });

  test('⚠️ raising it activates the edges the GRID holds, not a copy of them', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const edges = b.geometry.edgesOf('v_bloc1');

    b.blockers.get('v_bloc1')!.enable(55);

    expect(edges.every((edge) => edge.active)).toBe(true);
    // And lowering it takes them away again.
    b.blockers.get('v_bloc1')!.disable();
    expect(edges.some((edge) => edge.active)).toBe(false);
  });

  test('⚠️ the timeout reports and does NOT lower the barrier', () => {
    // The blocker measures time; the mission decides what the time meant. A blocker that switched
    // itself off would make `DrainBallBlockerControl`'s flashing extension impossible to express.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const blocker = b.blockers.get('v_bloc1')!;

    blocker.enable(55);
    b.clock.advance(60);

    expect(b.timedOut).toEqual(['v_bloc1']);
    expect(blocker.active, 'still up: the timeout is a report, not a switch').toBe(true);
  });

  test('⚠️ a negative duration gives it no clock at all — easy mode', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    b.blockers.get('v_bloc1')!.enable(-1);
    b.clock.advance(10000);

    expect(b.timedOut).toEqual([]);
    expect(b.blockers.get('v_bloc1')!.active).toBe(true);
  });

  test('⚠️ and raising it sounds exactly like lowering it, because the file says the same wave twice', () => {
    // `v_bloc1` carries 28 in BOTH 1100 and 1101. So this file cannot tell the two records apart, and
    // asserting that one differs from the other would be asserting a wish — the same situation the
    // 1995 gates are in, for the opposite reason (they carry neither record).
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const blocker = b.blockers.get('v_bloc1')!;

    blocker.enable(55);
    blocker.disable();

    expect(b.played).toEqual([28, 28]);
  });

  test('⚠️ and `reset` is the silent one, which is what tilt and a new player use', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const blocker = b.blockers.get('v_bloc1')!;
    blocker.enable(55);
    b.played.length = 0;

    blocker.reset();

    expect(blocker.active).toBe(false);
    expect(b.played, 'a reset says nothing').toEqual([]);
    expect(b.geometry.edgesOf('v_bloc1').some((edge) => edge.active)).toBe(false);
  });
});
