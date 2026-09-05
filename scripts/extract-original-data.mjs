// SPDX-License-Identifier: AGPL-3.0-or-later
// scripts/extract-original-data.mjs — traz os dados ORIGINAIS do jogo para a maquina local, uma vez.
//
// ========================= O QUE ISTO FAZ, DITO SEM EUFEMISMO =========================
// Baixa `PINBALL.DAT`, os ~60 WAVs e os 2 MIDIs do *3D Pinball for Windows*. Sao obra da Microsoft.
// NAO entram no git (o `.gitignore` cobre `game_resources/`), NAO sao redistribuidos por este projeto,
// e existem aqui por um motivo so: sem eles nao ha como PROVAR que a fisica portada bate com a original.
//
// ========================= POR QUE DA PARA FATIAR =========================
// O `pinball.alula.me` e um build Emscripten. O `--preload-file` concatena os arquivos num unico `.data`
// e deixa o INDICE (nome, offset inicial, offset final) em texto puro dentro do `.js` do loader. Entao
// nao ha formato a decifrar: le-se o indice, baixa-se o blob e recorta-se por offset.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = 'https://pinball.alula.me';
const DESTINO = 'game_resources';

const humano = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB');

async function existe(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  if (await existe(DESTINO)) {
    console.error(`A pasta "${DESTINO}/" ja existe. Apague-a se quiser baixar de novo — nao sobrescrevo em silencio.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Lendo o indice do pacote em ${BASE}/SpaceCadetPinball.js ...`);
  const loader = await (await fetch(`${BASE}/SpaceCadetPinball.js`)).text();
  const bruto = loader.match(/"files"\s*:\s*\[[^\]]*\]/);
  if (!bruto) throw new Error('indice nao encontrado no loader: o build do site mudou de formato');
  const { files } = JSON.parse('{' + bruto[0] + '}');
  console.log(`  ${files.length} arquivos no indice.`);

  console.log(`Baixando ${BASE}/SpaceCadetPinball.data ...`);
  const blob = Buffer.from(await (await fetch(`${BASE}/SpaceCadetPinball.data`)).arrayBuffer());
  console.log(`  ${humano(blob.length)}.`);

  await mkdir(DESTINO, { recursive: true });
  let total = 0;
  for (const f of files) {
    const nome = f.filename.replace(/^.*\//, '');
    const dados = blob.subarray(f.start, f.end);
    await writeFile(join(DESTINO, nome), dados);
    total += dados.length;
  }
  console.log(`\nGravados ${files.length} arquivos (${humano(total)}) em ${DESTINO}/`);
  console.log('Estao no .gitignore. Nao os commite, nao os redistribua.');
}

main().catch((e) => { console.error('Falhou:', e.message); process.exitCode = 1; });
