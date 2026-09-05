// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/helpers/partout — construtor de arquivos PARTOUT sinteticos.
//
// POR QUE UM CONSTRUTOR E NAO UM ARQUIVO DE FIXTURE: o PINBALL.DAT e obra de terceiro e nao pode ser
// versionado (ver .gitignore). Um teste que dependesse dele so rodaria na maquina de quem tem o jogo.
// Este construtor produz arquivos MINIMOS no mesmo formato, entao a logica do parser e testavel sozinha;
// o arquivo real entra depois, no gate de conformidade, comparado contra o dump do AdrienTD.
//
// Formato conforme `Doc/.dat file format.txt` do upstream (AdrienTD).

export const ASSINATURA = 'PARTOUT(4.0)RESOURCE';

/** Um campo de texto de tamanho FIXO, preenchido com zeros — e assim que o formato guarda os tres do cabecalho. */
function textoFixo(texto: string, tamanho: number): Uint8Array {
  const b = new Uint8Array(tamanho);
  for (let i = 0; i < texto.length && i < tamanho; i++) b[i] = texto.charCodeAt(i);
  return b;
}

export interface CabecalhoSintetico {
  readonly assinatura?: string;
  readonly nomeDoApp?: string;
  readonly descricao?: string;
  readonly numeroDeGrupos?: number;
  /** Corpo cru. Vazio por padrao: o cabecalho e testavel sem nenhum grupo. */
  readonly corpo?: Uint8Array;
}

/** Monta um arquivo PARTOUT completo. O corpo comeca em 0xB7, que e o que o dump do upstream confirma. */
export function montarPartout(c: CabecalhoSintetico = {}): Uint8Array {
  const corpo = c.corpo ?? new Uint8Array(0);
  const TAMANHO_CABECALHO = 0xb7;
  const arquivo = new Uint8Array(TAMANHO_CABECALHO + corpo.length);
  const dv = new DataView(arquivo.buffer);

  arquivo.set(textoFixo(c.assinatura ?? ASSINATURA, 21), 0x00);
  arquivo.set(textoFixo(c.nomeDoApp ?? '3D-Pinball', 50), 0x15);
  arquivo.set(textoFixo(c.descricao ?? 'Space Cadet Table', 100), 0x47);
  dv.setUint32(0xab, arquivo.length, true);
  dv.setUint16(0xaf, c.numeroDeGrupos ?? 0, true);
  dv.setUint32(0xb1, corpo.length, true);
  dv.setUint16(0xb5, 0, true);
  arquivo.set(corpo, TAMANHO_CABECALHO);

  return arquivo;
}

/* ===================== CORPO: GRUPOS E ENTRADAS ===================== */

/**
 * Uma entrada comum: byte de tipo, DWORD de tamanho, dados.
 * (O tipo 0 NAO segue esta forma — ver `entradaTipo0`.)
 */
export function entrada(tipo: number, dados: Uint8Array): Uint8Array {
  const b = new Uint8Array(1 + 4 + dados.length);
  b[0] = tipo;
  new DataView(b.buffer).setUint32(1, dados.length, true);
  b.set(dados, 5);
  return b;
}

/**
 * A ENTRADA TIPO 0, que e a armadilha do formato: o byte de tipo e seguido de um WORD de valor,
 * e nao do DWORD de tamanho. Um leitor que trate todos os tipos igual sai de sincronia aqui e le
 * lixo por todo o resto do arquivo — sem estourar, o que e o pior modo de falhar.
 */
export function entradaTipo0(valor: number): Uint8Array {
  const b = new Uint8Array(3);
  b[0] = 0;
  new DataView(b.buffer).setUint16(1, valor, true);
  return b;
}

/** Um grupo: um byte com a contagem de entradas, seguido das entradas. */
export function grupo(...entradas: Uint8Array[]): Uint8Array {
  const total = entradas.reduce((n, e) => n + e.length, 0);
  const b = new Uint8Array(1 + total);
  b[0] = entradas.length;
  let p = 1;
  for (const e of entradas) { b.set(e, p); p += e.length; }
  return b;
}

/** Concatena grupos num corpo. */
export function corpoCom(...grupos: Uint8Array[]): Uint8Array {
  const total = grupos.reduce((n, g) => n + g.length, 0);
  const b = new Uint8Array(total);
  let p = 0;
  for (const g of grupos) { b.set(g, p); p += g.length; }
  return b;
}

/** Bytes de um texto latin1 — o que as entradas de tipo 3 (nome de grupo) e 9 (string) carregam. */
export function texto(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
