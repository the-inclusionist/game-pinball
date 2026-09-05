// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { montarPartout, ASSINATURA } from './helpers/partout.js';
import { lerCabecalho } from '../app/js/dat/partman.js';

describe('partman — cabecalho PARTOUT', () => {
  test('le a assinatura, o nome do app e a descricao dos campos de tamanho fixo', () => {
    const arquivo = montarPartout({ nomeDoApp: '3D-Pinball', descricao: 'Space Cadet Table' });

    const cab = lerCabecalho(arquivo);

    expect(cab.assinatura).toBe(ASSINATURA);
    expect(cab.nomeDoApp).toBe('3D-Pinball');
    expect(cab.descricao).toBe('Space Cadet Table');
  });
});

describe('partman — campos numericos do cabecalho', () => {
  test('le o numero de grupos e o tamanho do corpo', () => {
    const corpo = new Uint8Array(12);
    const arquivo = montarPartout({ numeroDeGrupos: 541, corpo });

    const cab = lerCabecalho(arquivo);

    expect(cab.numeroDeGrupos).toBe(541);
    expect(cab.tamanhoDoCorpo).toBe(12);
  });

  test('o corpo comeca em 0xB7, que e onde o dump do upstream poe o grupo 0', () => {
    const arquivo = montarPartout({ corpo: new Uint8Array([0xaa]) });

    expect(lerCabecalho(arquivo).inicioDoCorpo).toBe(0xb7);
  });
});

describe('partman — arquivo malformado', () => {
  test('recusa um arquivo cuja assinatura nao e PARTOUT', () => {
    const arquivo = montarPartout({ assinatura: 'NAO E UM PARTOUT' });

    expect(() => lerCabecalho(arquivo)).toThrow(/assinatura/i);
  });
});
