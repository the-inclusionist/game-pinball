// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/bitmap8 — o bitmap de 8 bits por pixel do PARTOUT (entrada tipo 1).
//
// Cabecalho de 14 bytes, conforme `Doc/.dat file format.txt`:
//   +0  resolucao  BYTE  0=640x480 · 1=800x600 · 2=1024x768 · -1=vale em todas
//   +1  largura    WORD
//   +3  altura     WORD
//   +5  x          WORD
//   +7  y          WORD
//   +9  tamanho    DWORD
//   +13 flags      BYTE
//   +14 dados
//
// A RESOLUCAO E ASSINADA e o -1 e o caso comum nos sprites pequenos: um `getUint8` devolveria 255 e o
// filtro por resolucao passaria a descartar exatamente as entradas que valem para todas elas.

const OFF = { resolucao: 0, largura: 1, altura: 3, x: 5, y: 7, tamanho: 9, flags: 13 } as const;
export const TAMANHO_DO_CABECALHO = 14;

/**
 * Bits do byte de flags. O bit 0 e `RawBmpUnaligned` no upstream: ligado quer dizer DESALINHADO.
 * A spec em Doc/ o descreve como "Raw bmp align", que convida a leitura contraria — e a leitura
 * contraria faz a assercao de alinhamento reprovar exatamente os bitmaps que estao certos.
 */
const BIT = { brutoDesalinhado: 1, dib: 2, spliced: 4 } as const;

/** Os tres tipos do `BitmapTypes` do upstream. A ordem de teste importa — ver `tipoDe`. */
export const TipoDeBitmap = { Bruto: 'bruto', Dib: 'dib', Spliced: 'spliced' } as const;
export type TipoDeBitmap = (typeof TipoDeBitmap)[keyof typeof TipoDeBitmap];

/**
 * NAO E COMUTATIVO. O gdrv.cpp testa Spliced, depois Dib, e so entao cai em Bruto — entao um bitmap
 * com os dois bits ligados e Spliced, nao Dib. Testar Dib primeiro classificaria errado e o erro
 * apareceria como imagem embaralhada, sem nada apontando para a classificacao.
 */
function tipoDe(flags: number): TipoDeBitmap {
  if (flags & BIT.spliced) return TipoDeBitmap.Spliced;
  if (flags & BIT.dib) return TipoDeBitmap.Dib;
  return TipoDeBitmap.Bruto;
}

/**
 * O stride das linhas INDEXADAS (8bpp), que sobe ao proximo multiplo de 4 quando a largura nao e.
 * O buffer de destino em cor usa a largura crua — sao dois strides no mesmo bitmap, e troca-los
 * inclina a imagem uma coluna por linha.
 *
 * `null` no spliced: aquele formato nao tem linhas, e devolver um numero ali seria convidar alguem a
 * percorre-lo como se tivesse.
 */
function strideIndexadoDe(tipo: TipoDeBitmap, largura: number): number | null {
  if (tipo === TipoDeBitmap.Spliced) return null;
  return largura % 4 === 0 ? largura : largura - (largura % 4) + 4;
}

export interface CabecalhoDeBitmap {
  readonly resolucao: number;
  readonly largura: number;
  readonly altura: number;
  readonly x: number;
  readonly y: number;
  readonly tamanhoDosDados: number;
  readonly brutoDesalinhado: boolean;
  readonly ehDib: boolean;
  /** Combina bitmap e z-map num esquema tipo RLE (o "skipline" do upstream). */
  readonly ehSpliced: boolean;
  readonly tipo: TipoDeBitmap;
  /** Stride das linhas indexadas; `null` no spliced, que nao tem linhas. */
  readonly strideIndexado: number | null;
}

export function lerCabecalhoDeBitmap(payload: Uint8Array): CabecalhoDeBitmap {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const flags = dv.getUint8(OFF.flags);
  const largura = dv.getUint16(OFF.largura, true);
  const tipo = tipoDe(flags);
  return {
    tipo,
    strideIndexado: strideIndexadoDe(tipo, largura),
    resolucao: dv.getInt8(OFF.resolucao),
    largura,
    altura: dv.getUint16(OFF.altura, true),
    x: dv.getUint16(OFF.x, true),
    y: dv.getUint16(OFF.y, true),
    tamanhoDosDados: dv.getUint32(OFF.tamanho, true),
    brutoDesalinhado: (flags & BIT.brutoDesalinhado) !== 0,
    ehDib: (flags & BIT.dib) !== 0,
    ehSpliced: (flags & BIT.spliced) !== 0,
  };
}
