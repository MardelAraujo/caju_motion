import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

type Meta = { createdAt?: string; updatedAt?: string };

/**
 * O projeto foi salvo no Studio depois de criado? `caju new` e `caju build` (sem clipes do editor)
 * gravam `createdAt === updatedAt` (ou nenhum dos dois); o Studio reescreve `updatedAt` ao salvar.
 */
export function wasEditedInStudio(meta: Meta | undefined): boolean {
  if (!meta?.updatedAt) return false;
  return meta.updatedAt !== meta.createdAt;
}

/**
 * Antes de regenerar (scripts antigos, sem merge): se o projeto foi SALVO no Studio,
 * não sobrescreve sem `--force` — e, mesmo com `--force`, guarda uma cópia em `.cache/backups/`.
 * Projeto recém-criado (`caju new`, updatedAt igual a createdAt) não é considerado editado.
 */
export function guardOverwrite(projectDir: string, rootDir: string, force: boolean): void {
  const file = path.join(projectDir, 'project.json');
  if (!existsSync(file)) return;
  let edited: string | undefined;
  try {
    const meta = (JSON.parse(readFileSync(file, 'utf8')) as { meta?: Meta }).meta;
    edited = wasEditedInStudio(meta) ? meta!.updatedAt : undefined;
  } catch {
    edited = 'desconhecido';
  }
  if (!edited) return;
  const id = path.basename(projectDir);
  if (!force) {
    throw new Error(
      `o projeto "${id}" foi editado no Studio (salvo em ${edited}). Regenerar apaga essas edições.\n` +
        '  Use --force para regenerar mesmo assim (uma cópia vai para .cache/backups/).',
    );
  }
  const dir = path.join(rootDir, '.cache', 'backups');
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${id}-${edited.replace(/[:.]/g, '-')}.json`);
  copyFileSync(file, dest);
  console.log(`• backup das edições: ${path.relative(rootDir, dest)}`);
}
