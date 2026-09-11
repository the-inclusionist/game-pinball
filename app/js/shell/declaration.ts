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
} from '@the-inclusionist/engine/core/contract.js';
import { cabinetKeyboard, cabinetPad } from './cabinet-declaration.js';

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

  /**
   * ⚠️ MIGRATED 2026-09-06: `width`/`height` BECAME `size`, AND TWO FIELDS APPEARED.
   *
   * The engine is linked by `file:` and is in active modularisation, which the plan names as a
   * declared risk — "a engine é alvo móvel... um consumidor externo vai encostar em APIs que ainda
   * mudam". This is the second time it has moved under this game: ADR-0084 turned `topology` from a
   * value into a function, and now `Topology` carries `size`, `move` and `frame`.
   *
   * ⚠️ `move: 'free'` BECAUSE A BALL IS NOT ON A GRID. The engine's own comment records why the field
   * exists: a sliding puzzle where nothing moves diagonally had its sonar UNDER-REPORTING distance by
   * up to twice, because Chebyshev counts a diagonal as one step and the puzzle needs four. In a
   * continuous space with a ball obeying `physics/step`, every direction costs what it measures.
   *
   * ⚠️ `frame: 'compass'` AND NOT `'clock'`, and that is an accessibility choice rather than a taste.
   * The engine's own note: "o relógio pressupõe ler relógio analógico, num público que inclui
   * alfabetização". This game is for school machines and its players are learning to read; "acima à
   * esquerda" needs nothing an eight-year-old has not got, and "às dez horas" needs a skill some of
   * them are still being taught.
   */
  const topology: Topology = {
    kind: 'continuous',
    size: [world.playfield.width, world.playfield.height],
    unit: world.ballRadius,
    move: 'free',
    frame: 'compass',
  };

  return {
    /**
     * ⚠️ A FUNCTION SINCE THE ENGINE'S ADR-0084, AND IT WAS A VALUE HERE. The engine changed under this
     * game — `conformanceProblems` began answering "topology: must be a FUNCTION (it was a value until
     * ADR-0084)" — and the reason it changed is one this table does not have: `game-15puzzle` is 3x3,
     * 4x4 or 5x5, so a memorised topology went stale in silence. A pinball's playfield is one size for
     * the life of the game, so the constant above is still the whole answer and this is the shape the
     * contract now asks it in.
     *
     * The plan called this risk out in one line — "a engine é alvo móvel... um consumidor externo vai
     * encostar em APIs que ainda mudam" — and this is the first time it has cost anything.
     */
    topology: () => topology,

    /**
     * ⚠️ AND `world` IS NEW AND REQUIRED, which the engine's own note explains better than a paraphrase
     * would: blindfold chess exists, so a game with no visible space is not a game where empathy makes
     * no sense — it is one that asks more of whoever writes it. A default would have let forgetting
     * pass as a decision.
     *
     * The pinball's world is the canvas the table is composed onto, which is the element the engine
     * already scales, filters for colour blindness and reads the CRT over. `#game-region` is where the
     * engine mounts and `REQUIRED_MARKUP` in `shell/boot` is what refuses a page without it.
     */
    world: () => ({ kind: 'element', selector: '#game-region' }),

    /**
     * ⚠️ TWO, AND THE COUNT IS THE CRADLE. The engine asks how many positions this game needs HELD AT THE
     * SAME TIME, and in a pinball that is both flippers: a ball held on one paddle while the other one
     * flips is not a trick, it is how the table is played. On a phone that registers two fingers, this is
     * the number that decides whether a child is told so before they start.
     *
     * ⚠️ AND NOT THREE, WHICH IS WHAT COUNTING THE ACTIONS WOULD HAVE GIVEN. `shell/keymap` offers four —
     * `left`, `right`, `plunger`, `pause` — and the plunger is a held charge like the flippers are. But it
     * is only ever drawn back with the ball IN THE LANE, and multiball does not put one there: `main.ts`
     * spawns the extra balls AT THE BALL THAT EARNED THEM. There is no state of this game where the
     * plunger and a flipper have to be held together.
     *
     * The engine's own note is the reason this is a judgement rather than an arithmetic: the platformer
     * declared nine actions against nine on-screen places and its warning never fired, while running,
     * walking and jumping at once were three fingers a two-finger phone does not have.
     */
    holdsAtOnce: () => 2,

    /**
     * ⚠️ YES, AND THIS IS THE FIELD A PINBALL WOULD BE WRONG TO GET WRONG. It decides whether the engine
     * OFFERS latching — press once to hold, press again to release — and that control exists for a child
     * who cannot keep a key pressed. Two things in this game are held: a flipper stays up while its key is
     * down, and the plunger is a CHARGE, where the longer it is held the further the ball goes
     * (`shell/plunger`, written because the Dev asked for exactly that).
     *
     * ⚠️ AND `holdsAtOnce` ABOVE DOES NOT ANSWER IT, which is the engine's own finding: that field counts
     * simultaneous positions and refuses zero, so a quiz that holds nothing still declares one. "One at a
     * time" and "one HELD" are the same number and different questions.
     */
    seguraTeclas: () => true,

    /**
     * ⚠️ NO, AND SAYING SO IS WHAT MAKES THE ENGINE'S `?? false` THIS GAME'S ANSWER RATHER THAN A GUESS.
     *
     * The field is optional where `holdsAtOnce` is mandatory, and the engine's reason for the difference
     * is that this one fails VISIBLY: a drawing game that forgets it "é inoperável no próprio aparelho de
     * quem o escreve". A pinball is two paddles and a plunger — there is no continuous position to aim,
     * and it plays on a machine with no mouse and no touch at all.
     *
     * It is the third axis the reach arithmetic reads, beside `holdsAtOnce` and `seguraTeclas`.
     */
    needsPointer: () => false,

    /**
     * ⚠️ THE CABINET, IN THE ENGINE'S OWN VOCABULARY — and until this line the engine ran on ITS factory.
     *
     * With no declaration `createGame` registers `null`, `initKB()` builds the engine's keyboard, and
     * `resetKB()` — the "restore defaults" a child presses — hands back a layout this game's author did not
     * choose. It was invisible only because the two tables coincide by accident, which `shell/pad`'s header
     * records as DISCOVERED rather than designed.
     *
     * 📏 Measured by mutation: change the plunger from `KeyU` to `KeyP` and, without these two lines, the
     * engine goes on answering `KeyU`. See `shell/cabinet-declaration` for how the mapping is derived from
     * the two tables that already state it, and for the one question it answers itself.
     */
    mapeamentoDoTeclado: cabinetKeyboard,
    mapeamentoDoPad: cabinetPad,

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
