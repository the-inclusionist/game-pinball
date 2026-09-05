// SPDX-License-Identifier: AGPL-3.0-or-later
// control/bindings — which component each control function reaches for, transcribed from `control.cpp`.
//
// ========================= THE LAST THING BETWEEN A PORT AND A GAME =========================
// `control/score-table` says WHICH control function each component runs. `control/lanes` and its
// neighbours say what those functions DO. Neither says which light, which group, which bumper — and in
// the original that is not in a table at all. It is in the function bodies, as named globals:
//
//     if (roll3 == caller)      light = lite8;
//     else if (roll2 == caller) light = lite9;
//     else                      light = lite10;
//
// So the bindings are data trapped in code, and getting them out is a transcription of its own. This
// file is where it goes, one control at a time, with the archive's own names.
//
// ⚠️ THE NAMES HERE ARE TAGS, NOT VARIABLES. `attack_bump` is what `control.cpp` calls it and
// `attack_bumpers` is what the file calls it; `roll3` is `a_roll3`. Everything in this file is the
// second kind, because the second kind is what a collision reports.
//
// ⚠️ AND IT IS PARTIAL, DELIBERATELY. One chain is transcribed and the rest are not. A half-filled
// table that pretended to be whole would be worse than a small one that says where it stops — and the
// count below is checked by a test, so growing it is a decision somebody makes rather than a drift.

/** One rollover lane's contribution: the light it turns on. */
export interface LaneLightBinding {
  /** The archive's name for the rollover. */
  readonly component: string;
  /** The archive's name for the light it lights. */
  readonly light: string;
}

export interface BumperLaneBinding {
  /** The control function in `score-table`'s `controlName`. */
  readonly control: string;
  /** Which light each lane turns on. */
  readonly lanes: readonly LaneLightBinding[];
  /** The light group the control asks "are all of you on yet". */
  readonly lightGroup: string;
  /** The bumper group it raises when the answer is yes. */
  readonly bumperGroup: string;
  /**
   * ⚠️ THE GUARD IS ON ONE NAMED BUMPER, NOT ON THE GROUP. `if (bump1->BmpIndex < 3)` — the original
   * asks the FIRST bumper and raises all four. Since they rise together the question is the same for
   * any of them, but transcribing it as "if any member is below 3" would be a different rule the day a
   * bumper is raised on its own.
   */
  readonly guardBumper: string;
  readonly guardBelowLevel: number;
  /** The resource id of the line shown when the lanes complete. */
  readonly completeTextId: string;
}

/**
 * `control::ReentryLanesRolloverControl`, transcribed whole.
 *
 * Verified against the archive rather than assumed: `bmpr_inc_lights` really holds lite8, lite9 and
 * lite10, and `attack_bumpers` really holds a_bump1 to a_bump4. The data agrees with the code, which is
 * the only reason to believe either.
 */
export const REENTRY_LANES: BumperLaneBinding = {
  control: 'ReentryLanesRolloverControl',
  lanes: [
    { component: 'a_roll3', light: 'lite8' },
    { component: 'a_roll2', light: 'lite9' },
    // The original's `else`: anything that is not roll3 or roll2 gets lite10, and roll1 is what that is.
    { component: 'a_roll1', light: 'lite10' },
  ],
  lightGroup: 'bmpr_inc_lights',
  bumperGroup: 'attack_bumpers',
  guardBumper: 'a_bump1',
  guardBelowLevel: 3,
  completeTextId: 'STRING106',
};

/**
 * `control::LaunchLanesRolloverControl`, the reentry lanes' twin.
 *
 * ⚠️ THE SAME SHAPE AND EVERY NAME DIFFERENT, which is exactly why it is written out rather than
 * derived. Three lanes, a light group, a bumper group, a guard on one named bumper, a line of text —
 * and not one of the six names is shared with the chain above. A rule that "the second lane set works
 * like the first" would be true about the structure and wrong about every value in it.
 *
 * The third lane is the original's `else`: anything that is not roll112 or roll111, which is roll110.
 */
export const LAUNCH_LANES: BumperLaneBinding = {
  control: 'LaunchLanesRolloverControl',
  lanes: [
    { component: 'a_roll112', light: 'lite171' },
    { component: 'a_roll111', light: 'lite170' },
    { component: 'a_roll110', light: 'lite169' },
  ],
  lightGroup: 'ramp_bmpr_inc_lights',
  bumperGroup: 'launch_bumpers',
  guardBumper: 'a_bump5',
  guardBelowLevel: 3,
  completeTextId: 'STRING107',
};

/** Every chain transcribed so far. The test that counts them is how the next one gets noticed. */
export const BUMPER_LANE_BINDINGS: readonly BumperLaneBinding[] = [REENTRY_LANES, LAUNCH_LANES];

/**
 * ⚠️ WHICH COMPONENTS EACH CONTROL REACHES FOR, and nothing about what it does with them.
 *
 * That division is the whole reason this table can exist at all. `control/lanes` and its neighbours
 * already say what every function DOES — they were transcribed in phase 5 and tested. What they take as
 * options is WHICH light, WHICH group, WHICH gate, and in the original that is not a table: it is named
 * globals inside each function body. So the only thing missing was the names, and names are data.
 *
 * Every entry is the set of tagged components named inside that function in `control.cpp`, with the
 * ARCHIVE's name rather than the variable's — `attack_bump` is `attack_bumpers`, `roll3` is `a_roll3`.
 * A test holds that every one of the 288 references names a group that is really in `PINBALL.DAT`,
 * which is what would catch a transcription that reads perfectly and addresses nothing.
 *
 * ⚠️ IT SAYS WHAT IS REACHED, NOT IN WHAT ROLE. `SpaceWarpRolloverControl` reaches lite27 and lite28
 * and this does not say which is which — it does not have to, because that function names them itself.
 * The two lane chains above DO need roles, and that is why they keep a richer type instead of being
 * folded in here. A table that flattened them would have lost which lane lights which lamp.
 */
export const CONTROL_REACHES: Readonly<Record<string, readonly string[]>> = {
  BallDrainControl: [
    'a_targ1', 'a_targ2', 'a_targ3', 'a_targ4', 'a_targ5', 'a_targ6', 'a_targ7', 'a_targ8',
    'a_targ9', 'attack_bumpers', 'bmpr_inc_lights', 'bpr_solotgt_lights', 'bsink_arrow_lights',
    'bumper_target_lights', 'drain', 'fuel_bargraph', 'hyperspace_lights', 'info_text_box',
    'l_trek_lights', 'launch_bumpers', 'lchute_tgt_lights', 'lite1', 'lite101', 'lite102',
    'lite103', 'lite110', 'lite130', 'lite16', 'lite17', 'lite18', 'lite19', 'lite195',
    'lite196', 'lite198', 'lite199', 'lite20', 'lite200', 'lite25', 'lite26', 'lite27',
    'lite28', 'lite29', 'lite30', 'lite38', 'lite39', 'lite4', 'lite40', 'lite54', 'lite55',
    'lite56', 'lite58', 'lite59', 'lite60', 'lite61', 'lite62', 'lite77', 'middle_circle',
    'mission_text_box', 'outer_circle', 'plunger', 'r_trek_lights', 'ramp_bmpr_inc_lights',
    'ramp_tgt_lights', 'skill_shot_lights', 'soundwave27', 'soundwave3', 'soundwave59',
    'top_circle_tgt_lights', 'top_target_lights', 'v_bloc1', 'v_gate1', 'v_gate2', 'v_sink3',
    'worm_hole_lights'
  ],
  BlackHoleKickoutControl: ['info_text_box'],
  BonusLaneRolloverControl: ['fuel_bargraph', 'info_text_box', 'lite16', 'soundwave25', 'soundwave50'],
  BoosterTargetControl: [
    'a_targ1', 'a_targ2', 'a_targ3', 'lite198', 'lite58', 'lite59', 'lite60', 'lite61',
    'soundwave45', 'soundwave46', 'soundwave47', 'soundwave48'
  ],
  DeploymentChuteToEscapeChuteOneWayControl: [
    'info_text_box', 'l_trek_lights', 'lite56', 'r_trek_lights', 'skill_shot_lights',
    'soundwave3'
  ],
  DeploymentChuteToTableOneWayControl: ['skill_shot_lights'],
  DrainBallBlockerControl: ['lite1'],
  ExtraBallLightControl: ['lite17', 'lite18'],
  FlagControl: ['lite20'],
  FlipperRebounderControl1: ['lite84'],
  FlipperRebounderControl2: ['lite85'],
  FuelRollover1Control: ['fuel_bargraph', 'info_text_box', 'literoll179'],
  FuelRollover2Control: ['fuel_bargraph', 'info_text_box', 'literoll180'],
  FuelRollover3Control: ['fuel_bargraph', 'info_text_box', 'literoll181'],
  FuelRollover4Control: ['fuel_bargraph', 'info_text_box', 'literoll182'],
  FuelRollover5Control: ['fuel_bargraph', 'info_text_box', 'literoll183'],
  FuelRollover6Control: ['fuel_bargraph', 'info_text_box', 'literoll184'],
  FuelSpotTargetControl: [
    'a_targ10', 'a_targ11', 'fuel_bargraph', 'info_text_box', 'lite70', 'lite71', 'lite72',
    'soundwave25', 'top_circle_tgt_lights'
  ],
  GravityWellKickoutControl: ['a_kout1', 'info_text_box', 'lite62', 'soundwave7'],
  HyperspaceKickOutControl: [
    'bumper_target_lights', 'hyperspace_lights', 'info_text_box', 'lite130', 'lite24',
    'lite25', 'lite26', 'lite27', 'lite28', 'soundwave21', 'soundwave35', 'soundwave36',
    'soundwave38', 'soundwave39', 'soundwave40', 'soundwave41', 'soundwave50',
    'top_target_lights', 'v_bloc1'
  ],
  LaunchLanesRolloverControl: [
    'a_bump5', 'a_roll111', 'a_roll112', 'info_text_box', 'launch_bumpers', 'lite169',
    'lite170', 'lite171', 'ramp_bmpr_inc_lights'
  ],
  LaunchRampControl: [
    'info_text_box', 'lite198', 'lite54', 'lite55', 'lite56', 'soundwave21', 'soundwave23',
    'soundwave24', 'soundwave30'
  ],
  LaunchRampHoleControl: ['lite54'],
  LeftFlipperControl: ['bmpr_inc_lights', 'ramp_bmpr_inc_lights'],
  LeftHazardSpotTargetControl: [
    'a_targ16', 'a_targ17', 'lchute_tgt_lights', 'lite104', 'lite105', 'lite106',
    'soundwave14', 'v_gate1'
  ],
  LeftKickerControl: ['v_gate1'],
  LeftKickerGateControl: ['lite196', 'lite30'],
  MedalTargetControl: ['a_targ4', 'a_targ5', 'a_targ6', 'bumper_target_lights', 'info_text_box'],
  MissionSpotTargetControl: [
    'a_targ13', 'a_targ14', 'lite101', 'lite102', 'lite103', 'lite198', 'ramp_tgt_lights',
    'soundwave52'
  ],
  MultiplierLightGroupControl: ['info_text_box'],
  MultiplierTargetControl: ['a_targ7', 'a_targ8', 'a_targ9', 'info_text_box', 'top_target_lights'],
  OutLaneRolloverControl: ['a_roll4', 'lite17', 'lite18', 'lite195', 'lite196', 'lite29', 'lite30', 'soundwave26'],
  PlungerControl: [
    'fuel_bargraph', 'l_trek_lights', 'lite200', 'lite67', 'middle_circle', 'r_trek_lights',
    'skill_shot_lights', 'top_target_lights', 'v_bloc1', 'v_gate1', 'v_gate2'
  ],
  ReentryLanesRolloverControl: [
    'a_bump1', 'a_roll2', 'a_roll3', 'attack_bumpers', 'bmpr_inc_lights', 'info_text_box',
    'l_trek_lights', 'lite10', 'lite56', 'lite8', 'lite9', 'r_trek_lights'
  ],
  ReturnLaneRolloverControl: ['a_roll6', 'a_roll7', 'lite27', 'lite28', 'lite59'],
  RightFlipperControl: ['bmpr_inc_lights', 'ramp_bmpr_inc_lights'],
  RightHazardSpotTargetControl: [
    'a_targ19', 'a_targ20', 'bpr_solotgt_lights', 'lite107', 'lite108', 'lite109',
    'soundwave14', 'v_gate2'
  ],
  RightKickerControl: ['v_gate2'],
  RightKickerGateControl: ['lite195', 'lite29'],
  SkillShotGate1Control: ['fuel_bargraph', 'lite200', 'lite25', 'lite54', 'lite67', 'skill_shot_lights', 'soundwave14'],
  SkillShotGate2Control: ['lite67', 'lite68', 'soundwave14'],
  SkillShotGate3Control: ['lite67', 'lite69', 'soundwave14'],
  SkillShotGate4Control: ['lite131', 'lite67', 'soundwave14'],
  SkillShotGate5Control: ['lite132', 'lite67', 'soundwave14'],
  SkillShotGate6Control: ['lite133', 'lite67', 'soundwave14'],
  SpaceWarpRolloverControl: ['lite27', 'lite28'],
  WormHoleControl: [
    'bsink_arrow_lights', 'info_text_box', 'lite110', 'lite4', 'v_sink1', 'v_sink2',
    'worm_hole_lights'
  ],
  WormHoleDestinationControl: ['info_text_box', 'lite110'],
};

/**
 * ⚠️ THE CONTROLS THAT REACH NO NAMED COMPONENT AT ALL — nine, not the two I first wrote.
 *
 * Measured rather than assumed, by reading every function body in `control.cpp` and asking which tagged
 * globals it mentions. `BumperControl` and `RebounderControl` pay from the caller's own score array;
 * `JackpotLightControl` and `BonusLightControl` clear a flag on the table; `ShootAgainLightControl`
 * messages only the caller. None of them needs a binding, which is not the same as lacking one — and
 * calling seven of them "not done yet" overstated the remaining work by that much.
 */
export const SELF_CONTAINED_CONTROLS: readonly string[] = [
  'BonusLightControl',
  'BumperControl',
  'BumperGroupControl',
  'EscapeChuteSinkControl',
  'HyperspaceLightGroupControl',
  'JackpotLightControl',
  'MedalLightGroupControl',
  'RebounderControl',
  'ShootAgainLightControl',
];
