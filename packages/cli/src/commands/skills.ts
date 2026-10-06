import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `caju skills add`: copia as skills de agente (pacote @caju-motion/skills) para `<destino>/.claude/skills/`
 * e, com `--agents all`, mantém um bloco marcado no AGENTS.md (Codex, Cursor, Gemini… leem esse arquivo).
 * Idempotente: só grava o que mudou.
 */

export const AGENTS_START = '<!-- caju-skills:start -->';
export const AGENTS_END = '<!-- caju-skills:end -->';

export type AgentsMode = 'claude' | 'all';

/**
 * Pasta `skills/` do @caju-motion/skills instalado; no monorepo, `packages/skills/skills`.
 * `from`: arquivo a partir do qual resolver (padrão: este módulo).
 */
export function resolveSkillsDir(from: string = fileURLToPath(import.meta.url)): string | null {
  try {
    const pkg = createRequire(from).resolve('@caju-motion/skills/package.json');
    const dir = path.join(path.dirname(pkg), 'skills');
    if (existsSync(dir)) return dir;
  } catch {
    // não instalado: tenta o repositório
  }
  for (let dir = path.dirname(from); ; ) {
    const candidate = path.join(dir, 'packages', 'skills', 'skills');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export type SkillInfo = { name: string; description: string; version: string };

/** Frontmatter simples (`chave: valor`) do SKILL.md. */
export function readSkillInfo(skillDir: string): SkillInfo {
  const text = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
  const field = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm)?.[1]?.trim() ?? '';
  return { name: field('name') || path.basename(skillDir), description: field('description'), version: field('version') };
}

/** Primeira frase da descrição (o resumo do AGENTS.md). */
export function firstSentence(text: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(text);
  return (m?.[1] ?? text).trim();
}

export function listSkills(skillsDir: string): string[] {
  return readdirSync(skillsDir)
    .filter((n) => existsSync(path.join(skillsDir, n, 'SKILL.md')))
    .sort();
}

function filesIn(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? filesIn(full, base) : [path.relative(base, full)];
  });
}

export type SkillChange = { skill: string; status: 'added' | 'updated' | 'unchanged'; files: number; removed: number };

/** Sincroniza uma skill (cópia exata: arquivos novos/alterados gravados, sobras removidas). */
function syncSkill(src: string, dest: string): Omit<SkillChange, 'skill'> {
  const existed = existsSync(dest);
  const srcFiles = filesIn(src);
  let changed = 0;
  for (const rel of srcFiles) {
    const from = path.join(src, rel);
    const to = path.join(dest, rel);
    const data = readFileSync(from);
    if (existsSync(to) && statSync(to).isFile() && readFileSync(to).equals(data)) continue;
    mkdirSync(path.dirname(to), { recursive: true });
    writeFileSync(to, data);
    changed++;
  }
  const keep = new Set(srcFiles);
  let removed = 0;
  for (const rel of filesIn(dest)) {
    if (keep.has(rel)) continue;
    rmSync(path.join(dest, rel), { force: true });
    removed++;
  }
  return { status: !existed ? 'added' : changed || removed ? 'updated' : 'unchanged', files: changed, removed };
}

/** Bloco do AGENTS.md com a lista de skills e onde estão. */
export function agentsBlock(skills: SkillInfo[], skillsPath = '.claude/skills'): string {
  return [
    AGENTS_START,
    '## Caju Motion skills',
    '',
    `This project uses Caju Motion (video by code + the Caju Studio timeline editor). Before creating, editing,`,
    `validating or rendering a video, read \`${skillsPath}/caju-best-practices/SKILL.md\` and follow it to the specific skill.`,
    '',
    ...skills.map((s) => `- \`${skillsPath}/${s.name}/SKILL.md\` — ${firstSentence(s.description)}`),
    '',
    `_Managed by \`caju skills add\`; edits inside this block are overwritten._`,
    AGENTS_END,
  ].join('\n');
}

/** Insere ou substitui o bloco marcado; preserva o resto do arquivo. */
export function upsertBlock(existing: string | null, block: string): string {
  if (existing === null || existing.trim() === '') return `${block}\n`;
  const start = existing.indexOf(AGENTS_START);
  const end = existing.indexOf(AGENTS_END);
  if (start !== -1 && end > start) {
    return existing.slice(0, start) + block + existing.slice(end + AGENTS_END.length);
  }
  return `${existing.replace(/\s*$/, '')}\n\n${block}\n`;
}

export type SkillsAddResult = {
  source: string;
  target: string;
  skills: SkillChange[];
  agentsMd: 'created' | 'updated' | 'unchanged' | null;
};

export function addSkills({ source, target, agents }: { source: string; target: string; agents: AgentsMode }): SkillsAddResult {
  const names = listSkills(source);
  if (!names.length) throw new Error(`nenhuma skill encontrada em ${source}`);
  const dest = path.join(target, '.claude', 'skills');
  const skills = names.map((name) => ({ skill: name, ...syncSkill(path.join(source, name), path.join(dest, name)) }));

  let agentsMd: SkillsAddResult['agentsMd'] = null;
  if (agents === 'all') {
    const file = path.join(target, 'AGENTS.md');
    const before = existsSync(file) ? readFileSync(file, 'utf8') : null;
    const after = upsertBlock(before, agentsBlock(names.map((n) => readSkillInfo(path.join(source, n)))));
    if (after === before) agentsMd = 'unchanged';
    else {
      writeFileSync(file, after);
      agentsMd = before === null ? 'created' : 'updated';
    }
  }
  return { source, target, skills, agentsMd };
}

const LABEL: Record<SkillChange['status'], string> = { added: 'adicionada', updated: 'atualizada', unchanged: 'sem mudanças' };

/** `caju skills add [--target <dir>] [--agents claude|all]`. */
export function skillsCommand({ action, target, agents }: { action?: string; target?: string; agents?: string }): number {
  if (action !== 'add') {
    console.error('uso: caju skills add [--target <pasta>] [--agents claude|all]');
    return 1;
  }
  const mode = (agents ?? 'claude') as AgentsMode;
  if (mode !== 'claude' && mode !== 'all') {
    console.error(`--agents inválido "${agents}" (use claude ou all)`);
    return 1;
  }
  const source = resolveSkillsDir();
  if (!source) {
    console.error('✗ skills não encontradas: instale o pacote @caju-motion/skills (npm i -D @caju-motion/skills)');
    return 1;
  }
  const dir = path.resolve(target ?? '.');
  const r = addSkills({ source, target: dir, agents: mode });
  const relative = path.relative(process.cwd(), dir);
  const shown = relative === '' ? '.' : relative.startsWith('..') || path.isAbsolute(relative) ? dir : relative;
  console.log(`skills do Caju → ${path.join(shown, '.claude', 'skills')}`);
  for (const s of r.skills) {
    const extra = s.status === 'updated' ? ` (${s.files} arquivo(s)${s.removed ? `, ${s.removed} removido(s)` : ''})` : '';
    console.log(`  ${s.status === 'unchanged' ? '·' : '✓'} ${s.skill}: ${LABEL[s.status]}${extra}`);
  }
  if (r.agentsMd) {
    const verb = { created: 'criado', updated: 'atualizado', unchanged: 'sem mudanças' }[r.agentsMd];
    console.log(`  ${r.agentsMd === 'unchanged' ? '·' : '✓'} AGENTS.md: ${verb}`);
  }
  const changed = r.skills.filter((s) => s.status !== 'unchanged').length;
  console.log(`\n${r.skills.length} skill(s)${changed ? `, ${changed} alterada(s)` : ', tudo em dia'}`);
  return 0;
}
