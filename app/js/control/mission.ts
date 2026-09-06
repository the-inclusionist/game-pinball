// SPDX-License-Identifier: AGPL-3.0-or-later
// control/mission — the mission state machine. Port of `control::MissionControl`.
//
// ========================= THE CURRENT MISSION IS A LAMP =========================
// `lite198->MessageField` holds which mission is running, 0 to 16, and `MissionControl` switches on it
// to choose one of seventeen controllers. Not a variable, not an enum in a struct: a field on a LAMP.
//
// Together with the rank — which is the count of lit lamps in the middle circle — this is a pattern
// rather than a coincidence. THE STATE LIVES IN THE DISPLAY. There is no model kept beside the view
// and synchronized with it: the view IS the model, and the reason the table can never show something
// the game does not believe is that there is nothing else for it to show.
//
// ========================= A TRANSITION IS: WRITE THE LAMP, THEN RE-ENTER =========================
// Advancing looks like this, and the order is everything:
//
//     lite198->MessageField = 1;
//     MissionControl(ControlMissionComplete, nullptr);
//
// The re-entrant call re-reads the lamp, so the notification is delivered to the NEW controller, not
// the old one. A state machine with no transition table: writing the state and announcing it are the
// same two lines everywhere.
//
// ========================= AND SOME MESSAGES ARE REWRITTEN BEFORE DISPATCH =========================
// A timer expiring ON THE MISSION TEXT BOX becomes `ControlMissionStarted`. So a mission does not begin
// when it is chosen — it begins when its announcement has finished being read. `Resume` is rewritten
// the same way, which is how coming back from a pause restarts the mission cleanly.

import type { ControlContext, ControlledComponent, MessageCode } from './dispatch.js';

/** The codes the mission machine adds on top of the ones components send. */
export type MissionCode =
  | MessageCode
  | 'ControlMissionStarted'
  | 'ControlMissionComplete'
  | 'TLightGroupCountdownEnded'
  | 'TLightGroupToggleSplitIndex'
  | 'Resume';

export const MISSION_COUNT = 17;

/** The seventeen missions, in the order `lite198`'s field selects them. */
export const MISSION_NAMES: readonly string[] = [
  'WaitingDeployment', 'SelectMission', 'PracticeMission', 'LaunchTraining',
  'ReentryTraining', 'ScienceMission', 'StrayComet', 'BlackHoleThreat',
  'SpaceRadiation', 'BugHunt', 'AlienMenace', 'RescueMission',
  'Satellite', 'Reconnaissance', 'DoomsdayMachine', 'CosmicPlague', 'SecretMission',
];

/** The lamp that carries the mission number. Only its message field is used. */
export interface MissionLamp {
  messageField: number;
}

export type MissionController = (
  code: MissionCode,
  caller: ControlledComponent | null,
  ctx: MissionContext,
) => void;

export interface MissionContext extends ControlContext {
  readonly missionLamp: MissionLamp;
  /** Re-enters the machine. This is how a controller announces its own transition. */
  dispatch(code: MissionCode, caller: ControlledComponent | null): void;
  /** The component that shows mission text. Its timeout is what starts a mission. */
  readonly missionTextBox: ControlledComponent;
  showMissionText(text: string, seconds: number): void;
  clearMissionText(): void;
}

export interface MissionMachineOptions {
  readonly missionLamp: MissionLamp;
  /** One per mission index. A missing entry means that mission is not ported yet. */
  readonly controllers: Partial<Record<number, MissionController>>;
  readonly missionTextBox: ControlledComponent;
}

export interface MissionMachine {
  /** The mission running right now, read from the lamp. */
  readonly current: number;
  readonly currentName: string;
  dispatch(code: MissionCode, caller: ControlledComponent | null, ctx: MissionContext): void;
}

export function createMissionMachine(o: MissionMachineOptions): MissionMachine {
  function dispatch(code: MissionCode, caller: ControlledComponent | null, ctx: MissionContext): void {
    let effective = code;

    // THE REWRITES. A mission begins when its announcement has finished being read, not when it is
    // chosen — so the text box's own timeout is what starts it.
    if (code === 'ControlTimerExpired' && caller === o.missionTextBox) {
      effective = 'ControlMissionStarted';
    } else if (code === 'Resume') {
      effective = 'ControlMissionStarted';
    }

    // Read the lamp EVERY time. A controller that transitioned mid-call has already changed it, and
    // the re-entrant dispatch must land on the new one.
    const index = o.missionLamp.messageField;
    o.controllers[index]?.(effective, caller, ctx);
  }

  return {
    get current() { return o.missionLamp.messageField; },
    get currentName() { return MISSION_NAMES[o.missionLamp.messageField] ?? 'Unknown'; },
    dispatch,
  };
}

/* ===================== THE FIRST CONTROLLER ===================== */

export interface WaitingDeploymentOptions {
  /** The two one-ways at the deployment chute. Crossing either starts the game proper. */
  readonly deploymentGates: readonly ControlledComponent[];
  readonly awaitingText: string;
}

/**
 * `WaitingDeploymentController` — mission 0, the state the table sits in before the ball is in play.
 *
 * It shows one line of text forever (`-1` seconds is the original's "until told otherwise") and waits
 * for the ball to cross the deployment chute. Then it writes the lamp and re-enters, which is the
 * whole transition.
 *
 * ⚠️ THE ORIGINAL ALSO CLEARS `control::waiting_deployment_flag`, AND THIS DOES NOT. The flag is a
 * module-level global upstream; nothing in this port reads it, so a setter here would be a value
 * written and never asked for — the kind of object this port removes rather than adds. It is named
 * here so the day something needs it, the omission is a decision on the record and not a gap.
 */
export function makeWaitingDeploymentController(o: WaitingDeploymentOptions): MissionController {
  return (code, caller, ctx) => {
    switch (code) {
      case 'ControlCollision':
        if (caller && o.deploymentGates.includes(caller)) {
          ctx.missionLamp.messageField = 1;
          // Write, THEN announce: the re-entrant call lands on SelectMission, not here.
          ctx.dispatch('ControlMissionComplete', null);
        }
        break;

      case 'ControlMissionComplete':
        ctx.clearMissionText();
        ctx.playMusic('track1');
        break;

      case 'ControlMissionStarted':
        // -1 means "leave it up". The table says "Awaiting Deployment" until something happens.
        ctx.showMissionText(o.awaitingText, -1);
        break;

      default:
        break;
    }
  };
}
