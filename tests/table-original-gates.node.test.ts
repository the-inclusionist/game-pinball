// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { buildOriginalGates } from '../app/js/table/original-gates.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { loadTable } from '../app/js/dat/loader.js';

/**
 * ⚠️ A GATE IS THE TABLE'S OWN EDGES PLUS A SWITCH.
 *
 * `TGate` has no collision override: opening it clears the `active` flag on its edges and the grid
 * stops testing them. So the gate has to hold the VERY objects that went into the grid — a copy would
 * toggle a set of edges nothing collides against, and every test that only asks the gate whether it is
 * open would still pass.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

function build() {
  const table = manifest();
  if (!table) return null;
  const geometry = buildOriginalTable(table.groups);
  return { table, geometry, gates: buildOriginalGates(table, geometry) };
}

describe('the gates of the 1995 table', () => {
  test('both of them are built, by the archive\u2019s own names', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    expect([...b.gates.keys()].sort()).toEqual(['v_gate1', 'v_gate2']);
  });

  test('a gate starts SHUT, which is a wall the ball collides with', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);

    const gate = b.gates.get('v_gate1')!;

    expect(gate.open).toBe(false);
    expect(b.geometry.edgesOf('v_gate1').every((edge) => edge.active)).toBe(true);
  });

  test('\u26a0\ufe0f opening it deactivates the edges the GRID holds, not a copy of them', () => {
    // The identity is the whole point. `edgesOf` hands out the same objects `placeLineInGrid` was
    // given, so clearing `active` here is what the collision search sees on its next sweep.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const edges = b.geometry.edgesOf('v_gate1');
    expect(edges.length).toBeGreaterThan(0);

    b.gates.get('v_gate1')!.openGate();

    expect(edges.every((edge) => edge.active)).toBe(false);
    // And the other gate is untouched.
    expect(b.geometry.edgesOf('v_gate2').every((edge) => edge.active)).toBe(true);
  });

  test('shutting it puts them back', () => {
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const gate = b.gates.get('v_gate2')!;

    gate.openGate();
    gate.shutGate();

    expect(b.geometry.edgesOf('v_gate2').every((edge) => edge.active)).toBe(true);
  });

  test('⚠️ and BOTH of the 1995 gates are silent, because the file gives them no sound', () => {
    // Neither `v_gate1` nor `v_gate2` carries record 1100 or 1101, so `readVisual` answers zero for
    // both indices — and `loader::play_sound` returns immediately for anything at or below zero. The
    // gates are meant to be quiet, and the file says so by omission.
    //
    // ⚠️ WHICH MEANS THIS FILE CANNOT TELL THE TWO RECORDS APART. That direction — 1101 opens, 1100
    // shuts — is held by `tests/table-gate-oneway`, where the two ids are distinct. Here there is
    // nothing to distinguish, and asserting a difference would have been asserting a wish.
    const b = build();
    if (!b) return expect(existsSync(DAT)).toBe(false);
    const played: number[] = [];
    const gates = buildOriginalGates(b.table, b.geometry, { sound: { play: (id) => played.push(id) } });

    gates.get('v_gate1')!.openGate();
    gates.get('v_gate1')!.shutGate();
    gates.get('v_gate2')!.openGate();

    expect(played).toEqual([]);
  });
});
