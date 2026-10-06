/**
 * Copia as skills para `<destino>/.claude/skills/` (padrão: raiz do repo), com a mesma lógica do
 * `caju skills add` (idempotente; `--agents all` também atualiza o AGENTS.md).
 * Uso: npm run skills:install [-- <destino>] [--agents all]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addSkills } from '../../cli/src/commands/skills';

const SKILLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const ROOT = path.resolve(SKILLS_DIR, '..', '..', '..');

const args = process.argv.slice(2);
const agents = args.includes('--agents') && args[args.indexOf('--agents') + 1] === 'all' ? 'all' : 'claude';
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--agents');
const target = path.resolve(positional[0] ?? ROOT);

const r = addSkills({ source: SKILLS_DIR, target, agents });
for (const s of r.skills) console.log(`${s.status === 'unchanged' ? '·' : '✓'} ${path.join(target, '.claude', 'skills', s.skill)} (${s.status})`);
if (r.agentsMd) console.log(`${r.agentsMd === 'unchanged' ? '·' : '✓'} ${path.join(target, 'AGENTS.md')} (${r.agentsMd})`);
