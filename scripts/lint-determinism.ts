/**
 * Lint de determinismo: todo pixel renderizado precisa ser função pura do frame.
 * Proíbe APIs dependentes de relógio/aleatoriedade nos pacotes que desenham o vídeo.
 * Exceção pontual: comentário `caju-lint-allow` na mesma linha, com justificativa.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Pacotes cujo código roda DENTRO do render. */
const RENDER_PACKAGES = ['core', 'renderer'];

const BANNED: Array<[RegExp, string]> = [
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

async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(full);
  }
  return files;
}

let problems = 0;
for (const pkg of RENDER_PACKAGES) {
  for (const file of await walk(path.join(ROOT, 'packages', pkg, 'src'))) {
    const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (line.includes('caju-lint-allow') || line.includes('frame-lint-allow')) return;
      // ignora linhas de comentário (JSDoc/bloco) e comentários de fim de linha
      if (/^\s*(\*|\/\*|\/\/)/.test(line)) return;
      const code = line.replace(/\/\/.*$/, '');
      for (const [pattern, why] of BANNED) {
        if (pattern.test(code)) {
          problems++;
          console.log(`${path.relative(ROOT, file)}:${i + 1}  ${why}`);
        }
      }
    });
  }
}

if (problems > 0) {
  console.log(`\n✗ ${problems} problema(s) de determinismo`);
  process.exit(1);
}
console.log(`✓ determinismo ok (${RENDER_PACKAGES.join(', ')})`);
