// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { criarFramebuffer, empacotar } from '../app/js/gfx/framebuffer.js';

describe('framebuffer — as duas vistas da mesma memoria', () => {
  test('escrever na vista de 32 bits aparece na de bytes', () => {
    const fb = criarFramebuffer(2, 1);

    fb.pixels[0] = empacotar(1, 2, 3, 4);

    expect(Array.from(fb.bytes.subarray(0, 4))).toEqual([1, 2, 3, 4]);
  });

  test('os bytes saem na ordem R, G, B, A que o ImageData espera', () => {
    // O canvas le `data` como bytes RGBA. Empacotar 32 bits na ordem errada inverte vermelho e azul na
    // imagem inteira, e o sintoma e uma mesa de cores plausiveis — ninguem estranha ate comparar.
    const fb = criarFramebuffer(1, 1);

    fb.pixels[0] = empacotar(0xaa, 0xbb, 0xcc, 0xdd);

    expect(fb.bytes[0]).toBe(0xaa); // R
    expect(fb.bytes[1]).toBe(0xbb); // G
    expect(fb.bytes[2]).toBe(0xcc); // B
    expect(fb.bytes[3]).toBe(0xdd); // A
  });

  test('nasce transparente e nao preto opaco', () => {
    // Preto opaco esconderia todo pixel que nunca foi escrito, e um sprite faltando pareceria um sprite
    // preto. Transparente deixa a falta aparecer.
    const fb = criarFramebuffer(3, 2);

    expect(Array.from(fb.bytes.subarray(0, 4))).toEqual([0, 0, 0, 0]);
    expect(fb.pixels).toHaveLength(6);
  });
});
