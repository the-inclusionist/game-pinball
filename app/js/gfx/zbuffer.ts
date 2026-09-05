// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/zbuffer — a profundidade da cena, e as duas formas de pintar contra ela. Port de `zdrv.cpp`.
//
// ========================= AS DUAS PINTURAS DIFEREM DE PROPOSITO =========================
// O original tem duas funcoes que parecem a mesma coisa e nao sao, e uniformiza-las quebra o jogo de
// dois jeitos diferentes:
//
//   `pintar` (zdrv::paint) — para sprite que TEM profundidade propria (uma rampa, uma parede).
//       Compara `destino >= origem` e escreve COR E PROFUNDIDADE. O sprite carva o relevo da cena.
//       O `=` decide o desempate: no empate a origem vence, entao o ultimo desenhado fica por cima.
//
//   `pintarPlano` (zdrv::paint_flat) — para sprite a uma profundidade so (a bola).
//       Compara `destino > profundidade`, ESTRITO, escreve so a COR, e pula pixel transparente.
//       Nao escrever profundidade e o que faz a bola passar sem deixar rastro no relevo; o `>` estrito
//       e o que a impede de piscar na borda das rampas, onde as profundidades se igualam.
//
// ========================= E OS STRIDES SAO DOIS =========================
// O framebuffer anda de `largura` em `largura`; o z-buffer anda de `stride`, que sobe ao proximo
// multiplo de 4 (o `pad()` do original). Usar um no lugar do outro inclina a profundidade em relacao a
// imagem, e o sintoma e a bola sumindo no lugar errado — perto do certo, e por isso dificil de ver.

import type { Framebuffer } from './framebuffer.js';

/** O mais longe possivel. Nascer em zero poria o fundo na frente de tudo e nada seria desenhado. */
export const LONGE = 0xffff;

/** `zmap_header_type::pad`: sobe ao proximo multiplo de 4. */
function pad(largura: number): number {
  return largura & 3 ? largura - (largura & 3) + 4 : largura;
}

export interface ZBuffer {
  readonly largura: number;
  readonly altura: number;
  /** Passo entre linhas. NAO e a largura — ver o cabecalho deste modulo. */
  readonly stride: number;
  readonly profundidades: Uint16Array;
}

export interface Area {
  readonly largura: number;
  readonly altura: number;
  readonly destX?: number;
  readonly destY?: number;
  readonly origX?: number;
  readonly origY?: number;
}

export function criarZBuffer(largura: number, altura: number): ZBuffer {
  const stride = pad(largura);
  return { largura, altura, stride, profundidades: new Uint16Array(stride * altura).fill(LONGE) };
}

export function preencherZ(z: ZBuffer, valor: number): void {
  z.profundidades.fill(valor);
}

/** `zdrv::paint`: o sprite traz a propria profundidade e a imprime na cena. */
export function pintar(destino: Framebuffer, zDestino: ZBuffer, origem: Framebuffer, zOrigem: ZBuffer, a: Area): void {
  const dx = a.destX ?? 0, dy = a.destY ?? 0, ox = a.origX ?? 0, oy = a.origY ?? 0;

  for (let y = 0; y < a.altura; y++) {
    for (let x = 0; x < a.largura; x++) {
      const iDest = (dy + y) * destino.largura + (dx + x);
      const iDestZ = (dy + y) * zDestino.stride + (dx + x);
      const iOrig = (oy + y) * origem.largura + (ox + x);
      const iOrigZ = (oy + y) * zOrigem.stride + (ox + x);

      const profundidadeDaOrigem = zOrigem.profundidades[iOrigZ]!;
      if (zDestino.profundidades[iDestZ]! >= profundidadeDaOrigem) {
        destino.pixels[iDest] = origem.pixels[iOrig]!;
        zDestino.profundidades[iDestZ] = profundidadeDaOrigem;
      }
    }
  }
}

/** `zdrv::paint_flat`: o sprite esta todo a uma profundidade e nao imprime relevo nenhum. */
export function pintarPlano(destino: Framebuffer, zDestino: ZBuffer, origem: Framebuffer, profundidade: number, a: Area): void {
  const dx = a.destX ?? 0, dy = a.destY ?? 0, ox = a.origX ?? 0, oy = a.origY ?? 0;

  for (let y = 0; y < a.altura; y++) {
    for (let x = 0; x < a.largura; x++) {
      const iDest = (dy + y) * destino.largura + (dx + x);
      const iDestZ = (dy + y) * zDestino.stride + (dx + x);
      const iOrig = (oy + y) * origem.largura + (ox + x);

      const cor = origem.pixels[iOrig]!;
      // `Color` nao-zero no original: pixel todo zero e transparente e nao e desenhado.
      if (cor !== 0 && zDestino.profundidades[iDestZ]! > profundidade) {
        destino.pixels[iDest] = cor;
      }
    }
  }
}
