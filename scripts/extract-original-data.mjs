// SPDX-License-Identifier: AGPL-3.0-or-later
// scripts/extract-original-data.mjs — brings the ORIGINAL game data onto the local machine, once.
//
// ========================= WHAT THIS DOES, SAID WITHOUT EUPHEMISM =========================
// It downloads `PINBALL.DAT`, the ~60 WAVs and the 2 MIDIs of *3D Pinball for Windows*. They are
// Microsoft's work. They do NOT enter git (`.gitignore` covers `game_resources/`), they are NOT
// redistributed by this project, and they exist here for one reason only: without them there is no way
// to PROVE that the ported physics matches the original.
//
// ========================= WHY IT CAN BE SLICED =========================
// pinball.alula.me is an Emscripten build. `--preload-file` concatenates the files into a single
// `.data` and leaves the INDEX (name, start offset, end offset) in plain text inside the loader `.js`.
// So there is no format to decipher: read the index, download the blob, cut by offset.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = 'https://pinball.alula.me';
const DESTINATION = 'game_resources';

const human = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB');

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  if (await exists(DESTINATION)) {
    console.error(`The "${DESTINATION}/" folder already exists. Delete it if you want to download again — I do not overwrite silently.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Reading the package index at ${BASE}/SpaceCadetPinball.js ...`);
  const loader = await (await fetch(`${BASE}/SpaceCadetPinball.js`)).text();
  const rawIndex = loader.match(/"files"\s*:\s*\[[^\]]*\]/);
  if (!rawIndex) throw new Error('index not found in the loader: the site build changed format');
  const { files } = JSON.parse('{' + rawIndex[0] + '}');
  console.log(`  ${files.length} files in the index.`);

  console.log(`Downloading ${BASE}/SpaceCadetPinball.data ...`);
  const blob = Buffer.from(await (await fetch(`${BASE}/SpaceCadetPinball.data`)).arrayBuffer());
  console.log(`  ${human(blob.length)}.`);

  await mkdir(DESTINATION, { recursive: true });
  let total = 0;
  for (const f of files) {
    const name = f.filename.replace(/^.*\//, '');
    const data = blob.subarray(f.start, f.end);
    await writeFile(join(DESTINATION, name), data);
    total += data.length;
  }
  console.log(`\nWrote ${files.length} files (${human(total)}) into ${DESTINATION}/`);
  console.log('They are in .gitignore. Do not commit them, do not redistribute them.');
}

main().catch((e) => { console.error('Failed:', e.message); process.exitCode = 1; });
