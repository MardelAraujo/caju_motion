import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Regras de determinismo: todo pixel renderizado precisa ser função pura do frame.
 * Usadas pelo lint do repositório (`npm run lint`) e pelo `caju check` (pasta `components/`).
 * Exceção pontual: comentário `caju-lint-allow` na mesma linha, com justificativa.
 */
export const DETERMINISM_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bDate\.now\s*\(/, 'Date.now() — use o frame'],
  [/\bnew\s+Date\s*\(/, 'new Date() — use o frame'],
  [/\bMath\.random\s*\(/, 'Math.random() — use random(seed) do @caju-motion/core'],
  [/\bperformance\.now\s*\(/, 'performance.now() — use o frame'],
  [/\bsetTimeout\s*\(/, 'setTimeout — animação deve depender só do frame'],
  [/\bsetInterval\s*\(/, 'setInterval — animação deve depender só do frame'],
  [/\brequestAnimationFrame\s*\(/, 'requestAnimationFrame — o player controla o tempo'],
  [/\bIntl\./, 'Intl — formatação varia por máquina; formate manualmente'],
  [/\btransition\s*:/, 'CSS transition — não é seekável; anime via frame'],
  [/\banimation\s*:/, 'CSS animation — não é seekável; anime via frame'],
];

export type DeterminismProblem = { file: string; line: number; message: string };

/** Verifica um arquivo-fonte (texto). Ignora linhas de comentário e comentários de fim de linha. */
export function lintDeterminismSource(source: string, file = '<código>'): DeterminismProblem[] {
  const problems: DeterminismProblem[] = [];
  source.split(/\r?\n/).forEach((line, i) => {
    if (line.includes('caju-lint-allow') || line.includes('frame-lint-allow')) return;
    if (/^\s*(\*|\/\*|\/\/)/.test(line)) return;
    const code = line.replace(/\/\/.*$/, '');
    for (const [pattern, message] of DETERMINISM_RULES) {
      if (pattern.test(code)) problems.push({ file, line: i + 1, message });
    }
  });
  return problems;
}

/** Arquivos-fonte de uma pasta (recursivo), sem testes, `.d.ts`, ocultos e `node_modules`. */
export async function sourceFiles(dir: string, exts = /\.(ts|tsx|js|jsx|mts|mjs)$/): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await sourceFiles(full, exts)));
    else if (exts.test(e.name) && !/\.(test|spec)\.[jt]sx?$/.test(e.name) && !e.name.endsWith('.d.ts')) files.push(full);
  }
  return files;
}

/** Verifica todos os arquivos-fonte de uma pasta. */
export async function lintDeterminismDir(dir: string): Promise<DeterminismProblem[]> {
  const out: DeterminismProblem[] = [];
  for (const file of await sourceFiles(dir)) out.push(...lintDeterminismSource(await readFile(file, 'utf8'), file));
  return out;
}
