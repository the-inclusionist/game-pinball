// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/screen-art — the photographs behind the screens that have no table on them.
//
// ⚠️ THE DEV: "Use background.jpg como fundo de todas as telas que não tenham mesa com exceção da
// primeira tela. Para a tela inicial, use start.jpg como background."
//
// So there are two, and which one is which is the whole of this module: `start` for the title, and
// `background` for everything between it and a table — the selector and the mission screen. A screen
// with a table on it has the table, and the pause menu and its dialogs sit over one.
//
// ========================= THEY ARE 320x180, LIKE EVERYTHING ELSE HERE =========================
// `scripts/import-art.py` reduces the masters to the game's own grid and the page scales them up with
// the canvas. A photograph at the page's resolution behind pixel art at a sixth of it would be the one
// sharp thing on the screen — and it would cost two megabytes on a game meant to run offline on a
// school machine, against thirty kilobytes for this.
//
// ========================= AND THEY ARE DIMMED, BY A MEASUREMENT =========================
// The importer holds every pixel under Y 0.1469, which is what `shell/title-dom`'s INK needs to clear
// 4.5:1 as normal text. That is a bound on the PICTURE; text darker than INK does not get it for free,
// and `title-dom` puts those blocks on a panel rather than on the photograph. `tests/screen-art` does
// the arithmetic on the shipped files rather than trusting either half.

/**
 * The two pictures by name, or `undefined` when a build has none.
 *
 * ⚠️ A GLOB, FOR THE REASON `gfx/backdrop` USES ONE: Vite resolves it at build time into hashed URLs,
 * and a missing picture answers `undefined` instead of breaking the build. A title screen with no
 * photograph is the flat colour it was last week; a title screen that will not compile is nothing.
 */
const URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/screens/*.png', { eager: true, query: '?url', import: 'default' }),
  ).map(([path, url]) => [path.replace(/^.*\/(.+)\.png$/, '$1'), url as string]),
);

export type ScreenArt = 'start' | 'background';

/** Every screen photograph this build ships, for a gate that has to walk them. */
export const SCREEN_ARTS: readonly ScreenArt[] = ['start', 'background'];

/**
 * Which of them is held under the contrast ceiling, and the title is not.
 *
 * ⚠️ THE DEV, AFTER SEEING IT DIMMED: "Pirmeira tela: não use filtro para escurecer, deixe a imagem
 * original." So the title keeps the photograph as it was taken and the TEXT carries the contrast
 * instead — a cherry border around SPACE STUDENT, a neon glow under PINBALL, a tight dark shadow under
 * the credit. That is a real technique and not a concession: what the eye finds on a busy ground is an
 * EDGE, and an outline is an edge that does not depend on what the ground is doing there.
 *
 * ⚠️ AND IT IS ONLY THE TITLE. The selector and the mission screen carry paragraphs of small text in
 * two weights, and no outline in the world makes a seven-pixel legend readable over an undimmed
 * photograph. `scripts/import-art.py` holds the same table.
 */
export const SCREEN_DIMMED: Readonly<Record<ScreenArt, boolean>> = {
  start: false,
  background: true,
};

/**
 * The two text colours the screens are written in, as numbers.
 *
 * ⚠️ HERE RATHER THAN IN `title-dom`, WHICH IS WHERE THEY WERE. A node test cannot import that module
 * — it pulls in a font file on its first line — so a gate that wanted to measure a photograph against
 * the text on it had to write the two colours out a second time. Two copies of a colour is exactly the
 * shape of the defects this repository keeps finding: the one that is read and the one that is
 * checked, moving apart. `title-dom` builds its CSS strings from these.
 */
export const UI_INK = { r: 232, g: 236, b: 244 } as const;
export const UI_DIM = { r: 138, g: 147, b: 166 } as const;

/**
 * The brightest a screen photograph may be.
 *
 * ⚠️ DERIVED FROM THE TEXT, NOT CHOSEN. `UI_INK` is (232, 236, 244) at Y 0.83585, and WCAG
 * 1.4.3 wants 4.5:1 for normal text — the smallest word on these screens is the byline, at about eight
 * pixels. That leaves Y 0.1469 for anything behind it, and `scripts/import-art.py` computes the same
 * number from the same two inputs. This is the copy a TEST can read; the shipped files are what it
 * measures.
 */
export const INK_LUMINANCE = 0.83585;
export const TEXT_RATIO = 4.5;
export const SCREEN_CEILING = (INK_LUMINANCE + 0.05) / TEXT_RATIO - 0.05;

/**
 * The panel that goes under text too dim to sit on a photograph, and what it is made of.
 *
 * ⚠️ THE CEILING ABOVE IS INK'S AND NOT DIM'S. `UI_DIM` is (138, 147, 166) at Y 0.29027, and
 * on the brightest pixel a picture may contain that measures 1.73:1 — not a readable colour on a
 * photograph, barely a visible one. The legend, the scoreboard, the back links and the mission's
 * explanation are all DIM, deliberately: they are quieter than the thing you came to press.
 *
 * So those blocks get a panel and keep their colour. The alpha is not a taste — `tests/screen-art`
 * composites every pixel of both shipped pictures under it and asserts what is left clears 4.5:1.
 */
/**
 * Cherry, and the neon it glows in.
 *
 * ⚠️ THE DEV NAMED THE COLOUR AND NOT THE HEX: "uma borda em volta de SPACE STUDENT na cor cereja" and
 * "pinte pinball na cor cereja". This is cherry red at (210, 4, 45), Y 0.1398 — dark enough that white
 * clears 4.5:1 against it as a border, saturated enough to read as the colour he asked for.
 *
 * ⚠️ AND THE NEON IS BRIGHTER THAN THE LETTER, which is what makes it a tube rather than a shadow. A
 * real neon sign is a bright core in a coloured halo; the Dev asked for the letters themselves to be
 * cherry, so the brightness goes into the halo instead and the reading is the same.
 */
export const CHERRY = 'rgb(210, 4, 45)';
export const NEON = 'rgb(255, 74, 122)';

export const PANEL_ALPHA = 0.85;
export const PANEL_UNDER = { r: 14, g: 16, b: 23 } as const;
export const PANEL = `rgba(${PANEL_UNDER.r}, ${PANEL_UNDER.g}, ${PANEL_UNDER.b}, ${PANEL_ALPHA})`;

/** Where a screen's photograph lives, or `undefined` when the build has none. */
export function screenArtUrl(name: ScreenArt): string | undefined {
  return URLS[name];
}

/**
 * A CSS `background` value for one of them, or `none`.
 *
 * ⚠️ `cover` AND `pixelated`. The picture is exactly the game's aspect, so `cover` never crops in
 * practice — it is there for the case the region is not, which is a window narrower than 16:9 with the
 * page scrolling. Smoothing it would make it the only interpolated thing on a pixel-art screen.
 */
export function screenBackground(name: ScreenArt | null): string {
  const url = name === null ? undefined : screenArtUrl(name);
  return url === undefined ? 'none' : `url(${url})`;
}
