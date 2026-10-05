import { createProjectStore } from '@caju-motion/server';

/** Valida todos os projetos de uma pasta. Retorna o exit code. */
export async function checkCommand({ dir, ids }: { dir: string; ids: string[] }): Promise<number> {
  const store = createProjectStore(dir);
  const summaries = await store.list();
  const targets = ids.length > 0 ? ids : summaries.map((s) => s.id);
  if (targets.length === 0) {
    console.log(`nenhum projeto encontrado em ${store.root}`);
    return 0;
  }

  let failures = 0;
  for (const id of targets) {
    try {
      const project = await store.read(id);
      const missing = await store.missingAssets(project);
      if (missing.length > 0) {
        failures++;
        console.log(`✗ ${id}: assets ausentes no disco:\n    ${missing.join('\n    ')}`);
      } else {
        console.log(`✓ ${id}`);
      }
    } catch (err) {
      failures++;
      console.log(`✗ ${id}:\n${String((err as Error).message).replace(/^/gm, '    ')}`);
    }
  }
  console.log(`\n${targets.length - failures}/${targets.length} projeto(s) válidos`);
  return failures === 0 ? 0 : 1;
}
