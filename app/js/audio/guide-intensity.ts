// SPDX-License-Identifier: AGPL-3.0-or-later
// audio/guide-intensity — HOW NEAR IT SOUNDS, without a beep (engine #84 item 2, engine ADR-0105).
//
// ========================= WHY IT LIVES HERE =========================
// It left the engine with the continuous guide (engine ADR-0257), and this game keeps its own copy by the Dev's order of
// 2026-09-27: «Fica com uma cópia do guia, feito o platformer.» The copy is `game-platformer`'s
// `platform/guide-intensity` (its commit 69d2a06), which is the engine's module translated. The design below is
// unchanged; only where it lives changed.
//
// ========================= WHAT THIS REPLACES =========================
// The guide used to play a beep at a fixed interval, FOREVER, whether or not anything moved. The Dev's verdict: «um ping
// é a pior escolha possível, tenebroso para quem tem TEA». It was not the interval that was wrong — it was the beep.
//
// What replaces it is a CONTINUOUS presence that grows more intense as the ball gets closer to what the mission asks
// for, along the mapped route (the engine's `core/route`). Nothing fires; the sound simply becomes more present.
//
// ========================= THE AXIS IS BRIGHTNESS, AND THE DECISION IS THE DEV'S =========================
// Four axes were put on the table — volume, brightness (filter cutoff), layers and tempo — and the choice was
// **brightness as the main one, with a small share of volume as secondary**:
//
//   · VOLUME ALONE is the axis a child turns down when a sound tires them, and they would lose the whole signal with it;
//     volume change is also the most tiring of the four.
//   · TEMPO reads as HURRY, the opposite of what autism-support mode exists to protect.
//   · LAYERS needs composed material, and the guide synthesizes.
//   · BRIGHTNESS is continuous, and comes from a `BiquadFilter` Web Audio already has.
//
// ⚠️ AND THE SHARE OF VOLUME IS NOT DECORATION: for a child with hearing loss the brightness may fall exactly in the band
// they cannot reach. Two redundant axes mean neither decides alone.
//
// ========================= WHAT THIS MODULE DOES NOT DO =========================
// It plays nothing. It returns two numbers from ONE: how many steps remain along the route. `audio/guide` builds the
// graph and plays them.
//
// A leaf module: it imports nothing.

/** What the guide sounds like, for a given distance. */
export interface Intensity {
  /** The low-pass cutoff, in hertz. Low and muffled far away; open and bright up close. */
  readonly cutoff: number;
  /** A factor on the guide's base gain, between `FAR_VOL` and 1. NEVER zero. */
  readonly volume: number;
}

/**
 * From how many steps on the guide stops getting darker.
 *
 * Twelve, and the number is not new: the engine's sonar cuts "very near" at 4 steps and "near" at 9, and its pan
 * saturates the stereo at 11. The guide saturates just after — fine detail serves whoever is arriving, and beyond that
 * "far" is enough.
 */
export const STEPS_TO_FLOOR = 12;

/** The cutoff at the bottom of the scale: muffled, present, never an alarm sound. */
export const FAR_CUT = 320;
/** The cutoff at the target: open. Above this the timbre starts to hiss, and a hiss draws attention like a beep. */
export const NEAR_CUT = 3200;

/**
 * The lowest volume factor.
 *
 * ⚠️ NEVER ZERO, AND IT IS THE MOST IMPORTANT ASSERTION IN THIS FILE. If the guide went mute far away, "far" would be
 * indistinguishable from "there is no target" — and the child who depends on it would conclude there is nothing to find,
 * exactly when there is and it is distant. Silence is a statement, and here it would be a false one.
 */
export const FAR_VOL = 0.55;

/**
 * The intensity for `stepsAway` steps along the route.
 *
 * ⚠️ THE CUTOFF INTERPOLATES EXPONENTIALLY, not linearly: the ear perceives pitch and brightness as a RATIO, not a
 * difference. A linear ramp from 320 to 3200 would open almost everything in the first third of the way and then seem to
 * stand still — the child would feel the ball had arrived with half the way to go.
 *
 * The volume interpolates LINEARLY, and the asymmetry is deliberate: it is the secondary axis, and an exponential curve
 * there too would make both accelerate at the same point, the opposite of having two axes.
 */
export function guideIntensity(stepsAway: number): Intensity {
  if (!Number.isFinite(stepsAway) || stepsAway < 0) return { cutoff: FAR_CUT, volume: FAR_VOL };
  // 0 = right on the target; 1 = at the bottom of the scale or beyond.
  const far = Math.min(1, stepsAway / STEPS_TO_FLOOR);
  const near = 1 - far;
  return {
    cutoff: FAR_CUT * Math.pow(NEAR_CUT / FAR_CUT, near),
    volume: FAR_VOL + (1 - FAR_VOL) * near,
  };
}
