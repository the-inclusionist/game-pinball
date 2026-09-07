// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { mountHud, HUD_TEXT_COLOR, HUD_SURFACE_COLOR } from '../app/js/shell/hud-dom.js';
import { PLAYFIELD_COLOR } from '../app/js/gfx/table-view.js';
import { pack } from '../app/js/gfx/framebuffer.js';
import { layoutHud, DEFAULT_HUD } from '../app/js/shell/hud.js';
import { createTranslator } from '../app/js/i18n/index.js';

/** A document with just enough in it. The module reaches for nothing else, and a test proves that. */
function fakeDocument() {
  const made: FakeElement[] = [];
  const doc = {
    createElement(tag: string): FakeElement {
      const el = makeElement(tag);
      made.push(el);
      return el;
    },
  };
  return { doc, made };
}

interface FakeElement {
  tagName: string;
  textContent: string;
  className: string;
  children: FakeElement[];
  style: Record<string, string>;
  attributes: Record<string, string>;
  setAttribute(name: string, value: string): void;
  appendChild(child: FakeElement): FakeElement;
  remove(): void;
  removed: boolean;
}

function makeElement(tag: string): FakeElement {
  const el: FakeElement = {
    tagName: tag, textContent: '', className: '', children: [], style: {}, attributes: {},
    removed: false,
    setAttribute(name, value) { el.attributes[name] = value; },
    appendChild(child) { el.children.push(child); return child; },
    remove() { el.removed = true; },
  };
  return el;
}

function mounted() {
  const { doc } = fakeDocument();
  const host = makeElement('div');
  const hud = mountHud({
    doc: doc as never, host: host as never,
    layout: layoutHud(DEFAULT_HUD), screen: DEFAULT_HUD, t: createTranslator('en'),
  });
  return { hud, host };
}

describe('the four blocks reach the document', () => {
  test('one container, four blocks, and nothing else', () => {
    const { host } = mounted();

    expect(host.children).toHaveLength(1);
    expect(host.children[0]!.children).toHaveLength(4);
  });

  test('⚠️ the container does not eat the clicks or the keys underneath it', () => {
    // The blocks sit ON TOP of the canvas, and on `wide-arc` they sit on top of the PLAY. An overlay
    // that swallowed pointer events would make the table unclickable and would take focus away from
    // `#game-region`, which is where the keyboard is bound.
    const { host } = mounted();

    expect(host.children[0]!.style.pointerEvents).toBe('none');
  });

  test('each block is placed in per-cent, from the edge it hangs off', () => {
    /**
     * ⚠️ THE HINT HANGS FROM ITS BOTTOM AND THE OTHER THREE SIT ON THEIR TOP, which is why this can
     * no longer ask every block for a `top`. It is the fix for text leaving the canvas: the height is
     * a floor rather than a cap, so a long hint GROWS, and a block anchored by its top grows away
     * from the bottom-left corner the hint belongs to — measured at thirty-two pixels below the
     * canvas in the built page.
     *
     * Per-cent is still the point, and still checked on both: the canvas is 320x180 stretched to
     * whatever the page gives it, so a block placed in pixels sits in the middle of the table on
     * every screen but one.
     */
    const { host } = mounted();

    for (const block of host.children[0]!.children) {
      const anchor = block.attributes['data-block'] === 'hint' ? block.style.bottom : block.style.top;

      expect(block.style.left).toMatch(/%$/);
      expect(anchor, `${block.attributes['data-block']} is not placed in per-cent`).toMatch(/%$/);
    }
  });

  test('the score carries an accessible name, because its block is only digits', () => {
    const { hud, host } = mounted();

    hud.update({ score: 12500, ballCount: 3, playerNumber: 1, hint: '' });
    const score = host.children[0]!.children.find((c) => c.attributes['data-block'] === 'score')!;

    expect(score.textContent).toContain('12');
    expect(score.attributes['aria-label']!.toLowerCase()).toContain('score');
  });

  test('updating writes the words through', () => {
    const { hud, host } = mounted();

    hud.update({ score: 0, ballCount: 2, playerNumber: 1, hint: 'Pull the plunger.' });
    const textOf = (name: string) =>
      host.children[0]!.children.find((c) => c.attributes['data-block'] === name)!.textContent;

    expect(textOf('balls')).toBe('Balls: 2');
    expect(textOf('hint')).toBe('Pull the plunger.');
  });

  test('⚠️ and it is NOT announced by the live regions, which belong to events', () => {
    // A score that changes forty times a ball, wired to `aria-live`, is a screen reader that never
    // stops talking and a player who cannot hear the table. The blocks are readable ON REQUEST; what
    // gets announced is an event, and events go to `#sr-status` and `#sr-alert` which the host already
    // provides and this module does not touch.
    const { host } = mounted();

    for (const block of host.children[0]!.children) {
      expect(block.attributes['aria-live']).toBeUndefined();
    }
  });

  test('unmounting takes the container with it', () => {
    const { hud, host } = mounted();

    hud.destroy();

    expect(host.children[0]!.removed).toBe(true);
  });
});

/**
 * ⚠️ THE BLOCKS INHERITED THE PAGE'S COLOURS AND WERE UNREADABLE.
 *
 * The first version set position and nothing else, so the text came out as whatever the document said:
 * black, Times New Roman, sixteen pixels. Over a playfield of rgb(26,30,38) that is black on black —
 * a contrast ratio near 1.3 against a requirement of 7. "Jogador 1" also wrapped and was clipped.
 *
 * A block that declares no colour is BETTING that whatever ends up underneath is what the page's
 * stylesheet assumed. Underneath is a dark game canvas the stylesheet has never seen. So the HUD
 * carries its own colours, and the gate is the measured ratio rather than the presence of a value —
 * ADR-0011 anchors AAA text on WCAG 1.4.6, which is 7:1, and that is an arithmetic anybody can check.
 */
function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const channel = (v: number): number => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const n = parseInt(hex.replace('#', ''), 16);
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

describe('the words are legible, which is the other half of the engine’s rule', () => {
  test('⚠️ the text meets AAA contrast against the surface it is drawn on', () => {
    expect(contrastRatio(HUD_TEXT_COLOR, HUD_SURFACE_COLOR)).toBeGreaterThanOrEqual(7);
  });

  test('and the surface is the one the table is actually drawn on', () => {
    // Checking the text against a colour nobody uses would prove nothing.
    //
    // ⚠️ Compared through `pack` rather than by slicing a hex string. `PLAYFIELD_COLOR` is a packed
    // pixel whose byte ORDER depends on the machine's endianness — the first version of this test read
    // it as `#261e1a` on this one, which is the same colour backwards, and failed against correct code.
    const [r, g, b] = [
      parseInt(HUD_SURFACE_COLOR.slice(1, 3), 16),
      parseInt(HUD_SURFACE_COLOR.slice(3, 5), 16),
      parseInt(HUD_SURFACE_COLOR.slice(5, 7), 16),
    ];

    expect(pack(r!, g!, b!, 255)).toBe(PLAYFIELD_COLOR);
  });

  test('the container paints that surface rather than trusting the page for it', () => {
    const { host } = mounted();

    expect(host.children[0]!.style.color).toBe(HUD_TEXT_COLOR);
  });

  test('⚠️ and the type scales with the canvas, which pixels would not', () => {
    // 16px on a canvas stretched to 960 is a third the size it should be; on a phone it covers the
    // table. Container units tie the type to the element's own width, so one line of HUD is one line
    // of HUD at every scale.
    const { host } = mounted();

    expect(host.children[0]!.style.containerType).toBe('inline-size');
    expect(host.children[0]!.style.fontSize).toContain('cqw');
  });
});
