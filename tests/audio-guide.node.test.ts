// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of audio/guide — the CONTINUOUS sound guide (engine #84 item 2, engine ADR-0105), node project.
//
// ========================= WHERE THESE CASES CAME FROM =========================
// They are `game-platformer`'s `tests/audio-guide.node.test.js` (its commit 69d2a06), which are the engine's guide cases
// moved with the guide (engine ADR-0257). The claims are the same, with the engine's SONAR as a double of its three
// answers (`playerCtx`, `panFor`, `needsAudioCues`) — this file tests the guide and not the sonar.
//
// ⚠️ WHAT IS DIFFERENT HERE IS THE MIXER, AND IT IS THE ENGINE'S DOING. The engine is removing its `guide` category, so
// this game's copy asks no category anything: the cases that switched the category off became cases about the game's
// SOUND switch, and one case holds that the guide plays straight into the destination rather than into a bus.
//
// ========================= THE FAKE AUDIO CONTEXT =========================
// ⚠️ IT HAS TO EXIST: a continuous presence is a GRAPH that stays — `createOscillator` + `createBiquadFilter` +
// `createGain` — and those nodes are what the cases below question.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { rotaAte } from '@the-inclusionist/engine/core/route.js';
import { distance, type Role, type Spot, type Topology } from '@the-inclusionist/engine/core/contract.js';
import {
  createAudioGuide, GUIDE_WAVE, GUIDE_VOL, FRAMES_BETWEEN_ROUTES, type AudioGuideCtx, type GuidePlayer,
} from '../app/js/audio/guide.js';
import { FAR_CUT, NEAR_CUT } from '../app/js/audio/guide-intensity.js';

interface FakeParam { value: number; targets: number[]; setTargetAtTime(v: number): void }
interface FakeNode { _name: string; connect?: (n: FakeNode) => FakeNode }
interface FakeOsc extends FakeNode { type: string; frequency: FakeParam; starts: number; stoppedAt: number | null; start(): void; stop(t: number): void }
interface FakeFilter extends FakeNode { type: string; frequency: FakeParam }
interface FakeGain extends FakeNode { gain: FakeParam }
interface FakePanner extends FakeNode { pan: FakeParam }

function param(): FakeParam {
  return { value: 0, targets: [], setTargetAtTime(v: number) { this.value = v; this.targets.push(v); } };
}

function fakeAC() {
  const oscillators: FakeOsc[] = [], filters: FakeFilter[] = [], gains: FakeGain[] = [], panners: FakePanner[] = [];
  const links: { from: FakeNode; to: FakeNode }[] = [];
  const link = (self: FakeNode) => (n: FakeNode) => { links.push({ from: self, to: n }); return n; };
  const destination: FakeNode = { _name: 'destination' };
  const ac = {
    currentTime: 0,
    destination,
    createOscillator(): FakeOsc {
      const o: FakeOsc = {
        _name: 'osc', type: '', frequency: param(), starts: 0, stoppedAt: null,
        start() { o.starts++; }, stop(t: number) { o.stoppedAt = t; },
      };
      o.connect = link(o); oscillators.push(o); return o;
    },
    createBiquadFilter(): FakeFilter { const f: FakeFilter = { _name: 'filter', type: '', frequency: param() }; f.connect = link(f); filters.push(f); return f; },
    createGain(): FakeGain { const g: FakeGain = { _name: 'gain', gain: param() }; g.connect = link(g); gains.push(g); return g; },
    createStereoPanner(): FakePanner { const p: FakePanner = { _name: 'panner', pan: param() }; p.connect = link(p); panners.push(p); return p; },
  };
  return { ac, oscillators, filters, gains, panners, links, destination };
}

/**
 * A pinball-shaped space: continuous, and the unit is the ball's radius (see `shell/declaration`). `STEP` is named so the
 * distances below read in steps.
 */
const STEP = 4;
const CONTINUOUS: Topology = { kind: 'continuous', size: [183, 235], unit: STEP, move: 'free', frame: 'compass' };

interface Over {
  topology?: Topology;
  targets?: Spot[];
  targetsOf?: (i: number) => Spot[];
  roleAt?: (at: Spot) => Role;
  getVolume?: () => number;
  players?: (GuidePlayer & { seesLittle?: boolean })[];
  soundOn?: () => boolean;
  noContext?: boolean;
  playerCtx?: (pl: GuidePlayer) => { ac: AudioContext; out: GainNode } | null;
}

/**
 * THE SONAR'S THREE ANSWERS, played by a double. `panFor` is the sonar's own rule on this ruler — eleven steps saturate
 * the stereo — and `needsAudioCues` stands for «blind mode, or impaired sight» with one flag on the player.
 */
function sonarDouble(over: Over): AudioGuideCtx['sonar'] {
  return {
    playerCtx: (p) => (over.playerCtx ? over.playerCtx(p) : null),
    panFor: (wx, p) => Math.max(-1, Math.min(1, (wx - p.x) / (11 * STEP))),
    needsAudioCues: (p) => !!(p as { seesLittle?: boolean }).seesLittle,
  };
}

function setup(over: Over = {}) {
  const f = fakeAC();
  const ctx: AudioGuideCtx = {
    sonar: sonarDouble(over),
    topology: () => over.topology || CONTINUOUS,
    targetsOf: (i) => (over.targetsOf ? over.targetsOf(i) : (over.targets || [])),
    // `roleAt` OMITTED by default: the guide must keep working without it — the straight line.
    ...(over.roleAt ? { roleAt: over.roleAt } : {}),
    ...(over.getVolume ? { getVolume: over.getVolume } : {}),
    getPlayers: () => over.players || [],
    getAudioCtx: () => (over.noContext ? null : f.ac as unknown as AudioContext),
    getSoundOn: () => (over.soundOn ? over.soundOn() : true),
  };
  return { guide: createAudioGuide(ctx), ...f };
}

/** Runs `n` frames, advancing the clock as a real game would. */
function frames(g: ReturnType<typeof setup>, n: number): void {
  for (let i = 0; i < n; i++) { g.ac.currentTime += 1 / 60; g.guide.updateGuide(); }
}

const pl = (o: Partial<GuidePlayer & { seesLittle: boolean }> = {}) => ({ x: 32, y: 32, seesLittle: true, i: 0, ...o });

describe('audio/guide · the CONTINUOUS presence (#84 item 2)', () => {
  it('⚠️ [Right] THE BEEP IS DEAD: ONE oscillator, started once, that never stops by itself', () => {
    // THE CASE THAT DEFINES THE CHANGE. The old guide created a 0.12 s `triangle` every 48 frames and threw it away. The
    // Dev's verdict: «um ping é a pior escolha possível, tenebroso para quem tem TEA».
    const g = setup({ players: [pl()], targets: [{ x: 60, y: 32 }] });
    frames(g, 120);
    expect(g.oscillators.length, 'more than one oscillator was born — it fires again').toBe(1);
    expect(g.oscillators[0]!.starts).toBe(1);
    expect(g.oscillators[0]!.stoppedAt, 'the guide stopped by itself: a sound with an end is a beep').toBe(null);
    expect(g.guide.guideCount).toBe(120); // counts FRAMES that sound, not beeps
  });

  it('⚠️ [Right] the timbre has HARMONICS and the filter is a low-pass — without that the brightness axis does not exist', () => {
    const g = setup({ players: [pl()], targets: [{ x: 60, y: 32 }] });
    frames(g, FRAMES_BETWEEN_ROUTES);
    expect(g.oscillators[0]!.type).toBe('sawtooth');
    expect(GUIDE_WAVE, 'a sine has nothing to filter').not.toBe('sine');
    expect(g.filters[0]!.type).toBe('lowpass');
  });

  it('⚠️ [Right] coming closer OPENS the filter; moving away closes it, and neither is silence', () => {
    const near = setup({ players: [pl()], targets: [{ x: 32 + STEP, y: 32 }] });      // 1 step
    const far = setup({ players: [pl()], targets: [{ x: 32 + 20 * STEP, y: 32 }] });  // 20 steps
    frames(near, FRAMES_BETWEEN_ROUTES + 2);
    frames(far, FRAMES_BETWEEN_ROUTES + 2);
    expect(near.filters[0]!.frequency.value).toBeGreaterThan(far.filters[0]!.frequency.value);
    expect(near.gains[0]!.gain.value).toBeGreaterThan(far.gains[0]!.gain.value);
    // ⚠️ AND FAR IS NOT SILENCE. If it were, far would be indistinguishable from no target.
    expect(far.gains[0]!.gain.value, 'the guide went silent far away').toBeGreaterThan(0);
    expect(far.filters[0]!.frequency.value).toBeGreaterThanOrEqual(FAR_CUT);
    expect(near.filters[0]!.frequency.value).toBeLessThanOrEqual(NEAR_CUT);
  });

  it('⚠️ [Interface] NO MIXER BUS: the graph ends in the context\'s destination', () => {
    // The engine is removing its `guide` category, and this copy asks it nothing — so the only place left to play into
    // is the destination, as the platformer's copy does. A bus reached by any other road would be a dependency on the
    // category that is leaving.
    const g = setup({ players: [pl()], targets: [{ x: 60, y: 32 }] });
    frames(g, 2);
    const last = g.links.filter((l) => l.from === g.panners[0]);
    expect(last.map((l) => l.to), 'the pan does not end in the destination').toEqual([g.destination]);
  });

  it('[Interface] a child\'s OWN device carries the guide, and the shared context builds nothing', () => {
    const own = fakeAC();
    const out = own.ac.createGain();
    const g = setup({
      players: [pl()], targets: [{ x: 60, y: 32 }],
      playerCtx: () => ({ ac: own.ac as unknown as AudioContext, out: out as unknown as GainNode }),
    });
    frames(g, 2);
    expect(g.oscillators.length, 'the guide was built on the shared context').toBe(0);
    expect(own.oscillators.length).toBe(1);
    expect(own.links.some((l) => l.from === own.panners[0] && l.to === out), 'it does not reach the child\'s device').toBe(true);
  });

  it('[Zero] a player who sees gets no guide, even with a target beside them', () => {
    const g = setup({ players: [pl({ seesLittle: false })], targets: [{ x: 40, y: 32 }] });
    frames(g, 60);
    expect(g.oscillators.length).toBe(0);
    expect(g.guide.guideCount).toBe(0);
  });

  it('⚠️ [Zero] WITHOUT A TARGET the guide does not even light — its first writing lit it 60 times a second', () => {
    // Silence is the ONLY statement the guide can make, and it means there is no target. Lighting first and asking after
    // created and destroyed sixty oscillators per second, inaudible and costly.
    const g = setup({ players: [pl()], targets: [] });
    frames(g, 60);
    expect(g.oscillators.length, 'a graph was lit with nothing to point at').toBe(0);
    expect(g.guide.guideCount).toBe(0);
  });

  it('⚠️ [Interface] the target VANISHING midway puts the graph out — the mission\'s last target quiets the guide', () => {
    let targets: Spot[] = [{ x: 60, y: 32 }];
    const g = setup({ players: [pl()], targetsOf: () => targets });
    frames(g, FRAMES_BETWEEN_ROUTES + 2);
    expect(g.oscillators.length).toBe(1);
    expect(g.oscillators[0]!.stoppedAt).toBe(null);
    targets = [];
    frames(g, FRAMES_BETWEEN_ROUTES + 1);
    expect(g.oscillators[0]!.stoppedAt, 'the target left and the guide kept pointing at it').not.toBe(null);
    expect(g.oscillators.length, 'it put one out and lit another — the loop spins again').toBe(1);
  });

  it('⚠️ [Interface] switching the game\'s sound off MIDWAY puts the graph out — a sound that stays is a sound that leaks', () => {
    let on = true;
    const g = setup({ players: [pl()], targets: [{ x: 60, y: 32 }], soundOn: () => on });
    frames(g, 30);
    expect(g.oscillators[0]!.stoppedAt).toBe(null);
    on = false;
    frames(g, 2);
    expect(g.oscillators[0]!.stoppedAt, 'the sound went off and the oscillator stayed alive').not.toBe(null);
  });

  it('[Interface] the MASTER volume multiplies the guide, and does not unplug it from the graph', () => {
    const g = setup({ players: [pl()], targets: [{ x: 48, y: 32 }], getVolume: () => 0 });
    frames(g, FRAMES_BETWEEN_ROUTES + 2);
    expect(g.gains[0]!.gain.value).toBe(0);
    expect(g.oscillators[0]!.stoppedAt, 'lowering the volume killed the graph instead of quieting it').toBe(null);
  });

  it('🔴 [Zero] the game\'s sound off: no graph is built, and nothing throws', () => {
    const g = setup({ players: [pl()], targets: [{ x: 48, y: 32 }], soundOn: () => false });
    expect(() => frames(g, 30)).not.toThrow();
    expect(g.oscillators.length).toBe(0);
    expect(g.guide.guideCount).toBe(0);
  });

  it('🔴 [Zero] before the engine\'s audio has started, nothing is built — not even on a child\'s own device', () => {
    // The engine's context exists only after a gesture (`ensureAC`). The guide waits for it even when this child has a
    // device of their own, which is what the engine's guide did; without the question it would light on that device
    // before the game's own sound could play.
    const own = fakeAC();
    const out = own.ac.createGain();
    const g = setup({
      noContext: true, players: [pl()], targets: [{ x: 48, y: 32 }],
      playerCtx: () => ({ ac: own.ac as unknown as AudioContext, out: out as unknown as GainNode }),
    });
    expect(() => frames(g, 30)).not.toThrow();
    expect(own.oscillators.length, 'the guide lit before the engine\'s audio started').toBe(0);
    expect(g.guide.guideCount).toBe(0);
  });

  it('⚠️ [Error] a device that refuses to build the graph leaves the guide off, and the frame goes on', () => {
    const g = setup({ players: [pl()], targets: [{ x: 48, y: 32 }] });
    g.ac.createOscillator = () => { throw new Error('no oscillator on this device'); };
    expect(() => frames(g, 30)).not.toThrow();
    expect(g.guide.guideCount).toBe(0);
  });

  it('🔴 [Right] the route is measured every FRAMES_BETWEEN_ROUTES frames — no sooner, no later — and the pan follows it', () => {
    let targets: Spot[] = [{ x: 32 + 4 * STEP, y: 32 }];                    // to the right
    const g = setup({ players: [pl()], targetsOf: () => targets });
    frames(g, 1);                                                            // the first frame measures
    expect(g.panners[0]!.pan.value, 'the pan does not say the target is to the right').toBeGreaterThan(0);
    targets = [{ x: 32 - 4 * STEP, y: 32 }];                                 // it moves to the left
    frames(g, FRAMES_BETWEEN_ROUTES - 1);
    expect(g.panners[0]!.pan.value, 'the route was measured before its cadence').toBeGreaterThan(0);
    frames(g, 1);
    expect(g.panners[0]!.pan.value, 'the route was not measured on its cadence').toBeLessThan(0);
  });

  it('[Simple] the base gain is LOWER than the beep it replaced', () => {
    // A sound that never stops is perceived as louder than a transient of the same peak. The beep used 0.11.
    expect(GUIDE_VOL).toBeLessThan(0.11);
    expect(GUIDE_VOL, 'the volume floor cannot be zero').toBeGreaterThan(0);
  });
});

describe('audio/guide · the route, when the game allows it (#84 item 2)', () => {
  // A 20×20 grid with a vertical WALL at x = 5, open only at y = 19. The target is just on the other side: in a straight
  // line that is 2 cells; on foot it is many, because one must go down, round and back.
  // `structure` is what a pinball's walls declare, and the route does not cross it (`core/route`'s traversable roles).
  const WALL = (at: Spot): Role => (at.x === 5 && at.y !== 19 ? 'structure' : 'free');
  const ORTHO_GRID: Topology = { kind: 'grid', size: [20, 20], move: 'orthogonal', frame: 'compass' };

  it('⚠️ [Right] with `roleAt`, the distance is the one the ball TRAVELS — not the straight line through the wall', () => {
    const withRoute = setup({ topology: ORTHO_GRID, roleAt: WALL, players: [pl({ x: 4, y: 0 })], targets: [{ x: 6, y: 0 }] });
    const withoutRoute = setup({ topology: ORTHO_GRID, players: [pl({ x: 4, y: 0 })], targets: [{ x: 6, y: 0 }] });
    frames(withRoute, FRAMES_BETWEEN_ROUTES + 2);
    frames(withoutRoute, FRAMES_BETWEEN_ROUTES + 2);
    // The straight line says 2 cells and opens the filter almost fully; the route knows about the wall and keeps it closed.
    expect(
      withRoute.filters[0]!.frequency.value,
      'the route was not used: the guide says «almost there» of a target behind a wall',
    ).toBeLessThan(withoutRoute.filters[0]!.frequency.value);
  });

  it('⚠️ [Interface] the TWO distances are already in the same unit: steps', () => {
    // It is the assertion that prevents the extra conversion. `distance()` divides by `unit` in the continuous branch, and
    // the route counts steps by definition — dividing again by the world's step would put the guide at full brightness.
    const route = rotaAte({ topology: ORTHO_GRID, roleAt: () => 'free' }, { x: 0, y: 0 }, [{ x: 7, y: 0 }]);
    expect(route!.passos).toBe(distance(ORTHO_GRID, { x: 0, y: 0 }, { x: 7, y: 0 }));
    // And with a wall the route is STRICTLY longer — never shorter than the straight line.
    const detour = rotaAte({ topology: ORTHO_GRID, roleAt: WALL }, { x: 4, y: 0 }, [{ x: 6, y: 0 }]);
    expect(detour!.passos).toBeGreaterThan(distance(ORTHO_GRID, { x: 4, y: 0 }, { x: 6, y: 0 }));
  });
});

// ========================= MUTATIONS CHECKED =========================
// Run on 2026-09-27 in this repository, each alone, with an occurrence count and the source restored from a copy — all red:
//   · M1 the graph not kept on the player (`return startGuide(pl)`) → FIVE fail: THE BEEP IS DEAD (an oscillator per
//     frame), the child's own device, the vanishing target and sound-off teardowns, and the cadence case.
//   · M2 `GUIDE_WAVE` from `sawtooth` to `sine` → the harmonics case. The main axis would die silently.
//   · M3 no `stopGuide(pl)` when the guide cannot be heard → the sound-off-midway case: a sound that lasts leaks.
//   · M4 `if (roleAt)` → `if (roleAt && false)` → the distance-the-ball-TRAVELS case: «almost there» behind a wall.
//   · M5 `GUIDE_VOL * i.volume * vol` → `GUIDE_VOL * i.volume` → the MASTER-volume case.
//   · M6 no target check before lighting → TWO fail: the no-target-never-lights and the vanishing-target cases.
//   · M7 the game's sound not asked → TWO fail: «the game's sound off» and the sound-off-midway case.
//   · M8 the cadence one frame late (`< FRAMES_BETWEEN_ROUTES + 1`) → the cadence case.
//   · M9 the pan never measured → the cadence-and-pan case.
//   · M10 a refusing device rethrown instead of leaving the guide off → the [Error] case.
//   · M11 `framesSinceRoute` born at 0 instead of the ceiling → the cadence case (the first frame no longer measures).
//   · M12 the output into a gain of its own instead of the destination → NO MIXER BUS.
//   · M13 `GUIDE_VOL` at 0.12 → the [Simple] base-gain case.
//   · M14 the child's own device ignored for the context (`const ac = ctx.getAudioCtx()`) → the own-device case.
//   · M15 `needsAudioCues` not asked → a player who sees gets a guide.
//   · M16 the engine's context not asked in `guideAudible` → the before-the-audio-started case.
//   · E1 the INSTALLED ENGINE's route counting `(steps + 1) * 16` (in `node_modules`, restored after) → the same-unit case.
//     It guards a premise the guide takes from the engine, so only a mutation of the engine can redden it.
// The wiring in `main.ts` is held by `tests/accessibility.browser` — see the list at the end of that file.
