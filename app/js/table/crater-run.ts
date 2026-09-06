// SPDX-License-Identifier: AGPL-3.0-or-later
// table/crater-run — the precision table.
//
// ========================= THE THIRD SHAPE OF PLAY =========================
// `low-orbit` is open and forgiving: bumpers at the top, targets down one side, plenty of room to
// recover. `ion-storm` is busy and chaotic: a cluster in the middle that every route crosses and
// scatters the ball off. Neither asks the player to AIM.
//
// This one does. Its centre is a bank of five drop targets in a tight row, and the two ramps that
// flank it are narrow enough that a loose shot goes between them into the bumper pair rather than up.
// Missing is cheap here — the ball comes back down the middle, which is the safest place on any of
// these tables — so the table is difficult without being punishing, which is the trade a precision
// table has to make or it is simply unfair.
//
// ⚠️ AND ITS TARGETS ARE A ROW, NOT A SCATTER, ON PURPOSE. Five targets in a line can be cleared with
// one well-aimed ball that rattles along them; five scattered around the table would be five separate
// shots and a mission nobody finishes. The row is what makes the precision rewarding rather than
// merely demanded.
//
// The cabinet is `table/cabinet`'s — see that module for the two defects it exists to stop anybody
// re-making.

import type { AuthoredTable } from './authored.js';
import { cabinet, CABINET_LAMPS } from './cabinet.js';

const WALL = 'structure' as const;
const BALL_RADIUS = 3;

const WIDTH = 183;
const HEIGHT = 260;

/** The name every member of the bank points at, and the table declares once. */
const BANK_NAME = 'bank.crater';

/**
 * Five DROP targets in a row across the middle, 20 apart: a rattling ball can take more than one.
 *
 * ⚠️ AND THEY WERE FIVE ORDINARY TARGETS UNTIL NOW, WHICH IS WHAT THE DEV WAS POINTING AT.
 * `pinball.mission.craterRun.bank` has read "derrube o banco de alvos" since the day this table was
 * written, and the five behaved as five unrelated targets: each paid again every time the ball came
 * back, none of them ever went down, and the mission was cleared by rattling the nearest one five
 * times. The word "bank" was in the constant's name, in the mission text and in the comment, and
 * nowhere in the behaviour.
 *
 * A drop target sinks when it is hit — the ball then passes over where it was — and the bank pays and
 * stands them all up when the last one falls. That is the difference between a route and a rattle.
 */
const BANK = [42, 62, 82, 102, 122].map((x, i) => ({
  name: `crater${i + 1}`,
  kind: 'target' as const,
  role: 'key' as const,
  bounds: { x, y: 120, width: 12, height: 14 },
  scores: [2000],
  control: 'TargetBankControl',
  bank: BANK_NAME,
  lamps: [`lamp.crater${i + 1}`],
  collision: [{ kind: 'line' as const, from: { x, y: 134 }, to: { x: x + 12, y: 134 } }],
}));

export const CRATER_RUN: AuthoredTable = {
  name: 'crater-run',
  size: { width: WIDTH, height: HEIGHT },
  ballRadius: BALL_RADIUS,

  /**
   * ⚠️ THE PRIZE IS BIGGER THAN THE FIVE TARGETS TOGETHER — 10000 against 5 x 2000 — because clearing
   * a bank is a different achievement from hitting five things. Five separate targets are five lucky
   * bounces; a cleared bank means every one of them was still standing when you found it.
   */
  banks: [{ name: BANK_NAME, award: 10000 }],

  missions: [
    // The bank first, because it is the table's whole idea and a player should meet it immediately.
    { award: 15000, stages: [{ id: 'pinball.mission.craterRun.bank', targets: BANK.map((t) => t.name) }] },
    // Then the two ramps, which are the shots the bank teaches you to make.
    { award: 20000, stages: [{ id: 'pinball.mission.craterRun.ramps', targets: ['ramp.left', 'ramp.right'] }] },
    // Then the rim, at the top, reached only by keeping the ball alive up there.
    { award: 30000, stages: [{ id: 'pinball.mission.craterRun.rim', targets: ['rim1', 'rim2'] }] },
  ],

  components: [
    ...cabinet({ width: WIDTH, height: HEIGHT }),

    /* ===================== THE BANK: FIVE IN A ROW ===================== */
    ...BANK,

    /* ===================== THE TWO RAMPS THAT FLANK IT ===================== */
    // ⚠️ NARROW, AND THAT IS THE DIFFICULTY. A loose shot passes between them and meets the bumper
    // pair below the rim instead of climbing — which costs the shot and not the ball.
    { name: 'ramp.left', kind: 'ramp', role: 'climb', bounds: { x: 26, y: 52, width: 34, height: 52 },
      scores: [7000], control: 'RampControl', lamps: ['lamp.rampLeft'],
      collision: [{ kind: 'line', from: { x: 26, y: 104 }, to: { x: 60, y: 52 } }] },
    { name: 'ramp.right', kind: 'ramp', role: 'climb', bounds: { x: 106, y: 52, width: 34, height: 52 },
      scores: [7000], control: 'RampControl', lamps: ['lamp.rampRight'],
      collision: [{ kind: 'line', from: { x: 140, y: 104 }, to: { x: 106, y: 52 } }] },

    /* ===================== THE PAIR THAT PUNISHES A LOOSE SHOT ===================== */
    // Between the ramps, so the ball that failed to climb comes back through them.
    { name: 'rubble1', kind: 'bumper', role: WALL, bounds: { x: 74, y: 62, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.rubble1'],
      collision: [{ kind: 'circle', at: { x: 82, y: 70 }, radius: 8 }] },
    { name: 'rubble2', kind: 'bumper', role: WALL, bounds: { x: 92, y: 84, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.rubble2'],
      collision: [{ kind: 'circle', at: { x: 100, y: 92 }, radius: 8 }] },

    /* ===================== THE SCREE: FILLING THE FALL ===================== */
    // ⚠️ ADDED AFTER LOOKING AT THE PICTURE, not after a test failed. The table passed every gate with
    // fifty pixels of nothing between the bank and the funnel — a fall with no decision in it, which
    // is the difference between a table that is difficult and one that is merely tall. `low-orbit` has
    // furniture in the same band and that is why it reads as a table rather than as a corridor.
    //
    // On the flanks rather than the middle, so they reward a ball the player has KEPT to one side.
    { name: 'scree.left', kind: 'lane', role: 'key', bounds: { x: 26, y: 156, width: 12, height: 16 },
      scores: [2500], control: 'LaneControl', lamps: ['lamp.screeLeft'] },
    { name: 'scree.right', kind: 'lane', role: 'key', bounds: { x: 126, y: 156, width: 12, height: 16 },
      scores: [2500], control: 'LaneControl', lamps: ['lamp.screeRight'] },

    /* ===================== THE RIM ===================== */
    { name: 'rim1', kind: 'lane', role: 'goal', bounds: { x: 40, y: 16, width: 12, height: 14 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.rim1'] },
    { name: 'rim2', kind: 'lane', role: 'goal', bounds: { x: 108, y: 16, width: 12, height: 14 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.rim2'] },
  ],

  lamps: [
    ...CABINET_LAMPS,
    ...BANK.flatMap((t) => t.lamps),
    'lamp.rampLeft', 'lamp.rampRight', 'lamp.screeLeft', 'lamp.screeRight', 'lamp.rubble1', 'lamp.rubble2', 'lamp.rim1', 'lamp.rim2',
  ],
};
