/**
 * Lint de determinismo: todo pixel renderizado precisa ser função pura do frame.
 * Proíbe APIs dependentes de relógio/aleatoriedade nos pacotes que desenham o vídeo.
 * Exceção pontual: comentário `caju-lint-allow` na mesma linha, com justificativa.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// regras compartilhadas com o `caju check` (pasta components/ do usuário)
import { lintDeterminismSource, sourceFiles } from '../packages/sdk/src/determinism';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Pacotes cujo código roda DENTRO do render. */
const RENDER_PACKAGES = ['core', 'renderer'];
/** Componentes de exemplo do repositório também precisam ser determinísticos. */
const EXTRA_DIRS = ['components'];

let problems = 0;
const dirs = [...RENDER_PACKAGES.map((pkg) => path.join(ROOT, 'packages', pkg, 'src')), ...EXTRA_DIRS.map((d) => path.join(ROOT, d))];
for (const dir of dirs) {
  for (const file of await sourceFiles(dir, /\.(ts|tsx)$/)) {
    for (const p of lintDeterminismSource(await readFile(file, 'utf8'), path.relative(ROOT, file))) {
      problems++;
      console.log(`${p.file}:${p.line}  ${p.message}`);
    }
  }
}

if (problems > 0) {
  console.log(`\n✗ ${problems} problema(s) de determinismo`);
  process.exit(1);
}
console.log(`✓ determinismo ok (${[...RENDER_PACKAGES, ...EXTRA_DIRS].join(', ')})`);
