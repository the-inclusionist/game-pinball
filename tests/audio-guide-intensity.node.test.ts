// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GUIDE GROWS MORE INTENSE AS THE BALL GETS CLOSER, AND NEVER GOES SILENT (engine #84 item 2, engine ADR-0105).
//
// Moved with the guide (engine ADR-0257): the same seven claims over the pure mapping, as `game-platformer`'s
// `tests/guide-intensity.node.test.js` makes them (its commit 69d2a06), which are the engine's.
//
// ========================= WHY CONTINUOUS =========================
// No repeating ping — the Dev's verdict: «um ping é a pior escolha possível, tenebroso para quem tem TEA». The guide is a
// continuous presence — nothing fires, the thing just becomes more present.
//
// The axis is BRIGHTNESS, with a small share of volume on top, and the choice is the Dev's. The redundancy is not
// decoration: for a child with hearing loss the brightness may fall in a band they cannot reach, and two axes mean
// neither decides alone.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import {
  guideIntensity, STEPS_TO_FLOOR, FAR_CUT, NEAR_CUT, FAR_VOL,
} from '../app/js/audio/guide-intensity.js';

describe('audio/guide-intensity — distance becomes brightness', () => {
  it('[Right] on the target it opens fully; at the bottom of the scale it closes to the minimum', () => {
    // The two ends are NAMED here as numbers, not read back from the module: a case that compares the curve with the
    // constants it is built from moves with them, and the move of the guide was a copy that could have changed either.
    expect(guideIntensity(0).cutoff).toBeCloseTo(3200, 6);
    expect(guideIntensity(0).volume).toBeCloseTo(1, 6);
    expect(guideIntensity(STEPS_TO_FLOOR).cutoff).toBeCloseTo(320, 6);
    expect(guideIntensity(STEPS_TO_FLOOR).volume).toBeCloseTo(FAR_VOL, 6);
  });

  it('⚠️ [Zero] it NEVER goes mute — far still sounds, and it is the assertion that matters most', () => {
    // If the guide went silent far away, «far» would be indistinguishable from «no target», and the child who depends on
    // it would conclude there is nothing to find exactly when there is and it is far.
    for (const steps of [12, 20, 100, 5000]) {
      expect(guideIntensity(steps).volume, `${steps} steps silenced the guide`).toBeGreaterThanOrEqual(FAR_VOL);
      expect(guideIntensity(steps).cutoff, `${steps} steps closed the filter`).toBeGreaterThanOrEqual(FAR_CUT);
    }
    expect(FAR_VOL, 'the volume floor became zero').toBeGreaterThan(0);
  });

  it('⚠️ [Right] BOTH axes grow together on the way in — neither decides alone', () => {
    const steps = [12, 9, 6, 3, 0];
    const cutoffs = steps.map((p) => guideIntensity(p).cutoff);
    const vols = steps.map((p) => guideIntensity(p).volume);
    for (let i = 1; i < steps.length; i++) {
      expect(cutoffs[i], `the brightness did not rise from ${steps[i - 1]} to ${steps[i]}`).toBeGreaterThan(cutoffs[i - 1]!);
      expect(vols[i], `the volume did not rise from ${steps[i - 1]} to ${steps[i]}`).toBeGreaterThan(vols[i - 1]!);
    }
  });

  it('⚠️ [Boundary] the brightness is EXPONENTIAL: half the distance is not half the way', () => {
    // A linear ramp would open almost everything in the first third of the way and then seem to stall. With a constant
    // ratio, halfway gives the GEOMETRIC MEAN of the ends, noticeably smaller than the arithmetic one.
    const half = guideIntensity(STEPS_TO_FLOOR / 2).cutoff;
    expect(half).toBeCloseTo(Math.sqrt(FAR_CUT * NEAR_CUT), 4);
    expect(half, 'the cutoff became linear').toBeLessThan((FAR_CUT + NEAR_CUT) / 2);
  });

  it('[Boundary] and the VOLUME is linear — the asymmetry is deliberate', () => {
    // If both were exponential they would accelerate at the same point, which is the opposite of having two axes.
    expect(guideIntensity(STEPS_TO_FLOOR / 2).volume).toBeCloseTo((1 + FAR_VOL) / 2, 6);
  });

  it('[Zero] absurd input falls to the bottom of the scale instead of producing NaN', () => {
    for (const bad of [NaN, Infinity, -1, -0.0001]) {
      const i = guideIntensity(bad);
      expect(Number.isFinite(i.cutoff), `${bad} produced a non-finite cutoff`).toBe(true);
      expect(i.volume).toBeCloseTo(FAR_VOL, 6);
    }
  });

  it('⚠️ [Interface] the bottom of the scale is the ruler the sonar already uses', () => {
    // The engine's sonar cuts "very near" at 4 steps and "near" at 9; its pan saturates the stereo at 11. The guide
    // saturates just after. If someone moves this number inside that range, the guide bottoms out while the sonar still
    // says «near».
    expect(STEPS_TO_FLOOR).toBeGreaterThan(9);
    expect(NEAR_CUT, 'above this the timbre hisses, and a hiss draws attention like a beep').toBeLessThanOrEqual(4000);
  });
});

// ========================= MUTATIONS CHECKED =========================
// Run on 2026-09-27 in this repository, each alone, the source restored from a copy after each — all red:
//   · G1 `FAR_VOL = 0` → «it NEVER goes mute». It is the defect that would make «far» sound like «no target».
//   · G2 a linear cutoff (`FAR_CUT + (NEAR_CUT - FAR_CUT) * near`) → the EXPONENTIAL brightness case.
//   · G3 an exponential volume too → «the VOLUME is linear»: the two axes would accelerate at the same point.
//   · G4 no saturation (`Math.min(1, …)` dropped) → «it NEVER goes mute», below the floor beyond twelve steps.
//   · G5 `STEPS_TO_FLOOR = 8` → both axes growing together, and the scale's floor against the sonar's ruler.
//   · G6 the finiteness guard dropped → «absurd input», NaN reaches the cutoff.
//   · G7 `NEAR_CUT = 1600` → «on the target it opens fully». ⚠️ It SURVIVED the first run, when that case compared the
//     curve with `NEAR_CUT` itself — a case reading by the same link as the code. The ends are literals there now.
