// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';
import { readGroups } from '../app/js/dat/partman.js';

/**
 * ⚠️ THE SCORE TABLE COULD NOT REACH A SINGLE COMPONENT IN THE REAL ARCHIVE.
 *
 * `control/score-table` transcribed the 89 rows of `control::score_components` — the control function
 * and the score array for every scoring part of the 1995 table — and kept the name of the C++ VARIABLE.
 * The upstream's rows do not carry that name. They carry a TAG:
 *
 *     component_tag<TPopupTarget> control_target1_tag = {"a_targ1"};
 *
 * and the string in the braces is the group's name in `PINBALL.DAT`. `make_component_link` uses it and
 * nothing else. So the port had `target1` where the archive has `a_targ1`, and only nine of the
 * eighty-nine happened to agree — which is why the demonstration mode could name what the ball hit and
 * could not score any of it.
 *
 * The tag is DATA in the original's source, one line per component, and dropping it was a transcription
 * gap rather than a design choice.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';

describe('every scoring component says which group it is', () => {
  test('all of them carry a tag', () => {
    for (const row of SCORE_COMPONENTS) {
      expect(row.tag, row.name).toBeTruthy();
    }
  });

  test('and no two components claim the same group', () => {
    const tags = SCORE_COMPONENTS.map((r) => r.tag);

    expect(new Set(tags).size).toBe(tags.length);
  });

  test('⚠️ the tag is USUALLY NOT the name, which is the whole reason it has to be carried', () => {
    // Nine of the eighty-nine agree by coincidence. A port that assumed the two were the same would
    // work for those nine and silently fail for the rest — which is exactly what it did.
    const same = SCORE_COMPONENTS.filter((r) => r.tag === r.name);

    expect(same.length).toBeLessThan(SCORE_COMPONENTS.length / 4);
    expect(same.length).toBeGreaterThan(0);
  });

  test('⚠️ and every tag names a group that is really in PINBALL.DAT', () => {
    // The claim that matters: a transcribed tag with a typo would look perfect in the source and
    // address nothing. The archive is the only thing that can tell.
    if (!existsSync(DAT)) return expect(existsSync(DAT)).toBe(false);
    const buf = readFileSync(DAT);
    const groups = readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    const names = new Set(groups.map((g) => g.name).filter(Boolean));

    const absent = SCORE_COMPONENTS.filter((r) => !names.has(r.tag)).map((r) => `${r.name} -> ${r.tag}`);

    expect(absent).toEqual([]);
  });
});
