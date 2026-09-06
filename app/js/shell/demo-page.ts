// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/demo-page — the demonstration's own screen: ask for the archive, then show the table.
//
// ========================= A FILE INPUT, AND THAT IS THE WHOLE SECURITY MODEL =========================
// `PINBALL.DAT` is Microsoft's. The demo does not fetch it, does not bundle it and does not look for it
// on a server — it asks, and `<input type="file">` never sends the bytes anywhere. Any arrangement
// where the file arrives over HTTP is a redistribution with extra steps, whoever is hosting.
//
// ========================= AND IT SAYS WHAT IT IS =========================
// Nothing scores, no lamp lights and no mission runs, because the forty `T*` components are not built
// from the archive yet. The screen says so before the player asks, in their own language.

import { createDemo, type Demo } from './demo.js';
import { keyOf } from '../i18n/keys.js';
import { blitView } from '../gfx/table-view.js';
import type { Framebuffer } from '../gfx/framebuffer.js';
import type { Translate } from '../i18n/index.js';

export interface DemoPageOptions {
  readonly doc: Document;
  readonly host: HTMLElement;
  readonly screen: Framebuffer;
  readonly t: Translate;
  /** Called once the archive has been read, so the caller can start driving frames. */
  readonly onReady: (demo: Demo) => void;
  readonly onError: (message: string) => void;
  /** The player's own `PINBALL.MID`, offered after the table has opened. Optional, like the music. */
  readonly onMusic?: (bytes: ArrayBuffer) => boolean;
  /** Every noise the table makes, by voice name. Absent leaves the demonstration silent. */
  readonly onSound?: (name: string) => void;
  /**
   * ⚠️ THE PLAYER'S OWN `SOUND*.WAV`, offered beside the music. The archive names forty-seven of them
   * and holds not one byte; they are Microsoft's like the table and the tune. Answers how many of the
   * table's sounds the files covered, so the panel can say so instead of vanishing on a silent guess.
   */
  readonly onSounds?: (files: readonly File[]) => Promise<SoundsLoaded> | SoundsLoaded;
  /**
   * ⚠️ THE ARCHIVE'S OWN SOUND INDEX, which is a different thing from `onSound`'s role name. A
   * component reports the index of a group in the `.DAT`, and that group names a WAV. The caller plays
   * the file if the player gave it and does nothing if they did not — the role voice covers that case.
   */
  readonly onSoundId?: (id: number) => void;
}

/** What the caller answers after reading the player's WAVs. */
export interface SoundsLoaded {
  readonly loaded: number;
  /**
   * ⚠️ THE COMPONENTS WHOSE SOUND TIMES A HOLE. A missing file among these is not a quieter table, it
   * is a ball that never comes back — `loader::load_sound` stores minus one, and minus one is this
   * game's "never". Empty is the ordinary answer and the player is told when it is not.
   */
  readonly stranding: readonly string[];
}

export interface DemoPage {
  /** The window of the playfield the screen shows, following the ball. */
  blit(demo: Demo): void;
  destroy(): void;
}

/**
 * ⚠️ THE WINDOW FOLLOWS THE BALL AND IS CLAMPED TO THE PICTURE. The playfield is 365x470 and the screen
 * is 320x180, so most of the table is off screen at any moment — which is ADR-0001's decision arriving
 * at the original's own artwork rather than at an authored table.
 */
export function windowFor(
  ball: { x: number; y: number }, picture: { width: number; height: number },
  screen: { width: number; height: number },
): { x: number; y: number } {
  const clamp = (v: number, max: number): number => Math.max(0, Math.min(max, v));
  return {
    x: clamp(Math.floor(ball.x - screen.width / 2), Math.max(0, picture.width - screen.width)),
    y: clamp(Math.floor(ball.y - screen.height / 2), Math.max(0, picture.height - screen.height)),
  };
}

export function mountDemoPage(o: DemoPageOptions): DemoPage {
  const panel = o.doc.createElement('div');
  panel.className = 'pinball-demo';
  Object.assign(panel.style, {
    position: 'absolute', left: '0', top: '0', width: '100%',
    color: '#ffffff', font: '13px/1.4 system-ui, sans-serif',
    background: 'rgba(26, 30, 38, 0.92)', padding: '8px', boxSizing: 'border-box',
  });

  const say = o.doc.createElement('p');
  say.textContent = o.t('pinball.demo.ask');
  say.style.margin = '0 0 6px';

  const caveat = o.doc.createElement('p');
  caveat.textContent = o.t('pinball.demo.caveat');
  Object.assign(caveat.style, { margin: '0 0 6px', opacity: '0.8' });

  const input = o.doc.createElement('input');
  input.type = 'file';
  input.accept = '.dat,.DAT';
  input.setAttribute('aria-label', o.t('pinball.demo.ask'));

  /**
   * ⚠️ A SECOND INPUT, OFFERED AFTER THE TABLE OPENS. The music is a different file — `PINBALL.MID`,
   * Microsoft's like everything else — and asking for both at once would make the music look required.
   * A table with no music is still a table, and the demonstration says so by working without it.
   */
  const musicPanel = o.doc.createElement('div');
  Object.assign(musicPanel.style, {
    position: 'absolute', left: '0', bottom: '0', width: '100%',
    color: '#ffffff', font: '12px/1.3 system-ui, sans-serif',
    background: 'rgba(26, 30, 38, 0.85)', padding: '4px', boxSizing: 'border-box',
  });
  const musicLabel = o.doc.createElement('label');
  musicLabel.textContent = o.t('pinball.demo.music');
  const musicInput = o.doc.createElement('input');
  musicInput.type = 'file';
  musicInput.accept = '.mid,.MID,.midi';
  musicInput.setAttribute('aria-label', o.t('pinball.demo.music'));
  musicInput.addEventListener('change', () => {
    const file = musicInput.files?.[0];
    if (!file || !o.onMusic) return;
    void file.arrayBuffer().then((bytes) => {
      if (o.onMusic!(bytes)) musicPanel.remove();
      else musicLabel.textContent = o.t('pinball.demo.notMidi');
    });
  });
  musicPanel.append(musicLabel, musicInput);

  /**
   * ⚠️ A THIRD OFFER, AND THE ONLY ONE THAT TAKES MANY FILES AT ONCE. Sixty WAVs is not a thing to ask
   * for one at a time, and `multiple` is the difference between a player humouring the demonstration
   * and a player giving up on it.
   */
  const soundsPanel = o.doc.createElement('div');
  Object.assign(soundsPanel.style, {
    position: 'absolute', left: '0', bottom: '22px', width: '100%',
    color: '#ffffff', font: '12px/1.3 system-ui, sans-serif',
    background: 'rgba(26, 30, 38, 0.85)', padding: '4px', boxSizing: 'border-box',
  });
  const soundsLabel = o.doc.createElement('label');
  soundsLabel.textContent = o.t('pinball.demo.sounds');
  const soundsInput = o.doc.createElement('input');
  soundsInput.type = 'file';
  soundsInput.multiple = true;
  soundsInput.accept = '.wav,.WAV';
  soundsInput.setAttribute('aria-label', o.t('pinball.demo.sounds'));
  soundsInput.addEventListener('change', () => {
    const files = [...(soundsInput.files ?? [])];
    if (!files.length || !o.onSounds) return;
    void Promise.resolve(o.onSounds(files)).then(({ loaded, stranding }) => {
      // It says how many it took rather than disappearing: a player who handed over the wrong folder
      // learns it here instead of wondering why the table is still quiet.
      soundsLabel.textContent = o.t('pinball.demo.soundsLoaded', { n: loaded });
      // ⚠️ AND IT SAYS WHEN A MISSING FILE WILL STICK THE BALL, which is a different thing from a
      // quieter table and the player cannot tell them apart by playing.
      if (stranding.length) {
        const warn = o.doc.createElement('p');
        warn.textContent = o.t('pinball.demo.soundsStranding', {
          n: stranding.length, names: stranding.join(', '),
        });
        Object.assign(warn.style, { margin: '2px 0 0', color: '#ffd479' });
        soundsPanel.appendChild(warn);
      }
      if (loaded > 0) soundsInput.remove();
    });
  });
  soundsPanel.append(soundsLabel, soundsInput);

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    void file.arrayBuffer().then((bytes) => {
      try {
        // The completion lines are the game's own resources, so the demo is given the translator
        // rather than left to show a `STRING106` at the player.
        const demo = createDemo(bytes, {
          textFor: (id, params) => o.t(keyOf(id), params),
          ...(o.onSound ? { onSound: o.onSound } : {}),
          ...(o.onSoundId ? { onSoundId: o.onSoundId } : {}),
        });
        panel.remove();
        if (o.onMusic) o.host.appendChild(musicPanel);
        if (o.onSounds) o.host.appendChild(soundsPanel);
        o.onReady(demo);
      } catch (error) {
        o.onError(error instanceof Error ? error.message : String(error));
      }
    });
  });

  panel.append(say, caveat, input);
  o.host.appendChild(panel);

  return {
    blit(demo) {
      const at = demo.ballOnScreen();
      const picture = demo.render();
      const window = windowFor(at, picture, o.screen);
      blitView(
        o.screen, picture,
        { x: 0, y: 0, width: o.screen.width, height: o.screen.height },
        window.x, window.y,
      );
    },
    destroy() {
      panel.remove();
      musicPanel.remove();
      soundsPanel.remove();
    },
  };
}
