// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HOST'S WORK IS DONE BY A HOST.
//
// ========================= WHAT ADR-0139 SPLITS, AND WHY IT IS NOT A TIDINESS =========================
// ⚠️ A CARTRIDGE SUPPLIES THE HALF OF THE OPTIONS ONLY A GAME CAN ANSWER, AND THE HOST DOES THE REST. The
// contract names the line: "the host knows these — they describe the page and the device, not the game".
// Registering dictionaries and settling a locale is exactly that, and it is not a preference:
//
//   • `registerDict` writes ONE table shared by every cartridge on the page. Two games registering for one
//     locale is two writers on one table, and the second one wins in silence.
//   • The language belongs to the SITE under ADR-0117. A cartridge that chooses one overrules a choice the
//     child already made, on a screen where the engine's own half still speaks the other.
//
// ========================= WHY THIS READS SOURCE INSTEAD OF BEHAVIOUR =========================
// 📌 BECAUSE THE OUTCOME IS IDENTICAL EITHER WAY AND THE DEFECT IS IN WHO ACTED. A page booted through the
// shell and a page booted through the cartridge both end with `documentElement.lang` set and three
// dictionaries registered — there is no value to read back that differs. What differs is which file did it,
// and that is visible in one place only. `tests/one-language` still measures the OUTCOME, in a browser,
// through the shell; this file measures the split that outcome is now supposed to come through.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const at = (...p: readonly string[]): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), '..', ...p);
const read = (...p: readonly string[]): string => readFileSync(at(...p), 'utf8');

/**
 * The file with its prose taken out.
 *
 * 🔴 WITHOUT THIS, THE LEDGER BELOW MATCHED A SENTENCE. The cartridge's own header explains why it no
 * longer awaits `idiomaPronto()` — and writing the name down was enough to turn the case red. A gate that
 * a REWORDING can silence is not measuring what it claims to: the question is which file makes the call,
 * and prose makes none.
 *
 * 📌 It strips block comments and whole-line `//`, and deliberately not trailing ones — a `//` inside a
 * template literal (this file's neighbour writes markup with them, URLs included) would swallow the rest
 * of a real line of code. Leaving those in errs towards a case that fails loudly rather than one that
 * passes over code it never read.
 */
const code = (...p: readonly string[]): string => {
  const stripped = read(...p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');

  // The strip is regex over source, so it CAN overreach. If it ever eats the file, every ledger below
  // goes green over nothing — the same silent pass this helper exists to prevent, arriving from the
  // other side.
  expect(stripped, `the comment strip ate ${p.join('/')}`).toMatch(/\bimport\b/);
  return stripped;
};

/**
 * The four pieces of work that are a host's and nobody else's.
 *
 * 🔴 `documentElement.lang` IS ON THIS LIST BECAUSE IT WENT MISSING. The prologue moved out of the
 * cartridge and the write moved with it and came back nowhere: the page went on declaring the language
 * the document was born with — `en` in both test browsers — over a game drawing Portuguese. Nothing on
 * screen looks wrong, which is the point. What breaks is every reader that believes the attribute, and
 * the first of those is a screen reader choosing which voice to read the page in.
 */
const THE_HOSTS_WORK = [
  'initI18n(', 'registerDict(', 'idiomaPronto(', 'documentElement.lang',
] as const;

/**
 * 📌 `createGame(` IS NOT ON THAT LIST YET, AND LEAVING IT OFF IS DELIBERATE RATHER THAN FORGOTTEN.
 *
 * It belongs there — it is the call ADR-0139 exists to move, and it is still in the cartridge. Adding it
 * today turns two cases red and nothing in this commit can turn them green: the engine is built from a
 * DECLARATION, this game's declaration describes the playfield that was actually chosen, and the choice
 * is made six hundred lines into a body that cannot run before the engine exists. Slice A2c is that
 * knot, and the plan's §B6 carries the measurement — twenty-three bindings cross the cut.
 *
 * A gate that is red for three commits teaches a reader to run the suite with one known failure, which is
 * how the next real one gets waved through. The line is written down instead, where the work is.
 */

describe('the standalone shell hosts the cartridge', () => {
  test('⚠️ there is a shell, and it is not the game', () => {
    // Without this the two ledgers below pass over an empty string: a file that does not exist contains no
    // forbidden call either, which would read as the split being done when nothing had moved.
    expect(read('app/js/standalone.ts').length,
      'app/js/standalone.ts is missing, so every case below is measuring nothing')
      .toBeGreaterThan(0);
  });

  test('⚠️ the shell does the host\'s work', () => {
    const source = code('app/js/standalone.ts');

    expect(THE_HOSTS_WORK.filter((call) => !source.includes(call)),
      'the shell is a host that does not do a host\'s job — nobody else will')
      .toEqual([]);
  });

  test('🔴 and the cartridge does none of it', () => {
    /**
     * ⚠️ THIS IS THE HALF THAT CAN ROT WITHOUT ANYONE NOTICING. A cartridge that keeps registering its own
     * dictionaries works perfectly on this page — it is the only game on it. The damage arrives on the
     * platform, where a second cartridge registers for the same locale and one of the two screens quietly
     * starts drawing the other's words.
     */
    const source = code('app/js/main.ts');

    expect(THE_HOSTS_WORK.filter((call) => source.includes(call)),
      'the cartridge is doing a host\'s work; on a page with two cartridges this is a silent collision')
      .toEqual([]);
  });

  test('⚠️ the shell loads the cartridge AFTER its prologue, which a static import could not do', () => {
    /**
     * 📌 `import` IS HOISTED. Written as a declaration at the top of the shell, the game would run to
     * completion before a word of the registration above it — the prologue would have MOVED and stopped
     * working, with nothing to see. A dynamic import is a statement, and statements run in order.
     */
    const source = code('app/js/standalone.ts');

    expect(source, 'the shell has no dynamic import of the cartridge')
      .toMatch(/await import\(\s*'\.\/main\.js'\s*\)/);
    expect(source, 'a static import of the cartridge hoists above the prologue and defeats it')
      .not.toMatch(/^import .*'\.\/main\.js'/m);
  });

  test('⚠️ the cartridge does not read the page\'s address', () => {
    /**
     * ⚠️ "A CARTRIDGE READS `ctx.params`, NOT `location.search`" — the contract, and the reason is that
     * the address does not belong to it. On the platform one address carries every cartridge on the page:
     * a game that reads `?table=` off `location` reads a parameter that may have been meant for another
     * game, and a shell that wanted to give it a different one has no way to.
     *
     * 📌 THE WRITE IS A SEPARATE QUESTION AND IT IS STILL OPEN. `titleScreen.onStart` navigates the
     * whole page with `location.assign` to rebuild the world on a new table — which on the platform would
     * take the site down with it. Rebuilding in place instead is a decision about this game's boot, not a
     * rename, so it is named in the plan rather than smuggled into this case.
     */
    const source = code('app/js/main.ts');

    expect(source, 'the cartridge is reading a page it does not own')
      .not.toMatch(/location\.search/);
  });

  test('⚠️ and the page loads the shell rather than the game', () => {
    /**
     * The shell existing is not the same as the shell being used. The page is the one place that decides,
     * and pointing it back at `main.ts` would leave a correct host in the tree that nothing runs.
     */
    const page = read('app/index.html');

    expect(page, 'index.html does not load the shell').toContain('./js/standalone.ts');
    expect(page, 'index.html still loads the cartridge directly, so the shell is dead code')
      .not.toContain('./js/main.ts');
  });
});
