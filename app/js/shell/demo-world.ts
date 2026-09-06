// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/demo-world — the 1995 table as the engine's declaration sees it.
//
// ========================= WHY THIS EXISTS =========================
// The engine reads one declaration and answers every accessibility question from it: `focusOf` for the
// audio guide, `targetsOf` for the sonar, `roleAt` and `nameAt` for what a blind player is told is
// under a point. `shell/boot` builds that declaration once, from the AUTHORED table, and the
// demonstration is an early return through the frame loop — so with the 1995 table on screen the
// contract answered about a table that was not there, and blind mode had to be refused rather than
// give a confident wrong answer.
//
// This is the other half: the demonstration presented as a `LiveTable`, so the declaration follows what
// the player is actually looking at.
//
// ========================= THE THREE TRANSLATIONS =========================
// ⚠️ THE COORDINATES ARE THE PICTURE'S, NOT THE TABLE'S. The physics runs in float units — x from -8 to
// 8, y from -14 to 15 — and the declaration is read in the pixels of the 183x235 picture. Every
// position here goes through the camera's projection, which is the same one that decides where the ball
// is drawn: a declaration in table units would describe a table nobody can see.
//
// ⚠️ THE ROLE COMES FROM `table/original-roles`, WHICH IS A DECISION AND NOT A DERIVATION. See that
// file: `kindOf` reads a kind out of the archive's own naming, and the kind-to-role table was approved
// by the Dev on 2026-09-06. A component whose name says nothing gets no role and is LEFT OUT — the
// declaration is what a player is told, and a guess in it is a lie with a confident voice.
//
// ⚠️ AND THE TARGETS ARE THE MISSION'S, which is the whole reason the sonar can point at anything real
// here. `MISSION_TABLE` names the components each mission counts hits on; the current mission is the
// value of `lite198`'s message field, which `demo.mission` reads. A mission with no components — the
// waiting states, the game-over carousel — has no targets, and that is an honest empty rather than a
// fallback to "everything".

import { readGroups, type Group } from '../dat/partman.js';
import { floatAttribute } from '../dat/attributes.js';
import { boundsOfWall, WALL_RECORD } from '../table/original.js';
import { readCamera, screenBoundsOf } from '../gfx/original-view.js';
import { roleOfComponent } from '../table/original-roles.js';
import { kindOf, type ComponentKind } from '../i18n/names.js';
import { MISSION_TABLE } from '../control/mission-table.js';
import type { DeclaredBall, DeclaredComponent } from './declaration.js';
import type { Demo } from './demo.js';

/** Decision 5 of the plan: the playfield is drawn at half size, and so is everything placed on it. */
const PLAYFIELD_SCALE = 0.5;

/**
 * Every component of the archive that can be described, as a rectangle on the picture.
 *
 * ⚠️ COMPUTED ONCE. The 1995 table does not move: a bumper is where the archive says it is for the
 * whole game, and the only thing whose position changes is the ball. Recomputing this per frame would
 * be a hundred and forty projections a frame for an answer that cannot have changed.
 */
/**
 * ⚠️ A LINE HAS NO AREA, AND MOST OF THIS TABLE IS LINES. The drain is a single segment at y = 14.44;
 * so are the trip wires, the one-ways and the gates. Projected, those come out as rectangles of zero
 * height — and a rectangle with no area cannot be pointed at, is refused by the engine's own validator,
 * and was dropped by the first version of this file: 76 components survived out of 230, the drain among
 * the casualties. The one thing on the table that ends a ball was not in the description of it.
 *
 * So a thin component is given the thickness of the BALL. That is not a fudge for the sake of a
 * number: the question the declaration answers is "what is at this place", and the place a wall
 * occupies for a ball is at least as wide as the ball. Three pixels on a 183-wide picture.
 */
const MINIMUM_EXTENT = 3;

function thickened(
  rect: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const width = Math.max(rect.width, MINIMUM_EXTENT);
  const height = Math.max(rect.height, MINIMUM_EXTENT);
  return {
    x: rect.x - (width - rect.width) / 2,
    y: rect.y - (height - rect.height) / 2,
    width,
    height,
  };
}

export function describeComponents(groups: readonly Group[]): DeclaredComponent[] {
  const { projection } = readCamera(groups, { scale: PLAYFIELD_SCALE });
  const out: DeclaredComponent[] = [];

  for (const group of groups) {
    const name = group.name;
    if (!name) continue;
    const role = roleOfComponent(name, kindOf);
    // No kind, no description. Most of this table's geometry is anonymous and stays that way.
    if (role === null) continue;
    const record = floatAttribute(group, WALL_RECORD);
    if (!record || !record.length) continue;

    out.push({ name, role, bounds: thickened(screenBoundsOf(boundsOfWall([...record]), projection)) });
  }

  return out;
}

/** The components the mission running right now is counting hits on. */
export function targetsOfMission(mission: number): readonly string[] {
  return MISSION_TABLE.find((row) => row.mission === mission)?.components ?? [];
}

export interface DemoWorldOptions {
  readonly demo: Demo;
  /** The archive's groups, which the demonstration read to build itself. */
  readonly groups: readonly Group[];
}

/**
 * A live view of the demonstration in the shape `shell/boot` wants.
 *
 * ⚠️ GETTERS, NOT FIELDS, for the same reason `createPinballWorld` uses them: the declaration is read
 * whenever the engine asks, and a snapshot taken at boot would answer about the first frame for ever.
 */
export function demoWorld(o: DemoWorldOptions) {
  const components = describeComponents(o.groups);
  const names = new Set(components.map((c) => c.name));

  return {
    get playfieldWidth() { return o.demo.playfield.width; },
    get playfieldHeight() { return o.demo.playfield.height; },
    /**
     * ⚠️ IN PIXELS, LIKE EVERYTHING ELSE HERE. The ball's radius is 0.3 table units; on a picture 183
     * across that is about three pixels, and the engine measures its topology's `unit` in the same
     * space as its positions.
     */
    get ballRadius() { return Math.max(1, o.demo.table.ballRadius * o.demo.playfield.width / 16); },
    get balls(): readonly DeclaredBall[] {
      const at = o.demo.ballOnScreen();
      const ball = o.demo.ball;
      return [{
        active: ball.active,
        position: { x: at.x, y: at.y },
        direction: { x: ball.direction.x, y: ball.direction.y },
        speed: ball.speed,
      }];
    },
    get components(): readonly DeclaredComponent[] { return components; },
    kindOfComponent: (name: string): ComponentKind | null => kindOf(name),
    get missionTextId() { return o.demo.missionText; },
    get missionTargets(): readonly string[] {
      // Only the ones this port actually placed: a target the declaration does not carry is a name the
      // sonar would look up and not find.
      return targetsOfMission(o.demo.mission).filter((name) => names.has(name));
    },
    get missionNeed() { return targetsOfMission(o.demo.mission).length; },
    /**
     * ⚠️ ALWAYS ZERO, AND SAID RATHER THAN GUESSED. The 1995 mission runner keeps its progress in
     * `lite56`'s message field and counts DOWN; turning that into a "have" would mean reading a lamp
     * whose meaning differs per mission — some count hits, some count seconds, some are not touched at
     * all. The number a player hears is therefore "nought of N" until that is transcribed properly,
     * which is a smaller lie than a number derived from the wrong lamp.
     */
    missionHave: 0,
  };
}

/** Reads the archive again for the caller that has only the bytes. */
export function groupsOf(archive: ArrayBuffer): readonly Group[] {
  return readGroups(new Uint8Array(archive));
}
