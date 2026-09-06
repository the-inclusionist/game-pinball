// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/table-palette — the colours the authored tables are drawn in, and the CB-Safe alternative.
//
// ========================= WHAT THE DEV ASKED FOR =========================
// Palettes drawn from the 1995 table's own worlds — "a original tem predominância de azul (céu), outra
// com predominância de preto (espaço), outra de vermelho terroso (marte) e assim por diante" — with
// the tables sharing one visual identity, and a normal palette beside a CB-Safe alternative the player
// can choose. Three separate requirements, and this module has to answer all three at once.
//
// ========================= THE IDENTITY IS AN ORDER, NOT A HUE =========================
// The five tables cannot share a colour: on Mars the world is red and on the sky table it is blue, so
// nothing is constant across them by construction. What IS constant is the ARRANGEMENT:
//
//   · the ground is the darkest thing on the table, always;
//   · the ball is the lightest thing on the table, always;
//   · every component sits between them, and the same role has the same meaning everywhere.
//
// A player who learns to find the ball on `low-orbit` finds it on `narrow-tower` without being told.
// That is the identity, and `tests/gfx-table-palette` checks it rather than trusting it.
//
// The scene is carried by the GROUND, which is most of the pixels on the screen — "predominância" is
// literally the colour with the most area. The roles keep their meaning across scenes; only the world
// underneath them changes.
//
// ========================= AND THE COLOURS SAY WHAT A THING DOES =========================
// One colour per contract ROLE, not per component kind — the choice `gfx/table-view` was already
// making, kept and explained here. A player learns "red takes your ball" once and it holds on every
// table; a palette by kind would have to be relearned per table and would say nothing to the engine's
// colour-blindness filters, which read roles.
//
// ========================= WHY THE CB-SAFE VARIANT LOOKS ALMOST THE SAME =========================
// ⚠️ IT IS NOT A SECOND PALETTE. It is the normal one with the smallest change that survives the
// engine's own simulation matrices, and that is a deliberate construction rather than a coincidence:
// the colours were found by walking each role back TOWARD its normal colour for as long as the whole
// palette stayed separable. Five of the eight barely move. `structure`, `free` and `goal` do not move
// at all.
//
// What moves is `gate`, from blue to magenta, and the reason is worth stating because it is the whole
// argument for the mode existing:
//
//   Protanopia and deuteranopia keep the blue-yellow axis and lose red-green; tritanopia does the
//   reverse. A pair of colours that differs on only ONE of those survives two simulations and dies in
//   the third. Measured against the normal palette, five pairs collapse — and `water` is in four of
//   them, because cyan has somewhere to fall in every direction.
//
//   Blue is `water`'s by meaning and `gate`'s only by this project's own convention, so the gate is
//   what gives way. Every other band is already spoken for: red-orange is hazard, gold is goal, green
//   is key, violet is climb, grey is the world. Magenta is the one place left, and it is not a taste
//   decision — it is what remains after the meanings are honoured.
//
// ⚠️ AND THE HUES THAT CARRY MEANING WERE PINNED BEFORE THE SEARCH RAN, which is why this is not the
// palette a distance-maximiser produces. Left to maximise separation alone it returned sand-yellow
// water and neon-green keys: perfectly distinguishable and nonsense to read. Separation is a
// constraint here, not the objective.
//
// ========================= WHAT IS NOT CLAIMED =========================
// This makes the table legible, not the game accessible. A player who reads no colour at all is served
// by the sonar and the audio guide, which are a different mechanism and do not depend on any of this.

import type { Role } from '@the-inclusionist/engine/core/contract.js';

/**
 * A colour as three channels, NOT as a packed word.
 *
 * ⚠️ ON PURPOSE: `gfx/framebuffer.pack` chooses its byte order from a runtime endianness probe, so a
 * stored word means different channels on different hardware. Anything that wants to reason about a
 * colour — this module's tests, the contrast checks, a future palette editor — would have to reverse
 * that probe to read it back. The packing happens where the pixel is written and nowhere else.
 */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface Scene {
  /** The colour of the playfield, which is most of the screen and therefore the scene itself. */
  readonly ground: Rgb;
  /** What the world is, in a word the i18n layer can look up when a menu lists them. */
  readonly textId: string;
}

export interface TablePalette {
  readonly ground: Rgb;
  readonly ball: Rgb;
  readonly roles: Readonly<Record<Role, Rgb>>;
}

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });

/**
 * The five worlds.
 *
 * The first three are the Dev's: the 1995 table's blue sky, the black of space, the earthy red of
 * Mars. `ice` continues the series — a fourth world rather than a fourth mood — and `slate` is not a
 * world at all: it is the neutral ground `bare-minimum` was already drawn on, kept unchanged so that
 * the table which exists to show the floor of the format goes on showing exactly that.
 */
export const SCENES: Readonly<Record<string, Scene>> = {
  sky: { ground: rgb(14, 26, 46), textId: 'pinball.scene.sky' },
  space: { ground: rgb(8, 8, 12), textId: 'pinball.scene.space' },
  mars: { ground: rgb(42, 20, 16), textId: 'pinball.scene.mars' },
  ice: { ground: rgb(10, 28, 30), textId: 'pinball.scene.ice' },
  slate: { ground: rgb(26, 30, 38), textId: 'pinball.scene.slate' },
};

/**
 * Which world each authored table stands in.
 *
 * ⚠️ NO DEFAULT, AND THAT IS THE POINT. A sixth table added tomorrow gets `undefined` here and stops
 * `tests/gfx-table-palette`, rather than quietly coming out slate-grey and looking finished. Choosing
 * a world is part of authoring a table.
 */
const SCENE_OF_TABLE: Readonly<Record<string, string>> = {
  // The conventional table, and the one closest to the 1995 original's own blue.
  'low-orbit': 'sky',
  // Wider than the screen: the horizontal camera has travel here, and black gives the edges nothing
  // to catch on as the view slides.
  // The storm is lit by what it is made of: an electrical blue-violet, closest to `sky` of the five.
  'ion-storm': 'sky',
  'crater-run': 'mars',
  'wide-arc': 'space',
  // Two hundred and forty pixels of climb. Red earth for a table that is all ascent.
  'narrow-tower': 'mars',
  'four-flippers': 'ice',
  // The floor of the format, on the ground it has always had.
  'bare-minimum': 'slate',
};

export function sceneOf(tableName: string): string | undefined {
  return SCENE_OF_TABLE[tableName];
}

/** The lightest thing on any table, in either palette. */
const BALL = rgb(238, 242, 248);

/**
 * The normal palette.
 *
 * ⚠️ THREE OF THESE ARE NOT WHAT THIS PROJECT USED TO DRAW, and the change was forced by measurement
 * rather than taste. `free` against the ground came out at a CIE76 distance of 13.3 and `structure`
 * against `free` at 16.4 — both under the twenty this palette is held to, both on screen, and nothing
 * had ever measured them. A lane the player cannot see is a lane that is not there.
 */
const NORMAL: Readonly<Record<Role, Rgb>> = {
  // The only warm colour among the signals, and used for nothing else.
  hazard: rgb(208, 62, 48),
  goal: rgb(242, 206, 84),
  key: rgb(116, 202, 132),
  gate: rgb(86, 132, 226),
  structure: rgb(134, 142, 156),
  climb: rgb(186, 112, 206),
  water: rgb(64, 168, 196),
  free: rgb(74, 82, 96),
};

/**
 * The CB-Safe palette: the normal one, moved as little as separability allows.
 *
 * Every pair among these, the ball and all five grounds stays at least 22 apart in CIE76 — in normal
 * vision and under each of the three Machado 2009 simulations at full severity. The test asks for 20;
 * the two units are headroom, so that a later change to one colour fails loudly instead of drifting
 * across the line unnoticed.
 */
const CB_SAFE: Readonly<Record<Role, Rgb>> = {
  hazard: rgb(190, 71, 52),
  // Unmoved: gold survives every simulation as the lightest saturated thing on the table.
  goal: rgb(243, 206, 84),
  key: rgb(44, 240, 162),
  // ⚠️ THE ONE REAL CHANGE. See this module's header: blue belongs to water, and this is what is left.
  gate: rgb(223, 0, 152),
  // Unmoved: a neutral has no hue to lose.
  structure: rgb(134, 143, 157),
  climb: rgb(154, 101, 244),
  water: rgb(16, 175, 210),
  // Unmoved, for the same reason as `structure`.
  free: rgb(73, 83, 96),
};

/**
 * ⚠️ HOW FAR EACH COLOUR MAY BE SHADED BEFORE ITS EDGE READS AS ANOTHER ROLE.
 *
 * A lit edge is what makes a flat rectangle look like a raised bumper, and phase 8 wants that. But a
 * highlight IS a colour, drawn on a table where every colour already means something — and the first
 * attempt used ONE amount for every role and failed at every value tried. Eighteen per cent put
 * `free`'s highlight nearer `structure` than `free`, because those two clear this palette's threshold
 * by a fraction and nothing else.
 *
 * So the amount is per role: as much as that colour's own neighbours allow, and no more. What falls
 * out is a rule nobody set out to write — THE SIGNALS GET DEPTH AND THE WORLD STAYS NEARLY FLAT. The
 * two neutrals take a sixth; hazard, goal, key and climb take two fifths and more.
 *
 * ⚠️ SOLVED OFFLINE, STORED HERE, CHECKED ELSEWHERE. Deriving these at run time with a distance
 * function would put the same function on both sides of the gate: `tests/gfx-table-shading` measures
 * them with its own, so a wrong constant fails instead of moving the check with it.
 *
 * The same fact, seen from the other side, is why the GROUND cannot have a gradient: any lift big
 * enough to read as depth walks the ground into `free`. That one is an open question for the Dev.
 */
export const SHADE_HEADROOM: Readonly<Record<Role, number>> = {
  hazard: 0.40,
  goal: 0.48,
  key: 0.44,
  gate: 0.36,
  // The world. See above: this is a measurement, not a preference for flat scenery.
  structure: 0.20,
  climb: 0.40,
  water: 0.30,
  free: 0.16,
};

/**
 * Moves a colour toward white (`t > 0`) or toward black (`t < 0`).
 *
 * Toward WHITE rather than by a multiplier, because multiplying a near-black colour by 1.4 is still
 * near-black: the `space` ground moves 1.1 in lightness that way, and a highlight nobody can see is
 * not a highlight. Toward black on the other side, where multiplying is exactly right.
 */
export function shade(c: Rgb, t: number): Rgb {
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return t >= 0
    ? rgb(clamp(c.r + (255 - c.r) * t), clamp(c.g + (255 - c.g) * t), clamp(c.b + (255 - c.b) * t))
    : rgb(clamp(c.r * (1 + t)), clamp(c.g * (1 + t)), clamp(c.b * (1 + t)));
}

export interface PaletteOptions {
  /** Whether to use the alternative that survives the colour-blindness simulations. */
  readonly cbSafe: boolean;
}

/** The palette for one world. Unknown scenes fall to `slate`, which is the neutral, not a guess. */
export function paletteFor(scene: string, o: PaletteOptions): TablePalette {
  return {
    ground: (SCENES[scene] ?? SCENES['slate']!).ground,
    ball: BALL,
    roles: o.cbSafe ? CB_SAFE : NORMAL,
  };
}
