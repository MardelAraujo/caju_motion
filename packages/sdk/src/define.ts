import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FormatId, Project } from '@caju-motion/schema';
import { ProjectBuilder, type BuilderOptions } from './builder';

export type ProjectMeta = {
  /** Id do projeto (= nome da pasta). */
  id: string;
  name?: string;
  format: FormatId;
  background?: string;
  /** Duração em frames. Omitida: fim do último clipe. */
  duration?: number;
  /** Mixagem do export: ducking da música sob a locução e loudness final. */
  audio?: BuilderOptions['audio'];
};

/** API recebida pela função de build: cenas, assets, áudio, trilhas, marcadores e componentes. */
export type ProjectApi = ProjectBuilder;

export type ProjectDefinition = {
  readonly __caju: 'project';
  readonly meta: ProjectMeta;
  readonly build: (p: ProjectApi) => void | Promise<void>;
};

/**
 * Define um vídeo por código. O `video.ts` da pasta do projeto exporta isto (default),
 * e o `caju build` gera o `project.json` mesclando com as edições feitas no Studio.
 *
 * ```ts
 * export default defineProject({ id: 'lancamento', format: 'reel-9x16', duration: 150 }, (p) => {
 *   p.scene('abertura', 'Abertura', 0, 90, (s) => {
 *     s.text('Olá', { size: 120, weight: 800 }, { x: 540, y: 960, enter: { at: 0 } });
 *     s.component('CountUp', { to: 100 }, { at: [30, 90] });
 *   });
 * });
 * ```
 */
export function defineProject(meta: ProjectMeta, build: ProjectDefinition['build']): ProjectDefinition {
  return { __caju: 'project', meta, build };
}

export function isProjectDefinition(value: unknown): value is ProjectDefinition {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { __caju?: unknown }).__caju === 'project' &&
    typeof (value as { build?: unknown }).build === 'function'
  );
}

/** Executa a definição e devolve o projeto validado (todos os clipes com `origin: 'code'`). */
export async function buildProject(def: ProjectDefinition): Promise<Project> {
  const b = new ProjectBuilder(def.meta);
  await def.build(b);
  return b.build();
}

/** Arquivos de código procurados na pasta do projeto, em ordem. */
export const VIDEO_FILES = ['video.ts', 'video.tsx', 'video.mts', 'video.js', 'video.mjs'];

export function findVideoFile(projectDir: string): string | null {
  for (const name of VIDEO_FILES) {
    const file = path.join(projectDir, name);
    if (existsSync(file)) return file;
  }
  return null;
}

/**
 * Carrega um `video.ts` (TypeScript via tsx, sem build) e devolve a definição exportada
 * (`export default defineProject(...)` ou qualquer export nomeado com a definição).
 */
export async function loadProjectDefinition(file: string): Promise<ProjectDefinition> {
  const { tsImport } = await import('tsx/esm/api');
  const url = pathToFileURL(path.resolve(file)).href;
  const mod = (await tsImport(url, import.meta.url)) as Record<string, unknown>;
  const nested = mod.default && typeof mod.default === 'object' ? (mod.default as Record<string, unknown>).default : undefined;
  const def = [mod.default, nested, ...Object.values(mod)].find(isProjectDefinition);
  if (!def) {
    throw new Error(`${path.basename(file)} não exporta um defineProject(...) (use \`export default defineProject(...)\`)`);
  }
  return def;
}
