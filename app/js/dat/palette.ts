// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/palette — a paleta de 256 cores do PARTOUT (entrada tipo 5).
//
// Uma cor por DWORD little-endian. O layout de bits e o do `ColorRgba` do upstream (gdrv.h):
//
//     A << 24 | R << 16 | G << 8 | B
//
// ou seja, na MEMORIA os bytes saem B, G, R, A — e nao R, G, B, A, que e a leitura que o nome "Rgba"
// convida a fazer. Trocar os dois inverte vermelho e azul na mesa inteira: a nebulosa roxa fica verde-
// -agua e ninguem descobre por que ate abrir um pixel na mao.
//
// O ALFA DO ARQUIVO E ZERO e nao e opacidade: os campos de uma PALETTEENTRY do Windows sao R, G, B e
// `peFlags`, e `peFlags` vale 0. Quem tratar esse byte como alfa pinta a mesa inteira transparente.
// A opacidade e decidida por quem desenha, na fase de render, e nao aqui.

const CORES = 256;
const BYTES_POR_COR = 4;

export interface Paleta {
  readonly length: number;
  vermelho(i: number): number;
  verde(i: number): number;
  azul(i: number): number;
  /** O byte alto tal como veio do arquivo. Zero em todo o PINBALL.DAT — ver o cabecalho deste modulo. */
  alfa(i: number): number;
}

export function lerPaleta(payload: Uint8Array): Paleta {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const quantas = Math.min(CORES, Math.floor(payload.byteLength / BYTES_POR_COR));
  const cores = new Uint32Array(quantas);
  for (let i = 0; i < quantas; i++) cores[i] = dv.getUint32(i * BYTES_POR_COR, true);

  const canal = (i: number, deslocamento: number): number => ((cores[i] ?? 0) >>> deslocamento) & 0xff;
  return {
    length: quantas,
    vermelho: (i) => canal(i, 16),
    verde: (i) => canal(i, 8),
    azul: (i) => canal(i, 0),
    alfa: (i) => canal(i, 24),
  };
}
