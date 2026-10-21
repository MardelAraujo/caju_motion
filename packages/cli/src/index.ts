import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadDotEnv } from './env';
import { buildCommand } from './commands/build';
import { mediaCommand, parseProxyMode } from './commands/media';
import { captionsCommand, transcribeCommand, ttsCommand, voicesCommand } from './commands/voice';
import { checkCommand } from './commands/check';
import { doctorCommand } from './commands/doctor';
import { newCommand } from './commands/new';
import { renderCommand, stillCommand } from './commands/render';
import { skillsCommand } from './commands/skills';
import { snapshotCommand } from './commands/snapshot';
import { catalogCommand } from './commands/catalog';
import { beatsCommand } from './commands/beats';
import { captureCommand } from './commands/capture';
import { studioCommand } from './commands/studio';
import { componentsDirFor } from './extensions';

const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

const HELP = `caju ${VERSION} — Caju Motion: vídeo por código + timeline visual

Uso:
  caju studio [--dir projects] [--port 3700] [--open]    abre o Caju Studio no navegador
  caju new <id> [--format reel-9x16] [--dir projects]    cria um projeto vazio
  caju build [ids...] [--dir projects] [--force]         gera o project.json a partir do video.ts (defineProject),
                                                         preservando as edições feitas no Studio
  caju check [ids...] [--dir projects]                   valida projetos (schema, assets no disco, componentes)
  caju media [ids...] [--proxies auto|all] [--force]     lê os assets (duração, tamanho, fps), atualiza o project.json e gera
                                                         miniaturas, formas de onda e proxies de edição em .caju/media/
  caju render <id> [--out arquivo] [--format mp4-h264] [--resolution 1080] [--fps 30] [--quality high] [--no-audio]
                                                         exporta vídeo (Chromium + FFmpeg)
  caju still <id> --frame <n> [--out quadro.png] [--resolution 1080]
                                                         exporta um quadro como imagem
  caju tts <id> --text "..." [--script roteiro.txt] [--provider voicestudio|placeholder|openai|elevenlabs] [--voice v]
             [--model engine] [--seed n] [--name locucao] [--start s] [--speed 1] [--language pt] [--no-captions]
             [--files-only] [--force]
                                                         gera a locução (padrão: VoiceStudio local e grátis; openai e
                                                         elevenlabs pedem chave), o áudio numa trilha e as legendas;
                                                         mesmo texto+voz não gera de novo
  caju voices                                            lista os engines e as vozes do VoiceStudio (VOICESTUDIO_URL)
  caju transcribe <id> --from video.mp4|audio.wav [--provider voicestudio|openai] [--language pt] [--captions]
                                                         transcreve fala existente em words.json + SRT (legendas exatas)
  caju captions <id> --from legenda.srt|.vtt|.words.json [--offset s]
                                                         importa legendas como clipes de texto editáveis
  caju snapshot <id> [--at-cuts] [--frames 0,45,90] [--max 24] [--cols 4] [--resolution 540] [--out a.png]
                                                         contact sheet dos quadros-chave (e dos cortes) para revisar
                                                         antes do render; mapa dos quadros em boards/snapshot.json
  caju catalog [texto] [--query texto] [--kind transition|loop|effect|overlay|component|template]
                                                         o que já existe pronto (poses, loops, efeitos, componentes…)
  caju capture <url> --project <id> [--width 1440] [--height 900]
                                                         screenshots, cores, fontes, textos e imagens do site em
                                                         assets/capture/ (para vídeos a partir de um site)
  caju beats <musica.mp3> [--project <id>] [--out arquivo]
                                                         BPM e batidas (assets/data/<nome>.beats.json) para cortar no tempo
  caju doctor [--dir projects]                           diagnostica o ambiente (Node, FFmpeg, navegador, Studio…)
  caju skills add [--target .] [--agents claude|all]     instala as skills de agente em .claude/skills/
                                                         (all: também o bloco do Caju no AGENTS.md)

Opções:
  --dev        (studio) modo de desenvolvimento do próprio Studio, com Vite/HMR — só no repositório
  --format     (new) formato do projeto; (render) mp4-h264, mp4-h265, mov-prores, webm-vp9, gif, png-seq
  --quality    (render) draft, good, high, max
  --concurrency (render) abas do navegador em paralelo (1–2)
  --serve-url  (render/still) usa um Studio já rodando em vez de subir um servidor interno
  --components pasta dos componentes React (padrão: <dir>/../components)
  --force      (build) regenera mesmo com clipes de código editados no Studio (o código vence)
  --dry-run    (build) só mostra o que mudaria, sem gravar
  --json       (check, doctor, snapshot, catalog, voices, beats, capture) saída em JSON para agentes
  -v, --version
  -h, --help

Formatos de projeto: reel-9x16, feed-4x5, square-1x1, landscape-16x9
`;

async function main(argv: string[]): Promise<number> {
  // chaves (OPENAI_API_KEY, ELEVENLABS_API_KEY…) do .env da pasta atual; o terminal tem prioridade
  loadDotEnv();
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: 'string', default: 'projects' },
      port: { type: 'string', default: '3700' },
      format: { type: 'string' },
      out: { type: 'string', short: 'o' },
      resolution: { type: 'string' },
      fps: { type: 'string' },
      quality: { type: 'string' },
      'no-audio': { type: 'boolean', default: false },
      concurrency: { type: 'string' },
      frame: { type: 'string' },
      'serve-url': { type: 'string' },
      open: { type: 'boolean', default: false },
      dev: { type: 'boolean', default: false },
      components: { type: 'string' },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      target: { type: 'string' },
      proxies: { type: 'string' },
      text: { type: 'string' },
      script: { type: 'string' },
      name: { type: 'string' },
      provider: { type: 'string' },
      voice: { type: 'string' },
      model: { type: 'string' },
      speed: { type: 'string' },
      language: { type: 'string' },
      seed: { type: 'string' },
      captions: { type: 'boolean', default: false },
      start: { type: 'string' },
      'no-captions': { type: 'boolean', default: false },
      'files-only': { type: 'boolean', default: false },
      from: { type: 'string' },
      offset: { type: 'string' },
      agents: { type: 'string' },
      frames: { type: 'string' },
      'at-cuts': { type: 'boolean', default: false },
      cols: { type: 'string' },
      max: { type: 'string' },
      json: { type: 'boolean', default: false },
      project: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' },
      query: { type: 'string' },
      kind: { type: 'string' },
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
      return newCommand({ dir: values.dir, id, format: values.format ?? 'reel-9x16' });
    }
    case 'render': {
      const id = rest[0];
      if (!id) {
        console.error('uso: caju render <id> [--out arquivo.mp4] [--format mp4-h264]');
        return 1;
      }
      return renderCommand({
        dir: values.dir,
        id,
        out: values.out,
        format: values.format,
        resolution: values.resolution,
        fps: values.fps,
        quality: values.quality,
        audio: !values['no-audio'],
        concurrency: values.concurrency,
        serveUrl: values['serve-url'],
        components: values.components,
      });
    }
    case 'still': {
      const id = rest[0];
      if (!id || values.frame === undefined) {
        console.error('uso: caju still <id> --frame <n> [--out quadro.png]');
        return 1;
      }
      return stillCommand({
        dir: values.dir,
        id,
        frame: values.frame,
        out: values.out,
        resolution: values.resolution,
        serveUrl: values['serve-url'],
        components: values.components,
      });
    }
    case 'build':
      return buildCommand({ dir: values.dir, ids: rest, force: values.force, dryRun: values['dry-run'] });
    case 'check':
      return checkCommand({ dir: values.dir, ids: rest, componentsDir: componentsDirFor(values.dir, values.components), json: values.json });
    case 'media':
      return mediaCommand({ dir: values.dir, ids: rest, proxies: parseProxyMode(values.proxies), force: values.force, dryRun: values['dry-run'] });
    case 'tts':
      return ttsCommand({
        dir: values.dir,
        id: rest[0],
        text: values.text,
        script: values.script,
        name: values.name,
        provider: values.provider,
        voice: values.voice,
        model: values.model,
        speed: values.speed,
        language: values.language,
        seed: values.seed,
        start: values.start,
        captions: !values['no-captions'],
        filesOnly: values['files-only'],
        force: values.force,
      });
    case 'captions':
      return captionsCommand({ dir: values.dir, id: rest[0], from: values.from, offset: values.offset });
    case 'voices':
      return voicesCommand({ json: values.json });
    case 'capture':
      return captureCommand({ dir: values.dir, url: rest[0], project: values.project, width: values.width, height: values.height, json: values.json });
    case 'beats':
      return beatsCommand({ dir: values.dir, file: rest[0], project: values.project, out: values.out, json: values.json });
    case 'catalog':
      return catalogCommand({ query: values.query ?? (rest.length ? rest.join(' ') : undefined), kind: values.kind, json: values.json, componentsDir: componentsDirFor(values.dir, values.components) });
    case 'snapshot':
      return snapshotCommand({
        dir: values.dir,
        id: rest[0],
        frames: values.frames,
        atCuts: values['at-cuts'],
        max: values.max,
        cols: values.cols,
        resolution: values.resolution,
        out: values.out,
        json: values.json,
        serveUrl: values['serve-url'],
        components: values.components,
      });
    case 'transcribe':
      return transcribeCommand({
        dir: values.dir,
        id: rest[0],
        from: values.from,
        name: values.name,
        provider: values.provider,
        model: values.model,
        language: values.language,
        offset: values.offset,
        captions: values.captions,
        force: values.force,
      });
    case 'doctor':
      return doctorCommand({ dir: values.dir, componentsDir: componentsDirFor(values.dir, values.components), json: values.json });
    case 'skills':
      return skillsCommand({ action: rest[0], target: values.target, agents: values.agents });
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
