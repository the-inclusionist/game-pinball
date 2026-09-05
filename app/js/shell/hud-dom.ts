// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/hud-dom — the four corner blocks, as elements over the canvas.
//
// ========================= THE THIN HALF =========================
// `shell/hud-view` decides what the blocks say and where they go; this puts them there. Splitting the
// two is what lets the decisions be tested off a browser, and it is the shape the engine's own HUD
// takes for the same reason.
//
// ========================= WHY AN OVERLAY AND NOT PIXELS =========================
// ADR-0010 resolves "AAA text versus a 320x180 screen" as text in the DOM. A four-pixel digit cannot
// meet a size-and-contrast requirement at any zoom the player controls, and a number painted into a
// framebuffer is invisible to a screen reader however sharp it is.
//
// ⚠️ THE OVERLAY MUST NOT EAT EVENTS. It sits on top of the canvas, and on `wide-arc` it sits on top of
// the PLAY. `pointer-events: none` on the container is what keeps the table clickable and keeps focus
// where the keyboard is bound, which is `#game-region`.
//
// ⚠️ AND IT IS NOT A LIVE REGION. A score that changes forty times a ball wired to `aria-live` is a
// screen reader that never stops talking and a player who can no longer hear the table. These blocks
// are readable on request; announcements are EVENTS, and they go to the `#sr-status` and `#sr-alert`
// the host already provides, which this module does not touch.

import { hudView, hudPlacement, type HudState } from './hud-view.js';
import type { HudLayout, HudConfig } from './hud.js';
import type { Translate } from '../i18n/index.js';

/** The slice of a document this module uses. Narrow so a test can supply it. */
export interface HudDocument {
  createElement(tag: string): HudElement;
}

/** See `HudElement.appendChild`. The two uses below are the whole of this file's contact with the DOM. */
const asChild = (element: HudElement): never => element as never;

export interface HudElement {
  textContent: string | null;
  className: string;
  /**
   * `CSSStyleDeclaration` has no index signature, so a `Record<string, string>` here would refuse a
   * real element. The properties actually written are listed instead — which also says, in the type,
   * exactly how much of the style this module touches.
   */
  readonly style: Partial<Record<
    'position' | 'left' | 'top' | 'width' | 'height' | 'minHeight' | 'overflow' | 'pointerEvents'
    | 'color' | 'containerType' | 'fontSize' | 'fontFamily' | 'fontVariantNumeric' | 'lineHeight'
    | 'textShadow' | 'textAlign' | 'whiteSpace',
    string
  >>;
  setAttribute(name: string, value: string): void;
  /**
   * `never`, and that is the only way this interface accepts a real element. The DOM declares
   * `appendChild<T extends Node>(node: T): T`, and a function taking `Node` is assignable to one
   * taking `never` while the reverse never holds — so the parameter is widened to nothing here and
   * narrowed at the two call sites, which is where a cast belongs when there is one.
   */
  appendChild(child: never): unknown;
  remove(): void;
}

export interface HudDomOptions {
  readonly doc: HudDocument;
  /** Where the container goes. The same element the canvas is in, so they share a coordinate space. */
  readonly host: HudElement;
  readonly layout: HudLayout;
  readonly screen: HudConfig;
  readonly t: Translate;
}

export interface MountedHud {
  update(state: HudState): void;
  destroy(): void;
}

/**
 * ⚠️ THE FIRST VERSION SET POSITION AND NOTHING ELSE, AND THE HUD CAME OUT UNREADABLE: black Times New
 * Roman at sixteen pixels, over a playfield of rgb(26,30,38). That is black on black — a contrast ratio
 * near 1.3 against a requirement of 7 — with the player's name clipped for good measure.
 *
 * A block that declares no colour is BETTING that whatever ends up underneath is what the page's
 * stylesheet assumed, and underneath is a dark game canvas that stylesheet has never seen. So the HUD
 * carries its own, and a test checks the RATIO rather than the presence of a value: ADR-0011 anchors
 * AAA text on WCAG 1.4.6, which is 7:1, and that is arithmetic anybody can repeat.
 */
export const HUD_TEXT_COLOR = '#ffffff';
/** The playfield's own colour, so the ratio is measured against what is really behind the words. */
export const HUD_SURFACE_COLOR = '#1a1e26';

/**
 * ⚠️ THE TYPE SCALES WITH THE CANVAS, and a pixel size would not: sixteen pixels on a canvas stretched
 * to 960 is a third of what the layout reserved, and on a phone it covers the table. Container units
 * tie the size to the element's own width, so one line of HUD is one line of HUD at every scale — and
 * `lineHeight / screenWidth` is exactly the proportion `shell/hud` laid out.
 */
export const HUD_LINE_HEIGHT = 7;

const BLOCKS = ['score', 'balls', 'player', 'hint'] as const;

export function mountHud(o: HudDomOptions): MountedHud {
  const placement = hudPlacement(o.layout, o.screen);

  const container = o.doc.createElement('div');
  container.className = 'pinball-hud';
  Object.assign(container.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    // See the header: the overlay is a caption, not a surface.
    pointerEvents: 'none',
    color: HUD_TEXT_COLOR,
    containerType: 'inline-size',
    fontSize: `calc(100cqw * ${HUD_LINE_HEIGHT} / ${o.screen.screenWidth})`,
    // A stack rather than a face: no font is shipped, and a HUD that waits for a download shows
    // nothing while it waits. `tabular-nums` keeps the score from jittering as its digits change.
    fontFamily: 'ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: '1.1',
    // Enough to keep the words off the dark table on the one table that has no margin — see ADR-0002
    // on `overlaying`. It is a legibility aid on top of a ratio that already passes without it.
    textShadow: `0 0 2px ${HUD_SURFACE_COLOR}, 0 0 4px ${HUD_SURFACE_COLOR}`,
  });

  const elements = new Map<(typeof BLOCKS)[number], HudElement>();
  for (const name of BLOCKS) {
    const block = o.doc.createElement('div');
    block.className = `pinball-hud-${name}`;
    block.setAttribute('data-block', name);
    const box = placement[name];
    Object.assign(block.style, {
      position: 'absolute',
      left: box.left, top: box.top, width: box.width,
      // The height is a floor rather than a cap: a hint that wraps to a fifth line should be readable,
      // not clipped. `layoutHud` already keeps the blocks apart with room for four.
      minHeight: box.height,
      // The score is the one block that is read right to left, and its corner is the right one.
      textAlign: name === 'score' ? 'right' : 'left',
      // Not hidden: clipping accessible text to protect a layout is the wrong way round, and
      // `layoutHud` already keeps the blocks apart with room for four lines of hint.
      whiteSpace: 'pre-line',
    });
    container.appendChild(asChild(block));
    elements.set(name, block);
  }

  o.host.appendChild(asChild(container));

  return {
    update(state) {
      const view = hudView(state, o.t);
      for (const name of BLOCKS) {
        const element = elements.get(name)!;
        const block = view[name];
        element.textContent = block.text;
        // Only where the shown text is not the whole meaning — the score's digits without the word.
        if (block.label) element.setAttribute('aria-label', block.label);
      }
    },
    destroy() {
      container.remove();
    },
  };
}
