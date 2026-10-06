import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addSkills, AGENTS_END, AGENTS_START, firstSentence, resolveSkillsDir, upsertBlock } from './skills';

let tmp: string;
let source: string;

function skill(name: string, files: Record<string, string>) {
  const dir = path.join(source, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: Does ${name} things. More detail here.\nversion: 1.0.0\n---\n# ${name}\n`);
  for (const [f, c] of Object.entries(files)) writeFileSync(path.join(dir, f), c);
}

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'caju-skills-'));
  source = path.join(tmp, 'src');
  skill('caju-a', { 'rules.md': 'regra 1' });
  skill('caju-b', {});
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('caju skills add', () => {
  it('encontra as skills do monorepo', () => {
    const dir = resolveSkillsDir();
    expect(dir).toBeTruthy();
    expect(existsSync(path.join(dir!, 'caju-best-practices', 'SKILL.md'))).toBe(true);
  });

  it('copia para .claude/skills e é idempotente', () => {
    const target = path.join(tmp, 'proj');
    const r1 = addSkills({ source, target, agents: 'claude' });
    expect(r1.skills.map((s) => s.status)).toEqual(['added', 'added']);
    expect(r1.agentsMd).toBeNull();
    expect(readFileSync(path.join(target, '.claude', 'skills', 'caju-a', 'rules.md'), 'utf8')).toBe('regra 1');
    expect(existsSync(path.join(target, 'AGENTS.md'))).toBe(false);

    const r2 = addSkills({ source, target, agents: 'claude' });
    expect(r2.skills.map((s) => s.status)).toEqual(['unchanged', 'unchanged']);

    // mudança na origem + arquivo que sumiu da origem
    writeFileSync(path.join(source, 'caju-a', 'rules.md'), 'regra 2');
    writeFileSync(path.join(target, '.claude', 'skills', 'caju-a', 'velho.md'), 'x');
    const r3 = addSkills({ source, target, agents: 'claude' });
    expect(r3.skills[0]).toMatchObject({ skill: 'caju-a', status: 'updated', files: 1, removed: 1 });
    expect(r3.skills[1]!.status).toBe('unchanged');
    expect(existsSync(path.join(target, '.claude', 'skills', 'caju-a', 'velho.md'))).toBe(false);
  });

  it('--agents all: cria/atualiza só o bloco marcado do AGENTS.md', () => {
    const target = path.join(tmp, 'proj');
    mkdirSync(target);
    writeFileSync(path.join(target, 'AGENTS.md'), '# Meu projeto\n\nRegras da casa.\n');
    expect(addSkills({ source, target, agents: 'all' }).agentsMd).toBe('updated');
    const text = readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
    expect(text.startsWith('# Meu projeto\n\nRegras da casa.\n\n<!-- caju-skills:start -->')).toBe(true);
    expect(text).toContain('`.claude/skills/caju-a/SKILL.md` — Does caju-a things.');
    expect(text).not.toContain('More detail');

    expect(addSkills({ source, target, agents: 'all' }).agentsMd).toBe('unchanged');

    // edição do usuário fora do bloco é preservada; skill nova entra no bloco
    writeFileSync(path.join(target, 'AGENTS.md'), `${readFileSync(path.join(target, 'AGENTS.md'), 'utf8')}\nRodapé meu.\n`);
    skill('caju-c', {});
    expect(addSkills({ source, target, agents: 'all' }).agentsMd).toBe('updated');
    const after = readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
    expect(after).toContain('caju-c/SKILL.md');
    expect(after).toContain('Regras da casa.');
    expect(after).toContain('Rodapé meu.');
    expect(after.split(AGENTS_START)).toHaveLength(2);

    const fresh = path.join(tmp, 'novo');
    expect(addSkills({ source, target: fresh, agents: 'all' }).agentsMd).toBe('created');
  });

  it('upsertBlock e firstSentence', () => {
    const block = `${AGENTS_START}\nX\n${AGENTS_END}`;
    expect(upsertBlock(null, block)).toBe(`${block}\n`);
    expect(upsertBlock(`a\n${AGENTS_START}\nvelho\n${AGENTS_END}\nb\n`, block)).toBe(`a\n${block}\nb\n`);
    expect(firstSentence('Use it. Then more.')).toBe('Use it.');
    expect(firstSentence('No period')).toBe('No period');
    expect(firstSentence('Supports v1.2 files. Next.')).toBe('Supports v1.2 files.');
  });
});
