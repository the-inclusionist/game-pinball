// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { montarPartout, corpoCom, grupo, entrada, texto, int16s } from './helpers/partout.js';
import { TipoDeEntrada } from '../app/js/dat/partman.js';
import { carregarMesa, TipoDeObjeto } from '../app/js/dat/loader.js';

const grupoNomeado = (nome: string, ...extras: Uint8Array[]) =>
  grupo(entrada(TipoDeEntrada.NomeDeGrupo, texto(nome)), ...extras);

describe('loader — indice de grupos', () => {
  test('acha um grupo pelo nome', () => {
    const arquivo = montarPartout({
      numeroDeGrupos: 2,
      corpo: corpoCom(grupoNomeado('table_size'), grupoNomeado('s_ramp9')),
    });

    const mesa = carregarMesa(arquivo);

    expect(mesa.indiceDoGrupo('s_ramp9')).toBe(1);
  });

  test('grupo inexistente devolve null em vez de -1', () => {
    // -1 e um indice valido em JavaScript quando usado sem conferir, e le `undefined` calado.
    const arquivo = montarPartout({ numeroDeGrupos: 1, corpo: corpoCom(grupoNomeado('so_esse')) });

    expect(carregarMesa(arquivo).indiceDoGrupo('nao_existe')).toBeNull();
  });
});

describe('loader — table_size', () => {
  test('le largura e altura do par de int16', () => {
    const arquivo = montarPartout({
      numeroDeGrupos: 1,
      corpo: corpoCom(grupoNomeado('table_size', entrada(TipoDeEntrada.Int16s, int16s(600, 416)))),
    });

    expect(carregarMesa(arquivo).tamanhoDaMesa).toEqual({ largura: 600, altura: 416 });
  });
});

describe('loader — table_objects', () => {
  test('le pares tipo/grupo, descartando o primeiro inteiro', () => {
    // A spec: "o primeiro inteiro e desconhecido, e entao vem uma serie de pares de 16 bits".
    const arquivo = montarPartout({
      numeroDeGrupos: 1,
      corpo: corpoCom(grupoNomeado('table_objects',
        entrada(TipoDeEntrada.Int16s, int16s(0, TipoDeObjeto.Plunger, 42, TipoDeObjeto.Bumper, 43)))),
    });

    const objetos = carregarMesa(arquivo).objetosDaMesa;

    expect(objetos).toEqual([
      { tipo: TipoDeObjeto.Plunger, grupo: 42 },
      { tipo: TipoDeObjeto.Bumper, grupo: 43 },
    ]);
  });

  test('sem o grupo table_objects, a lista e vazia e nao um estouro', () => {
    const arquivo = montarPartout({ numeroDeGrupos: 1, corpo: corpoCom(grupoNomeado('outra_coisa')) });

    expect(carregarMesa(arquivo).objetosDaMesa).toEqual([]);
  });
});
