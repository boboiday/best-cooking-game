// Dapur Kilat — make.fun entry: copy game/ + screenshots/ to /output and write dossier.json.
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = '/output';
mkdirSync(out, { recursive: true });
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });
writeFileSync(join(out, 'dossier.json'), buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
}));
console.log('Dapur Kilat entry written to /output');
// Verify what landed: dossier bytes + game/index.html present.
const dossierBytes = readFileSync(join(out, 'dossier.json'));
console.log(`dossier.json: ${dossierBytes.length} bytes`);
if (!existsSync(join(out, 'game', 'index.html'))) throw new Error('game/index.html missing from /output');
console.log(`game/index.html: ${statSync(join(out, 'game', 'index.html')).size} bytes`);
