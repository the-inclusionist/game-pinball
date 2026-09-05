// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/declaration — the seven fields, answered by a pinball table.
//
// ========================= THE CONTRACT WAS NOT DRAWN FOR THIS GENRE =========================
// `core/contract` in the engine was written against tile games, a quiz and a platformer. Its roles are
// `hazard`, `climb`, `water`, `goal`, `gate`, `key`, `structure`, `free`; its topologies are a grid, a
// continuous space and an ordered list. Nothing in it mentions a ball, a flipper or a score.
//
// A pinball answers it anyway, and that is the whole claim being tested here: a genre the contract had
// never seen gets the sonar, the high contrast, the screen reader and the scanning without one line of
// any of them being written. If this declaration had needed the contract widened, the claim would be
// false and this file would say so.
//
// ========================= WHAT EACH FIELD BECOMES =========================
//   · topology  — `continuous`, 183x235, and the UNIT IS THE BALL'S RADIUS. The unit is what gives a
//                 narrator "two steps away", and in a pinball the ball is the only natural ruler.
//   · tick      — `clock`. A pinball does not wait for the player, and that is exactly the bit the
//                 contract says decides whether scanning can wait.
//   · focusOf   — the ball. It is literally where the player is.
//   · roleAt    — what the component under a point is FOR, which is where the interesting work is.
//   · nameAt    — its speakable name, supplied by i18n rather than hard-coded here.
//   · objective — the running mission, as `have` of `need`, read off the counter lamp.
//   · targetsOf — the components the current mission still counts. THIS is what makes the sonar work.
//
// ========================= THE ROLES ARE A JUDGEMENT, AND HERE IT IS =========================
// Two of the eight roles go unused, and that is not a gap: `climb` and `water` are about moving through
// a third dimension and through a fluid, and a pinball has neither. The other six are assigned by what
// a thing does TO THE BALL, never by what it looks like:
//
//   hazard    — the drain and the outlanes. They cost you the ball.
//   goal      — whatever the running mission is counting, and nothing else. A bumper is a goal during
//               the practice mission and furniture during the bug hunt. THE ROLE MOVES WITH THE
//               MISSION, which is the same "state lives in the display" habit the control layer has.
//   gate      — one-ways, gates, the drain blocker: they bar until a condition.
//   key       — what opens something else: the wormhole destination target, the skill-shot gates.
//   structure — walls, flippers, bumpers, rebounders. The furniture of the table.
//   free      — open playfield with nothing on it.
//
// ========================= AND THE HEADING IS THE BALL'S DIRECTION, BUCKETED =========================
// The contract wants one of eight compass points. Table coordinates grow DOWNWARD, so a ball traveling
// toward smaller `y` is heading north — up the table, away from the flippers. A ball that is not moving
// has heading `none`, which is the contract's own answer for "not pointing anywhere".

import type {
  Focus, GameDeclaration, Heading, Objective, Role, Speakable, Spot, Topology,
} from '@the-inclusionist/engine/core/contract.ts';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A component as the accessibility stack needs to see it: where it is, and what it is for. */
export interface DeclaredComponent {
  /** The `.DAT` group name, which is how every other module refers to it. */
  readonly name: string;
  readonly role: Role;
  readonly bounds: Rect;
}

export interface DeclaredBall {
  readonly active: boolean;
  readonly position: Spot;
  readonly direction: { readonly x: number; readonly y: number };
  readonly speed: number;
}

export interface PinballWorld {
  readonly playfield: { readonly width: number; readonly height: number };
  /** The metric of the narration. See this module's header. */
  readonly ballRadius: number;
  readonly balls: readonly DeclaredBall[];
  readonly components: readonly DeclaredComponent[];
  /** Names come from i18n; nothing speakable is written into this module. */
  readonly speak: (componentName: string) => Speakable | null;
  readonly mission: {
    readonly objective: Speakable;
    /** How many qualifying hits the mission has had. */
    readonly have: number;
    /** How many it needs. */
    readonly need: number;
    /** The components it is still counting. Empty is a legitimate answer. */
    readonly targets: readonly string[];
  };
}

const OCTANTS: readonly Heading[] = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'];

/** A direction vector as one of the contract's eight compass points. */
export function headingOf(direction: { x: number; y: number }): Heading {
  if (direction.x === 0 && direction.y === 0) return 'none';
  // `-y` because table coordinates grow downward and the compass does not.
  const octant = Math.round(Math.atan2(-direction.y, direction.x) / (Math.PI / 4));
  return OCTANTS[((octant % 8) + 8) % 8]!;
}

function contains(bounds: Rect, at: Spot): boolean {
  return at.x >= bounds.x && at.x < bounds.x + bounds.width
    && at.y >= bounds.y && at.y < bounds.y + bounds.height;
}

/** The center of a component, which is what a sonar points at. */
export function centerOf(bounds: Rect): Spot {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function createDeclaration(world: PinballWorld): GameDeclaration {
  const componentAt = (at: Spot): DeclaredComponent | undefined => {
    // Later components win, which matches the render order: what is drawn on top is what is there.
    for (let i = world.components.length - 1; i >= 0; i--) {
      const component = world.components[i]!;
      if (contains(component.bounds, at)) return component;
    }
    return undefined;
  };

  const topology: Topology = {
    kind: 'continuous',
    width: world.playfield.width,
    height: world.playfield.height,
    unit: world.ballRadius,
  };

  return {
    topology,
    // A pinball never waits for the player.
    tick: 'clock',

    roleAt(at: Spot): Role {
      const component = componentAt(at);
      if (!component) return 'free';
      // The mission's own targets are the goal, whatever they are the rest of the time.
      if (world.mission.targets.includes(component.name)) return 'goal';
      return component.role;
    },

    nameAt(at: Spot): Speakable | null {
      const component = componentAt(at);
      return component ? world.speak(component.name) : null;
    },

    focusOf(playerIndex: number): Focus | null {
      const ball = world.balls.find((b) => b.active);
      if (!ball) return null;
      return {
        id: `ball-${playerIndex}`,
        at: ball.position,
        heading: ball.speed === 0 ? 'none' : headingOf(ball.direction),
      };
    },

    objectiveOf(): Objective {
      return {
        name: world.mission.objective,
        have: world.mission.have,
        need: world.mission.need,
      };
    },

    targetsOf(): readonly Spot[] {
      const wanted = new Set(world.mission.targets);
      return world.components
        .filter((c) => wanted.has(c.name))
        .map((c) => centerOf(c.bounds));
    },
  };
}
