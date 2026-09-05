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

/** Every chain transcribed so far. One, and the test that counts it is how the next one gets noticed. */
export const BUMPER_LANE_BINDINGS: readonly BumperLaneBinding[] = [REENTRY_LANES];

/**
 * ⚠️ THE TWO CONTROLS THAT NEED NO BINDING AT ALL, which is not the same as being unbound.
 *
 * `BumperControl` reads the caller's own level and pays from the caller's own score array;
 * `RebounderControl` pays entry zero. Neither reaches for another component, so there is nothing to
 * transcribe — and filing them under "not done yet" would have overstated what is left by two and
 * misdescribed both. The arithmetic below caught the omission, which is what the arithmetic is for.
 */
export const SELF_CONTAINED_CONTROLS: readonly string[] = ['BumperControl', 'RebounderControl'];

/**
 * The controls in `score-table` that reach for something and are NOT transcribed here yet. Not
 * computed — WRITTEN, so that adding a binding means deleting a line from this list and a reader can
 * see the size of what is left without running anything.
 */
export const UNBOUND_CONTROLS: readonly string[] = [
  'LaunchLanesRolloverControl', 'WormHoleControl', 'BoosterTargetControl', 'MedalTargetControl',
  'MultiplierTargetControl', 'FuelSpotTargetControl', 'MissionSpotTargetControl',
  'LeftHazardSpotTargetControl', 'RightHazardSpotTargetControl', 'BumperGroupControl',
  'OutLaneRolloverControl', 'ReturnLaneRolloverControl', 'FlagControl', 'FlipperRebounderControl1',
  'FlipperRebounderControl2', 'LeftKickerControl', 'RightKickerControl', 'LeftKickerGateControl',
  'RightKickerGateControl', 'DeploymentChuteToEscapeChuteOneWayControl',
  'DeploymentChuteToTableOneWayControl', 'DrainBallBlockerControl', 'LaunchRampControl',
  'LaunchRampHoleControl', 'ExtraBallLightControl', 'BonusLaneRolloverControl', 'FuelRollover1Control',
  'FuelRollover2Control', 'FuelRollover3Control', 'FuelRollover4Control', 'FuelRollover5Control',
  'FuelRollover6Control', 'HyperspaceKickOutControl', 'HyperspaceLightGroupControl',
  'LeftFlipperControl', 'RightFlipperControl', 'PlungerControl', 'JackpotLightControl',
  'BonusLightControl', 'MedalLightGroupControl', 'MultiplierLightGroupControl',
  'WormHoleDestinationControl', 'SpaceWarpRolloverControl', 'BlackHoleKickoutControl',
  'GravityWellKickoutControl', 'BallDrainControl', 'SkillShotGate1Control', 'SkillShotGate2Control',
  'SkillShotGate3Control', 'SkillShotGate4Control', 'SkillShotGate5Control', 'SkillShotGate6Control',
  'ShootAgainLightControl', 'EscapeChuteSinkControl',
];
