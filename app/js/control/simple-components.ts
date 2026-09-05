// SPDX-License-Identifier: AGPL-3.0-or-later
// control/simple-components — the control layer's address book. Port of
// `control::simple_components`, extracted mechanically from the array of 145 tags.
//
// ========================= THE CONTROL LAYER TALKS TO THE DISPLAY =========================
// `make_links` does two passes. The first wires a behaviour into every component that has one — that
// is the score table, in `control/score-table`. The second resolves these 145 names into globals and
// attaches NO behaviour at all: they are only the things the control code needs to be able to reach.
//
// Sorting them by kind is the whole finding. All 145 are lamps, groups of lamps, sounds, or one of two
// text boxes:
//
//     95 lamps · 15 light groups · 33 sounds · 2 text boxes
//
// Not one ball, wall, flipper, ramp or bumper appears here. The control layer never reaches for a
// mechanism by name; it reaches for what the player can SEE and HEAR, and touches mechanisms only
// through the `caller` it was handed. Which is the same observation this port has been making module
// by module — the state lives in the display — arriving here as a fact about the address book itself.
//
// ========================= AND THE SPLIT BETWEEN THE TWO ARRAYS IS EXACT =========================
// A lamp that DOES something is not here. `lite200` (the shoot-again fade), `lite17` (the extra ball
// expiring), `lite59` and `lite60` (the bonus and jackpot windows closing) all carry a control
// function, so they are score components — with a behaviour and no score. Every lamp that is only
// read or written lands here instead. The two arrays are disjoint, and the rule that separates them
// is simply whether the lamp has a rule of its own.
//
// A name that this table lists and a table does not provide is not an error in the original: it simply
// stays null and every use of it does nothing. `resolveSimpleComponents` reports the misses instead,
// because for an AUTHORED table (phase 8) a missing lamp is a wiring bug, not a fact of life.

/** `lite*`. Ninety-five of them, and every one is read for its state or its message field. */
export const SIMPLE_LIGHTS: readonly string[] = [
  'lite8', 'lite9', 'lite10', 'lite171', 'lite170', 'lite169', 'lite30', 'lite29', 'lite1',
  'lite54', 'lite55', 'lite56', 'lite18', 'lite27', 'lite28', 'lite16', 'lite21', 'lite22',
  'lite23', 'lite24', 'lite25', 'lite26', 'lite130', 'lite5', 'lite6', 'lite7', 'lite4', 'lite2',
  'lite3', 'literoll179', 'literoll180', 'literoll181', 'literoll182', 'literoll183',
  'literoll184', 'lite20', 'lite19', 'lite61', 'lite58', 'lite11', 'lite12', 'lite13', 'lite70',
  'lite71', 'lite72', 'lite101', 'lite102', 'lite103', 'lite104', 'lite105', 'lite106', 'lite107',
  'lite108', 'lite109', 'lite110', 'lite62', 'lite67', 'lite68', 'lite69', 'lite131', 'lite132',
  'lite133', 'lite77', 'lite198', 'lite199', 'lite196', 'lite195', 'lite84', 'lite85', 'lite300',
  'lite301', 'lite302', 'lite303', 'lite304', 'lite305', 'lite306', 'lite307', 'lite308',
  'lite309', 'lite310', 'lite311', 'lite312', 'lite313', 'lite314', 'lite315', 'lite316',
  'lite317', 'lite318', 'lite319', 'lite320', 'lite321', 'lite322', 'lite38', 'lite39', 'lite40',
];

/** `TLightGroup`s: the bargraph, the rank circles, the trek lights, the lane sets. */
export const SIMPLE_LIGHT_GROUPS: readonly string[] = [
  'bmpr_inc_lights', 'ramp_bmpr_inc_lights', 'worm_hole_lights', 'bsink_arrow_lights',
  'l_trek_lights', 'r_trek_lights', 'fuel_bargraph', 'top_circle_tgt_lights', 'ramp_tgt_lights',
  'lchute_tgt_lights', 'bpr_solotgt_lights', 'skill_shot_lights', 'middle_circle', 'outer_circle',
  'goal_lights',
];

/** `TSound`s the control layer plays directly, rather than through a component. */
export const SIMPLE_SOUNDS: readonly string[] = [
  'soundwave9', 'soundwave10', 'soundwave21', 'soundwave23', 'soundwave24', 'soundwave30',
  'soundwave28', 'soundwave50_1', 'soundwave8', 'soundwave40', 'soundwave41', 'soundwave36_1',
  'soundwave50_2', 'soundwave35_1', 'soundwave36_2', 'soundwave35_2', 'soundwave38',
  'soundwave39', 'soundwave44', 'soundwave45', 'soundwave46', 'soundwave47', 'soundwave48',
  'soundwave52', 'soundwave14_1', 'soundwave59', 'soundwave27', 'soundwave14_2', 'soundwave3',
  'soundwave26', 'soundwave49D', 'soundwave25', 'soundwave7',
];

/** The two text boxes: one for the running commentary, one for the mission. */
export const SIMPLE_TEXT_BOXES: readonly string[] = [
  'info_text_box', 'mission_text_box',
];

/** All 145, in the original's declaration order. */
export const SIMPLE_COMPONENTS: readonly string[] = [
  'lite8', 'lite9', 'lite10', 'bmpr_inc_lights', 'lite171', 'lite170', 'lite169',
  'ramp_bmpr_inc_lights', 'lite30', 'lite29', 'lite1', 'lite54', 'lite55', 'lite56', 'lite18',
  'lite27', 'lite28', 'lite16', 'lite21', 'lite22', 'lite23', 'lite24', 'lite25', 'lite26',
  'lite130', 'lite5', 'lite6', 'lite7', 'worm_hole_lights', 'lite4', 'lite2', 'lite3',
  'bsink_arrow_lights', 'l_trek_lights', 'r_trek_lights', 'literoll179', 'literoll180',
  'literoll181', 'literoll182', 'literoll183', 'literoll184', 'fuel_bargraph', 'lite20', 'lite19',
  'lite61', 'lite58', 'lite11', 'lite12', 'lite13', 'lite70', 'lite71', 'lite72',
  'top_circle_tgt_lights', 'lite101', 'lite102', 'lite103', 'ramp_tgt_lights', 'lite104',
  'lite105', 'lite106', 'lite107', 'lite108', 'lite109', 'lchute_tgt_lights',
  'bpr_solotgt_lights', 'lite110', 'lite62', 'lite67', 'lite68', 'lite69', 'lite131', 'lite132',
  'lite133', 'skill_shot_lights', 'lite77', 'lite198', 'middle_circle', 'outer_circle',
  'soundwave9', 'soundwave10', 'soundwave21', 'soundwave23', 'soundwave24', 'soundwave30',
  'soundwave28', 'soundwave50_1', 'soundwave8', 'soundwave40', 'soundwave41', 'soundwave36_1',
  'soundwave50_2', 'soundwave35_1', 'soundwave36_2', 'soundwave35_2', 'soundwave38',
  'soundwave39', 'soundwave44', 'soundwave45', 'soundwave46', 'soundwave47', 'soundwave48',
  'soundwave52', 'soundwave14_1', 'soundwave59', 'lite199', 'lite196', 'lite195', 'info_text_box',
  'mission_text_box', 'soundwave27', 'lite84', 'lite85', 'soundwave14_2', 'soundwave3',
  'soundwave26', 'soundwave49D', 'lite300', 'lite301', 'lite302', 'lite303', 'lite304', 'lite305',
  'lite306', 'lite307', 'lite308', 'lite309', 'lite310', 'lite311', 'lite312', 'lite313',
  'lite314', 'lite315', 'lite316', 'lite317', 'lite318', 'lite319', 'lite320', 'lite321',
  'lite322', 'goal_lights', 'soundwave25', 'soundwave7', 'lite38', 'lite39', 'lite40',
];

export interface SimpleResolution {
  readonly resolved: number;
  /** Names no component on the table answers to. Null in the original; reported here. */
  readonly missing: readonly string[];
}

/**
 * `make_links`' second pass. The original silently leaves a missing name null; this reports it, so an
 * authored table can be checked against the address book it is expected to satisfy.
 */
export function resolveSimpleComponents(
  names: readonly string[],
  lookUp: (name: string) => unknown,
): SimpleResolution {
  const missing: string[] = [];
  let resolved = 0;
  for (const name of names) {
    if (lookUp(name) === undefined || lookUp(name) === null) missing.push(name);
    else resolved++;
  }
  return { resolved, missing };
}
