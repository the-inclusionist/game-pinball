// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { fluxoSpliced } from './helpers/partout.js';
import { dividirSpliced, INDICE_DE_PREENCHIMENTO, PROFUNDIDADE_DE_PREENCHIMENTO } from '../app/js/dat/spliced.js';

const px = (profundidade: number, indice: number) => ({ profundidade, indice });

describe('spliced — divisao em bitmap indexado + z-map', () => {
  test('escreve indice e profundidade nas posicoes que o salto aponta', () => {
    const dados = fluxoSpliced([{ salto: 1, pixels: [px(0x1111, 7), px(0x2222, 8)] }]);

    const r = dividirSpliced(dados, { largura: 4, altura: 1, larguraDaMesa: 4 });

    expect(r.indices[1]).toBe(7);
    expect(r.indices[2]).toBe(8);
    expect(r.profundidades[1]).toBe(0x1111);
    expect(r.profundidades[2]).toBe(0x2222);
  });

  test('o que a corrida nao toca fica no preenchimento, nao em zero', () => {
    // O original preenche o bitmap com 0xFF (indice 255, que a paleta define como branco) e o z-map
    // com 0xFFFF (o mais longe possivel). Preencher com zero poria tudo na frente de tudo.
    const dados = fluxoSpliced([{ salto: 2, pixels: [px(0x1234, 9)] }]);

    const r = dividirSpliced(dados, { largura: 4, altura: 1, larguraDaMesa: 4 });

    expect(r.indices[0]).toBe(INDICE_DE_PREENCHIMENTO);
    expect(r.profundidades[0]).toBe(PROFUNDIDADE_DE_PREENCHIMENTO);
  });

  test('uma corrida IMPAR desalinha o fluxo e a corrida seguinte ainda le certo', () => {
    // TRES bytes por pixel: uma corrida de 1 pixel deixa o cursor em posicao impar. Um leitor que
    // percorresse o fluxo em palavras de 16 bits leria o salto seguinte com um byte de defasagem, e o
    // sintoma seria a imagem se desfazendo a partir do primeiro sprite de contagem impar — nunca no
    // primeiro pixel, que e onde alguem procuraria.
    const dados = fluxoSpliced([
      { salto: 0, pixels: [px(0x0101, 1)] },
      { salto: 1, pixels: [px(0x0202, 2)] },
    ]);

    const r = dividirSpliced(dados, { largura: 4, altura: 1, larguraDaMesa: 4 });

    expect(r.indices[0]).toBe(1);
    expect(r.indices[2]).toBe(2);
    expect(r.profundidades[2]).toBe(0x0202);
  });

  test('salto negativo encerra o fluxo', () => {
    const dados = fluxoSpliced([{ salto: 0, pixels: [px(0x0303, 3)] }]);

    const r = dividirSpliced(dados, { largura: 4, altura: 1, larguraDaMesa: 4 });

    expect(r.indices[1]).toBe(INDICE_DE_PREENCHIMENTO);
  });

  test('salto maior que a largura e corrigido pela largura da mesa', () => {
    // `stride += bmp.Width - tableWidth`: o salto foi gravado em termos da largura da MESA na
    // resolucao original, e precisa ser reexpresso na largura deste bitmap.
    const dados = fluxoSpliced([{ salto: 10, pixels: [px(0x0404, 4)] }]);

    // Duas linhas de 8: o destino tem 16 celulas, e a 8 e o inicio da segunda linha.
    const r = dividirSpliced(dados, { largura: 8, altura: 2, larguraDaMesa: 10 });

    expect(r.indices[8]).toBe(4); // 10 + 8 - 10 = 8
  });
});

describe('spliced — diagnostico', () => {
  test('conta os pixels escritos e diz que terminou no encerrador', () => {
    const dados = fluxoSpliced([{ salto: 0, pixels: [px(1, 1), px(2, 2)] }]);

    const r = dividirSpliced(dados, { largura: 4, altura: 1, larguraDaMesa: 4 });

    expect(r.pixelsEscritos).toBe(2);
    expect(r.terminouLimpo).toBe(true);
    expect(r.foraDosLimites).toBe(0);
  });

  test('CONTA o que cai fora dos limites em vez de engolir', () => {
    // Escrever fora e clampado para nao estourar, mas silenciar isso transformaria um erro de decodificacao
    // num sprite com pedacos faltando — visivel, inexplicavel e sem nada apontando para a causa.
    const dados = fluxoSpliced([{ salto: 3, pixels: [px(1, 1), px(2, 2), px(3, 3)] }]);

    const r = dividirSpliced(dados, { largura: 4, altura: 1, larguraDaMesa: 4 });

    expect(r.foraDosLimites).toBe(2); // destinos 4 e 5
  });

  test('um fluxo cortado no meio nao terminou limpo', () => {
    const completo = fluxoSpliced([{ salto: 0, pixels: [px(1, 1), px(2, 2)] }]);
    const cortado = completo.subarray(0, completo.length - 4);

    expect(dividirSpliced(cortado, { largura: 4, altura: 1, larguraDaMesa: 4 }).terminouLimpo).toBe(false);
  });
});
