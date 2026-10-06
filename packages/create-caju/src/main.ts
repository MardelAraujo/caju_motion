import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { c, createPrompter, type Prompter } from './prompts';
import {
  detectPackageManager,
  execBin,
  isDirEmpty,
  ownVersion,
  PACKAGE_MANAGERS,
  runScript,
  scaffold,
  toPackageName,
  type PackageManager,
} from './scaffold';
import { DEFAULT_TEMPLATE, findTemplate, TEMPLATES } from './templates';

export const HELP = `create-caju — cria um projeto de vídeo Caju Motion

Uso:
  npm create caju@latest [pasta] [opções]

Opções:
  -t, --template <nome>   ${TEMPLATES.map((t) => t.name).join(', ')}
  -y, --yes               sem perguntas (padrões: pasta "meu-video", template "${DEFAULT_TEMPLATE}", instala deps e skills)
      --no-install        não instala as dependências
      --skills            instala as skills de agente (Claude Code / AGENTS.md)
      --no-skills         não instala as skills
      --pm <gerenciador>  npm, pnpm, yarn ou bun (padrão: o que chamou o create)
  -v, --version
  -h, --help

Templates:
${TEMPLATES.map((t) => `  ${t.name.padEnd(16)} ${t.description}`).join('\n')}
`;

export type CliOptions = {
  dir?: string;
  template?: string;
  yes: boolean;
  /** undefined = perguntar (ou sim, com --yes). */
  install?: boolean;
  skills?: boolean;
  pm?: PackageManager;
  help: boolean;
  version: boolean;
};

export function parseCliArgs(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      template: { type: 'string', short: 't' },
      yes: { type: 'boolean', short: 'y', default: false },
      install: { type: 'boolean' },
      'no-install': { type: 'boolean' },
      skills: { type: 'boolean' },
      'no-skills': { type: 'boolean' },
      pm: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  });
  if (values.pm !== undefined && !(PACKAGE_MANAGERS as string[]).includes(values.pm)) {
    throw new Error(`--pm inválido "${values.pm}" (use ${PACKAGE_MANAGERS.join(', ')})`);
  }
  if (values.template !== undefined && !findTemplate(values.template)) {
    throw new Error(`template desconhecido "${values.template}". Opções: ${TEMPLATES.map((t) => t.name).join(', ')}`);
  }
  const flag = (yes: boolean | undefined, no: boolean | undefined) => (no ? false : yes ? true : undefined);
  return {
    ...(positionals[0] ? { dir: positionals[0] } : {}),
    ...(values.template ? { template: values.template } : {}),
    yes: values.yes,
    install: flag(values.install, values['no-install']),
    skills: flag(values.skills, values['no-skills']),
    ...(values.pm ? { pm: values.pm as PackageManager } : {}),
    help: values.help,
    version: values.version,
  };
}

/** Roda um comando herdando o terminal. Resolve com o exit code. */
function run(cmd: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    // no Windows, npm/pnpm/yarn são .cmd: precisam de shell (os argumentos aqui são fixos, sem entrada do usuário)
    const child =
      process.platform === 'win32' && cmd !== process.execPath
        ? spawn([cmd, ...args].join(' '), { cwd, stdio: 'inherit', shell: true })
        : spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.once('error', () => resolve(127));
    child.once('close', (code) => resolve(code ?? 1));
  });
}

/** CLI do Caju instalado no projeto (dist/index.js), ou null. */
function installedCli(dir: string): string | null {
  try {
    const file = createRequire(path.join(dir, 'package.json')).resolve('@caju-motion/cli');
    return existsSync(file) ? file : null;
  } catch {
    return null;
  }
}

export async function main(argv: string[], prompter?: Prompter): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCliArgs(argv);
  } catch (err) {
    console.error(`${c.red('✗')} ${(err as Error).message}\n\n${HELP}`);
    return 1;
  }
  if (opts.version) {
    console.log(ownVersion());
    return 0;
  }
  if (opts.help) {
    console.log(HELP);
    return 0;
  }

  // sem TTY (CI, pipes) e sem --yes: usa os padrões, sem perguntar
  const interactive = !opts.yes && (prompter !== undefined || process.stdin.isTTY === true);
  const ask = interactive ? (prompter ?? createPrompter()) : null;
  const pm = opts.pm ?? detectPackageManager();
  console.log(`\n${c.bold('caju')} ${c.dim(`create-caju ${ownVersion()}`)} — vídeo por código + timeline visual\n`);

  try {
    let dir = opts.dir;
    if (!dir) dir = ask ? await ask.text('Nome do projeto (pasta)', 'meu-video') : 'meu-video';
    const target = path.resolve(dir);
    if (!isDirEmpty(target)) {
      console.error(`${c.red('✗')} a pasta ${target} já existe e não está vazia. Escolha outro nome.`);
      return 1;
    }

    const template =
      opts.template ??
      (ask
        ? await ask.select(
            'Template',
            TEMPLATES.map((t) => ({ value: t.name, label: t.title, hint: t.description })),
            DEFAULT_TEMPLATE,
          )
        : DEFAULT_TEMPLATE);
    const install = opts.install ?? (ask ? await ask.confirm(`Instalar as dependências (${pm} install)?`, true) : true);
    const skills =
      opts.skills ?? (ask ? await ask.confirm('Adicionar as skills do Caju para agentes (Claude Code, AGENTS.md)?', true) : true);
    ask?.close();

    const r = scaffold({ targetDir: target, template, packageName: toPackageName(path.basename(target)), pm });
    console.log(`${c.green('✓')} projeto criado em ${r.dir} ${c.dim(`(template ${r.template.name}, ${r.files.length} arquivos)`)}`);

    let installed = false;
    if (install) {
      console.log(`\n${c.dim(`$ ${pm} install`)}`);
      const code = await run(pm, ['install'], r.dir);
      installed = code === 0;
      if (!installed) console.log(`${c.yellow('!')} ${pm} install falhou (código ${code}). Rode de novo dentro da pasta.`);
    }

    let skillsDone = false;
    if (skills && installed) {
      const cli = installedCli(r.dir);
      const code = cli ? await run(process.execPath, [cli, 'skills', 'add', '--agents', 'all'], r.dir) : 1;
      skillsDone = code === 0;
      if (!skillsDone) console.log(`${c.yellow('!')} não consegui instalar as skills agora.`);
    }

    const rel = path.relative(process.cwd(), r.dir) || '.';
    const t = r.template;
    const steps = [
      ...(rel !== '.' ? [`cd ${rel.includes(' ') ? `"${rel}"` : rel}`] : []),
      ...(installed ? [] : [`${pm} install`]),
      ...(skills && !skillsDone ? [`${execBin(pm, 'caju')} skills add --agents all   ${c.dim('# skills para agentes')}`] : []),
      `${runScript(pm, 'dev')}   ${c.dim('# abre o Caju Studio')}`,
      `${runScript(pm, 'render', [t.project])}   ${c.dim('# exporta o MP4')}`,
    ];
    console.log(`\n${c.bold('Próximos passos:')}\n${steps.map((s) => `  ${s}`).join('\n')}`);
    console.log(
      `\n${c.dim(`Edite projects/${t.project}/video.ts e rode ${runScript(pm, 'build')}; problemas com FFmpeg/navegador: ${runScript(pm, 'doctor')}.`)}\n`,
    );
    return 0;
  } catch (err) {
    ask?.close();
    console.error(`${c.red('✗')} ${(err as Error).message}`);
    return 1;
  }
}
