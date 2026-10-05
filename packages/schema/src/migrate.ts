import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION, ProjectSchema, type Project } from './project';

/**
 * Migrações do documento. Chave = versão DE ORIGEM; a função devolve o doc na versão seguinte.
 * Regra: toda mudança de formato adiciona uma entrada aqui + um teste com um doc antigo real.
 */
type RawDoc = Record<string, unknown>;
export type Migration = (doc: RawDoc) => RawDoc;

export const MIGRATIONS: Record<number, Migration> = {
  // 1: (doc) => ({ ...doc, novoCampo: ... }),
};

export class ProjectFormatError extends Error {
  override name = 'ProjectFormatError';
}

function isRecord(value: unknown): value is RawDoc {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Leva um doc de qualquer versão conhecida até a versão atual (sem validar o resto). */
export function migrateProject(
  raw: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
  target: number = CURRENT_SCHEMA_VERSION,
): RawDoc {
  if (!isRecord(raw)) throw new ProjectFormatError('projeto não é um objeto JSON');
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ProjectFormatError('schemaVersion ausente ou inválido');
  }
  if (version > target) {
    throw new ProjectFormatError(
      `projeto criado por uma versão mais nova do Caju Motion (schema v${version}; esta versão entende até v${target}). Atualize o Caju Motion.`,
    );
  }

  let doc = raw;
  for (let v = version; v < target; v++) {
    const migrate = migrations[v];
    if (!migrate) throw new ProjectFormatError(`sem migração de schema v${v} para v${v + 1}`);
    doc = { ...migrate(doc), schemaVersion: v + 1 };
  }
  return doc;
}

/** Migra + valida. Lança `ProjectFormatError` com mensagem legível. */
export function parseProject(raw: unknown): Project {
  const result = safeParseProject(raw);
  if (!result.success) throw new ProjectFormatError(result.error);
  return result.project;
}

export type SafeParseResult = { success: true; project: Project } | { success: false; error: string };

export function safeParseProject(raw: unknown): SafeParseResult {
  let migrated: RawDoc;
  try {
    migrated = migrateProject(raw);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
  const parsed = ProjectSchema.safeParse(migrated);
  if (!parsed.success) return { success: false, error: z.prettifyError(parsed.error) };
  return { success: true, project: parsed.data };
}
