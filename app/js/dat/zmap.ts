// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/zmap — o mapa de profundidade de 16 bits do PARTOUT (entrada tipo 12).
//
// Cabecalho de 14 bytes, conforme `Doc/.dat file format.txt`:
//   +0  largura  WORD
//   +2  altura   WORD
//   +4  stride   WORD   (pitch/2 — em celulas de 16 bits, nao em bytes)
//   +6  ?        DWORD  (0)
//   +10 ?        WORD   (0)
//   +12 ?        WORD   (80)
//   +14 profundidades
//
// O STRIDE E EM CELULAS, NAO EM BYTES, e pode ser maior que a largura: o excedente e preenchimento no
// fim de cada linha. Ler linha por linha com passo `largura` em vez de `stride` produz uma imagem que
// escorrega para o lado — o defeito classico de quem confunde os dois.

const OFF = { largura: 0, altura: 2, stride: 4 } as const;
export const TAMANHO_DO_CABECALHO = 14;

export interface ZMap {
  readonly largura: number;
  readonly altura: number;
  readonly stride: number;
  readonly profundidades: Uint16Array;
  /** Verdadeiro quando o cabecalho nao descreve os dados que vieram atras dele. Ver abaixo. */
  readonly vazio: boolean;
  profundidadeEm(x: number, y: number): number;
}

function montar(largura: number, altura: number, stride: number, profundidades: Uint16Array, vazio: boolean): ZMap {
  return {
    largura, altura, stride, profundidades, vazio,
    profundidadeEm: (x, y) => profundidades[y * stride + x] ?? 0,
  };
}

/** Um z-map que nao descreve nada. Nao e erro — ver o comentario em `lerZMap`. */
const VAZIO = montar(0, 0, 0, new Uint16Array(0), true);

export function lerZMap(payload: Uint8Array): ZMap {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const largura = dv.getUint16(OFF.largura, true);
  const altura = dv.getUint16(OFF.altura, true);
  const stride = dv.getUint16(OFF.stride, true);
  const bytesDeCarga = payload.byteLength - TAMANHO_DO_CABECALHO;

  // O CABECALHO TEM DE EXPLICAR A CARGA, E QUANDO NAO EXPLICA A RESPOSTA E VAZIO — NAO EXCECAO.
  // Os grupos 497 e 498 do PINBALL.DAT tem o cabecalho de z-map zerado com carga atras; o original
  // (partman.cpp) confere `stride * altura * 2 == comprimento` e, quando falha, salta a carga e poe um
  // z-map 0x0 no lugar. Transcrito literalmente: sao dados reais do arquivo de 1995, e um port que
  // estourasse ali nao carregaria a mesa.
  if (stride * altura * 2 !== bytesDeCarga) return VAZIO;

  const profundidades = new Uint16Array(stride * altura);
  for (let i = 0; i < profundidades.length; i++) {
    profundidades[i] = dv.getUint16(TAMANHO_DO_CABECALHO + i * 2, true);
  }
  return montar(largura, altura, stride, profundidades, false);
}
