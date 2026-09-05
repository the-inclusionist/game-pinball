// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { montarPartout, corpoCom, grupo, entrada, entradaTipo0, entradaFixa, texto } from './helpers/partout.js';
import { lerGrupos, TipoDeEntrada } from '../app/js/dat/partman.js';

describe('partman — corpo', () => {
  test('le um grupo com uma entrada de texto', () => {
    const arquivo = montarPartout({
      numeroDeGrupos: 1,
      corpo: corpoCom(grupo(entrada(TipoDeEntrada.String, texto('3D-Pinball')))),
    });

    const grupos = lerGrupos(arquivo);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.entradas).toHaveLength(1);
    expect(grupos[0]!.entradas[0]!.tipo).toBe(TipoDeEntrada.String);
    expect(grupos[0]!.entradas[0]!.dados).toEqual(texto('3D-Pinball'));
  });

  test('le varios grupos em sequencia sem perder o sincronismo', () => {
    const arquivo = montarPartout({
      numeroDeGrupos: 2,
      corpo: corpoCom(
        grupo(entrada(TipoDeEntrada.NomeDeGrupo, texto('table_size'))),
        grupo(entrada(TipoDeEntrada.NomeDeGrupo, texto('s_ramp9')), entrada(TipoDeEntrada.String, texto('ok'))),
      ),
    });

    const grupos = lerGrupos(arquivo);

    expect(grupos).toHaveLength(2);
    expect(grupos[1]!.entradas).toHaveLength(2);
    expect(grupos[1]!.nome).toBe('s_ramp9');
  });

  test('a entrada tipo 0 tem WORD de valor e NAO DWORD de tamanho', () => {
    const arquivo = montarPartout({
      numeroDeGrupos: 2,
      corpo: corpoCom(
        grupo(entradaTipo0(0x1234)),
        grupo(entrada(TipoDeEntrada.NomeDeGrupo, texto('depois'))),
      ),
    });

    const grupos = lerGrupos(arquivo);

    expect(grupos[0]!.entradas[0]!.valor).toBe(0x1234);
    // A prova real nao e o valor: e o grupo SEGUINTE ainda ser legivel. Um leitor que tratasse o tipo 0
    // como os outros consumiria 4 bytes onde ha 2 e leria lixo daqui ate o fim do arquivo, sem estourar.
    expect(grupos[1]!.nome).toBe('depois');
  });
});

describe('partman — tipos de tamanho fixo alem do 0', () => {
  // A tabela `_field_size[]` do partman.cpp: { 2, -1, 2, -1, ..., 0 }. Os indices 0 e 2 valem 2 bytes,
  // o indice 13 vale 0, e todo o resto le um DWORD de tamanho. A spec em Doc/ so menciona o tipo 0,
  // entao um leitor escrito so a partir dela desincroniza em qualquer arquivo que use 2 ou 13.
  test('o tipo 2 tem 2 bytes fixos e nao DWORD de tamanho', () => {
    const arquivo = montarPartout({
      numeroDeGrupos: 2,
      corpo: corpoCom(
        grupo(entradaFixa(2, new Uint8Array([0xbe, 0xef]))),
        grupo(entrada(TipoDeEntrada.NomeDeGrupo, texto('depois'))),
      ),
    });

    const grupos = lerGrupos(arquivo);

    expect(grupos[0]!.entradas[0]!.dados).toEqual(new Uint8Array([0xbe, 0xef]));
    expect(grupos[1]!.nome).toBe('depois');
  });

  test('o tipo 13 nao tem dados nenhum', () => {
    const arquivo = montarPartout({
      numeroDeGrupos: 2,
      corpo: corpoCom(
        grupo(entradaFixa(13, new Uint8Array(0))),
        grupo(entrada(TipoDeEntrada.NomeDeGrupo, texto('depois'))),
      ),
    });

    const grupos = lerGrupos(arquivo);

    expect(grupos[0]!.entradas[0]!.dados).toHaveLength(0);
    expect(grupos[1]!.nome).toBe('depois');
  });
});
