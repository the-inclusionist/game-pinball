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

/** Bits do byte de flags. `dib` desligado quer dizer bitmap CRU — a ausencia e que e o caso comum. */
const BIT = { alinhadoBruto: 1, dib: 2, spliced: 4 } as const;

export interface CabecalhoDeBitmap {
  readonly resolucao: number;
  readonly largura: number;
  readonly altura: number;
  readonly x: number;
  readonly y: number;
  readonly tamanhoDosDados: number;
  readonly alinhadoBruto: boolean;
  readonly ehDib: boolean;
  /** Combina bitmap e z-map num esquema tipo RLE (o "skipline" do upstream). */
  readonly ehSpliced: boolean;
}

export function lerCabecalhoDeBitmap(payload: Uint8Array): CabecalhoDeBitmap {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const flags = dv.getUint8(OFF.flags);
  return {
    resolucao: dv.getInt8(OFF.resolucao),
    largura: dv.getUint16(OFF.largura, true),
    altura: dv.getUint16(OFF.altura, true),
    x: dv.getUint16(OFF.x, true),
    y: dv.getUint16(OFF.y, true),
    tamanhoDosDados: dv.getUint32(OFF.tamanho, true),
    alinhadoBruto: (flags & BIT.alinhadoBruto) !== 0,
    ehDib: (flags & BIT.dib) !== 0,
    ehSpliced: (flags & BIT.spliced) !== 0,
  };
}
