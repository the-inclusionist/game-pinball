// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/escala — a reducao a metade que leva a mesa de 365x470 para 183x235.
//
// ========================= POR QUE AQUI HA ESCOLHA, E NO ORIGINAL NAO HAVIA =========================
// O `gdrv_bitmap8::ScaleIndexed` do upstream e vizinho mais proximo puro (`px = x / scaleX`, truncado).
// Nao por gosto: ele escala INDICES DE PALETA, e a media de dois indices e um terceiro indice, que
// aponta para uma cor sem relacao nenhuma com as duas. Nearest e a unica operacao valida ali.
//
// Nos escalamos DEPOIS da paleta, em RGBA, onde a media existe e significa alguma coisa. Entao a
// escolha volta a ser escolha, e ela e estetica: media de caixa preserva detalhe e amacia o pixel;
// vizinho preserva a aresta dura de pixel art e perde os brilhos de um pixel das rampas.
// As duas estao implementadas, e a decisao e de quem desenha, nao de quem porta.
//
// ========================= E A PROFUNDIDADE NAO TEM ESCOLHA =========================
// Media de profundidade INVENTA superficie. Entre uma rampa a 100 e o tampo a 500 nao existe nada a
// 300, e uma borda com profundidades medias poria a bola dentro da rampa em metade dos seus pixels.
// Profundidade so pode ser amostrada.

import { criarFramebuffer, empacotar, type Framebuffer } from './framebuffer.js';
import { criarZBuffer, type ZBuffer } from './zbuffer.js';

const metade = (n: number): number => Math.ceil(n / 2); // CIMA: 365 vira 183, e nao 182 cortando uma tira

/**
 * Media de caixa 2x2 PESADA PELO ALFA.
 *
 * Somar o (0,0,0,0) de um pixel transparente como se fosse preto escurece toda borda de sprite — e o
 * halo escuro classico de quem mistura cor sem pesar pelo alfa. Aqui a cor sai so de quem tem alfa, e
 * o alfa sai da media simples: um bloco meio transparente fica meio transparente, com a cor certa.
 */
export function reduzirPelaMetade(fb: Framebuffer): Framebuffer {
  const saida = criarFramebuffer(metade(fb.largura), metade(fb.altura));

  for (let y = 0; y < saida.altura; y++) {
    for (let x = 0; x < saida.largura; x++) {
      let somaRA = 0, somaGA = 0, somaBA = 0, somaA = 0, quantos = 0;

      for (let dy = 0; dy < 2; dy++) {
        const oy = y * 2 + dy;
        if (oy >= fb.altura) continue;
        for (let dx = 0; dx < 2; dx++) {
          const ox = x * 2 + dx;
          if (ox >= fb.largura) continue;
          const i = (oy * fb.largura + ox) * 4;
          const a = fb.bytes[i + 3]!;
          somaRA += fb.bytes[i]! * a;
          somaGA += fb.bytes[i + 1]! * a;
          somaBA += fb.bytes[i + 2]! * a;
          somaA += a;
          quantos++;
        }
      }

      saida.pixels[y * saida.largura + x] = somaA === 0
        ? 0
        : empacotar(
            Math.round(somaRA / somaA), Math.round(somaGA / somaA), Math.round(somaBA / somaA),
            Math.round(somaA / quantos),
          );
    }
  }

  return saida;
}

/** Vizinho mais proximo, como o `ScaleIndexed` do original: a amostra de cima-a-esquerda de cada bloco. */
export function reduzirPelaMetadeVizinho(fb: Framebuffer): Framebuffer {
  const saida = criarFramebuffer(metade(fb.largura), metade(fb.altura));
  for (let y = 0; y < saida.altura; y++) {
    for (let x = 0; x < saida.largura; x++) {
      saida.pixels[y * saida.largura + x] = fb.pixels[(y * 2) * fb.largura + x * 2]!;
    }
  }
  return saida;
}

/** Amostragem, nunca media — ver o cabecalho deste modulo. */
export function reduzirProfundidadePelaMetade(z: ZBuffer): ZBuffer {
  const saida = criarZBuffer(metade(z.largura), metade(z.altura));
  for (let y = 0; y < saida.altura; y++) {
    for (let x = 0; x < saida.largura; x++) {
      saida.profundidades[y * saida.stride + x] = z.profundidades[(y * 2) * z.stride + x * 2]!;
    }
  }
  return saida;
}
