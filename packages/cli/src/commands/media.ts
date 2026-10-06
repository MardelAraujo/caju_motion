import path from 'node:path';
import { analyzeProject, type ProxyMode } from '@caju-motion/media';
import { createProjectStore } from '@caju-motion/server';

type Opts = {
  dir: string;
  ids: string[];
  /** `auto` (vídeos pesados), `all`, ou `false`. */
  proxies: ProxyMode;
  force: boolean;
  dryRun: boolean;
};

export function parseProxyMode(value: string | undefined): ProxyMode {
  if (value === undefined || value === 'none' || value === 'false') return false;
  if (value === 'auto' || value === 'all') return value;
  throw new Error(`--proxies aceita auto, all ou none (recebido: ${value})`);
}

/**
 * `caju media`: lê os assets de cada projeto (duração, tamanho, fps, áudio, hash), grava o que mudou
 * no project.json (com histórico, como o Studio) e gera miniaturas, formas de onda e proxies em
 * `<projeto>/.caju/media/`.
 */
export async function mediaCommand({ dir, ids, proxies, force, dryRun }: Opts): Promise<number> {
  const store = createProjectStore(dir);
  const targets = ids.length ? ids : (await store.list()).filter((p) => p.valid).map((p) => p.id);
  if (targets.length === 0) {
    console.log(`nenhum projeto em ${path.resolve(dir)}`);
    return ids.length ? 1 : 0;
  }
  let failures = 0;
  for (const id of targets) {
    let version: string;
    let project;
    try {
      version = await store.version(id);
      project = await store.read(id);
    } catch (err) {
      console.error(`✗ ${id}: ${(err as Error).message}`);
      failures++;
      continue;
    }
    const projectDir = await store.dir(id);
    const { project: next, reports } = await analyzeProject(projectDir, project, {
      proxies,
      force,
      write: !dryRun,
      onProgress: process.stdout.isTTY ? (asset, step) => process.stdout.write(`\r  ${id}: ${asset.id} (${step})`.padEnd(60)) : undefined,
    });
    if (process.stdout.isTTY) process.stdout.write(`\r${' '.repeat(60)}\r`);

    const changed = reports.filter((r) => r.changed.length);
    const problems = reports.filter((r) => r.status === 'missing' || r.status === 'error');
    const derived = reports.reduce((n, r) => n + Object.keys(r.derived).length, 0);
    for (const r of problems) {
      console.error(`  ✗ ${r.id} (${r.src}): ${r.status === 'missing' ? 'arquivo não encontrado' : r.error}`);
    }
    if (changed.length && !dryRun) {
      try {
        await store.write(id, next, new Date(), version); // recusa se o Studio salvou nesse meio-tempo
      } catch (err) {
        console.error(`✗ ${id}: ${(err as Error).message}`);
        failures++;
        continue;
      }
    }
    const what = changed.length
      ? `${changed.length} asset(s) ${dryRun ? 'mudariam' : 'atualizado(s)'}: ${changed.map((r) => `${r.id} (${r.changed.join(', ')})`).join('; ')}`
      : 'metadados em dia';
    console.log(`${problems.length ? '!' : '✓'} ${id}: ${reports.length} asset(s), ${what}; ${derived} derivado(s) no cache`);
    if (problems.length) failures++;
  }
  return failures ? 1 : 0;
}
