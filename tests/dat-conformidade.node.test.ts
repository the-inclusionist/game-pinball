// SPDX-License-Identifier: AGPL-3.0-or-later
// O GATE DE CONFORMIDADE: o parser contra o PINBALL.DAT de verdade.
//
// Os numeros conferidos aqui NAO foram gerados por este codigo. Vem do `Doc/.dat dump.txt` do upstream,
// escrito pelo AdrienTD com outra ferramenta, em outra linguagem, anos antes deste port existir. E a
// diferenca entre um teste e um espelho: um golden que eu mesmo produzisse confirmaria apenas que o
// parser concorda consigo mesmo.
//
// PULA quando os dados nao estao na maquina, e diz como obte-los. Os arquivos sao da Microsoft e nunca
// entram no repositorio; um teste que dependesse deles sem essa guarda quebraria em todo clone limpo.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO = join(RAIZ, 'game_resources', 'PINBALL.DAT');
const temDados = existsSync(CAMINHO);

describe.skipIf(!temDados)('conformidade — PINBALL.DAT real vs o dump do AdrienTD', () => {
  const arquivo = temDados ? new Uint8Array(readFileSync(CAMINHO)) : new Uint8Array(0);

  test('o cabecalho bate com o dump', async () => {
    const { lerCabecalho } = await import('../app/js/dat/partman.js');
    const c = lerCabecalho(arquivo);

    expect(c.assinatura).toBe('PARTOUT(4.0)RESOURCE');
    expect(c.nomeDoApp).toBe('3D-Pinball');
    expect(c.descricao).toBe('Space Cadet Table');
    expect(c.numeroDeGrupos).toBe(541);
    expect(arquivo.byteLength).toBe(928700);
  });

  test('percorre os 541 grupos sem sair de sincronia', async () => {
    const { lerGrupos } = await import('../app/js/dat/partman.js');

    // A prova de sincronismo nao e a contagem: e o CONTEUDO do primeiro e do segundo grupo, que o dump
    // transcreve. Um parser desalinhado ainda produziria 541 objetos, cheios de lixo.
    const grupos = lerGrupos(arquivo);

    expect(grupos).toHaveLength(541);
    expect(new TextDecoder('latin1').decode(grupos[0]!.entradas[0]!.dados!))
      .toContain('Copyright 1994, Cinematronics');
    expect(grupos[1]!.nome).toBe('table_size');
  });

  test('a mesa mede 600x416 e o maior bitmap e 365x470', async () => {
    const { carregarMesa } = await import('../app/js/dat/loader.js');
    const { lerCabecalhoDeBitmap } = await import('../app/js/dat/bitmap8.js');
    const { TipoDeEntrada } = await import('../app/js/dat/partman.js');

    const mesa = carregarMesa(arquivo);
    expect(mesa.tamanhoDaMesa).toEqual({ largura: 600, altura: 416 });

    const bitmaps = mesa.grupos.flatMap((g) => g.entradas
      .filter((e) => e.tipo === TipoDeEntrada.Bitmap8 && e.dados)
      .map((e) => lerCabecalhoDeBitmap(e.dados!)));

    expect(bitmaps).toHaveLength(318);
    const maior = bitmaps.reduce((a, b) => (a.largura * a.altura >= b.largura * b.altura ? a : b));
    expect([maior.largura, maior.altura]).toEqual([365, 470]);
  });

  test('todo bitmap nao-spliced tem tamanho igual a altura x stride indexado', async () => {
    // A assercao que o proprio gdrv faz no construtor. Se ela vale para os 318, o cabecalho foi lido certo.
    const { carregarMesa } = await import('../app/js/dat/loader.js');
    const { lerCabecalhoDeBitmap, TipoDeBitmap } = await import('../app/js/dat/bitmap8.js');
    const { TipoDeEntrada } = await import('../app/js/dat/partman.js');

    const divergentes = carregarMesa(arquivo).grupos.flatMap((g) => g.entradas
      .filter((e) => e.tipo === TipoDeEntrada.Bitmap8 && e.dados)
      .map((e) => lerCabecalhoDeBitmap(e.dados!))
      .filter((c) => c.tipo !== TipoDeBitmap.Spliced
        && c.tamanhoDosDados !== c.altura * (c.strideIndexado ?? 0)));

    expect(divergentes).toEqual([]);
  });

  test('o 3DPB nao usa spliced nem dib: os 318 bitmaps sao CRUS, na resolucao 0', async () => {
    // MEDIDO, nao suposto. A primeira versao deste teste tentava decodificar os bitmaps spliced do
    // arquivo e falhou na guarda `resultados.length > 0`: nao existe nenhum. O formato spliced e do
    // Full Tilt! Pinball, e o `partman.cpp` do upstream carrega os dois jogos.
    //
    // A CONSEQUENCIA, dita aqui porque nao aparece em lugar nenhum: `dat/spliced.ts` continua SEM
    // validacao contra dado real. Os testes dele sao sinteticos e transcrevem o algoritmo do upstream
    // linha a linha, o que e mais forte do que nada e mais fraco do que este gate. So dados do Full
    // Tilt fecham essa lacuna.
    const { carregarMesa } = await import('../app/js/dat/loader.js');
    const { lerCabecalhoDeBitmap, TipoDeBitmap } = await import('../app/js/dat/bitmap8.js');
    const { TipoDeEntrada } = await import('../app/js/dat/partman.js');

    const cabecalhos = carregarMesa(arquivo).grupos.flatMap((g) => g.entradas
      .filter((e) => e.tipo === TipoDeEntrada.Bitmap8 && e.dados)
      .map((e) => lerCabecalhoDeBitmap(e.dados!)));

    expect(cabecalhos.filter((c) => c.tipo !== TipoDeBitmap.Bruto)).toEqual([]);
    expect(cabecalhos.filter((c) => c.resolucao !== 0)).toEqual([]);
  });

  test('os 302 z-maps do arquivo sao todos legiveis', async () => {
    // O `partman.cpp` avisa que os grupos 497 e 498 tem cabecalho zerado. Este teste diz quantos
    // caem nesse caso: se um dia forem mais, alguma coisa mudou na leitura e nao no arquivo.
    const { carregarMesa } = await import('../app/js/dat/loader.js');
    const { TipoDeEntrada } = await import('../app/js/dat/partman.js');
    const { lerZMap } = await import('../app/js/dat/zmap.js');

    const zmaps = carregarMesa(arquivo).grupos.flatMap((g) => g.entradas
      .filter((e) => e.tipo === TipoDeEntrada.ZMap && e.dados)
      .map((e) => lerZMap(e.dados!)));

    expect(zmaps).toHaveLength(302);
    expect(zmaps.filter((z) => z.vazio)).toHaveLength(2); // os grupos 497 e 498
  });
});

describe.skipIf(temDados)('conformidade — dados ausentes', () => {
  test('o gate esta esperando os dados originais', () => {
    // Nao e falha: e o estado normal de um clone limpo. Este teste existe para que a ausencia apareca
    // na saida em vez de o conjunto passar em silencio dando a impressao de que o gate rodou.
    expect(temDados).toBe(false);
    console.log(`\n  [gate de conformidade PULADO] ${CAMINHO} nao existe.`);
    console.log('  Para habilita-lo: npm run data:extract\n');
  });
});
