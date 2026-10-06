import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { rm, statfs, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ffmpegPath } from '@caju-motion/renderer-node';
import { STUDIO_APP_DIR } from '@caju-motion/studio';
import { loadComponentsInNode } from '../components';

/**
 * `caju doctor`: diagnostica o ambiente (Node, npm, FFmpeg, navegador do render, Studio buildado,
 * pastas do projeto, componentes, disco/memória, permissão de escrita). Exit 1 se algo impede o uso.
 */

export type CheckStatus = 'ok' | 'warn' | 'fail';
export type DoctorCheck = { label: string; status: CheckStatus; detail: string; hint?: string };

const GB = 1024 ** 3;
export const MIN_NODE = [20, 11] as const;

// ------------------------------------------------------------------ partes puras (testadas)

export function checkNodeVersion(version: string): DoctorCheck {
  const [major = 0, minor = 0] = version.replace(/^v/, '').split('.').map(Number);
  const ok = major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
  return ok
    ? { label: 'Node.js', status: 'ok', detail: version }
    : {
        label: 'Node.js',
        status: 'fail',
        detail: `${version} (precisa ≥ ${MIN_NODE.join('.')})`,
        hint: 'instale o Node.js 22 LTS (https://nodejs.org) ou use nvm/fnm/volta',
      };
}

/** "ffmpeg version 6.1.1-static https://…" → "6.1.1-static". */
export function parseFfmpegVersion(output: string): string | null {
  return /ffmpeg version (\S+)/i.exec(output)?.[1] ?? null;
}

export type BrowserCandidate = { name: string; path: string };

/** Onde o playwright-core procura os canais `chrome` e `msedge` (mesma ordem do render). */
export function browserCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): BrowserCandidate[] {
  if (platform === 'win32') {
    const roots = [env.LOCALAPPDATA, env.PROGRAMFILES ?? 'C:\\Program Files', env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'].filter(
      (r): r is string => !!r,
    );
    return [
      ...roots.map((r) => ({ name: 'Google Chrome', path: path.win32.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe') })),
      ...roots.map((r) => ({ name: 'Microsoft Edge', path: path.win32.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe') })),
    ];
  }
  if (platform === 'darwin') {
    return [
      { name: 'Google Chrome', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
      { name: 'Microsoft Edge', path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
    ];
  }
  return [
    { name: 'Google Chrome', path: '/opt/google/chrome/chrome' },
    { name: 'Microsoft Edge', path: '/opt/microsoft/msedge/msedge' },
  ];
}

export function checkBrowser(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, exists: (p: string) => boolean): DoctorCheck {
  const label = 'Navegador (render)';
  const custom = env.CAJU_BROWSER_PATH;
  if (custom) {
    return exists(custom)
      ? { label, status: 'ok', detail: `CAJU_BROWSER_PATH: ${custom}` }
      : { label, status: 'fail', detail: `CAJU_BROWSER_PATH aponta para um arquivo que não existe: ${custom}`, hint: 'corrija ou remova a variável' };
  }
  const found = browserCandidates(platform, env).find((c) => exists(c.path));
  return found
    ? { label, status: 'ok', detail: `${found.name} (${found.path})` }
    : {
        label,
        status: 'fail',
        detail: 'nenhum Chrome/Edge encontrado',
        hint: 'instale o Google Chrome ou o Microsoft Edge, ou defina CAJU_BROWSER_PATH com o caminho de um Chromium',
      };
}

export function checkDisk(freeBytes: number | null): DoctorCheck {
  const label = 'Espaço em disco';
  if (freeBytes === null) return { label, status: 'warn', detail: 'não consegui medir' };
  const detail = `${(freeBytes / GB).toFixed(1)} GB livres`;
  if (freeBytes < 0.5 * GB) return { label, status: 'fail', detail, hint: 'libere espaço: renders e o cache do navegador precisam de pelo menos ~1 GB' };
  if (freeBytes < 2 * GB) return { label, status: 'warn', detail, hint: 'pouco espaço: renders longos podem falhar no meio' };
  return { label, status: 'ok', detail };
}

export function checkMemory(freeBytes: number, totalBytes: number): DoctorCheck {
  const detail = `${(freeBytes / GB).toFixed(1)} de ${(totalBytes / GB).toFixed(1)} GB livres`;
  return freeBytes < 1 * GB
    ? { label: 'Memória', status: 'warn', detail, hint: 'feche programas; renderize com --concurrency 1 e evite vários Studios abertos' }
    : { label: 'Memória', status: 'ok', detail };
}

const ICON: Record<CheckStatus, string> = { ok: '✓', warn: '!', fail: '✗' };

export function formatCheck(c: DoctorCheck): string {
  return `${ICON[c.status]} ${c.label.padEnd(20)} ${c.detail}${c.hint ? `\n  ${''.padEnd(20)} → ${c.hint}` : ''}`;
}

export function doctorExitCode(checks: DoctorCheck[]): number {
  return checks.some((c) => c.status === 'fail') ? 1 : 0;
}

// ------------------------------------------------------------------ verificações com efeitos

function version(cmd: string, args: string[]): { ok: boolean; out: string } {
  const opts = { encoding: 'utf8', timeout: 15_000, windowsHide: true } as const;
  // no Windows, comandos do PATH como `npm` são .cmd e precisam de shell (linha fixa, sem entrada do usuário)
  const r =
    process.platform === 'win32' && !path.isAbsolute(cmd)
      ? spawnSync([cmd, ...args].join(' '), { ...opts, shell: true })
      : spawnSync(cmd, args, opts);
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

function checkNpm(): DoctorCheck {
  const r = version('npm', ['-v']);
  return r.ok
    ? { label: 'npm', status: 'ok', detail: r.out.split('\n')[0]! }
    : { label: 'npm', status: 'warn', detail: 'não encontrado no PATH', hint: 'vem com o Node.js; pnpm/yarn/bun também funcionam' };
}

function checkFfmpeg(): DoctorCheck {
  const label = 'FFmpeg (render)';
  let bin: string;
  try {
    bin = ffmpegPath();
  } catch (err) {
    return { label, status: 'fail', detail: (err as Error).message, hint: 'corrija CAJU_FFMPEG_PATH ou remova a variável' };
  }
  const source = process.env.CAJU_FFMPEG_PATH ? 'CAJU_FFMPEG_PATH' : bin === 'ffmpeg' ? 'PATH' : 'ffmpeg-static';
  const r = version(bin, ['-version']);
  const v = parseFfmpegVersion(r.out);
  if (!r.ok) {
    return {
      label,
      status: 'fail',
      detail: bin === 'ffmpeg' ? 'não encontrado (nem ffmpeg-static nem no PATH)' : `não executou: ${bin}`,
      hint: 'reinstale as dependências (npm install traz o ffmpeg-static) ou defina CAJU_FFMPEG_PATH',
    };
  }
  return { label, status: 'ok', detail: `${v ?? 'versão desconhecida'} (${source}${source === 'PATH' ? '' : `: ${bin}`})` };
}

function checkStudio(): DoctorCheck {
  return existsSync(path.join(STUDIO_APP_DIR, 'index.html'))
    ? { label: 'Caju Studio', status: 'ok', detail: 'app buildado' }
    : {
        label: 'Caju Studio',
        status: 'fail',
        detail: `app não buildado (${STUDIO_APP_DIR})`,
        hint: 'no repositório: npm run build -w @caju-motion/studio; num projeto: reinstale @caju-motion/cli',
      };
}

function checkProjects(dir: string): DoctorCheck {
  const label = 'Projetos';
  const rel = path.relative(process.cwd(), dir) || '.';
  if (!existsSync(dir)) {
    return { label, status: 'warn', detail: `pasta ${rel} não existe`, hint: 'crie um projeto com "npm create caju@latest" ou "caju new <id>", ou passe --dir' };
  }
  const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  const withJson = entries.filter((e) => existsSync(path.join(dir, e.name, 'project.json')));
  const onlyCode = entries.filter(
    (e) => !existsSync(path.join(dir, e.name, 'project.json')) && ['video.ts', 'video.tsx', 'video.js'].some((f) => existsSync(path.join(dir, e.name, f))),
  );
  if (onlyCode.length) {
    return {
      label,
      status: 'warn',
      detail: `${rel}: ${withJson.length} projeto(s); sem project.json: ${onlyCode.map((e) => e.name).join(', ')}`,
      hint: 'rode "caju build" para gerar o project.json a partir do video.ts',
    };
  }
  return withJson.length
    ? { label, status: 'ok', detail: `${rel}: ${withJson.map((e) => e.name).join(', ')}` }
    : { label, status: 'warn', detail: `${rel}: nenhum projeto`, hint: 'crie um com "caju new <id>"' };
}

async function checkComponents(dir: string): Promise<DoctorCheck> {
  const label = 'Componentes';
  const rel = path.relative(process.cwd(), dir) || '.';
  if (!existsSync(dir)) return { label, status: 'ok', detail: `nenhum (${rel} não existe)` };
  const loaded = await loadComponentsInNode(dir);
  if (!loaded.ok) {
    return { label, status: 'fail', detail: `${rel} não compila:\n    ${loaded.errors.slice(0, 5).join('\n    ')}`, hint: 'corrija os erros; detalhes em "caju check"' };
  }
  if (loaded.skipped) {
    return { label, status: 'warn', detail: `${rel}: compila, ${loaded.files.length} arquivo(s)`, hint: 'instale react, react-dom e @caju-motion/renderer no projeto (npm install)' };
  }
  return { label, status: 'ok', detail: `${rel}: ${loaded.names.length ? loaded.names.join(', ') : 'nenhum defineComponent'}` };
}

async function checkWritable(dir: string): Promise<DoctorCheck> {
  const label = 'Permissão de escrita';
  const where = existsSync(dir) ? dir : process.cwd();
  const file = path.join(where, `.caju-doctor-${process.pid}.tmp`);
  try {
    await writeFile(file, 'ok');
    await rm(file, { force: true });
    return { label, status: 'ok', detail: path.relative(process.cwd(), where) || '.' };
  } catch (err) {
    return { label, status: 'fail', detail: `não consigo gravar em ${where}: ${(err as NodeJS.ErrnoException).code ?? (err as Error).message}`, hint: 'rode numa pasta sua (fora de Arquivos de Programas / pastas sincronizadas bloqueadas)' };
  }
}

async function freeDisk(dir: string): Promise<number | null> {
  try {
    const s = await statfs(existsSync(dir) ? dir : process.cwd());
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

export async function runDoctor({ dir, componentsDir }: { dir: string; componentsDir: string }): Promise<DoctorCheck[]> {
  const projectsDir = path.resolve(dir);
  return [
    checkNodeVersion(process.version),
    checkNpm(),
    checkFfmpeg(),
    checkBrowser(process.platform, process.env, existsSync),
    checkStudio(),
    checkProjects(projectsDir),
    await checkComponents(componentsDir),
    checkDisk(await freeDisk(projectsDir)),
    checkMemory(os.freemem(), os.totalmem()),
    await checkWritable(projectsDir),
  ];
}

export async function doctorCommand(o: { dir: string; componentsDir: string }): Promise<number> {
  console.log('caju doctor — diagnóstico do ambiente\n');
  const checks = await runDoctor(o);
  for (const c of checks) console.log(formatCheck(c));
  const fails = checks.filter((c) => c.status === 'fail').length;
  const warns = checks.filter((c) => c.status === 'warn').length;
  console.log(
    fails
      ? `\n✗ ${fails} problema(s) impedem o uso do Caju${warns ? ` (+ ${warns} aviso(s))` : ''}. Siga as dicas (→) acima.`
      : `\n✓ tudo pronto${warns ? ` (${warns} aviso(s))` : ''}`,
  );
  return doctorExitCode(checks);
}
