// SPDX-License-Identifier: AGPL-3.0-or-later
// O GATE VISUAL DA FASE 2: a mesa de verdade, decodificada do PINBALL.DAT e escrita em PNG.
//
// As assercoes aqui sao objetivas (dimensao, opacidade, variedade de cor), mas o artefato existe para
// ser OLHADO: numeros sobre um buffer nao distinguem uma mesa correta de uma mesa espelhada, invertida
// ou com vermelho e azul trocados — e sao exatamente esses tres os erros que este caminho convida.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { carregarMesa } from '../app/js/dat/loader.js';
import { lerCabecalhoDeBitmap, TAMANHO_DO_CABECALHO } from '../app/js/dat/bitmap8.js';
import { TipoDeEntrada } from '../app/js/dat/partman.js';
import { lerPaleta } from '../app/js/dat/palette.js';
import { desempacotarIndexado } from '../app/js/dat/indexado.js';
import { montarPaletaDeExibicao, aplicarPaleta } from '../app/js/gfx/gdrv.js';
import { montarPng } from './helpers/png.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO = join(RAIZ, 'game_resources', 'PINBALL.DAT');
const SAIDA = join(RAIZ, 'shots');

describe.skipIf(!existsSync(CAMINHO))('render — a mesa real em PNG', () => {
  test('o grupo "table" decodifica em 365x470, do lado certo e com as cores certas', () => {
    const arquivo = new Uint8Array(readFileSync(CAMINHO));
    const mesa = carregarMesa(arquivo);

    const entradaDePaleta = mesa.grupos.flatMap((g) => g.entradas)
      .find((e) => e.tipo === TipoDeEntrada.Paleta && e.dados);
    expect(entradaDePaleta).toBeDefined();
    const paleta = montarPaletaDeExibicao(lerPaleta(entradaDePaleta!.dados!));

    // Pelo NOME e nao pelo tamanho: "o maior bitmap" acerta hoje por acidente e deixaria de acertar no
    // dia em que um sprite crescesse. O grupo se chama `table`, e e isso que ele e.
    const indiceDoFundo = mesa.indiceDoGrupo('table');
    expect(indiceDoFundo).not.toBeNull();
    const entradaDoFundo = mesa.grupos[indiceDoFundo!]!.entradas
      .find((e) => e.tipo === TipoDeEntrada.Bitmap8 && e.dados)!;
    const cab = lerCabecalhoDeBitmap(entradaDoFundo.dados!);

    const indices = desempacotarIndexado(entradaDoFundo.dados!.subarray(TAMANHO_DO_CABECALHO), {
      largura: cab.largura, altura: cab.altura, strideIndexado: cab.strideIndexado!,
    });
    const fb = aplicarPaleta(indices, paleta, cab.largura, cab.altura);

    mkdirSync(SAIDA, { recursive: true });
    writeFileSync(join(SAIDA, 'mesa-fundo.png'), montarPng(fb.bytes, fb.largura, fb.altura));

    expect([cab.largura, cab.altura]).toEqual([365, 470]);

    const opacosNaFaixa = (y0: number, y1: number): number => {
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < fb.largura; x++) if (fb.bytes[(y * fb.largura + x) * 4 + 3]! > 0) n++;
      }
      return n;
    };

    // NAO ESTA DE CABECA PARA BAIXO. A mesa e larga no topo e afina ate o pedestal embaixo, entao a
    // faixa de cima tem MUITO mais pixel opaco que a de baixo. Medido: 4494 contra 3084. Inverter as
    // linhas troca os dois e nada mais no jogo reclama — a bola apenas cai para cima.
    expect(opacosNaFaixa(0, 20)).toBeGreaterThan(opacosNaFaixa(fb.altura - 20, fb.altura) * 1.2);

    // VERMELHO E AZUL NAO ESTAO TROCADOS. O disco central e azul-esverdeado: medido r=58, g=78, b=92.
    // Trocar os canais poria o vermelho em 92 e o azul em 58, e a mesa continuaria "plausivel" —
    // roxo trocado continua roxo. E o disco que denuncia.
    let r = 0, b = 0, n = 0;
    for (let y = 230; y < 290; y++) {
      for (let x = 150; x < 215; x++) {
        const i = (y * fb.largura + x) * 4;
        r += fb.bytes[i]!; b += fb.bytes[i + 2]!; n++;
      }
    }
    expect(b / n).toBeGreaterThan((r / n) * 1.3);

    // E e colorida: um defeito de indice que colapsasse tudo numa cor so passaria em todo o resto.
    expect(new Set(Array.from(fb.pixels)).size).toBeGreaterThan(100);
  });
});
