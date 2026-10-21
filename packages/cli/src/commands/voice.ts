import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { findVideoFile } from '@caju-motion/sdk';
import { assertProjectId, createProjectStore } from '@caju-motion/server';
import {
  addCaptions,
  addVoiceover,
  DEFAULT_PROVIDER,
  engineNames,
  providerByName,
  readCaptions,
  sttByName,
  transcription,
  voiceover,
  voiceoverStartSec,
  voiceStudioVoices,
} from '@caju-motion/voice';

type TtsOpts = {
  dir: string;
  id: string | undefined;
  text?: string;
  script?: string;
  name?: string;
  provider?: string;
  voice?: string;
  model?: string;
  speed?: string;
  language?: string;
  seed?: string;
  start?: string;
  captions: boolean;
  /** Só os arquivos (áudio, words.json, srt), sem tocar no project.json. Automático com video.ts. */
  filesOnly: boolean;
  force: boolean;
};

const num = (v: string | undefined, flag: string, { positive = false } = {}): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || (positive && n === 0)) {
    throw new Error(`${flag} precisa ser um número ${positive ? '> 0' : '≥ 0'} (recebido: ${v})`);
  }
  return n;
};

/**
 * `caju tts <id>`: gera a locução (TTS) no projeto, registra o áudio numa trilha "Locução" e, por
 * padrão, as legendas numa trilha "Legendas". Mesmo texto + voz reaproveita o arquivo (não paga de novo).
 */
export async function ttsCommand(o: TtsOpts): Promise<number> {
  if (!o.id) throw new Error('uso: caju tts <id> --text "..." (ou --script roteiro.txt) [--provider voicestudio|placeholder|openai|elevenlabs] [--voice v]');
  const text = (o.script ? await readFile(o.script, 'utf8') : (o.text ?? '')).trim();
  if (!text) throw new Error('informe o texto com --text "..." ou --script arquivo.txt');
  const providerName = o.provider ?? DEFAULT_PROVIDER;
  const seed = num(o.seed, '--seed');
  const provider = providerByName(providerName, { voice: o.voice, model: o.model, seed });
  const store = createProjectStore(o.dir);
  // sem exigir project.json: num projeto por código ele só nasce no `caju build`
  assertProjectId(o.id);
  const projectDir = path.join(store.root, o.id);
  if (!existsSync(projectDir)) throw new Error(`projeto "${o.id}" não encontrado em ${path.resolve(o.dir)}`);
  const name = o.name ?? 'locucao';
  const startSec = num(o.start, '--start');
  const speed = num(o.speed, '--speed', { positive: true });
  // projeto por código: o video.ts decide onde a locução e as legendas entram (readCaptions + s.captions);
  // mexer no project.json aqui duplicaria tudo no próximo `caju build`
  const codeFile = findVideoFile(projectDir);
  const filesOnly = o.filesOnly || !!codeFile;

  if (providerName === 'placeholder') {
    console.log('· voz provisória (tom + tempos estimados). Para a voz real: --provider voicestudio (local, grátis), openai ou elevenlabs');
  } else if (providerName === 'voicestudio') {
    console.log(`· voz: VoiceStudio local (${provider.id.split(':').slice(1).join(' · ')})`);
  }
  const vo = await voiceover({
    projectDir,
    name,
    text,
    provider,
    voice: o.voice,
    speed,
    language: o.language,
    force: o.force,
  });
  const summary = `✓ ${o.id}: ${vo.audioSrc} (${vo.durationSec.toFixed(2)} s${vo.cached ? ', reaproveitado' : ''}); tempos ${vo.timed ? 'do provedor' : 'estimados'}`;
  if (filesOnly) {
    console.log(summary);
    console.log(`  ${vo.srtSrc} · ${vo.wordsSrc}`);
    if (codeFile) {
      console.log(
        `  projeto com ${path.basename(codeFile)}: o project.json não foi alterado. No código: readCaptions('./${vo.wordsSrc}') + s.captions(...)` +
          ` e p.audioClip('${name}', …); depois caju build.`,
      );
    }
    return 0;
  }

  const version = await store.version(o.id);
  let project = await store.read(o.id);
  project = addVoiceover(project, vo, { assetId: name, startSec });
  // legendas acompanham onde a locução está de fato (inclusive se foi movida no Studio)
  const offsetSec = voiceoverStartSec(project, name) ?? 0;
  if (o.captions) project = addCaptions(project, vo.cues, { prefix: `${name}-legenda`, offsetSec });
  await store.write(o.id, project, new Date(), version);
  console.log(`${summary}${o.captions ? `, ${vo.cues.length} legenda(s)` : ''}`);
  console.log(`  ${vo.srtSrc} · ${vo.wordsSrc}`);
  return 0;
}

type CaptionsOpts = { dir: string; id: string | undefined; from?: string; offset?: string; prefix?: string };

/** `caju captions <id> --from legenda.srt|.vtt|.words.json`: importa legendas como clipes de texto. */
export async function captionsCommand(o: CaptionsOpts): Promise<number> {
  if (!o.id || !o.from) throw new Error('uso: caju captions <id> --from arquivo.srt|.vtt|.words.json [--offset s]');
  const store = createProjectStore(o.dir);
  const version = await store.version(o.id);
  const project = await store.read(o.id);
  const cues = await readCaptions(path.resolve(o.from));
  if (!cues.length) throw new Error(`nenhuma legenda em ${o.from}`);
  const prefix = o.prefix ?? `${path.basename(o.from).replace(/(\.words)?\.[^.]+$/, '')}-legenda`;
  const next = addCaptions(project, cues, { prefix, offsetSec: num(o.offset, '--offset') ?? 0 });
  await store.write(o.id, next, new Date(), version);
  const added = next.tracks.flatMap((t) => t.clips).filter((c) => c.id.startsWith(`${prefix}-`)).length;
  console.log(`✓ ${o.id}: ${added} legenda(s) de ${o.from}${added < cues.length ? ` (${cues.length - added} ignorada(s) por sobreposição)` : ''}`);
  return 0;
}

/** `caju voices`: vozes e engines do VoiceStudio (perfis clonados/desenhados no app). */
export async function voicesCommand(): Promise<number> {
  const cat = await voiceStudioVoices({ signal: AbortSignal.timeout(5000) });
  const engines = engineNames(cat.engines);
  console.log(`VoiceStudio em ${cat.url}`);
  if (engines.length) console.log(`engines (--model): ${engines.join(', ')}`);
  const profiles = cat.voices.filter((v) => v.type === 'profile');
  if (!profiles.length) {
    console.log('nenhum perfil de voz: crie ou clone uma voz no app VoiceStudio (sem --voice, vale a voz padrão do engine)');
    return 0;
  }
  console.log('perfis (--voice <id ou nome>):');
  for (const v of profiles) console.log(`  ${v.id.padEnd(24)} ${v.name}${v.language ? ` (${v.language})` : ''}`);
  return 0;
}

type TranscribeOpts = {
  dir: string;
  id: string | undefined;
  from?: string;
  name?: string;
  provider?: string;
  model?: string;
  language?: string;
  offset?: string;
  captions: boolean;
  force: boolean;
};

/**
 * `caju transcribe <id> --from video.mp4`: transcreve um áudio/vídeo (VoiceStudio local por padrão)
 * em `assets/data/<name>.words.json` + `.srt` e, com `--captions`, já põe as legendas no projeto.
 */
export async function transcribeCommand(o: TranscribeOpts): Promise<number> {
  if (!o.id || !o.from) {
    throw new Error('uso: caju transcribe <id> --from arquivo.mp4|.wav|.mp3 [--provider voicestudio|openai] [--language pt] [--captions] [--offset s]');
  }
  const store = createProjectStore(o.dir);
  assertProjectId(o.id);
  const projectDir = path.join(store.root, o.id);
  if (!existsSync(projectDir)) throw new Error(`projeto "${o.id}" não encontrado em ${path.resolve(o.dir)}`);
  // relativo à pasta atual (como o --from do caju captions); se não existir, relativo ao projeto
  const file = existsSync(path.resolve(o.from)) ? path.resolve(o.from) : path.resolve(projectDir, o.from);
  const name = o.name ?? path.basename(file, path.extname(file)).replace(/[^\w.-]+/g, '-');
  const provider = sttByName(o.provider ?? DEFAULT_PROVIDER, { model: o.model });
  const tr = await transcription({ projectDir, name, file, provider, language: o.language, force: o.force });
  console.log(`✓ ${o.id}: ${tr.words.length} palavra(s), ${tr.cues.length} legenda(s) de ${tr.source}${tr.cached ? ' (reaproveitado)' : ''}`);
  console.log(`  ${tr.srtSrc} · ${tr.wordsSrc}`);
  if (!o.captions) {
    console.log(`  para pôr no vídeo: caju captions ${o.id} --from ${path.join(o.dir, o.id, tr.wordsSrc)} (ou rode com --captions)`);
    return 0;
  }
  if (findVideoFile(projectDir)) {
    console.log(`  projeto por código: no video.ts use readCaptions('./${tr.wordsSrc}') + s.captions(...); depois caju build.`);
    return 0;
  }
  const version = await store.version(o.id);
  const project = await store.read(o.id);
  const next = addCaptions(project, tr.cues, { prefix: `${name}-legenda`, offsetSec: num(o.offset, '--offset') ?? 0 });
  await store.write(o.id, next, new Date(), version);
  console.log(`  ${tr.cues.length} legenda(s) na trilha "Legendas"`);
  return 0;
}
