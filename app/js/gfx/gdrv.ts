// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/gdrv — a paleta de exibicao e a conversao de indices em cores. Port de `gdrv::display_palette`
// e `gdrv::ApplyPalette`.
//
// ========================= O UNICO PONTO EM QUE TRANSCREVER SERIA ERRADO =========================
// O original faz, nas cores 10 a 245 vindas do arquivo:
//
//     srcClr.SetAlpha(0xff);  current_palette[index] = srcClr;  current_palette[index].SetAlpha(2);
//
// Alfa DOIS. Nao e opacidade: o SDL ignora o alfa naquele caminho de textura, e o 2 so precisa ser
// NAO-ZERO para o teste de transparencia (`if ((*srcPtr).Color)`) classificar o pixel como desenhavel.
// E um sentinela vestido de canal alfa.
//
// O canvas NAO ignora o alfa. Copiar o 2 literalmente pintaria a mesa inteira a 0,8% de opacidade — o
// port estaria "fiel" e a tela, vazia. Traduzir o sentinela para 255 preserva a semantica exata (zero
// continua sendo o unico valor transparente) e corrige o meio. Fica escrito aqui porque e a especie de
// decisao que, sem registro, alguem "conserta" de volta para 2 achando que esta sendo fiel.
//
// ========================= O MAPA DOS 256 INDICES =========================
//   0        transparente (o proprio upstream comenta "Color 0: transparent")
//   1 a 9    paleta de sistema do Windows, fixa no codigo
//   10 a 245 do arquivo, opacas
//   246 a 254 nunca atribuidas — ficam no zero do memset, isto e, transparentes
//   255      branco opaco

import { criarFramebuffer, empacotar, type Framebuffer } from './framebuffer.js';

/** O que este modulo precisa de uma paleta lida do .DAT. */
export interface PaletaDeArquivo {
  vermelho(i: number): number;
  verde(i: number): number;
  azul(i: number): number;
}

/** Os nove primeiros da paleta de sistema do Windows, depois do indice 0 transparente. */
const SISTEMA: readonly (readonly [number, number, number])[] = [
  [0x80, 0, 0], [0, 0x80, 0], [0x80, 0x80, 0], [0, 0, 0x80],
  [0x80, 0, 0x80], [0, 0x80, 0x80], [0xc0, 0xc0, 0xc0], [0xc0, 0xdc, 0xc0], [0xa6, 0xca, 0xf0],
];

const PRIMEIRA_DO_ARQUIVO = 10;
const DEPOIS_DA_ULTIMA_DO_ARQUIVO = 246;

export function montarPaletaDeExibicao(paleta: PaletaDeArquivo): Uint32Array {
  const saida = new Uint32Array(256); // zero = transparente, que ja e o certo para 0 e para 246..254

  SISTEMA.forEach(([r, g, b], i) => { saida[i + 1] = empacotar(r, g, b, 0xff); });

  for (let i = PRIMEIRA_DO_ARQUIVO; i < DEPOIS_DA_ULTIMA_DO_ARQUIVO; i++) {
    saida[i] = empacotar(paleta.vermelho(i), paleta.verde(i), paleta.azul(i), 0xff);
  }

  saida[255] = empacotar(255, 255, 255, 255);
  return saida;
}

/** `gdrv::ApplyPalette`, sem a inversao vertical: essa ja aconteceu em `dat/indexado`. */
export function aplicarPaleta(indices: Uint8Array, paleta: Uint32Array, largura: number, altura: number): Framebuffer {
  const fb = criarFramebuffer(largura, altura);
  const n = Math.min(indices.length, fb.pixels.length);
  for (let i = 0; i < n; i++) fb.pixels[i] = paleta[indices[i]!]!;
  return fb;
}
