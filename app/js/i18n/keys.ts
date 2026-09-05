// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/keys — from the original's resource identifiers to ours.
//
// ========================= THE IDENTIFIERS ARE FAITHFUL, THE WORDS ARE NOT =========================
// `control/mission-table` carries `STRING208`, `STRING179` and thirty-three others, because those are
// what the original's controllers name and transcribing them is what makes the table checkable against
// the C++. What those numbers pointed AT is Microsoft's text, and this repository does not carry it.
//
// So the numbers are kept as the join, and this table maps each one to a key of ours. Everything a
// player reads is written for this project, in `i18n/pt`, `i18n/en` and `i18n/es`. A translator never
// sees `STRING208`; a reader of the mission table never sees a sentence.
//
// ========================= AND TWO MISSIONS SHARE A KEY, BECAUSE THEY SHARE A SENTENCE =========================
// `STRING208` is the running text of both the practice mission and Alien Menace part two: the same
// bumpers, the same instruction, one line in the original. That survives here — both map to
// `pinball.mission.bumpers.run` — and a test checks the two are still the same key, because if they
// ever diverge it should be a decision and not a slip.
//
// ========================= THE COLUMN IS SIXTY-THREE PIXELS WIDE =========================
// ADR-0002 put the hint and the mission text in a 63-pixel column: roughly fifteen characters a line
// over four lines. These strings are written short on purpose, and that is the HUD decision arriving as
// a writing constraint rather than as a truncation bug. A test holds them to it.

/** The original's identifier, and the key this project reads instead. */
export const RESOURCE_KEYS: Readonly<Record<string, string>> = {
  // Shared by the practice mission and Alien Menace part two — see this module's header.
  // ⚠️ SHOWN WHEN THE REENTRY LANES COMPLETE AND THE BUMPERS GO UP A LEVEL. Missing until the binding
  // for that chain was transcribed and a test asked whether the line it names can be shown — the same
  // gap that once put `STRING151` on screen.
  STRING106: 'pinball.event.attackBumpersRaised',
  // ⚠️ THE LAUNCH LANES' TWIN, AND A DIFFERENT LINE ON PURPOSE. Two sets of bumpers rise from two sets
  // of lanes, and one message for both would leave the player unable to tell which work they had just
  // finished. The gate that walks every binding found this one missing the moment the second chain was
  // transcribed, which is what walking them all is for.
  STRING107: 'pinball.event.launchBumpersRaised',
  // ⚠️ SHOWN BY ALL SIX FUEL ROLLOVERS, WHICH SHARE ONE LINE IN THE ORIGINAL. The tank has six
  // segments and one message: the player learns where they are from the lamps, not from the text.
  STRING145: 'pinball.event.refuel',
  // ⚠️ THE OUT LANE'S CONSOLATION, and the only line in the game that announces a ball being given.
  STRING110: 'pinball.event.extraBall',
  // The bonus lane's payout, which carries the amount. The original formats an int into it.
  STRING104: 'pinball.award.bonusCollected',
  // The medal bank's three rungs. The third is an extra ball rather than a score.
  STRING154: 'pinball.award.medal1',
  STRING155: 'pinball.award.medal2',
  STRING156: 'pinball.award.medal3',
  // ⚠️ THE MULTIPLIER'S FOUR RUNGS ARE 2, 3, 5 AND 10, not 2, 3, 4, 5. `SCORE_MULTIPLIERS` is
  // `[1, 2, 3, 5, 10]` and the lamp count indexes it, so the third completion is worth FIVE times and
  // naming these `multiplier4` would put a number on screen the table never pays.
  STRING157: 'pinball.award.multiplier2',
  STRING158: 'pinball.award.multiplier3',
  STRING159: 'pinball.award.multiplier5',
  STRING160: 'pinball.award.multiplier10',
  STRING208: 'pinball.mission.bumpers.run',
  STRING209: 'pinball.mission.practice.done',
  STRING231: 'pinball.mission.alienMenace2.done',

  STRING211: 'pinball.mission.launchTraining.run',
  STRING212: 'pinball.mission.launchTraining.done',
  STRING213: 'pinball.mission.reentryTraining.run',
  STRING214: 'pinball.mission.reentryTraining.done',
  STRING215: 'pinball.mission.science.run',
  STRING216: 'pinball.mission.science.done',
  STRING226: 'pinball.mission.bugHunt.run',
  STRING227: 'pinball.mission.bugHunt.done',
  STRING233: 'pinball.mission.satellite.run',
  STRING234: 'pinball.mission.satellite.done',
  STRING235: 'pinball.mission.recon.run',
  STRING237: 'pinball.mission.recon.done',
  STRING238: 'pinball.mission.doomsday.run',
  STRING239: 'pinball.mission.doomsday.done',
  STRING240: 'pinball.mission.plague.run',
  STRING241: 'pinball.mission.plague2.run',
  STRING242: 'pinball.mission.plague2.done',
  STRING243: 'pinball.mission.secretYellow.run',
  STRING244: 'pinball.mission.secretRed.run',
  STRING245: 'pinball.mission.secretGreen.run',
  STRING246: 'pinball.mission.secretGreen.done',
  STRING247: 'pinball.mission.timeWarp.run',

  STRING249: 'pinball.mission.maelstrom1.run',
  STRING250: 'pinball.mission.maelstrom2.run',
  STRING251: 'pinball.mission.maelstrom3.run',
  STRING252: 'pinball.mission.maelstrom4.run',
  STRING253: 'pinball.mission.maelstrom5.run',
  STRING254: 'pinball.mission.maelstrom6.run',
  STRING255: 'pinball.mission.maelstrom7.run',
  STRING256: 'pinball.mission.maelstrom8.run',
  STRING149: 'pinball.mission.maelstrom8.info',

  /** The shared "you scored N" line, which nearly every rewarded mission names. */
  STRING179: 'pinball.award.scored',

  /* ===================== THE NINE MISSIONS WITH THEIR OWN SHAPE ===================== */
  //
  // ⚠️ ADDED AFTER A REAL BOOT PUT `STRING151` ON THE SCREEN. The map held only the ids
  // `MISSION_TABLE` names, and the very first thing the game says — "waiting for deployment" — belongs
  // to a mission that is not in it. See `MISSION_TEXT_IDS` in `control/mission-table` for the table
  // that now covers all thirty-three, and the test that walks it.
  STRING151: 'pinball.mission.waiting.run',
  STRING178: 'pinball.mission.select.run',
  STRING275: 'pinball.mission.alienMenace.run',
  STRING272: 'pinball.mission.gameOver.run',

  // The two-stage missions: first stage, second stage, completion.
  STRING218: 'pinball.mission.strayComet.run',
  STRING219: 'pinball.mission.strayComet.stage2',
  STRING220: 'pinball.mission.strayComet.done',
  STRING223: 'pinball.mission.blackHole.run',
  STRING224: 'pinball.mission.blackHole.stage2',
  STRING225: 'pinball.mission.blackHole.done',
  STRING276: 'pinball.mission.radiation.run',
  STRING221: 'pinball.mission.radiation.stage2',
  STRING222: 'pinball.mission.radiation.done',
  STRING228: 'pinball.mission.rescue.run',
  STRING229: 'pinball.mission.rescue.stage2',
  STRING230: 'pinball.mission.rescue.done',

  // Time warp part two, whose two halves pull in opposite directions.
  STRING248: 'pinball.mission.timeWarp2.run',
  STRING147: 'pinball.mission.timeWarp2.promoted',
  STRING148: 'pinball.mission.timeWarp2.demoted',
};

/** The key a resource identifier resolves to, or the identifier itself when nothing is mapped. */
export function keyOf(resourceId: string): string {
  return RESOURCE_KEYS[resourceId] ?? resourceId;
}
