// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { conformanceProblems } from '@the-inclusionist/engine/core/contract.ts';
import {
  bootPinball, createPinballOptions, createPinballWorld, pinballDeclines, REQUIRED_MARKUP,
  type BootOptions, type LiveTable, type PinballGameOptions,
} from '../app/js/shell/boot.js';

function table(over: Partial<LiveTable> = {}): LiveTable {
  return {
    playfieldWidth: 183,
    playfieldHeight: 235,
    ballRadius: 3,
    balls: [{ active: true, position: { x: 90, y: 200 }, direction: { x: 0, y: -1 }, speed: 4 }],
    components: [
      { name: 'drain', role: 'hazard', bounds: { x: 80, y: 225, width: 20, height: 10 } },
      { name: 'bump1', role: 'structure', bounds: { x: 40, y: 60, width: 10, height: 10 } },
    ],
    missionTextId: 'STRING208',
    missionHave: 3,
    missionNeed: 8,
    missionTargets: ['bump1'],
    ...over,
  };
}

const host = { doc: {} as Document, win: {} as Window };

function options(over: Partial<BootOptions> = {}): BootOptions {
  return { locale: 'pt', table: table(), host, phase: () => 'playing', ...over };
}

/** Stands in for the engine's `createGame`, which the entry point supplies for real. */
const fakeEngine = (problems: readonly string[] = []) =>
  (o: PinballGameOptions) => ({ problems, received: o });

describe('the world the declaration reads is LIVE, not a copy', () => {
  test('REPLACING the ball list changes what the declaration answers', () => {
    // The point of getters, and the reason this replaces the array rather than editing it in place: a
    // copied reference would still see an edit through the same array, so only a REPLACEMENT tells a
    // view apart from a snapshot. A snapshot would have the sonar point at where the ball was.
    let balls = table().balls;
    const mutable: LiveTable = { ...table(), get balls() { return balls; } };
    const world = createPinballWorld(mutable, 'pt');

    expect(world.balls[0]!.position.y).toBe(200);
    balls = [{ active: true, position: { x: 90, y: 40 }, direction: { x: 0, y: -1 }, speed: 4 }];

    expect(world.balls[0]!.position.y).toBe(40);
  });

  test('and so does replacing the component list', () => {
    let components = table().components;
    const mutable: LiveTable = { ...table(), get components() { return components; } };
    const world = createPinballWorld(mutable, 'pt');

    expect(world.components).toHaveLength(2);
    components = [];

    expect(world.components).toHaveLength(0);
  });

  test('the mission text is TRANSLATED and counts down', () => {
    const world = createPinballWorld(table(), 'pt');

    // 8 needed, 3 had: five to go.
    expect(world.mission.objective.text).toContain('5');
    expect(world.mission.objective.text).not.toContain('STRING208');
  });

  test('the same table in another locale says it in that language', () => {
    const ptText = createPinballWorld(table(), 'pt').mission.objective.text;
    const enText = createPinballWorld(table(), 'en').mission.objective.text;

    expect(ptText).not.toBe(enText);
    expect(enText).toContain('5');
  });

  test('component names come out spoken, with a gender', () => {
    const world = createPinballWorld(table(), 'pt');

    expect(world.speak('bump1')).toEqual({ text: 'para-choque', gender: 'm', plural: false });
    expect(world.speak('soundwave9')).toBeNull();
  });
});

describe('what is handed to the engine', () => {
  test('the declaration passes the engine’s own conformance check', () => {
    const problems = conformanceProblems(createPinballOptions(options()).declaration);

    expect(problems).toEqual([]);
  });

  test('THIS GAME DECLINES NOTHING', () => {
    // A quiz declines the pause menu and the pad assistant. A pinball has both, so the empty object
    // is the honest answer rather than an oversight.
    expect(pinballDeclines()).toEqual({});
    expect(createPinballOptions(options()).declines).toEqual({});
  });

  test('it is navigable only while PAUSED', () => {
    // The tick belongs to the clock. A ball in play does not wait while somebody walks a menu.
    const playing = createPinballOptions(options({ phase: () => 'playing' }));
    const paused = createPinballOptions(options({ phase: () => 'paused' }));

    expect(playing.isNavigable()).toBe(false);
    expect(paused.isNavigable()).toBe(true);
  });

  test('the phase is asked EVERY time, not read once at boot', () => {
    let phase: 'playing' | 'paused' = 'playing';
    const built = createPinballOptions(options({ phase: () => phase }));

    expect(built.isNavigable()).toBe(false);
    phase = 'paused';

    expect(built.isNavigable()).toBe(true);
  });

  test('blind mode is passed through only when the host offers it', () => {
    expect(createPinballOptions(options()).isBlindMode).toBeUndefined();
    expect(createPinballOptions(options({ isBlindMode: () => true })).isBlindMode?.()).toBe(true);
  });

  test('the markup the engine requires is named, so a host can be checked against it', () => {
    expect(REQUIRED_MARKUP).toEqual(['#game-region', '#sr-status', '#sr-alert']);
  });
});

describe('booting', () => {
  test('what the host failed to provide is handed on, not swallowed', () => {
    const shell = bootPinball(options(), fakeEngine(['#sr-alert missing']));

    expect(shell.problems).toEqual(['#sr-alert missing']);
  });

  test('the caller keeps the engine it handed over, fully typed', () => {
    const shell = bootPinball(options(), (o) => ({ problems: [], received: o }));

    expect(shell.engine.received.declaration).toBe(shell.declaration);
  });

  test('the HUD is laid out for THIS table’s width', () => {
    const shell = bootPinball(options(), fakeEngine());

    expect(shell.hud.playfield.width).toBe(183);
    expect(shell.hud.overlaying).toBe(false);
  });

  test('a table as wide as the screen makes the HUD say it is overlaying', () => {
    const wide = options({ table: table({ playfieldWidth: 320 }) });

    expect(bootPinball(wide, fakeEngine()).hud.overlaying).toBe(true);
  });

  test('the camera starts on the flippers', () => {
    expect(bootPinball(options(), fakeEngine()).camera.offset).toBe(55);
  });
});

describe('⚠️ advance counts FRAMES, not seconds', () => {
  test('one call of sixty frames equals sixty calls of one', () => {
    // The engine's `update(dt)` is in frames and the camera's damping is per frame. Reading it as
    // seconds would make the camera about sixty times too slow, and nothing would error.
    const climbing = table({
      balls: [{ active: true, position: { x: 90, y: 60 }, direction: { x: 0, y: -1 }, speed: 4 }],
    });

    const inOneGo = bootPinball(options({ table: climbing }), fakeEngine());
    const oneByOne = bootPinball(options({ table: climbing }), fakeEngine());

    inOneGo.advance(60);
    for (let i = 0; i < 60; i++) oneByOne.advance(1);

    expect(inOneGo.camera.offset).toBeCloseTo(oneByOne.camera.offset, 9);
  });

  test('a frame actually moves the view when the ball is high', () => {
    const climbing = table({
      balls: [{ active: true, position: { x: 90, y: 60 }, direction: { x: 0, y: -1 }, speed: 4 }],
    });
    const shell = bootPinball(options({ table: climbing }), fakeEngine());

    shell.advance(30);

    expect(shell.camera.offset).toBeLessThan(55);
  });

  test('with no ball in play the view does not drift', () => {
    const shell = bootPinball(options({ table: table({ balls: [] }) }), fakeEngine());

    shell.advance(100);

    expect(shell.camera.offset).toBe(55);
  });

  test('a DRAINED ball does not drag the view, however high it is left', () => {
    // The ball list keeps the ball after it drains, inactive. Taking the first of the list instead of
    // the first ACTIVE one would follow a ball that is no longer in play.
    const drained = table({
      balls: [
        { active: false, position: { x: 90, y: 20 }, direction: { x: 0, y: -1 }, speed: 8 },
      ],
    });
    const shell = bootPinball(options({ table: drained }), fakeEngine());

    shell.advance(60);

    expect(shell.camera.offset).toBe(55);
  });

  test('and with one drained and one live ball, the LIVE one is followed', () => {
    const both = table({
      balls: [
        { active: false, position: { x: 10, y: 230 }, direction: { x: 0, y: 1 }, speed: 8 },
        { active: true, position: { x: 90, y: 40 }, direction: { x: 0, y: -1 }, speed: 4 },
      ],
    });
    const shell = bootPinball(options({ table: both }), fakeEngine());

    shell.advance(60);

    expect(shell.camera.offset).toBeLessThan(55);
  });

  test('the camera reads the ball’s VERTICAL speed, not its total', () => {
    // A ball moving fast sideways and barely upward must not drag the view at its full speed.
    const sideways = table({
      balls: [{ active: true, position: { x: 90, y: 60 }, direction: { x: 1, y: 0 }, speed: 20 }],
    });
    const shell = bootPinball(options({ table: sideways }), fakeEngine());

    shell.advance(30);

    expect(shell.camera.offset).toBe(55);
  });
});
