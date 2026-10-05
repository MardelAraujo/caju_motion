import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { checkCommand } from './commands/check';
import { newCommand } from './commands/new';
import { studioCommand } from './commands/studio';

const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

const HELP = `caju ${VERSION} — Caju Motion: vídeo por código + timeline visual

Uso:
  caju studio [--dir projects] [--port 3700] [--open]    abre o Caju Studio no navegador
  caju new <id> [--format reel-9x16] [--dir projects]    cria um projeto vazio
  caju check [ids...] [--dir projects]                   valida projetos (schema + assets no disco)

Opções:
  --dev        (studio) modo de desenvolvimento do próprio Studio, com Vite/HMR — só no repositório
  -v, --version
  -h, --help

Formatos: reel-9x16, feed-4x5, square-1x1, landscape-16x9
`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: 'string', default: 'projects' },
      port: { type: 'string', default: '3700' },
      format: { type: 'string', default: 'reel-9x16' },
      open: { type: 'boolean', default: false },
      dev: { type: 'boolean', default: false },
      components: { type: 'string' },
      version: { type: 'boolean', short: 'v', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [command, ...rest] = positionals;

  if (values.version) {
    console.log(VERSION);
    return 0;
  }
  if (values.help || !command) {
    console.log(HELP);
    return command || values.help ? 0 : 1;
  }

  switch (command) {
    case 'studio': {
      const port = Number(values.port);
      if (!Number.isInteger(port) || port <= 0) {
        console.error(`porta inválida: ${values.port}`);
        return 1;
      }
      await studioCommand({ dir: values.dir, port, open: values.open, dev: values.dev, components: values.components });
      return -1; // continua rodando
    }
    case 'new': {
      const id = rest[0];
      if (!id) {
        console.error('uso: caju new <id> [--format reel-9x16]');
        return 1;
      }
      return newCommand({ dir: values.dir, id, format: values.format });
    }
    case 'check':
      return checkCommand({ dir: values.dir, ids: rest });
    default:
      console.error(`comando desconhecido: ${command}\n\n${HELP}`);
      return 1;
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    if (code >= 0) process.exit(code);
  },
  (err: Error) => {
    console.error(`erro: ${err.message}`);
    process.exit(1);
  },
);
