import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { safeParseProject } from '@caju-motion/schema';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = path.join(PKG, 'skills');
const ROOT = path.resolve(PKG, '..', '..');

const skillNames = readdirSync(SKILLS);
const mdFiles = skillNames.flatMap((s) =>
  readdirSync(path.join(SKILLS, s))
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(SKILLS, s, f)),
);

/** Blocos cercados com uma info string específica (ex.: "json caju-project"). */
function blocks(file: string, info: RegExp): string[] {
  const out: string[] = [];
  const re = /^```([^\n]*)\n([\s\S]*?)^```\s*$/gm;
  const text = readFileSync(file, 'utf8');
  for (let m = re.exec(text); m; m = re.exec(text)) if (info.test(m[1]!.trim())) out.push(m[2]!);
  return out;
}

describe('skills: estrutura', () => {
  it.each(skillNames)('%s tem SKILL.md com frontmatter válido', (name) => {
    const text = readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(text.replace(/\r\n/g, '\n'))?.[1];
    expect(fm, 'frontmatter ausente').toBeTruthy();
    const field = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm!)?.[1]?.trim();
    expect(field('name')).toBe(name);
    expect(field('description')?.length ?? 0).toBeGreaterThan(40);
    expect(field('description')!.length).toBeLessThanOrEqual(1024);
    expect(field('version')).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('links relativos apontam para arquivos existentes', () => {
    const broken: string[] = [];
    for (const file of mdFiles) {
      const text = readFileSync(file, 'utf8');
      for (const [, href] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:/i.test(href!)) continue;
        if (!existsSync(path.resolve(path.dirname(file), href!))) broken.push(`${path.relative(SKILLS, file)} → ${href}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('o roteador cita todas as outras skills', () => {
    const router = readFileSync(path.join(SKILLS, 'caju-best-practices', 'SKILL.md'), 'utf8');
    for (const name of skillNames.filter((n) => n !== 'caju-best-practices')) expect(router).toContain(`../${name}/SKILL.md`);
  });
});

describe('skills: exemplos', () => {
  const projects = mdFiles.flatMap((f) => blocks(f, /^json caju-project$/).map((code) => ({ f, code })));

  it('há exemplos de projeto para validar', () => expect(projects.length).toBeGreaterThan(0));

  it.each(projects.map((p, i) => [`${path.relative(SKILLS, p.f)} #${i + 1}`, p.code] as const))(
    '%s passa no schema',
    (_label, code) => {
      const result = safeParseProject(JSON.parse(code));
      expect(result.success ? 'ok' : result.error).toBe('ok');
    },
  );

  it('blocos ts/tsx "caju-check" compilam contra os pacotes reais', () => {
    const tmp = path.join(PKG, '.check');
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    const files: string[] = [];
    mdFiles.forEach((f) => {
      blocks(f, /^tsx? caju-check$/).forEach((code, i) => {
        const tsx = /<[A-Z]/.test(code);
        const file = path.join(tmp, `${path.basename(path.dirname(f))}-${path.basename(f, '.md')}-${i}.${tsx ? 'tsx' : 'ts'}`);
        // exemplos de gerador importam o builder relativo a scripts/<pasta>/
        const fixed = code.replace(/'\.\.\/examples\/builder'/g, JSON.stringify(path.join(ROOT, 'scripts', 'examples', 'builder').replace(/\\/g, '/')));
        writeFileSync(file, fixed);
        files.push(file);
      });
    });
    expect(files.length).toBeGreaterThan(0);

    const { config } = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile);
    const { options } = ts.parseJsonConfigFileContent(config, ts.sys, ROOT);
    const program = ts.createProgram(files, { ...options, noEmit: true });
    const errors = ts
      .getPreEmitDiagnostics(program)
      .filter((d) => d.file && files.includes(path.normalize(d.file.fileName)))
      .map((d) => `${path.basename(d.file!.fileName)}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    rmSync(tmp, { recursive: true, force: true });
    expect(errors).toEqual([]);
  }, 60_000);
});
