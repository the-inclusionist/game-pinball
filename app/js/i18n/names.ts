// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/names — what the ball is next to, said out loud.
//
// ========================= WITHOUT THIS THERE IS NO SCREEN READER AND NO SIGN LANGUAGE =========================
// `nameAt` is the contract's third field, and the engine asks for it twice over: the same text is
// spoken by the screen reader and handed to the sign-language interpreter. A table whose components
// have no names answers `null` to every point on it, and the blind mode goes quiet.
//
// ========================= GENDER IS NOT PEDANTRY, IT IS A LANGUAGE REQUIREMENT =========================
// The engine's `Speakable` carries a grammatical gender because in Portuguese the FRAME agrees with the
// CONTENT: "o ralo está à frente" and "a rampa está à frente" are one engine sentence with one
// parameter, and without the gender one of them comes out wrong. Only the game knows which.
//
// Which is why these are not in `i18n/pt` beside the mission strings: those are a flat
// `Record<string, string>`, matching the engine's own dictionaries, and a name is three fields rather
// than one. The strings stay flat and the speakables live here.
//
// ========================= THE NAME IS THE KIND, NOT THE COMPONENT =========================
// There are 88 scoring components and 145 more in the address book, and naming each one would be 233
// strings saying "bumper" thirty times. A component is named by WHAT IT IS, matched from the prefix of
// its `.DAT` group name — `bump1`, `bump2` and `bump7` are all a bumper.
//
// ⚠️ AND NO PREFIX IS A PREFIX OF ANOTHER, WHICH IS WHY THE ORDER DOES NOT MATTER.
// The obvious trap here is `literoll179`, which contains the word roll and is a LAMP. It is not a trap
// for this matcher: `startsWith` reads from the beginning, and the name begins with `lite`. An earlier
// version of this table carried a redundant `literoll` entry and a comment claiming the order saved
// it; a mutation removing that entry changed nothing, which is how the claim was found to be false.
//
// What actually protects the table is that no two prefixes overlap at all, so a name matches at most
// one of them and the order of the list is free. That is a property a future addition could break —
// adding `flip` beside an existing `f` would — so there is a test that asserts it directly, instead of
// a comment asking the next reader to be careful.

import type { Speakable } from '@the-inclusionist/engine/core/contract.js';
import { type Locale, BASE_LOCALE } from './index.js';

export type ComponentKind =
  | 'bumper' | 'target' | 'lane' | 'well' | 'kicker' | 'ramp' | 'oneway' | 'gate'
  | 'drain' | 'plunger' | 'flipper' | 'rebounder' | 'flag' | 'blocker' | 'wall'
  | 'lamp' | 'hole';

/** Order-independent: no prefix is a prefix of another, and a test holds that. */
const PREFIXES: readonly (readonly [string, ComponentKind])[] = [
  ['plunger', 'plunger'],
  ['kickout', 'kicker'],
  ['oneway', 'oneway'],
  ['target', 'target'],
  ['block', 'blocker'],
  ['drain', 'drain'],
  ['flag', 'flag'],
  ['bump', 'bumper'],
  ['gate', 'gate'],
  ['hole', 'hole'],
  ['lite', 'lamp'],
  ['ramp', 'ramp'],
  ['rebo', 'rebounder'],
  ['roll', 'lane'],
  ['sink', 'well'],
  ['wall', 'wall'],
  ['flip', 'flipper'],
];

/** The prefixes themselves, so a test can assert the property the table depends on. */
export const KIND_PREFIXES: readonly string[] = PREFIXES.map(([prefix]) => prefix);

/** What a `.DAT` group name is, or `null` when nothing claims it. */
export function kindOf(componentName: string): ComponentKind | null {
  for (const [prefix, kind] of PREFIXES) {
    if (componentName.startsWith(prefix)) return kind;
  }
  return null;
}

type NameTable = Readonly<Record<ComponentKind, Speakable>>;

const n = (text: string, gender: Speakable['gender']): Speakable =>
  ({ text, gender, plural: false });

const pt: NameTable = {
  bumper: n('para-choque', 'm'),
  target: n('alvo', 'm'),
  lane: n('pista', 'f'),
  well: n('poço', 'm'),
  kicker: n('ejetor', 'm'),
  ramp: n('rampa', 'f'),
  oneway: n('passagem', 'f'),
  gate: n('portão', 'm'),
  drain: n('ralo', 'm'),
  plunger: n('êmbolo', 'm'),
  flipper: n('pá', 'f'),
  rebounder: n('amortecedor', 'm'),
  flag: n('bandeira', 'f'),
  blocker: n('barreira', 'f'),
  wall: n('parede', 'f'),
  lamp: n('luz', 'f'),
  hole: n('buraco', 'm'),
};

// English has no grammatical gender, so every one of these is neutral. That is a fact about the
// language and not a gap in the table.
const en: NameTable = {
  bumper: n('bumper', 'n'),
  target: n('target', 'n'),
  lane: n('lane', 'n'),
  well: n('well', 'n'),
  kicker: n('kicker', 'n'),
  ramp: n('ramp', 'n'),
  oneway: n('one-way', 'n'),
  gate: n('gate', 'n'),
  drain: n('drain', 'n'),
  plunger: n('plunger', 'n'),
  flipper: n('flipper', 'n'),
  rebounder: n('rebounder', 'n'),
  flag: n('flag', 'n'),
  blocker: n('blocker', 'n'),
  wall: n('wall', 'n'),
  lamp: n('light', 'n'),
  hole: n('hole', 'n'),
};

const es: NameTable = {
  bumper: n('tope', 'm'),
  target: n('blanco', 'm'),
  lane: n('carril', 'm'),
  well: n('pozo', 'm'),
  kicker: n('eyector', 'm'),
  ramp: n('rampa', 'f'),
  oneway: n('paso', 'm'),
  gate: n('puerta', 'f'),
  drain: n('desagüe', 'm'),
  plunger: n('émbolo', 'm'),
  flipper: n('paleta', 'f'),
  rebounder: n('rebotador', 'm'),
  flag: n('bandera', 'f'),
  blocker: n('barrera', 'f'),
  wall: n('pared', 'f'),
  lamp: n('luz', 'f'),
  hole: n('agujero', 'm'),
};

const TABLES: Readonly<Record<Locale, NameTable>> = { pt, en, es };

export function nameTableOf(locale: Locale): NameTable {
  return TABLES[locale] ?? TABLES[BASE_LOCALE];
}

/**
 * The speakable name of a component, for `nameAt`. `null` when nothing on the table claims that
 * prefix — which is a legitimate answer, and the contract's own way of saying "nothing here".
 */
export function createNamer(locale: Locale): (componentName: string) => Speakable | null {
  const table = nameTableOf(locale);
  return (componentName) => {
    const kind = kindOf(componentName);
    return kind ? table[kind] : null;
  };
}
