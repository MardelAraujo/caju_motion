import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createEmptyProject,
  ProjectSchema,
  safeParseProject,
  type FormatId,
  type Project,
} from '@caju-motion/schema';

/**
 * Repositório de projetos no disco. Um projeto = uma pasta com `project.json`.
 *   <dir>/<id>/project.json
 *   <dir>/<id>/assets/…
 *   <dir>/<id>/.caju/history/<timestamp>.json   (versões anteriores)
 */

export const PROJECT_FILE = 'project.json';
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export class ProjectStoreError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 422,
  ) {
    super(message);
    this.name = 'ProjectStoreError';
  }
}

export type ProjectSummary =
  | { id: string; valid: true; name: string; format: Project['settings']['format']; width: number; height: number; fps: number }
  | { id: string; valid: false; error: string };

export function assertProjectId(id: string): void {
  if (!ID_PATTERN.test(id) || id.includes('..')) {
    throw new ProjectStoreError(`id de projeto inválido: "${id}" (use letras, números, ".", "_" e "-")`, 400);
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export function createProjectStore(projectsDir: string) {
  const root = path.resolve(projectsDir);
  const dirOf = (id: string) => {
    assertProjectId(id);
    return path.join(root, id);
  };
  const fileOf = (id: string) => path.join(dirOf(id), PROJECT_FILE);

  async function readRaw(id: string): Promise<unknown> {
    const file = fileOf(id);
    if (!(await exists(file))) throw new ProjectStoreError(`projeto "${id}" não encontrado`, 404);
    const text = await readFile(file, 'utf8');
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new ProjectStoreError(`project.json de "${id}" não é JSON válido: ${(err as Error).message}`, 422);
    }
  }

  /** Grava de forma atômica (tmp + rename) para não corromper em caso de queda. */
  async function writeAtomic(file: string, data: unknown): Promise<void> {
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    await rename(tmp, file);
  }

  return {
    root,

    /** Pasta do projeto (lança 404 se não existir). */
    async dir(id: string): Promise<string> {
      const file = fileOf(id);
      if (!(await exists(file))) throw new ProjectStoreError(`projeto "${id}" não encontrado`, 404);
      return dirOf(id);
    },

    async list(): Promise<ProjectSummary[]> {
      if (!(await exists(root))) return [];
      const entries = await readdir(root, { withFileTypes: true });
      const out: ProjectSummary[] = [];
      for (const e of entries) {
        if (!e.isDirectory() || !ID_PATTERN.test(e.name)) continue;
        if (!(await exists(path.join(root, e.name, PROJECT_FILE)))) continue;
        try {
          const r = safeParseProject(await readRaw(e.name));
          out.push(
            r.success
              ? {
                  id: e.name,
                  valid: true,
                  name: r.project.name,
                  format: r.project.settings.format,
                  width: r.project.settings.width,
                  height: r.project.settings.height,
                  fps: r.project.settings.fps,
                }
              : { id: e.name, valid: false, error: r.error },
          );
        } catch (err) {
          out.push({ id: e.name, valid: false, error: (err as Error).message });
        }
      }
      return out.sort((a, b) => a.id.localeCompare(b.id));
    },

    async read(id: string): Promise<Project> {
      const r = safeParseProject(await readRaw(id));
      if (!r.success) throw new ProjectStoreError(r.error, 422);
      return r.project;
    },

    /**
     * Versão = hash do arquivo no disco. Muda sempre que alguém grava (Studio, gerador,
     * edição manual): é assim que o Studio percebe que o projeto mudou por fora.
     */
    async version(id: string): Promise<string> {
      const file = fileOf(id);
      if (!(await exists(file))) throw new ProjectStoreError(`projeto "${id}" não encontrado`, 404);
      return createHash('sha1').update(await readFile(file)).digest('hex').slice(0, 16);
    },

    /**
     * Valida, guarda a versão anterior no histórico e grava.
     * `baseVersion`: versão que o cliente abriu; se o disco mudou desde então, recusa (409).
     */
    async write(id: string, doc: unknown, now = new Date(), baseVersion?: string): Promise<Project> {
      const parsed = ProjectSchema.safeParse(doc);
      if (!parsed.success) {
        const r = safeParseProject(doc);
        throw new ProjectStoreError(r.success ? 'projeto inválido' : r.error, 422);
      }
      const project = parsed.data;
      if (project.id !== id) throw new ProjectStoreError(`id do documento ("${project.id}") difere da URL ("${id}")`, 400);

      const file = fileOf(id);
      if (!(await exists(file))) throw new ProjectStoreError(`projeto "${id}" não encontrado`, 404);
      if (baseVersion && baseVersion !== (await this.version(id))) {
        throw new ProjectStoreError(
          `o projeto "${id}" foi alterado no disco desde que foi aberto (por exemplo, regenerado). Recarregue para não sobrescrever essas mudanças.`,
          409,
        );
      }

      const historyDir = path.join(dirOf(id), '.caju', 'history');
      await mkdir(historyDir, { recursive: true });
      const stamp = now.toISOString().replace(/[:.]/g, '-');
      await writeFile(path.join(historyDir, `${stamp}.json`), await readFile(file, 'utf8'), 'utf8');

      const next: Project = { ...project, meta: { ...project.meta, updatedAt: now.toISOString() } };
      await writeAtomic(file, next);
      return next;
    },

    async create(id: string, opts: { name?: string; format?: FormatId } = {}, now = new Date()): Promise<Project> {
      const dir = dirOf(id);
      if (await exists(path.join(dir, PROJECT_FILE))) throw new ProjectStoreError(`projeto "${id}" já existe`, 409);
      await mkdir(path.join(dir, 'assets'), { recursive: true });
      const project = createEmptyProject({ id, ...opts, now: now.toISOString() });
      await writeAtomic(path.join(dir, PROJECT_FILE), project);
      return project;
    },

    /** Assets referenciados que não existem no disco (apenas caminhos relativos). */
    async missingAssets(project: Project): Promise<string[]> {
      const missing: string[] = [];
      for (const asset of project.assets) {
        if (asset.src.includes('://')) continue;
        if (!(await exists(path.join(dirOf(project.id), asset.src)))) missing.push(asset.src);
      }
      return missing;
    },
  };
}

export type ProjectStore = ReturnType<typeof createProjectStore>;
