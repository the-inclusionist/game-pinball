// SPDX-License-Identifier: AGPL-3.0-or-later
// table/sound-id — one rule about the archive's sound indices.

/** Where a component's own sound goes. The id is the archive's, not a role name. */
export interface SoundSink {
  play(soundId: number, source: unknown): void;
}

/**
 * `loader::play_sound`, whose first line is `if (soundIndex <= 0) return 0.0`.
 *
 * ⚠️ ZERO IS SILENCE, AND THE ARCHIVE USES IT. `v_gate1` and `v_gate2` carry no sound records at all,
 * so both of their indices read zero — and a component guarding only on `undefined` would ask the
 * mixer for sound number zero on every open and shut. The mixer has no such sound, so nothing would be
 * heard and nothing would be reported: a lookup that silently finds nothing looks exactly like a
 * component the table meant to keep quiet.
 *
 * The rule belongs in one place because it belongs to the FILE, not to any one component: every
 * `SoundIndex` in every record is read the same way.
 */
export function playSoundId(
  sound: SoundSink | undefined, soundId: number | undefined, source: unknown,
): void {
  if (sound === undefined || soundId === undefined || soundId <= 0) return;
  sound.play(soundId, source);
}
