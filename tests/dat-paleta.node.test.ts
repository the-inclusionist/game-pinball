// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { lerPaleta } from '../app/js/dat/palette.js';

/** Uma paleta crua: 256 DWORDs little-endian, que e como o arquivo a guarda. */
function paletaCrua(cores: number[]): Uint8Array {
  const b = new Uint8Array(1024);
  const dv = new DataView(b.buffer);
  for (let i = 0; i < 256; i++) dv.setUint32(i * 4, cores[i] ?? 0, true);
  return b;
}

describe('palette — entrada tipo 5', () => {
  test('le 256 cores de um payload de 1024 bytes', () => {
    expect(lerPaleta(paletaCrua([])).length).toBe(256);
  });

  test('decompoe a cor na ordem A<<24 | R<<16 | G<<8 | B do ColorRgba', () => {
    // 0x00204060: alfa 0, vermelho 0x20, verde 0x40, azul 0x60.
    const p = lerPaleta(paletaCrua([0x00204060]));

    expect(p.vermelho(0)).toBe(0x20);
    expect(p.verde(0)).toBe(0x40);
    expect(p.azul(0)).toBe(0x60);
  });

  test('o alfa vem ZERO do arquivo — a opacidade nao e do .DAT', () => {
    // Os campos de PALETTEENTRY do Windows sao R, G, B e peFlags, e peFlags e 0. Quem le esse zero
    // como alfa e pinta com ele desenha a mesa inteira transparente, e o sintoma aparece so na fase de
    // render, longe daqui. Fica registrado no teste: a opacidade e decidida por quem pinta.
    expect(lerPaleta(paletaCrua([0x00204060])).alfa(0)).toBe(0);
  });
});
