// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/en — English. Written from `i18n/pt`, which is the base; a missing key falls back to it.
//
// THESE ARE NOT THE ORIGINAL'S WORDS. 3D Pinball's English strings belong to Microsoft and are not
// carried by this repository. Every line here was written for this project from what the mission asks
// the player to do, and being in the original's language does not make it the original's text.
//
// Held to the same 63-pixel column as every other locale — see `i18n/keys`.

const en: Record<string, string> = {
  /* ===================== MISSIONS ===================== */
  'pinball.mission.bumpers.run': 'Hit the bumpers: {n} to go',
  'pinball.mission.practice.done': 'Training complete.',
  'pinball.mission.alienMenace2.done': 'Threat repelled.',

  'pinball.mission.launchTraining.run': 'Take the ramp: {n} to go',
  'pinball.mission.launchTraining.done': 'Launch approved.',
  'pinball.mission.reentryTraining.run': 'Run the lanes: {n} to go',
  'pinball.mission.reentryTraining.done': 'Re-entry approved.',
  'pinball.mission.science.run': 'Research targets: {n} to go',
  'pinball.mission.science.done': 'Research complete.',
  'pinball.mission.bugHunt.run': 'Bug hunt: {n} to go',
  'pinball.mission.bugHunt.done': 'Infestation cleared.',
  'pinball.mission.satellite.run': 'Wake the satellite: {n} to go',
  'pinball.mission.satellite.done': 'Satellite is up.',
  'pinball.mission.recon.run': 'Recon sweep: {n} to go',
  'pinball.mission.recon.done': 'Sector mapped.',
  'pinball.mission.doomsday.run': 'Disarm it: {n} to go',
  'pinball.mission.doomsday.done': 'Machine disarmed.',
  'pinball.mission.plague.run': 'Spin the flags: {n} to go',
  'pinball.mission.plague2.run': 'Take the sample to the lab.',
  'pinball.mission.plague2.done': 'Plague contained.',
  'pinball.mission.secretYellow.run': 'Into the yellow well.',
  'pinball.mission.secretRed.run': 'Into the red well.',
  'pinball.mission.secretGreen.run': 'Into the green well.',
  'pinball.mission.secretGreen.done': 'Secret mission done.',
  'pinball.mission.timeWarp.run': 'Hit the rebounders: {n} to go',

  'pinball.mission.maelstrom1.run': 'Maelstrom: left targets, {n} to go',
  'pinball.mission.maelstrom2.run': 'Maelstrom: right targets, {n} to go',
  'pinball.mission.maelstrom3.run': 'Maelstrom: the lanes, {n} to go',
  'pinball.mission.maelstrom4.run': 'Maelstrom: the fuel roller.',
  'pinball.mission.maelstrom5.run': 'Maelstrom: take the ramp.',
  'pinball.mission.maelstrom6.run': 'Maelstrom: spin the flags.',
  'pinball.mission.maelstrom7.run': 'Maelstrom: any well.',
  'pinball.mission.maelstrom8.run': 'Maelstrom: the last kick.',
  'pinball.mission.maelstrom8.info': 'Hyperspace open.',

  'pinball.mission.waiting.run': 'Pull the plunger to launch.',
  'pinball.mission.select.run': 'Pick a mission on the targets.',
  'pinball.mission.alienMenace.run': 'Raise the bumper level.',
  'pinball.mission.gameOver.run': 'Game over.',
  'pinball.mission.strayComet.run': 'Drop the three right targets.',
  'pinball.mission.strayComet.stage2': 'Now the right kicker.',
  'pinball.mission.strayComet.done': 'Comet deflected.',
  'pinball.mission.blackHole.run': 'Raise bumper five a level.',
  'pinball.mission.blackHole.stage2': 'Now the far kicker.',
  'pinball.mission.blackHole.done': 'Black hole sealed.',
  'pinball.mission.radiation.run': 'Drop the three left targets.',
  'pinball.mission.radiation.stage2': 'Now any well.',
  'pinball.mission.radiation.done': 'Radiation contained.',
  'pinball.mission.rescue.run': 'Hit the left targets.',
  'pinball.mission.rescue.stage2': 'Now the kicker: rescue!',
  'pinball.mission.rescue.done': 'Crew rescued.',
  'pinball.mission.timeWarp2.run': 'Ramp promotes, kicker demotes.',
  'pinball.mission.timeWarp2.promoted': 'Promoted to {rank}.',
  'pinball.mission.timeWarp2.demoted': 'Demoted to {rank}.',

  'pinball.award.scored': '{points} points',

  /* ===================== HUD ===================== */
  'pinball.hud.score': 'Score: {n}',
  'pinball.hud.player': 'Player {n}',
  'pinball.hud.balls': 'Balls: {n}',
  'pinball.hud.gameOver': 'Game over',
  'pinball.hud.shootAgain': 'Shoot again',
  'pinball.hud.waiting': 'Pull the plunger.',
};

export default en;
