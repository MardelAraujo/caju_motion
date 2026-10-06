import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findTemplate, TEMPLATES, TEMPLATES_DIR, type TemplateInfo } from './templates';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';
export const PACKAGE_MANAGERS: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

/** Versão do próprio create-caju: os pacotes do Caju são publicados em lockstep com ela. */
export function ownVersion(): string {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  return (JSON.parse(readFileSync(file, 'utf8')) as { version: string }).version;
}

/** Gerenciador que chamou o `create` (`npm_config_user_agent`, ex.: "pnpm/9.1.0 npm/? node/v22…"). */
export function detectPackageManager(userAgent: string | undefined = process.env.npm_config_user_agent): PackageManager {
  const name = userAgent?.split(' ')[0]?.split('/')[0];
  return (PACKAGE_MANAGERS as string[]).includes(name ?? '') ? (name as PackageManager) : 'npm';
}

/** Nome de pacote npm válido a partir do nome da pasta ("Meu Vídeo!" → "meu-video"). */
export function toPackageName(dirName: string): string {
  const name = dirName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._~-]+/g, '-')
    .replace(/^[._-]+|[-]+$/g, '');
  return name || 'meu-video';
}

/** Arquivos que não impedem criar o projeto numa pasta existente. */
const HARMLESS = new Set(['.git', '.DS_Store', 'Thumbs.db', '.idea', '.vscode']);

export function isDirEmpty(dir: string): boolean {
  if (!existsSync(dir)) return true;
  return readdirSync(dir).every((f) => HARMLESS.has(f));
}

/** `npm run x` / `pnpm x`… (com argumentos extras para o script). */
export function runScript(pm: PackageManager, script: string, args: string[] = []): string {
  const extra = args.length ? ` ${args.join(' ')}` : '';
  if (pm === 'npm') return `npm run ${script}${args.length ? ` --${extra}` : ''}`;
  if (pm === 'bun') return `bun run ${script}${extra}`;
  return `${pm} ${script}${extra}`;
}

/** `npx caju …` equivalente em cada gerenciador. */
export function execBin(pm: PackageManager, bin: string): string {
  return { npm: `npx ${bin}`, pnpm: `pnpm exec ${bin}`, yarn: `yarn ${bin}`, bun: `bunx ${bin}` }[pm];
}

export function projectPackageJson(name: string, version: string): Record<string, unknown> {
  const caju = `^${version}`;
  return {
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'caju studio --open',
      build: 'caju build',
      check: 'caju check',
      render: 'caju render',
      still: 'caju still',
      doctor: 'caju doctor',
    },
    dependencies: {
      '@caju-motion/cli': caju,
      '@caju-motion/core': caju,
      '@caju-motion/renderer': caju,
      '@caju-motion/sdk': caju,
      '@caju-motion/voice': caju,
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      zod: '^4.0.0',
    },
    devDependencies: {
      '@types/react': '^19.0.0',
      typescript: '^5.9.0',
    },
    engines: { node: '>=20.11' },
  };
}

export const TSCONFIG = {
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'Bundler',
    jsx: 'react-jsx',
    strict: true,
    noEmit: true,
    isolatedModules: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    skipLibCheck: true,
  },
  include: ['projects/*/video.ts', 'components'],
};

export const GITIGNORE = `node_modules/
renders/
*.log
.DS_Store

# chaves de API (caju tts): nunca versionar
.env
.env.*
!.env.example

# cache e histórico locais do Caju (exceto a base do último build,
# que permite detectar edições do Studio em clones novos)
**/.caju/*
!**/.caju/last-build.json
`;

export function readme(name: string, t: TemplateInfo, pm: PackageManager): string {
  const run = (s: string, a: string[] = []) => runScript(pm, s, a);
  return `# ${name}

Projeto de vídeo [Caju Motion](https://github.com/MardelAraujo/caju_motion) — template **${t.title}** (${t.description}).

## Comandos

| | |
|---|---|
| \`${run('dev')}\` | abre o Caju Studio (timeline visual) |
| \`${run('build')}\` | gera \`projects/*/project.json\` a partir do \`video.ts\`, preservando o que foi editado no Studio |
| \`${run('check')}\` | valida projetos, assets e \`components/\` |
| \`${run('render', [t.project])}\` | exporta MP4 em \`projects/${t.project}/renders/\` |
| \`${run('still', [t.project, '--frame', String(t.stillFrame)])}\` | exporta um quadro como PNG |
| \`${run('doctor')}\` | diagnostica o ambiente (Node, FFmpeg, navegador…) |

Estrutura: \`projects/<id>/video.ts\` (código) + \`project.json\` (o que o Studio edita) + \`assets/\`;
\`components/\` tem componentes React (\`defineComponent\`) que aparecem na aba Componentes do Studio.
O render usa o Chrome ou o Edge instalados e o FFmpeg embutido.

## English

A [Caju Motion](https://github.com/MardelAraujo/caju_motion) video project. \`${run('dev')}\` opens Caju Studio,
\`${run('build')}\` regenerates \`project.json\` from \`video.ts\` (keeping Studio edits), \`${run('render', [t.project])}\` exports an MP4.
Coding agents: see [AGENTS.md](AGENTS.md).
`;
}

export function agentsMd(name: string): string {
  return `# ${name} — instruções para agentes

Este é um projeto de vídeo **Caju Motion** (vídeo por código + timeline visual, o Caju Studio).

- Antes de criar, editar ou renderizar vídeos aqui, carregue as skills do Caju em \`.claude/skills/\`
  (comece por \`caju-best-practices\`). Se a pasta não existir: \`npx caju skills add --agents all\`.
- Fonte em código: \`projects/<id>/video.ts\` (\`defineProject\` de \`@caju-motion/sdk\`); depois de editar, rode \`npx caju build\`.
- Nunca sobrescreva \`project.json\` à mão sem ler a skill \`caju-studio\`: ele pode ter edições feitas no Studio.
- Antes de dizer que terminou: \`npx caju check\` precisa passar; para conferir o visual, \`npx caju still <id> --frame <n>\`.
`;
}

export const CLAUDE_MD = `@AGENTS.md

Use as skills do Caju Motion em \`.claude/skills/\` (comece por \`caju-best-practices\`).
`;

export type ScaffoldOptions = {
  targetDir: string;
  template: string;
  /** Nome do pacote (padrão: derivado do nome da pasta). */
  packageName?: string;
  /** Versão dos pacotes do Caju (padrão: a do create-caju). */
  version?: string;
  pm?: PackageManager;
  now?: Date;
  /** Pasta de templates (testes). */
  templatesDir?: string;
};

export type ScaffoldResult = { dir: string; template: TemplateInfo; packageName: string; files: string[] };

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

/** Cria o projeto: copia o template e gera package.json, tsconfig, .gitignore, README e instruções de agentes. */
export function scaffold(opts: ScaffoldOptions): ScaffoldResult {
  const t = findTemplate(opts.template);
  if (!t) throw new Error(`template desconhecido "${opts.template}". Opções: ${TEMPLATES.map((x) => x.name).join(', ')}`);
  const dir = path.resolve(opts.targetDir);
  if (!isDirEmpty(dir)) throw new Error(`a pasta ${dir} não está vazia`);
  const src = path.join(opts.templatesDir ?? TEMPLATES_DIR, t.name);
  if (!existsSync(src)) throw new Error(`template "${t.name}" não encontrado em ${src}`);

  const packageName = opts.packageName ?? toPackageName(path.basename(dir));
  const version = opts.version ?? ownVersion();
  const pm = opts.pm ?? 'npm';

  mkdirSync(dir, { recursive: true });
  cpSync(src, dir, { recursive: true });

  // o projeto do template "nasce" agora (o conteúdo continua igual ao último build: `caju build` não muda nada)
  const projectFile = path.join(dir, 'projects', t.project, 'project.json');
  if (existsSync(projectFile)) {
    const project = JSON.parse(readFileSync(projectFile, 'utf8')) as { meta?: Record<string, unknown> };
    const now = (opts.now ?? new Date()).toISOString();
    project.meta = { ...project.meta, createdAt: now, updatedAt: now };
    writeFileSync(projectFile, JSON.stringify(project, null, 2) + '\n');
  }

  const write = (file: string, content: string) => writeFileSync(path.join(dir, file), content);
  write('package.json', JSON.stringify(projectPackageJson(packageName, version), null, 2) + '\n');
  write('tsconfig.json', JSON.stringify(TSCONFIG, null, 2) + '\n');
  write('.gitignore', GITIGNORE);
  write('README.md', readme(packageName, t, pm));
  write('AGENTS.md', agentsMd(packageName));
  write('CLAUDE.md', CLAUDE_MD);

  return { dir, template: t, packageName, files: listFiles(dir).sort() };
}
