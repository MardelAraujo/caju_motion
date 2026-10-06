import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { findVideoFile } from '@caju-motion/sdk';
import { assertProjectId, createProjectStore } from '@caju-motion/server';
import { addCaptions, addVoiceover, providerByName, readCaptions, voiceover } from '@caju-motion/voice';

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
  start?: string;
  captions: boolean;
  /** Só os arquivos (áudio, words.json, srt), sem tocar no project.json. Automático com video.ts. */
  filesOnly: boolean;
  force: boolean;
};

const num = (v: string | undefined, flag: string): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${flag} precisa ser um número ≥ 0 (recebido: ${v})`);
  return n;
};

/**
 * `caju tts <id>`: gera a locução (TTS) no projeto, registra o áudio numa trilha "Locução" e, por
 * padrão, as legendas numa trilha "Legendas". Mesmo texto + voz reaproveita o arquivo (não paga de novo).
 */
export async function ttsCommand(o: TtsOpts): Promise<number> {
  if (!o.id) throw new Error('uso: caju tts <id> --text "..." (ou --script roteiro.txt) [--provider placeholder|openai|elevenlabs] [--voice v]');
  const text = (o.script ? await readFile(o.script, 'utf8') : (o.text ?? '')).trim();
  if (!text) throw new Error('informe o texto com --text "..." ou --script arquivo.txt');
  const providerName = o.provider ?? 'placeholder';
  const provider = providerByName(providerName, { voice: o.voice, model: o.model });
  const store = createProjectStore(o.dir);
  // sem exigir project.json: num projeto por código ele só nasce no `caju build`
  assertProjectId(o.id);
  const projectDir = path.join(store.root, o.id);
  if (!existsSync(projectDir)) throw new Error(`projeto "${o.id}" não encontrado em ${path.resolve(o.dir)}`);
  const name = o.name ?? 'locucao';
  const startSec = num(o.start, '--start') ?? 0;
  // projeto por código: o video.ts decide onde a locução e as legendas entram (readCaptions + s.captions);
  // mexer no project.json aqui duplicaria tudo no próximo `caju build`
  const codeFile = findVideoFile(projectDir);
  const filesOnly = o.filesOnly || !!codeFile;

  if (providerName === 'placeholder') {
    console.log('· voz provisória (tom + tempos estimados). Para a voz real: --provider openai ou --provider elevenlabs');
  }
  const vo = await voiceover({
    projectDir,
    name,
    text,
    provider,
    voice: o.voice,
    speed: num(o.speed, '--speed'),
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
  if (o.captions) project = addCaptions(project, vo.cues, { prefix: `${name}-legenda`, offsetSec: startSec });
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
