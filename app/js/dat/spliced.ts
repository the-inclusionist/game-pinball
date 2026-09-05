// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/spliced — desfaz o bitmap "spliced", que guarda cor E profundidade entrelacadas num so fluxo.
//
// Port de `GroupData::SplitSplicedBitmap`. O upstream faz isto NO CARREGAMENTO e diz por que, no
// comentario dele: "Get rid of spliced bitmap early on, to simplify render pipeline". O `zdrv` chega a
// afirmar que nunca ve um bitmap spliced. Entao este modulo mora na fase de dados, e nao na de render.
//
// ========================= O FLUXO =========================
// Uma sequencia de corridas, cada uma:
//
//     [salto: int16] [quantos: uint16] depois `quantos` pixels de [profundidade: uint16] [indice: uint8]
//
// e um `salto` NEGATIVO encerra.
//
// ========================= A ARMADILHA: TRES BYTES POR PIXEL =========================
// A profundidade tem 2 bytes e o indice tem 1. O original expressa isso com um `char**` que aliasa o
// mesmo ponteiro que le as palavras de 16 bits, e avanca UM byte por pixel. O efeito e que uma corrida
// de tamanho IMPAR deixa o cursor em posicao impar, e o `int16` da corrida seguinte e lido desalinhado.
//
// Percorrer o fluxo em unidades de 16 bits nao consegue nem representar esse estado. Por isso aqui o
// cursor e em BYTES, sempre. O sintoma de errar isto seria a imagem se desfazendo a partir do primeiro
// sprite de contagem impar — nunca no primeiro pixel, que e onde alguem procuraria.

/** Indice 255. A paleta o define como branco (`current_palette[255] = White()`). */
export const INDICE_DE_PREENCHIMENTO = 0xff;
/** O mais longe possivel. Preencher com zero poria o fundo na frente de tudo. */
export const PROFUNDIDADE_DE_PREENCHIMENTO = 0xffff;

export interface Dimensoes {
  readonly largura: number;
  readonly altura: number;
  /**
   * A largura da MESA na resolucao em que o fluxo foi gravado (`resolution_array[].TableWidth`).
   * Entra por parametro em vez de ser lida de uma tabela global porque e a unica dependencia externa
   * deste algoritmo, e injetada ela fica testavel sem montar o sistema de resolucoes inteiro.
   */
  readonly larguraDaMesa: number;
}

export interface Dividido {
  readonly indices: Uint8Array;
  readonly profundidades: Uint16Array;
}

export function dividirSpliced(dados: Uint8Array, d: Dimensoes): Dividido {
  const celulas = d.largura * d.altura;
  const indices = new Uint8Array(celulas).fill(INDICE_DE_PREENCHIMENTO);
  const profundidades = new Uint16Array(celulas).fill(PROFUNDIDADE_DE_PREENCHIMENTO);

  const dv = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  let cursor = 0; // EM BYTES — ver o cabecalho deste modulo.
  let destino = 0;

  for (;;) {
    if (cursor + 2 > dados.byteLength) break;
    let salto = dv.getInt16(cursor, true); cursor += 2;
    if (salto < 0) break;

    // O salto foi gravado em termos da largura da MESA; num bitmap mais estreito ele precisa ser
    // reexpresso. So se aplica quando o salto excede a largura deste bitmap, que e como o original o faz.
    if (salto > d.largura) salto += d.largura - d.larguraDaMesa;

    destino += salto;

    if (cursor + 2 > dados.byteLength) break;
    const quantos = dv.getUint16(cursor, true); cursor += 2;

    for (let i = 0; i < quantos; i++) {
      if (cursor + 3 > dados.byteLength) return { indices, profundidades };
      const profundidade = dv.getUint16(cursor, true); cursor += 2;
      const indice = dv.getUint8(cursor); cursor += 1;

      if (destino >= 0 && destino < celulas) {
        indices[destino] = indice;
        profundidades[destino] = profundidade;
      }
      destino++;
    }
  }

  return { indices, profundidades };
}
