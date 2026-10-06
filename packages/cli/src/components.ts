import { buildComponentsBundle } from '@caju-motion/server';

export type LoadedComponents =
  | { ok: true; names: string[]; files: string[]; skipped?: string }
  | { ok: false; errors: string[]; files: string[] };

/**
 * Compila `components/` e, se React e o renderer estiverem instalados, executa o bundle no Node
 * para descobrir os nomes registrados (`defineComponent`). Sem eles, só compila.
 */
export async function loadComponentsInNode(dir: string): Promise<LoadedComponents> {
  const build = await buildComponentsBundle(dir);
  if (!build.ok) return { ok: false, errors: build.errors, files: build.files };
  if (build.files.length === 0) return { ok: true, names: [], files: [] };

  // nomes de módulo em variáveis: o bundler da CLI não deve tentar empacotá-los
  const modules = ['react', 'react/jsx-runtime', 'react-dom', '@caju-motion/core', '@caju-motion/renderer'];
  let runtime: Record<string, unknown>;
  try {
    const loaded = await Promise.all(modules.map((m) => import(m) as Promise<unknown>));
    runtime = Object.fromEntries(modules.map((m, i) => [m, loaded[i]]));
    runtime['react/jsx-dev-runtime'] = runtime['react/jsx-runtime'];
  } catch {
    return { ok: true, names: [], files: build.files, skipped: 'React/@caju-motion/renderer não instalados: nomes não verificados' };
  }

  const g = globalThis as { __cajuRuntime?: Record<string, unknown> };
  const previous = g.__cajuRuntime;
  g.__cajuRuntime = runtime;
  try {
    const url = `data:text/javascript;base64,${Buffer.from(build.code).toString('base64')}`;
    const mod = (await import(url)) as { modules?: Record<string, unknown>[] };
    const renderer = runtime['@caju-motion/renderer'] as typeof import('@caju-motion/renderer');
    const defs = (mod.modules ?? []).flatMap((m) => renderer.componentsFromModule(m));
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const d of defs) (seen.has(d.name) ? dups : seen).add(d.name);
    if (dups.size) return { ok: false, files: build.files, errors: [...dups].map((n) => `componente "${n}" definido mais de uma vez`) };
    return { ok: true, names: [...seen].sort(), files: build.files };
  } catch (err) {
    return { ok: false, files: build.files, errors: [`erro ao executar components/: ${(err as Error).message}`] };
  } finally {
    g.__cajuRuntime = previous;
  }
}
