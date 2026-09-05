// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/helpers/png — escritor de PNG minimo, para o gate visual ter um artefato que se possa OLHAR.
//
// Existe porque a alternativa era comparar numeros sobre um buffer e chamar isso de verificacao visual.
// Um PNG no disco e conferivel por um humano, e e o unico jeito de o "compare com o pinball.alula.me"
// do plano deixar de ser figura de linguagem.
//
// RGBA de 8 bits, sem filtragem (byte 0 por linha), deflate do proprio Node. Nao e otimizado e nao
// precisa ser: e ferramenta de teste, nao codigo de jogo.
import { deflateSync } from 'node:zlib';

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of dados) c = TABELA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pedaco(tipo: string, dados: Uint8Array): Buffer {
  const cabecalho = Buffer.alloc(8);
  cabecalho.writeUInt32BE(dados.length, 0);
  cabecalho.write(tipo, 4, 'latin1');
  const corpo = Buffer.concat([cabecalho.subarray(4), Buffer.from(dados)]);
  const fim = Buffer.alloc(4);
  fim.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([cabecalho.subarray(0, 4), corpo, fim]);
}

/** Bytes de um PNG RGBA a partir de `largura * altura * 4` bytes. */
export function montarPng(bytes: Uint8ClampedArray, largura: number, altura: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;  // bits por canal
  ihdr[9] = 6;  // RGBA
  // 10, 11, 12 = compressao, filtro, entrelacamento: todos 0

  // Uma linha por vez, cada uma prefixada pelo byte de filtro 0 ("nenhum").
  const cru = Buffer.alloc(altura * (1 + largura * 4));
  for (let y = 0; y < altura; y++) {
    const destino = y * (1 + largura * 4);
    cru[destino] = 0;
    Buffer.from(bytes.buffer, bytes.byteOffset + y * largura * 4, largura * 4).copy(cru, destino + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', ihdr),
    pedaco('IDAT', deflateSync(cru)),
    pedaco('IEND', new Uint8Array(0)),
  ]);
}
