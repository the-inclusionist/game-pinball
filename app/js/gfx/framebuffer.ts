// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/framebuffer — o alvo de composicao, na forma que o `gdrv.cpp` usa: uma grade de 32 bits por pixel.
//
// DUAS VISTAS DA MESMA MEMORIA, e e de proposito:
//   · `pixels` (Uint32Array) e por onde se compoe. Um blit de sprite move uma palavra por pixel em vez
//     de quatro bytes, que e o que torna um compositor software viavel em JavaScript.
//   · `bytes` (Uint8ClampedArray) e o que vai direto para `new ImageData(bytes, largura)`, sem copia.
//
// A ORDEM DOS BYTES E A ARMADILHA. O canvas le `data` como R, G, B, A nessa sequencia. Empacotar os 32
// bits na ordem errada troca vermelho por azul na imagem inteira — e o resultado nao parece defeito,
// parece uma mesa de outras cores. Ninguem estranha ate comparar com o original lado a lado.
//
// E POR QUE A ORDEM E DETECTADA EM VEZ DE ASSUMIDA: em maquina little-endian, os bytes R,G,B,A lidos
// como uma palavra dao `A<<24 | B<<16 | G<<8 | R`; em big-endian, o inverso. Toda plataforma-alvo hoje e
// little-endian, mas escrever a constante direto deixa a suposicao INVISIVEL, e uma suposicao invisivel
// que quebra so em hardware raro e a pior especie. A sondagem custa uma vez, no carregamento do modulo.

const LITTLE_ENDIAN = (() => {
  const sonda = new ArrayBuffer(4);
  new Uint32Array(sonda)[0] = 1;
  return new Uint8Array(sonda)[0] === 1;
})();

/** Empacota uma cor na palavra de 32 bits cuja leitura em bytes e R, G, B, A. */
export const empacotar = LITTLE_ENDIAN
  ? (r: number, g: number, b: number, a: number): number =>
      (((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0
  : (r: number, g: number, b: number, a: number): number =>
      (((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)) >>> 0;

export interface Framebuffer {
  readonly largura: number;
  readonly altura: number;
  /** Vista de composicao. Uma palavra por pixel. */
  readonly pixels: Uint32Array;
  /** A MESMA memoria em bytes, pronta para `new ImageData(bytes, largura)`. */
  readonly bytes: Uint8ClampedArray;
}

/**
 * Nasce TRANSPARENTE, e nao preto opaco. Preto opaco esconderia todo pixel que nunca foi escrito, e um
 * sprite que faltasse pareceria um sprite preto — um defeito disfarcado de arte. Transparente deixa a
 * falta aparecer como falta.
 */
export function criarFramebuffer(largura: number, altura: number): Framebuffer {
  const buf = new ArrayBuffer(largura * altura * 4);
  return { largura, altura, pixels: new Uint32Array(buf), bytes: new Uint8ClampedArray(buf) };
}
