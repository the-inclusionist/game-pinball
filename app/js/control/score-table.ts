// SPDX-License-Identifier: AGPL-3.0-or-later
// control/score-table — the 88 scoring components of the Space Cadet table, transcribed from
// `control::score_components` and the score arrays beside it.
//
// This is DATA, and it was extracted from control.cpp mechanically rather than retyped, because 88
// rows of three fields each is exactly the kind of transcription a human does wrong once and never
// notices. The values are the 1995 table's.
//
// ========================= WHAT A ROW MEANS =========================
//     { name: 'bump1', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores1 }
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
}

export const SCORE_COMPONENTS: readonly ScoreTableRow[] = [
  { name: 'bump1', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores1 },
  { name: 'bump2', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores1 },
  { name: 'bump3', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores1 },
  { name: 'bump4', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores1 },
  { name: 'roll3', controlName: 'ReentryLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores1 },
  { name: 'roll2', controlName: 'ReentryLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores1 },
  { name: 'roll1', controlName: 'ReentryLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores1 },
  { name: 'attack_bump', controlName: 'BumperGroupControl', scores: NO_SCORES },
  { name: 'bump5', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores2 },
  { name: 'bump6', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores2 },
  { name: 'bump7', controlName: 'BumperControl', scores: SCORE_ARRAYS.bump_scores2 },
  { name: 'roll112', controlName: 'LaunchLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores2 },
  { name: 'roll111', controlName: 'LaunchLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores2 },
  { name: 'roll110', controlName: 'LaunchLanesRolloverControl', scores: SCORE_ARRAYS.roll_scores2 },
  { name: 'launch_bump', controlName: 'BumperGroupControl', scores: NO_SCORES },
  { name: 'rebo1', controlName: 'FlipperRebounderControl1', scores: SCORE_ARRAYS.rebo_score1 },
  { name: 'rebo2', controlName: 'FlipperRebounderControl2', scores: SCORE_ARRAYS.rebo_score1 },
  { name: 'rebo3', controlName: 'RebounderControl', scores: SCORE_ARRAYS.rebo_score1 },
  { name: 'rebo4', controlName: 'RebounderControl', scores: SCORE_ARRAYS.rebo_score1 },
  { name: 'kicker1', controlName: 'LeftKickerControl', scores: NO_SCORES },
  { name: 'kicker2', controlName: 'RightKickerControl', scores: NO_SCORES },
  { name: 'gate1', controlName: 'LeftKickerGateControl', scores: NO_SCORES },
  { name: 'gate2', controlName: 'RightKickerGateControl', scores: NO_SCORES },
  { name: 'oneway4', controlName: 'DeploymentChuteToEscapeChuteOneWayControl', scores: SCORE_ARRAYS.oneway4_score1 },
  { name: 'oneway10', controlName: 'DeploymentChuteToTableOneWayControl', scores: NO_SCORES },
  { name: 'block1', controlName: 'DrainBallBlockerControl', scores: NO_SCORES },
  { name: 'ramp', controlName: 'LaunchRampControl', scores: SCORE_ARRAYS.ramp_score1 },
  { name: 'ramp_hole', controlName: 'LaunchRampHoleControl', scores: NO_SCORES },
  { name: 'roll4', controlName: 'OutLaneRolloverControl', scores: SCORE_ARRAYS.roll_score1 },
  { name: 'roll8', controlName: 'OutLaneRolloverControl', scores: SCORE_ARRAYS.roll_score1 },
  { name: 'lite17', controlName: 'ExtraBallLightControl', scores: NO_SCORES },
  { name: 'roll6', controlName: 'ReturnLaneRolloverControl', scores: SCORE_ARRAYS.roll_score2 },
  { name: 'roll7', controlName: 'ReturnLaneRolloverControl', scores: SCORE_ARRAYS.roll_score2 },
  { name: 'roll5', controlName: 'BonusLaneRolloverControl', scores: SCORE_ARRAYS.roll_score3 },
  { name: 'roll179', controlName: 'FuelRollover1Control', scores: SCORE_ARRAYS.roll_score4 },
  { name: 'roll180', controlName: 'FuelRollover2Control', scores: SCORE_ARRAYS.roll_score4 },
  { name: 'roll181', controlName: 'FuelRollover3Control', scores: SCORE_ARRAYS.roll_score4 },
  { name: 'roll182', controlName: 'FuelRollover4Control', scores: SCORE_ARRAYS.roll_score4 },
  { name: 'roll183', controlName: 'FuelRollover5Control', scores: SCORE_ARRAYS.roll_score4 },
  { name: 'roll184', controlName: 'FuelRollover6Control', scores: SCORE_ARRAYS.roll_score4 },
  { name: 'flag1', controlName: 'FlagControl', scores: SCORE_ARRAYS.flag_score1 },
  { name: 'kickout2', controlName: 'HyperspaceKickOutControl', scores: SCORE_ARRAYS.kickout_score1 },
  { name: 'hyper_lights', controlName: 'HyperspaceLightGroupControl', scores: NO_SCORES },
  { name: 'flag2', controlName: 'FlagControl', scores: SCORE_ARRAYS.flag_score1 },
  { name: 'sink1', controlName: 'WormHoleControl', scores: SCORE_ARRAYS.sink_score1 },
  { name: 'sink2', controlName: 'WormHoleControl', scores: SCORE_ARRAYS.sink_score1 },
  { name: 'sink3', controlName: 'WormHoleControl', scores: SCORE_ARRAYS.sink_score1 },
  { name: 'flip1', controlName: 'LeftFlipperControl', scores: NO_SCORES },
  { name: 'flip2', controlName: 'RightFlipperControl', scores: NO_SCORES },
  { name: 'plunger', controlName: 'PlungerControl', scores: NO_SCORES },
  { name: 'target1', controlName: 'BoosterTargetControl', scores: SCORE_ARRAYS.target_score1 },
  { name: 'target2', controlName: 'BoosterTargetControl', scores: SCORE_ARRAYS.target_score1 },
  { name: 'target3', controlName: 'BoosterTargetControl', scores: SCORE_ARRAYS.target_score1 },
  { name: 'lite60', controlName: 'JackpotLightControl', scores: NO_SCORES },
  { name: 'lite59', controlName: 'BonusLightControl', scores: NO_SCORES },
  { name: 'target6', controlName: 'MedalTargetControl', scores: SCORE_ARRAYS.target_score2 },
  { name: 'target5', controlName: 'MedalTargetControl', scores: SCORE_ARRAYS.target_score2 },
  { name: 'target4', controlName: 'MedalTargetControl', scores: SCORE_ARRAYS.target_score2 },
  { name: 'bumber_target_lights', controlName: 'MedalLightGroupControl', scores: NO_SCORES },
  { name: 'target9', controlName: 'MultiplierTargetControl', scores: SCORE_ARRAYS.target_score3 },
  { name: 'target8', controlName: 'MultiplierTargetControl', scores: SCORE_ARRAYS.target_score3 },
  { name: 'target7', controlName: 'MultiplierTargetControl', scores: SCORE_ARRAYS.target_score3 },
  { name: 'top_target_lights', controlName: 'MultiplierLightGroupControl', scores: NO_SCORES },
  { name: 'target10', controlName: 'FuelSpotTargetControl', scores: SCORE_ARRAYS.target_score4 },
  { name: 'target11', controlName: 'FuelSpotTargetControl', scores: SCORE_ARRAYS.target_score4 },
  { name: 'target12', controlName: 'FuelSpotTargetControl', scores: SCORE_ARRAYS.target_score4 },
  { name: 'target13', controlName: 'MissionSpotTargetControl', scores: SCORE_ARRAYS.target_score5 },
  { name: 'target14', controlName: 'MissionSpotTargetControl', scores: SCORE_ARRAYS.target_score5 },
  { name: 'target15', controlName: 'MissionSpotTargetControl', scores: SCORE_ARRAYS.target_score5 },
  { name: 'target16', controlName: 'LeftHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6 },
  { name: 'target17', controlName: 'LeftHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6 },
  { name: 'target18', controlName: 'LeftHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6 },
  { name: 'target19', controlName: 'RightHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6 },
  { name: 'target20', controlName: 'RightHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6 },
  { name: 'target21', controlName: 'RightHazardSpotTargetControl', scores: SCORE_ARRAYS.target_score6 },
  { name: 'target22', controlName: 'WormHoleDestinationControl', scores: SCORE_ARRAYS.target_score7 },
  { name: 'roll9', controlName: 'SpaceWarpRolloverControl', scores: SCORE_ARRAYS.roll_score5 },
  { name: 'kickout3', controlName: 'BlackHoleKickoutControl', scores: SCORE_ARRAYS.kickout_score2 },
  { name: 'kickout1', controlName: 'GravityWellKickoutControl', scores: SCORE_ARRAYS.kickout_score3 },
  { name: 'drain', controlName: 'BallDrainControl', scores: NO_SCORES },
  { name: 'oneway1', controlName: 'SkillShotGate1Control', scores: NO_SCORES },
  { name: 'trip1', controlName: 'SkillShotGate2Control', scores: NO_SCORES },
  { name: 'trip2', controlName: 'SkillShotGate3Control', scores: NO_SCORES },
  { name: 'trip3', controlName: 'SkillShotGate4Control', scores: NO_SCORES },
  { name: 'trip4', controlName: 'SkillShotGate5Control', scores: NO_SCORES },
  { name: 'trip5', controlName: 'SkillShotGate6Control', scores: NO_SCORES },
  { name: 'lite200', controlName: 'ShootAgainLightControl', scores: NO_SCORES },
  { name: 'sink7', controlName: 'EscapeChuteSinkControl', scores: NO_SCORES },
];
