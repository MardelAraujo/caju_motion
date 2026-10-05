import path from 'node:path';
import { FORMAT_IDS, type FormatId } from '@caju-motion/schema';
import { createProjectStore } from '@caju-motion/server';

export async function newCommand({ dir, id, format }: { dir: string; id: string; format: string }): Promise<number> {
  if (!(FORMAT_IDS as readonly string[]).includes(format)) {
    console.error(`formato inválido "${format}". Use: ${FORMAT_IDS.join(', ')}`);
    return 1;
  }
  const store = createProjectStore(dir);
  const project = await store.create(id, { format: format as FormatId });
  console.log(`✓ projeto criado: ${path.join(store.root, id)}`);
  console.log(`  ${project.settings.width}×${project.settings.height} @ ${project.settings.fps}fps`);
  return 0;
}
