// SPDX-License-Identifier: AGPL-3.0-or-later
// control/score-table — the 88 scoring components of the Space Cadet table, transcribed from
// `control::score_components` and the score arrays beside it.
//
// This is DATA, and it was extracted from control.cpp mechanically rather than retyped, because 88
// rows of three fields each is exactly the kind of transcription a human does wrong once and never
// notices. The values are the 1995 table's.
//
// ========================= WHAT A ROW MEANS =========================
//     { name: 'bump1', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores1, tag: 'a_bump1' }
//
// The NAME is a .DAT group name, so it matches the file rather than anything in this codebase. The
// CONTROL NAME picks a behavior out of the registry — and a behavior that is not registered yet
// simply leaves that component inert, which is how this table can be complete while the behaviors
// arrive in batches. The SCORES are shared: four bumpers of a group point at one array.
//
// ========================= THE ARRAYS SAY WHAT THE TABLE IS WORTH =========================
// A bumper's four entries are the four levels it can reach, so `bump_scores1` climbing 500 to 2000 is
// the reward for keeping a bumper lit. `oneway4_score1` runs 15000, 30000, 75000, 30000, 15000, 7500 —
// up and then down, which is a skill shot: the timing window pays most in the middle.

/** Components whose control entry carries no scores at all. */
export const NO_SCORES: readonly number[] = [];

/** The score arrays, exactly as declared in control.cpp. Shared between components by design. */
export const SCORE_ARRAYS = {
  /** A bumper's four levels. */
  bump_scores1: [500, 1000, 1500, 2000],
  bump_scores2: [1500, 2500, 3500, 4500],
  roll_scores1: [2000],
  roll_scores2: [500],
  rebo_score1: [500],
  /** Up then down: a timing window that pays most in the middle. */
  oneway4_score1: [15000, 30000, 75000, 30000, 15000, 7500],
  ramp_score1: [5000],
  roll_score1: [20000],
  roll_score2: [5000, 25000],
  roll_score3: [10000],
  roll_score4: [500],
  roll_score5: [10000],
  flag_score1: [500, 2500],
  /** The second entry is zero on purpose — that level scores nothing. */
  kickout_score1: [10000, 0, 20000, 50000, 150000],
  kickout_score2: [20000],
  kickout_score3: [50000],
  sink_score1: [2500, 5000, 7500],
  target_score1: [500, 5000],
  target_score2: [1500, 10000, 50000],
  target_score3: [500, 1500],
  target_score4: [750],
  target_score5: [1000],
  target_score6: [750],
  target_score7: [750],
} as const satisfies Record<string, readonly number[]>;

export interface ScoreTableRow {
  /** A .DAT group name. */
  readonly name: string;
  /** Picks a behavior out of the control registry. Unregistered means the component stays inert. */
  readonly controlName: string;
  readonly scores: readonly number[];
  /**
   * ⚠️ THE GROUP'S NAME IN `PINBALL.DAT`, AND THE ONLY THING THAT BINDS THIS ROW TO A REAL TABLE.
   *
   * The upstream's rows are not named at all — they carry a tag:
   *
   *     component_tag<TPopupTarget> control_target1_tag = {"a_targ1"};
   *
   * and `make_component_link` looks the component up by that string and nothing else. `name` above is
   * the C++ VARIABLE's name, which is readable and addresses nothing: the archive has `a_targ1` where
   * this file says `target1`, and only nine of the eighty-nine happen to agree.
   *
   * Leaving it out was a transcription gap, and its cost was exact: the demonstration mode could say
   * what the ball had hit and could not score a single thing.
   */
  readonly tag: string;
}

export const SCORE_COMPONENTS: readonly ScoreTableRow[] = [
  { name: 'bump1', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores1, tag: 'a_bump1' },
  { name: 'bump2', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores1, tag: 'a_bump2' },
  { name: 'bump3', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores1, tag: 'a_bump3' },
  { name: 'bump4', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores1, tag: 'a_bump4' },
  { name: 'roll3', controlName: 'ReentryLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores1, tag: 'a_roll3' },
  { name: 'roll2', controlName: 'ReentryLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores1, tag: 'a_roll2' },
  { name: 'roll1', controlName: 'ReentryLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores1, tag: 'a_roll1' },
  { name: 'attack_bump', controlName: 'BumperGroupControl', scores: NO_SCORES, tag: 'attack_bumpers' },
  { name: 'bump5', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores2, tag: 'a_bump5' },
  { name: 'bump6', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores2, tag: 'a_bump6' },
  { name: 'bump7', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores2, tag: 'a_bump7' },
  { name: 'roll112', controlName: 'LaunchLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores2, tag: 'a_roll112' },
  { name: 'roll111', controlName: 'LaunchLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores2, tag: 'a_roll111' },
  { name: 'roll110', controlName: 'LaunchLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores2, tag: 'a_roll110' },
  { name: 'launch_bump', controlName: 'BumperGroupControl', scores: NO_SCORES, tag: 'launch_bumpers' },
  { name: 'rebo1', controlName: 'FlipperRebounderControl1', scores: SCORE_ARRAYS.rebo_score1, tag: 'v_rebo1' },
  { name: 'rebo2', controlName: 'FlipperRebounderControl2', scores: SCORE_ARRAYS.rebo_score1, tag: 'v_rebo2' },
  { name: 'rebo3', controlName: 'RebounderControl', scores: SCORE_ARRAYS.rebo_score1, tag: 'v_rebo3' },
  { name: 'rebo4', controlName: 'RebounderControl', scores: SCORE_ARRAYS.rebo_score1, tag: 'v_rebo4' },
  { name: 'kicker1', controlName: 'LeftKickerControl', scores: NO_SCORES, tag: 'a_kick1' },
  { name: 'kicker2', controlName: 'RightKickerControl', scores: NO_SCORES, tag: 'a_kick2' },
  { name: 'gate1', controlName: 'LeftKickerGateControl', scores: NO_SCORES, tag: 'v_gate1' },
  { name: 'gate2', controlName: 'RightKickerGateControl', scores: NO_SCORES, tag: 'v_gate2' },
  { name: 'oneway4', controlName: 'DeploymentChuteToEscapeChuteOneWayControl', scores: SCORE_ARRAYS.oneway4_score1, tag: 's_onewy4' },
  { name: 'oneway10', controlName: 'DeploymentChuteToTableOneWayControl', scores: NO_SCORES, tag: 's_onewy10' },
  { name: 'block1', controlName: 'DrainBallBlockerControl', scores: NO_SCORES, tag: 'v_bloc1' },
  { name: 'ramp', controlName: 'LaunchRampControl', scores: SCORE_ARRAYS.ramp_score1, tag: 'ramp' },
  { name: 'ramp_hole', controlName: 'LaunchRampHoleControl', scores: NO_SCORES, tag: 'ramp_hole' },
  { name: 'roll4', controlName: 'OutLaneRolloverControl', scores: SCORE_ARRAYS.roll_score1, tag: 'a_roll4' },
  { name: 'roll8', controlName: 'OutLaneRolloverControl', scores: SCORE_ARRAYS.roll_score1, tag: 'a_roll8' },
  { name: 'lite17', controlName: 'ExtraBallLightControl', scores: NO_SCORES, tag: 'lite17' },
  { name: 'roll6', controlName: 'ReturnLaneRolloverControl', scores: SCORE_ARRAYS.roll_score2, tag: 'a_roll6' },
  { name: 'roll7', controlName: 'ReturnLaneRolloverControl', scores: SCORE_ARRAYS.roll_score2, tag: 'a_roll7' },
  { name: 'roll5', controlName: 'BonusLaneRolloverControl', scores: SCORE_ARRAYS.roll_score3, tag: 'a_roll5' },
  { name: 'roll179', controlName: 'FuelRollover1Control', scores: SCORE_ARRAYS.roll_score4, tag: 'a_roll179' },
  { name: 'roll180', controlName: 'FuelRollover2Control', scores: SCORE_ARRAYS.roll_score4, tag: 'a_roll180' },
  { name: 'roll181', controlName: 'FuelRollover3Control', scores: SCORE_ARRAYS.roll_score4, tag: 'a_roll181' },
  { name: 'roll182', controlName: 'FuelRollover4Control', scores: SCORE_ARRAYS.roll_score4, tag: 'a_roll182' },
  { name: 'roll183', controlName: 'FuelRollover5Control', scores: SCORE_ARRAYS.roll_score4, tag: 'a_roll183' },
  { name: 'roll184', controlName: 'FuelRollover6Control', scores: SCORE_ARRAYS.roll_score4, tag: 'a_roll184' },
  { name: 'flag1', controlName: 'FlagControl', scores: SCORE_ARRAYS.flag_score1, tag: 'a_flag1' },
  { name: 'kickout2', controlName: 'HyperspaceKickOutControl', scores: SCORE_ARRAYS.kickout_score1, tag: 'a_kout2' },
  { name: 'hyper_lights', controlName: 'HyperspaceLightGroupControl', scores: NO_SCORES, tag: 'hyperspace_lights' },
  { name: 'flag2', controlName: 'FlagControl', scores: SCORE_ARRAYS.flag_score1, tag: 'a_flag2' },
  { name: 'sink1', controlName: 'WormHoleControl', scores: SCORE_ARRAYS.sink_score1, tag: 'v_sink1' },
  { name: 'sink2', controlName: 'WormHoleControl', scores: SCORE_ARRAYS.sink_score1, tag: 'v_sink2' },
  { name: 'sink3', controlName: 'WormHoleControl', scores: SCORE_ARRAYS.sink_score1, tag: 'v_sink3' },
  { name: 'flip1', controlName: 'LeftFlipperControl', scores: NO_SCORES, tag: 'a_flip1' },
  { name: 'flip2', controlName: 'RightFlipperControl', scores: NO_SCORES, tag: 'a_flip2' },
  { name: 'plunger', controlName: 'PlungerControl', scores: NO_SCORES, tag: 'plunger' },
  { name: 'target1', controlName: 'BoosterTargetControl', scores: SCORE_ARRAYS.target_score1, tag: 'a_targ1' },
  { name: 'target2', controlName: 'BoosterTargetControl', scores: SCORE_ARRAYS.target_score1, tag: 'a_targ2' },
  { name: 'target3', controlName: 'BoosterTargetControl', scores: SCORE_ARRAYS.target_score1, tag: 'a_targ3' },
  { name: 'lite60', controlName: 'JackpotLightControl', scores: NO_SCORES, tag: 'lite60' },
  { name: 'lite59', controlName: 'BonusLightControl', scores: NO_SCORES, tag: 'lite59' },
  { name: 'target6', controlName: 'MedalTargetControl', scores: SCORE_ARRAYS.target_score2, tag: 'a_targ6' },
  { name: 'target5', controlName: 'MedalTargetControl', scores: SCORE_ARRAYS.target_score2, tag: 'a_targ5' },
  { name: 'target4', controlName: 'MedalTargetControl', scores: SCORE_ARRAYS.target_score2, tag: 'a_targ4' },
  { name: 'bumber_target_lights', controlName: 'MedalLightGroupControl', scores: NO_SCORES, tag: 'bumper_target_lights' },
  { name: 'target9', controlName: 'MultiplierTargetControl', scores: SCORE_ARRAYS.target_score3, tag: 'a_targ9' },
  { name: 'target8', controlName: 'MultiplierTargetControl', scores: SCORE_ARRAYS.target_score3, tag: 'a_targ8' },
  { name: 'target7', controlName: 'MultiplierTargetControl', scores: SCORE_ARRAYS.target_score3, tag: 'a_targ7' },
  { name: 'top_target_lights', controlName: 'MultiplierLightGroupControl', scores: NO_SCORES, tag: 'top_target_lights' },
  { name: 'target10', controlName: 'FuelSpotTargetControl', scores: SCORE_ARRAYS.target_score4, tag: 'a_targ10' },
  { name: 'target11', controlName: 'FuelSpotTargetControl', scores: SCORE_ARRAYS.target_score4, tag: 'a_targ11' },
  { name: 'target12', controlName: 'FuelSpotTargetControl', scores: SCORE_ARRAYS.target_score4, tag: 'a_targ12' },
  { name: 'target13', controlName: 'MissionSpotTargetControl', scores: SCORE_ARRAYS.target_score5, tag: 'a_targ13' },
  { name: 'target14', controlName: 'MissionSpotTargetControl', scores: SCORE_ARRAYS.target_score5, tag: 'a_targ14' },
  { name: 'target15', controlName: 'MissionSpotTargetControl', scores: SCORE_ARRAYS.target_score5, tag: 'a_targ15' },
  { name: 'target16', controlName: 'LeftHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6, tag: 'a_targ16' },
  { name: 'target17', controlName: 'LeftHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6, tag: 'a_targ17' },
  { name: 'target18', controlName: 'LeftHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6, tag: 'a_targ18' },
  { name: 'target19', controlName: 'RightHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6, tag: 'a_targ19' },
  { name: 'target20', controlName: 'RightHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6, tag: 'a_targ20' },
  { name: 'target21', controlName: 'RightHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6, tag: 'a_targ21' },
  { name: 'target22', controlName: 'WormHoleDestinationControl', scores: SCORE_ARRAYS.target_score7, tag: 'a_targ22' },
  { name: 'roll9', controlName: 'SpaceWarpRolloverControl', scores: SCORE_ARRAYS.roll_score5, tag: 'a_roll9' },
  { name: 'kickout3', controlName: 'BlackHoleKickoutControl', scores: SCORE_ARRAYS.kickout_score2, tag: 'a_kout3' },
  { name: 'kickout1', controlName: 'GravityWellKickoutControl', scores: SCORE_ARRAYS.kickout_score3, tag: 'a_kout1' },
  { name: 'drain', controlName: 'BallDrainControl', scores: NO_SCORES, tag: 'drain' },
  { name: 'oneway1', controlName: 'SkillShotGate1Control', scores: NO_SCORES, tag: 's_onewy1' },
  { name: 'trip1', controlName: 'SkillShotGate2Control', scores: NO_SCORES, tag: 's_trip1' },
  { name: 'trip2', controlName: 'SkillShotGate3Control', scores: NO_SCORES, tag: 's_trip2' },
  { name: 'trip3', controlName: 'SkillShotGate4Control', scores: NO_SCORES, tag: 's_trip3' },
  { name: 'trip4', controlName: 'SkillShotGate5Control', scores: NO_SCORES, tag: 's_trip4' },
  { name: 'trip5', controlName: 'SkillShotGate6Control', scores: NO_SCORES, tag: 's_trip5' },
  { name: 'lite200', controlName: 'ShootAgainLightControl', scores: NO_SCORES, tag: 'lite200' },
  { name: 'sink7', controlName: 'EscapeChuteSinkControl', scores: NO_SCORES, tag: 'v_sink7' },
];
