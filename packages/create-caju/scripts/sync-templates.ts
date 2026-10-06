/**
 * Regenera o `project.json` (+ `.caju/last-build.json`) de cada template a partir do `video.ts`,
 * para o projeto abrir no Studio logo após o `npm create caju` (antes de qualquer `caju build`).
 *
 * Uso (na raiz do repo): npx tsx --conditions=source packages/create-caju/scripts/sync-templates.ts
 * O teste do create-caju falha se um template ficar fora de sincronia.
 */
import { rmSync } from 'node:fs';
import path from 'node:path';
import { buildProjectDir } from '@caju-motion/sdk';
import { TEMPLATES, TEMPLATES_DIR } from '../src/templates';

/** Data fixa: o scaffolder troca pela data da criação do projeto. */
const NOW = new Date('2026-01-01T00:00:00.000Z');

for (const t of TEMPLATES) {
  const dir = path.join(TEMPLATES_DIR, t.name, 'projects', t.project);
  const r = await buildProjectDir(dir, { force: true, now: NOW });
  rmSync(path.join(dir, '.caju', 'history'), { recursive: true, force: true });
  console.log(`✓ ${t.name}/${t.project}: ${r.status}`);
}
