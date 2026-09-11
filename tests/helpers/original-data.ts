// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/helpers/original-data — where the Microsoft files are, resolved FROM THIS FILE.
//
// ========================= THE REPOSITORY WAS RENAMED AND THIRTY-EIGHT GATES WENT DARK =========================
// ⚠️ `SpaceCadetPinball` BECAME `game-pinball`, and every one of those files carried the old absolute path
// written out in full: `C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT`. The data is
// never versioned — `game_resources/` is gitignored and populated by `npm run data:extract` — so each of
// those suites is written to SKIP when the file is absent, which is the correct behaviour for a clone that
// has not run the extractor.
//
// So they went on passing. They passed by measuring nothing, and several of them said so out loud:
// `expect(existsSync(DAT)).toBe(false)` had become a true statement about a directory that could not exist,
// asserted as evidence that the parser was fine. Thirty-six suites about the 1995 table — the parser, the
// bitmaps, the z-map, the score tables, the address book, the frame budget — were green and blind.
//
// ⚠️ AND THE FIX IS NOT A BETTER ABSOLUTE PATH. It is that the location is DERIVED from where this file
// sits, so moving or renaming the repository moves it too. `tests/no-absolute-paths` is the gate that keeps
// the literal from coming back.
import { fileURLToPath } from 'node:url';

/** The directory the extractor writes into. Ends with a separator, because two callers build on it. */
export const RESOURCES = fileURLToPath(new URL('../../game_resources/', import.meta.url));

/** One file in it, by name: `resource('PINBALL.DAT')`. */
export const resource = (name: string): string => RESOURCES + name;
