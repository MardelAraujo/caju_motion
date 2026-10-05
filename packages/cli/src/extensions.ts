import path from 'node:path';
import type { ApiExtension } from '@caju-motion/server';

export type ExtensionContext = {
  /** Pasta de projetos (`--dir`). */
  projectsDir: string;
  /** Pasta de componentes do usuário (`--components`, padrão: `<dir>/../components`). */
  componentsDir: string;
};

export function componentsDirFor(projectsDir: string, explicit?: string): string {
  return path.resolve(explicit ?? path.join(projectsDir, '..', 'components'));
}

/**
 * Extensões da API montadas pelo `caju studio` (dev e produção) e pelo render.
 * Cada recurso (render, componentes) registra suas rotas aqui, sem acoplar o servidor a eles.
 */
export async function studioExtensions(_ctx: ExtensionContext): Promise<ApiExtension[]> {
  return [];
}
