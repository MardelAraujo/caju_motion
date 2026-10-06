import { createHash } from 'node:crypto';
import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ApiExtension } from './api';

/**
 * Componentes do usuário (pasta `components/`): bundle ESM com esbuild, servido ao Studio
 * e ao exportador. React e os pacotes do Caju NÃO vão no bundle: viram leituras de
 * `globalThis.__cajuRuntime[<módulo>]`, preenchido pelo app (mesma instância do React).
 * O resto (zod, utilitários) é empacotado junto.
 */

/** Módulos fornecidos pelo app em `globalThis.__cajuRuntime`. */
export const RUNTIME_MODULES = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  '@caju-motion/core',
  '@caju-motion/renderer',
] as const;

const SOURCE = /\.(tsx|ts|jsx|js|mts|mjs)$/;
const IGNORED = /\.(test|spec)\.[jt]sx?$|\.d\.ts$/;

/**
 * Arquivos de entrada: fontes no topo de `components/` e `components/<pasta>/index.*`.
 * Arquivos em subpastas só entram se importados (podem ser helpers).
 */
export async function componentEntries(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.') || e.name.startsWith('_') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isFile() && SOURCE.test(e.name) && !IGNORED.test(e.name)) out.push(full);
    else if (e.isDirectory()) {
      const inner = await readdir(full).catch(() => [] as string[]);
      const index = inner.sort().find((n) => /^index\.(tsx|ts|jsx|js)$/.test(n));
      if (index) out.push(path.join(full, index));
    }
  }
  return out;
}

/** Todos os arquivos que afetam o bundle (para a versão), sem node_modules. */
async function watchedFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await watchedFiles(full)));
    else if (e.isFile()) out.push(full);
  }
  return out.sort();
}

/** Versão da pasta (hash de caminho + tamanho + mtime). Barato: o Studio consulta a cada segundo. */
export async function componentsVersion(dir: string): Promise<string> {
  const files = await watchedFiles(dir);
  if (files.length === 0) return 'empty';
  const h = createHash('sha1');
  for (const f of files) {
    const s = await stat(f).catch(() => null);
    if (s) h.update(`${path.relative(dir, f)}|${s.size}|${s.mtimeMs}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

export type ComponentsBuild =
  /** `files`: entradas, relativas à pasta (com `/`). */
  | { ok: true; code: string; files: string[]; warnings: string[] }
  | { ok: false; errors: string[]; files: string[] };

/**
 * Empacota os componentes num módulo ESM que exporta `modules` (os módulos de cada entrada).
 * Quem carrega usa `componentsFromModule` em cada um.
 */
export async function buildComponentsBundle(dir: string, opts: { minify?: boolean } = {}): Promise<ComponentsBuild> {
  // caminho real (no Windows, o tmp pode vir como MARDEL~1): mensagens relativas à pasta
  const root = await realpath(path.resolve(dir)).catch(() => path.resolve(dir));
  const files = await componentEntries(root);
  if (files.length === 0) return { ok: true, code: 'export const modules = [];\n', files: [], warnings: [] };

  const esbuild = await import('esbuild');
  const entry =
    files.map((f, i) => `import * as m${i} from ${JSON.stringify(f.split(path.sep).join('/'))};`).join('\n') +
    `\nexport const modules = [${files.map((_, i) => `m${i}`).join(', ')}];\n` +
    `export const files = ${JSON.stringify(files.map((f) => path.relative(root, f).split(path.sep).join('/')))};\n`;

  const rel = files.map((f) => path.relative(root, f).split(path.sep).join('/'));
  const runtime = new Set<string>(RUNTIME_MODULES);
  try {
    const result = await esbuild.build({
      stdin: { contents: entry, resolveDir: root, sourcefile: 'caju-components-entry.js', loader: 'js' },
      absWorkingDir: root,
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      jsx: 'automatic',
      minify: opts.minify ?? false,
      sourcemap: 'inline',
      sourceRoot: root,
      logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [
        {
          name: 'caju-runtime-globals',
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => (runtime.has(args.path) ? { path: args.path, namespace: 'caju-runtime' } : undefined));
            build.onLoad({ filter: /.*/, namespace: 'caju-runtime' }, (args) => ({
              contents:
                `const rt = globalThis.__cajuRuntime;\n` +
                `if (!rt || !rt[${JSON.stringify(args.path)}]) throw new Error(${JSON.stringify(`runtime do Caju sem "${args.path}"`)});\n` +
                `module.exports = rt[${JSON.stringify(args.path)}];\n`,
              loader: 'js',
            }));
          },
        },
      ],
    });
    return {
      ok: true,
      code: result.outputFiles[0]!.text,
      files: rel,
      warnings: result.warnings.map((w) => formatMessage(w, root)),
    };
  } catch (err) {
    const errors = (err as { errors?: Parameters<typeof formatMessage>[0][] }).errors;
    return { ok: false, files: rel, errors: errors?.length ? errors.map((e) => formatMessage(e, root)) : [String((err as Error).message)] };
  }
}

function formatMessage(m: { text: string; location?: { file: string; line: number; column: number } | null }, root: string): string {
  if (!m.location) return m.text;
  const file = path.isAbsolute(m.location.file) ? path.relative(root, m.location.file) : m.location.file;
  return `${file}:${m.location.line}:${m.location.column + 1}: ${m.text}`;
}

/** Cache por versão: o bundle só é refeito quando algum arquivo muda. */
export function createComponentsBundler(dir: string) {
  let cached: { version: string; build: Promise<ComponentsBuild> } | null = null;
  return {
    dir: path.resolve(dir),
    version: () => componentsVersion(dir),
    async build(): Promise<{ version: string; build: ComponentsBuild }> {
      const version = await componentsVersion(dir);
      if (!cached || cached.version !== version) cached = { version, build: buildComponentsBundle(dir) };
      return { version, build: await cached.build };
    },
  };
}

/**
 * Rotas `/api/components/*`:
 * - `GET /components/version` → `{ version, dir, ok, errors? }` (o Studio consulta para recarregar);
 * - `GET /components/bundle.js` → módulo ESM (`export const modules`), ou 422 com `{ errors }`.
 */
export function componentsRoutes({ componentsDir }: { componentsDir: string }): ApiExtension {
  const bundler = createComponentsBundler(componentsDir);
  return (app) => {
    app.get('/components/version', async (c) => {
      const { version, build } = await bundler.build();
      return c.json({
        version,
        dir: bundler.dir,
        ok: build.ok,
        files: build.files,
        ...(build.ok ? {} : { errors: build.errors }),
      });
    });
    app.get('/components/bundle.js', async (c) => {
      const { version, build } = await bundler.build();
      if (!build.ok) return c.json({ version, errors: build.errors }, 422);
      return c.body(build.code, 200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
        'x-caju-components-version': version,
      });
    });
  };
}
