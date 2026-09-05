// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/indexado — desempacota as linhas do bitmap de 8 bits para uma grade linear, na ordem da tela.
//
// DUAS CONVERSOES NUMA SO, e as duas sao silenciosas quando erradas:
//
// 1. AS LINHAS ESTAO DE BAIXO PARA CIMA. O `gdrv::ApplyPalette` percorre a origem de `Height-1` ate 0
//    escrevendo o destino de cima para baixo — a convencao DIB do Windows. Ler na ordem direta entrega
//    a mesa de cabeca para baixo, e o jogo roda: a bola cai para cima e nada estoura.
//    (O comentario do upstream naquela funcao diz "flip horizontally". Esta errado — a inversao e
//    vertical. O codigo e a verdade; o comentario e a armadilha.)
//
// 2. O STRIDE DE ORIGEM NAO E A LARGURA. Linhas indexadas sao preenchidas ate multiplo de 4 bytes, e o
//    preenchimento nao e imagem. Percorrer a origem com passo `largura` inclina a figura uma coluna por
//    linha — o classico "imagem em escada" de quem confunde largura com stride.

export interface FormaIndexada {
  readonly largura: number;
  readonly altura: number;
  /** Passo entre linhas NA ORIGEM, em bytes. Ver `strideIndexado` em `dat/bitmap8`. */
  readonly strideIndexado: number;
}

/** Devolve `largura * altura` indices de paleta, ja na ordem de leitura da tela (topo primeiro). */
export function desempacotarIndexado(dados: Uint8Array, f: FormaIndexada): Uint8Array {
  const saida = new Uint8Array(f.largura * f.altura);

  for (let y = 0; y < f.altura; y++) {
    const linhaDeOrigem = f.altura - 1 - y; // a inversao vertical, em uma linha
    const inicio = linhaDeOrigem * f.strideIndexado;
    for (let x = 0; x < f.largura; x++) {
      saida[y * f.largura + x] = dados[inicio + x] ?? 0;
    }
  }

  return saida;
}
