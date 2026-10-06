/**
 * Verifica projetos gerados pelo create-caju: `caju build` (precisa dar "sem mudanças": o project.json
 * do template está em sincronia com o video.ts) + `caju check`, num processo só.
 *
 * Uso (na raiz do repo): node --conditions=source --import tsx packages/create-caju/scripts/verify-projects.ts <raiz-do-projeto>...
 * Saída: o log dos comandos e, na última linha, `RESULT <json>` com o exit code de cada etapa.
 */
import path from 'node:path';
import { buildCommand } from '../../cli/src/commands/build';
import { checkCommand } from '../../cli/src/commands/check';

const results: Record<string, { build: number; check: number; unchanged: boolean }> = {};
for (const root of process.argv.slice(2)) {
  const dir = path.join(root, 'projects');
  const lines: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => {
    lines.push(a.join(' '));
    log(...a);
  };
  try {
    const build = await buildCommand({ dir, ids: [], force: false, dryRun: false });
    const unchanged = lines.some((l) => l.includes('sem mudanças')) && !lines.some((l) => /: (criado|atualizado)/.test(l));
    const check = await checkCommand({ dir, ids: [], componentsDir: path.join(root, 'components') });
    results[root] = { build, check, unchanged };
  } finally {
    console.log = log;
  }
}
console.log(`RESULT ${JSON.stringify(results)}`);
