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
        });
        panel.remove();
        if (o.onMusic) o.host.appendChild(musicPanel);
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
    },
  };
}
