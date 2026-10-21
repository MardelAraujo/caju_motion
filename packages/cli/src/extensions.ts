import path from 'node:path';
import { renderRoutes } from '@caju-motion/renderer-node';
import { componentsRoutes, type ApiExtension } from '@caju-motion/server';
import { voiceRoutes } from './voice-routes';

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
export async function studioExtensions(ctx: ExtensionContext): Promise<ApiExtension[]> {
  return [
    // componentes React do usuário (bundle esbuild + versão para recarga a quente)
    componentsRoutes({ componentsDir: ctx.componentsDir }),
    // render: usa a origem da própria requisição como servidor das páginas (componentes inclusos)
    renderRoutes(),
    // voz: locução (TTS) e legendas por transcrição, gravadas no projeto
    voiceRoutes(),
  ];
}
