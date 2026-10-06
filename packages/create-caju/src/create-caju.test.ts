import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { main, parseCliArgs } from './main';
import type { Prompter } from './prompts';
import { detectPackageManager, isDirEmpty, ownVersion, runScript, scaffold, toPackageName, TSCONFIG } from './scaffold';
import { TEMPLATES, TEMPLATES_DIR } from './templates';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(PKG, '..', '..');

describe('create-caju: utilitários', () => {
  it('detecta o gerenciador pelo npm_config_user_agent', () => {
    expect(detectPackageManager('pnpm/9.12.0 npm/? node/v22.11.0 win32 x64')).toBe('pnpm');
    expect(detectPackageManager('yarn/4.5.0 npm/? node/v22.11.0')).toBe('yarn');
    expect(detectPackageManager('bun/1.1.0 npm/? node/v22')).toBe('bun');
    expect(detectPackageManager('npm/10.9.0 node/v22.11.0')).toBe('npm');
    expect(detectPackageManager(undefined)).toBe('npm');
    expect(detectPackageManager('deno/2.0')).toBe('npm');
  });

  it('gera nomes de pacote válidos', () => {
    expect(toPackageName('Meu Vídeo!')).toBe('meu-video');
    expect(toPackageName('lançamento_2026')).toBe('lancamento_2026');
    expect(toPackageName('...')).toBe('meu-video');
  });

  it('monta comandos por gerenciador', () => {
    expect(runScript('npm', 'render', ['reel'])).toBe('npm run render -- reel');
    expect(runScript('npm', 'dev')).toBe('npm run dev');
    expect(runScript('pnpm', 'render', ['reel'])).toBe('pnpm render reel');
    expect(runScript('bun', 'dev')).toBe('bun run dev');
  });

  it('lê as flags', () => {
    expect(parseCliArgs(['meu', '--template', 'audiograma', '--yes', '--no-install', '--no-skills', '--pm', 'pnpm'])).toMatchObject({
      dir: 'meu',
      template: 'audiograma',
      yes: true,
      install: false,
      skills: false,
      pm: 'pnpm',
    });
    const bare = parseCliArgs([]);
    expect(bare.install).toBeUndefined();
    expect(bare.skills).toBeUndefined();
    expect(parseCliArgs(['-y', '--skills']).skills).toBe(true);
    expect(() => parseCliArgs(['--template', 'nao-existe'])).toThrow(/template desconhecido/);
    expect(() => parseCliArgs(['--pm', 'cargo'])).toThrow(/--pm inválido/);
  });
});

describe('create-caju: templates', () => {
  it('a pasta templates/ tem exatamente os templates registrados', () => {
    expect(readdirSync(TEMPLATES_DIR).sort()).toEqual(TEMPLATES.map((t) => t.name).sort());
  });

  it.each(TEMPLATES.map((t) => [t.name, t] as const))('%s: video.ts, project.json, último build e componentes', (_n, t) => {
    const dir = path.join(TEMPLATES_DIR, t.name);
    for (const f of ['video.ts', 'project.json', path.join('.caju', 'last-build.json')]) {
      expect(existsSync(path.join(dir, 'projects', t.project, f)), f).toBe(true);
    }
    const comps = existsSync(path.join(dir, 'components'))
      ? readdirSync(path.join(dir, 'components')).filter((f) => f.endsWith('.tsx')).map((f) => f.replace(/\.tsx$/, ''))
      : [];
    expect(comps.sort()).toEqual([...t.components].sort());
    // nada de binários grandes nos templates
    const big = readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => path.join(e.parentPath, e.name))
      .filter((f) => readFileSync(f).length > 100 * 1024);
    expect(big).toEqual([]);
  });

  it('video.ts e components/ de todos os templates passam no TypeScript (strict)', () => {
    const files = TEMPLATES.flatMap((t) => {
      const dir = path.join(TEMPLATES_DIR, t.name);
      const comps = path.join(dir, 'components');
      return [
        path.join(dir, 'projects', t.project, 'video.ts'),
        ...(existsSync(comps) ? readdirSync(comps).filter((f) => f.endsWith('.tsx')).map((f) => path.join(comps, f)) : []),
      ];
    });
    const { options, errors } = ts.convertCompilerOptionsFromJson(
      // as mesmas opções do tsconfig gerado; no repo os pacotes resolvem pelo código-fonte
      { ...TSCONFIG.compilerOptions, customConditions: ['source'], types: [] },
      ROOT,
    );
    expect(errors).toEqual([]);
    const program = ts.createProgram(files, options);
    const diags = ts.getPreEmitDiagnostics(program).filter((d) => d.file && files.includes(path.resolve(d.file.fileName)));
    expect(diags.map((d) => `${path.relative(TEMPLATES_DIR, d.file!.fileName)}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)).toEqual([]);
  }, 120_000);
});

describe('create-caju: scaffold + caju build + caju check', () => {
  let tmp: string;
  beforeAll(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'caju-create-'));
  });
  afterAll(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('recusa pasta não vazia e template desconhecido', () => {
    expect(() => scaffold({ targetDir: PKG, template: 'blank' })).toThrow(/não está vazia/);
    expect(() => scaffold({ targetDir: path.join(tmp, 'x'), template: 'nao-existe' })).toThrow(/template desconhecido/);
    expect(isDirEmpty(path.join(tmp, 'nao-existe'))).toBe(true);
  });

  it('modo interativo: pergunta pasta, template, instalação e skills', async () => {
    const asked: string[] = [];
    const prompter: Prompter = {
      text: async (m) => (asked.push(m), path.join(tmp, 'interativo')),
      select: async <T extends string>(m: string, options: { value: T }[]) => (asked.push(m), options.find((o) => o.value === 'data-video')!.value),
      confirm: async (m) => (asked.push(m), false),
      close: () => undefined,
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      expect(await main([], prompter)).toBe(0);
    } finally {
      log.mockRestore();
    }
    expect(asked).toHaveLength(4);
    expect(existsSync(path.join(tmp, 'interativo', 'projects', 'dados', 'assets', 'data', 'vendas.json'))).toBe(true);
    expect(existsSync(path.join(tmp, 'interativo', 'node_modules'))).toBe(false);
    // com flags, não pergunta nada
    asked.length = 0;
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      expect(await main([path.join(tmp, 'flags'), '-t', 'blank', '--no-install', '--no-skills'], prompter)).toBe(0);
    } finally {
      vi.restoreAllMocks();
    }
    expect(asked).toEqual([]);
  });

  it('todos os templates geram projetos que passam no build (sem mudanças) e no check', () => {
    const version = ownVersion();
    const roots = TEMPLATES.map((t) => {
      const dir = path.join(tmp, `app-${t.name}`);
      const r = scaffold({ targetDir: dir, template: t.name, pm: 'npm', now: new Date('2030-01-02T03:04:05.000Z') });
      expect(r.packageName).toBe(`app-${t.name}`);
      for (const f of ['package.json', 'tsconfig.json', '.gitignore', 'README.md', 'AGENTS.md', 'CLAUDE.md']) expect(r.files).toContain(f);

      const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
        name: string;
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
      };
      expect(pkg.name).toBe(`app-${t.name}`);
      expect(pkg.scripts).toMatchObject({ dev: 'caju studio --open', build: 'caju build', check: 'caju check', render: 'caju render' });
      for (const dep of ['@caju-motion/cli', '@caju-motion/sdk', '@caju-motion/renderer', '@caju-motion/core']) {
        expect(pkg.dependencies[dep]).toBe(`^${version}`);
      }
      expect(Object.keys(pkg.dependencies)).toEqual(expect.arrayContaining(['react', 'react-dom', 'zod']));
      expect(readFileSync(path.join(dir, '.gitignore'), 'utf8')).toMatch(/!\*\*\/\.caju\/last-build\.json/);
      const project = JSON.parse(readFileSync(path.join(dir, 'projects', t.project, 'project.json'), 'utf8')) as { meta: { createdAt: string } };
      expect(project.meta.createdAt).toBe('2030-01-02T03:04:05.000Z');

      // dependências "instaladas": as do monorepo
      symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
      return dir;
    });

    // um processo só, com os pacotes pelo código-fonte (o CI testa antes de buildar)
    const out = execFileSync(
      process.execPath,
      ['--conditions=source', '--import', 'tsx', path.join(PKG, 'scripts', 'verify-projects.ts'), ...roots],
      { cwd: ROOT, encoding: 'utf8', timeout: 180_000 },
    );
    const result = JSON.parse(/^RESULT (.*)$/m.exec(out)![1]!) as Record<string, { build: number; check: number; unchanged: boolean }>;
    for (const [i, t] of TEMPLATES.entries()) {
      expect(result[roots[i]!], `${t.name}\n${out}`).toEqual({ build: 0, check: 0, unchanged: true });
      for (const c of t.components) expect(out).toContain(c);
    }
  }, 240_000);

  it.runIf(process.env.CAJU_RENDER_IT === '1')(
    'renderiza um quadro de cada template (CAJU_RENDER_IT=1)',
    () => {
      for (const t of TEMPLATES) {
        const dir = path.join(tmp, `app-${t.name}`);
        const png = path.join(tmp, `${t.name}.png`);
        execFileSync(
          process.execPath,
          ['--conditions=source', '--import', 'tsx', path.join(ROOT, 'packages', 'cli', 'src', 'index.ts'), 'still', t.project,
            '--frame', String(t.stillFrame), '--resolution', '360', '--dir', path.join(dir, 'projects'), '--out', png],
          { cwd: ROOT, encoding: 'utf8', timeout: 120_000 },
        );
        expect(readFileSync(png).subarray(1, 4).toString()).toBe('PNG');
      }
    },
    600_000,
  );
});
