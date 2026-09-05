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
 * `control::ReturnLaneRolloverControl`, and the other half of a rule that spans two components.
 *
 * ⚠️ THE SPACE WARP LIGHTS THESE LAMPS AND SCORES NOTHING; the return lanes are where the shot is
 * collected, at score index ONE instead of index zero. Neither component means anything alone, and the
 * lamp is the only thing joining them — which is exactly why a binding table is needed at all: nothing
 * in either function says the other exists.
 */
export interface ReturnLaneBinding {
  readonly control: string;
  /** Each lane and the lamp the space warp lit for it. */
  readonly lanes: readonly { readonly component: string; readonly lamp: string }[];
  /** The shared warp indicator, darkened by whichever lane collects. */
  readonly warpLamp: string;
}

export const RETURN_LANES: ReturnLaneBinding = {
  control: 'ReturnLaneRolloverControl',
  lanes: [
    { component: 'a_roll6', lamp: 'lite27' },
    { component: 'a_roll7', lamp: 'lite28' },
  ],
  warpLamp: 'lite59',
};

/**
 * `control::FuelRollover1Control` to `FuelRollover6Control`: six rollovers that fill one tank.
 *
 * ⚠️ THE THRESHOLD AND THE FILL ARE THE SAME NUMBER, AND IT IS A LEVEL, NOT A LAMP. Each rollover asks
 * whether the tank is already past its own level and, if not, fills to exactly that level. Six lamps
 * make TWELVE levels — see `table/light-bargraph` — so the numbers run 1, 3, 5, 7, 9, 11 and every one
 * of them is odd: a rollover always leaves a solid lamp, never a flashing half.
 *
 * ⚠️ AND THE ROLLOVER'S OWN LAMP IS A SEGMENT OF THE TANK. `literoll179` is both the lamp blinked when
 * the tank is already fuller and the first bar of the bargraph, so a rollover that arrives too late
 * blinks the very segment it would have lit. That is the table telling the player where the shot went.
 */
export interface FuelRolloverBinding {
  readonly control: string;
  readonly component: string;
  /** Blinked for a twentieth of a second when the tank is already past this level. */
  readonly lamp: string;
  /** Both the threshold and the fill. See above. */
  readonly splitIndex: number;
}

/** The tank every one of them fills, by the archive's name. */
export const FUEL_BARGRAPH = 'fuel_bargraph';
/** The line shown on a successful refuel, the same one for all six. */
export const FUEL_REFUEL_TEXT_ID = 'STRING145';

export const FUEL_ROLLOVERS: readonly FuelRolloverBinding[] = [
  { control: 'FuelRollover1Control', component: 'a_roll179', lamp: 'literoll179', splitIndex: 1 },
  { control: 'FuelRollover2Control', component: 'a_roll180', lamp: 'literoll180', splitIndex: 3 },
  { control: 'FuelRollover3Control', component: 'a_roll181', lamp: 'literoll181', splitIndex: 5 },
  { control: 'FuelRollover4Control', component: 'a_roll182', lamp: 'literoll182', splitIndex: 7 },
  { control: 'FuelRollover5Control', component: 'a_roll183', lamp: 'literoll183', splitIndex: 9 },
  { control: 'FuelRollover6Control', component: 'a_roll184', lamp: 'literoll184', splitIndex: 11 },
];

/**
 * `control::OutLaneRolloverControl`, run by BOTH out lanes — `a_roll4` and `a_roll8`.
 *
 * ⚠️ THE FUNCTION BRANCHES ON WHICH ONE CALLED IT, and the original writes that as `roll4 == caller`
 * with everything else in the `else`. Transcribed as a table it is two entries, and the FIRST lamp of
 * each pair is the one whose lit state arms it: `lite30` arms `lite30 + lite196`, `lite29` arms
 * `lite29 + lite195`. Storing the pair in the other order would flash on the wrong condition.
 *
 * ⚠️ AND LOSING THE BALL HERE IS WHERE AN EXTRA BALL IS COLLECTED. `lite17` or `lite18` lit turns the
 * loss into a grant — the ball still drains, and one is banked. That is the whole reason an out lane
 * is not simply a drain.
 */
export interface OutLaneBinding {
  readonly control: string;
  /** Both lanes, by the archive's name. */
  readonly components: readonly string[];
  /** `lite17` and `lite18`. Either lit means an extra ball is waiting. */
  readonly extraBallLamps: readonly string[];
  /** Per lane, the warp pair it flashes. The first is the one that has to be lit. */
  readonly warpLamps: Readonly<Record<string, readonly string[]>>;
  readonly missSound: string;
  /** `table_add_extra_ball`'s own line. */
  readonly extraBallTextId: string;
}

export const OUT_LANES: OutLaneBinding = {
  control: 'OutLaneRolloverControl',
  components: ['a_roll4', 'a_roll8'],
  extraBallLamps: ['lite17', 'lite18'],
  warpLamps: {
    a_roll4: ['lite30', 'lite196'],
    a_roll8: ['lite29', 'lite195'],
  },
  missSound: 'miss',
  extraBallTextId: 'STRING110',
};

/**
 * `control::BonusLaneRolloverControl`, run by `a_roll5`.
 *
 * ⚠️ IT FILLS THE TANK EITHER WAY, and that is outside the branch in the original. Collecting the bonus
 * and missing it both end with `TLightGroupToggleSplitIndex 11` — so the lane is worth crossing even
 * when the lamp is dark, and a transcription that tucked the refill into the `else` would have made a
 * lit lamp cost the player their fuel.
 *
 * ⚠️ AND THE MISS BRANCH SHOWS THE REFUEL LINE, the same `STRING145` the six fuel rollovers show. The
 * consolation for crossing an unlit bonus lane is a full tank, and the game says so in those words.
 */
export interface BonusLaneBinding {
  readonly control: string;
  readonly component: string;
  /** `lite16`. Lit, the lane pays the accumulated bonus instead of its own score. */
  readonly lamp: string;
  /** The level the tank is filled to, which is the top of it. */
  readonly topSplitIndex: number;
  /** `STRING104`, which carries the amount paid. */
  readonly bonusTextId: string;
  /** `STRING145` — the refuel line, shared with the fuel rollovers. */
  readonly missTextId: string;
  readonly collectSound: string;
  readonly missSound: string;
}

export const BONUS_LANE: BonusLaneBinding = {
  control: 'BonusLaneRolloverControl',
  component: 'a_roll5',
  lamp: 'lite16',
  topSplitIndex: 11,
  bonusTextId: 'STRING104',
  missTextId: FUEL_REFUEL_TEXT_ID,
  collectSound: 'collect',
  missSound: 'miss',
};

/**
 * ⚠️ A CONTROL WHOSE WHOLE BINDING IS A LIST OF LAMPS, IN ORDER.
 *
 * Some control functions reach for nothing but lights, and their factories take exactly that. Those
 * need no shape of their own beyond the ORDER, which `CONTROL_REACHES` cannot carry because it is a
 * set of names rather than a sequence — `makeSpaceWarpRolloverControl` wants `[lite27, lite28]` and
 * would take `[lite28, lite27]` without complaint.
 *
 * ⚠️ AND ONLY ONE OF THEM IS WIRED, BECAUSE ONLY ONE ANSWERS A COLLISION. `ExtraBallLightControl`
 * responds to `TLightResetAndTurnOn` and to a light's timer expiring; `LaunchRampHoleControl` responds
 * to `ControlBallReleased`. The demonstration produces neither event, so wiring them would create
 * objects nothing can drive — the exact defect this port has spent its history removing. They are
 * listed here because the transcription is done and correct; the dispatcher says which it runs.
 */
export interface LampBinding {
  readonly control: string;
  /** The component that runs it, by the archive's name. */
  readonly component: string;
  /** The lamps, IN THE ORDER the control function expects them. */
  readonly lamps: readonly string[];
  /** Which message the control answers. Only `ControlCollision` has a source in this build. */
  readonly onMessage: 'ControlCollision' | 'ControlBallReleased' | 'TLightResetAndTurnOn';
}

export const LAMP_BINDINGS: readonly LampBinding[] = [
  { control: 'SpaceWarpRolloverControl', component: 'a_roll9', lamps: ['lite27', 'lite28'],
    onMessage: 'ControlCollision' },
  { control: 'ExtraBallLightControl', component: 'lite17', lamps: ['lite17', 'lite18'],
    onMessage: 'TLightResetAndTurnOn' },
  { control: 'LaunchRampHoleControl', component: 'ramp_hole', lamps: ['lite54'],
    onMessage: 'ControlBallReleased' },
];

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
