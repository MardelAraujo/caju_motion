/**
 * Copia as skills para `<destino>/.claude/skills/` (padrão: raiz do repo).
 * Precursor do `caju skills add` (F3).  Uso: npm run skills:install [-- <destino>]
 */
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const ROOT = path.resolve(SKILLS_DIR, '..', '..', '..');

const target = path.resolve(process.argv[2] ?? ROOT, '.claude', 'skills');
for (const name of readdirSync(SKILLS_DIR)) {
  const dest = path.join(target, name);
  if (existsSync(dest)) rmSync(dest, { recursive: true });
  cpSync(path.join(SKILLS_DIR, name), dest, { recursive: true });
  console.log(`✓ ${path.relative(process.cwd(), dest) || dest}`);
}
