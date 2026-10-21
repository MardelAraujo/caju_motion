import { projectDuration, type Asset, type Clip, type Project, type Track } from '@caju-motion/schema';

/**
 * Mixagem de áudio do export, montada a partir do DOCUMENTO (não do navegador):
 * cada clipe de áudio (e o áudio dos clipes de vídeo) vira uma cadeia de filtros do FFmpeg
 * com corte, velocidade, volume (fixo ou por keyframes), fades, pan e atraso até o início do
 * clipe; tudo é somado (`amix`, sem normalizar) e completado/cortado para a duração exata do
 * projeto. Com `settings.audio`: a música abaixa sob a voz (`sidechaincompress`) e o resultado
 * é normalizado para o loudness alvo (`loudnorm`).
 *
 * Módulo puro (sem fs/processos): quem executa o FFmpeg é o `@caju-motion/renderer-node`.
 */

export const MIX_SAMPLE_RATE = 48_000;

export type AudioMixOptions = {
  /** Pasta do projeto (assets com caminho relativo são resolvidos a partir dela). */
  projectDir: string;
  /** Inclui o áudio dos clipes de vídeo (assets com `meta.hasAudio !== false`). Padrão: true. */
  includeVideoAudio?: boolean;
  /** Índice do primeiro `-i` de áudio no comando do FFmpeg (ex.: 1 quando o vídeo é a entrada 0). Padrão: 0. */
  inputOffset?: number;
};

export type AudioMix = {
  /** Arquivos de entrada, na ordem dos `-i` (índice = `[n:a]` no filtergraph). */
  inputs: string[];
  /** Valor de `-filter_complex`. */
  filterComplex: string;
  /** Rótulo da saída do filtergraph (sem colchetes), para `-map [mix]`. */
  outputLabel: string;
  /** Duração exata da mixagem, em segundos (= duração do projeto). */
  durationSec: number;
};

/** Número com até 6 casas, sem notação científica nem zeros sobrando. */
export function num(v: number): string {
  const s = v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

/** Cadeia de `atempo` (cada estágio entre 0.5 e 2) que multiplica a velocidade por `speed`. */
export function atempoChain(speed: number): string[] {
  if (!(speed > 0)) throw new Error(`velocidade inválida: ${speed}`);
  const out: string[] = [];
  let s = speed;
  while (s > 2) {
    out.push('atempo=2');
    s /= 2;
  }
  while (s < 0.5) {
    out.push('atempo=0.5');
    s /= 0.5;
  }
  if (Math.abs(s - 1) > 1e-9) out.push(`atempo=${num(s)}`);
  return out;
}

/** Pan como balanço estéreo: -1 = só esquerda, 0 = centro (sem filtro), 1 = só direita. */
export function panFilter(pan: number): string | null {
  const p = Math.max(-1, Math.min(1, pan));
  if (p === 0) return null;
  const left = p > 0 ? 1 - p : 1;
  const right = p < 0 ? 1 + p : 1;
  return `pan=stereo|c0=${num(left)}*c0|c1=${num(right)}*c1`;
}

function resolvePath(projectDir: string, src: string): string {
  if (/^([a-zA-Z]:[\\/]|[\\/])/.test(src)) return src;
  return `${projectDir.replace(/[\\/]+$/, '')}/${src.replace(/^\.\//, '')}`;
}

/** O clipe contribui com som? */
function audible(clip: Clip, asset: Asset | undefined, includeVideoAudio: boolean): asset is Asset {
  if (!asset || clip.hidden) return false;
  if ((clip.audio?.volume ?? 1) <= 0 && !clip.keyframes?.['audio.volume']?.length) return false;
  if (asset.src.includes('://')) return false; // library:// etc. ainda não resolvidos no export
  if (clip.type === 'audio') return asset.kind === 'audio';
  if (clip.type === 'video') return includeVideoAudio && asset.kind === 'video' && asset.meta.hasAudio !== false;
  return false;
}

type VolumeKeyframe = { frame: number; value: number | string; easing?: unknown };

/**
 * Expressão do filtro `volume` (avaliada por frame de áudio, `t` = segundos desde o início do
 * clipe) a partir dos keyframes de `audio.volume`. Entre keyframes a rampa é linear (`hold`
 * segura o valor); antes do primeiro e depois do último, vale o valor da ponta.
 */
export function volumeExpression(keyframes: readonly VolumeKeyframe[], fps: number): string | null {
  const kfs = keyframes
    .filter((k): k is VolumeKeyframe & { value: number } => typeof k.value === 'number' && Number.isFinite(k.value))
    .map((k) => ({ t: k.frame / fps, v: Math.max(0, k.value), hold: k.easing === 'hold' }))
    .sort((a, b) => a.t - b.t);
  if (!kfs.length) return null;
  let expr = num(kfs[kfs.length - 1]!.v);
  for (let i = kfs.length - 2; i >= 0; i--) {
    const a = kfs[i]!;
    const b = kfs[i + 1]!;
    const seg = a.hold || b.t === a.t ? num(a.v) : `${num(a.v)}+${num(b.v - a.v)}*(t-${num(a.t)})/${num(b.t - a.t)}`;
    expr = `if(lt(t,${num(b.t)}),${seg},${expr})`;
  }
  return `if(lt(t,${num(kfs[0]!.t)}),${num(kfs[0]!.v)},${expr})`;
}

/** Filtros de UM clipe, do corte na mídia de origem até o atraso para a posição na timeline. */
export function clipFilters(
  clip: Pick<Clip, 'start' | 'duration' | 'trimIn' | 'speed' | 'audio'> & { keyframes?: Clip['keyframes'] },
  fps: number,
): string[] {
  const audio = clip.audio ?? { volume: 1, fadeIn: 0, fadeOut: 0, pan: 0 };
  const outDur = clip.duration / fps;
  const srcStart = clip.trimIn / fps;
  const srcEnd = srcStart + (clip.duration * clip.speed) / fps;

  const f: string[] = [
    `atrim=start=${num(srcStart)}:end=${num(srcEnd)}`,
    'asetpts=PTS-STARTPTS',
    `aformat=sample_fmts=fltp:sample_rates=${MIX_SAMPLE_RATE}:channel_layouts=stereo`,
    ...atempoChain(clip.speed),
  ];
  const animated = clip.keyframes?.['audio.volume'] ? volumeExpression(clip.keyframes['audio.volume'], fps) : null;
  if (animated) f.push(`volume='${animated}':eval=frame`);
  else if (audio.volume !== 1) f.push(`volume=${num(audio.volume)}`);
  if (audio.fadeIn > 0) f.push(`afade=t=in:st=0:d=${num(Math.min(audio.fadeIn, clip.duration) / fps)}`);
  if (audio.fadeOut > 0) {
    const d = Math.min(audio.fadeOut, clip.duration) / fps;
    f.push(`afade=t=out:st=${num(outDur - d)}:d=${num(d)}`);
  }
  const pan = panFilter(audio.pan);
  if (pan) f.push(pan);
  // atraso em AMOSTRAS (exato, sem arredondar para ms), em todos os canais
  const delay = Math.round((clip.start * MIX_SAMPLE_RATE) / fps);
  if (delay > 0) f.push(`adelay=${delay}S:all=1`);
  return f;
}

type Bus = 'voice' | 'music' | 'other';

/** Papel da trilha na mixagem. Sem `role`, trilha "Locução" é voz e outras trilhas de áudio são música. */
export function trackBus(track: Pick<Track, 'kind' | 'role' | 'name'>, clip: Pick<Clip, 'type'>): Bus {
  if (track.role === 'voice' || (!track.role && /^locu[cç][aã]o/i.test(track.name ?? ''))) return 'voice';
  if (track.role === 'sfx' || clip.type !== 'audio') return 'other';
  return 'music';
}

/** Soma rótulos num barramento (`anull` com um só). */
function mixOf(labels: string[], out: string, extra = ''): string {
  const tail = extra ? `,${extra}` : '';
  return labels.length > 1
    ? `${labels.join('')}amix=inputs=${labels.length}:duration=longest:dropout_transition=0:normalize=0${tail}[${out}]`
    : `${labels[0]}anull${tail}[${out}]`;
}

/**
 * Monta a mixagem do projeto. Retorna `null` quando não há nada audível
 * (sem clipes de áudio, tudo mudo/oculto, volume zero…).
 */
export function buildAudioMix(project: Project, { projectDir, includeVideoAudio = true, inputOffset = 0 }: AudioMixOptions): AudioMix | null {
  const { fps } = project.settings;
  const total = projectDuration(project);
  const durationSec = total / fps;
  const assets = new Map(project.assets.map((a) => [a.id, a]));

  const inputs: string[] = [];
  const chains: string[] = [];
  const buses: Record<Bus, string[]> = { voice: [], music: [], other: [] };
  const all: string[] = [];
  for (const track of project.tracks) {
    if (track.muted || track.hidden) continue;
    for (const clip of track.clips) {
      if (clip.start >= total) continue;
      const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
      if (!audible(clip, asset, includeVideoAudio)) continue;
      const i = inputs.length;
      inputs.push(resolvePath(projectDir, asset.src));
      chains.push(`[${i + inputOffset}:a]${clipFilters(clip, fps).join(',')}[a${i}]`);
      buses[trackBus(track, clip)].push(`[a${i}]`);
      all.push(`[a${i}]`);
    }
  }
  if (inputs.length === 0) return null;

  const { ducking, loudness } = project.settings.audio ?? {};
  // barramentos do mesmo tamanho (a duração do projeto): o compressor não corta a música quando a voz acaba
  const fit = `apad,atrim=end=${num(durationSec)}`;
  let finalLabels = all;
  if (ducking?.enabled && buses.voice.length && buses.music.length) {
    // a voz entra na mixagem e, em paralelo, comanda o compressor da música
    chains.push(mixOf(buses.voice, 'voicebus', fit), '[voicebus]asplit=2[voice][sidechain]');
    chains.push(mixOf(buses.music, 'musicbus', fit));
    chains.push(
      `[musicbus][sidechain]sidechaincompress=threshold=${num(ducking.threshold)}:ratio=${num(ducking.ratio)}` +
        `:attack=${num(ducking.attackMs)}:release=${num(ducking.releaseMs)}[ducked]`,
    );
    finalLabels = ['[voice]', '[ducked]', ...buses.other];
  }

  const outputLabel = 'mix';
  const tail = [
    'apad',
    `atrim=end=${num(durationSec)}`,
    'asetpts=PTS-STARTPTS',
    ...(loudness?.enabled ? [`loudnorm=I=${num(loudness.targetLufs)}:TP=${num(loudness.truePeakDb)}:LRA=11`, `aresample=${MIX_SAMPLE_RATE}`] : []),
    `aformat=sample_fmts=fltp:sample_rates=${MIX_SAMPLE_RATE}:channel_layouts=stereo`,
  ].join(',');
  // com uma entrada só, o rótulo vai direto para o apad (sem amix)
  const head =
    finalLabels.length > 1 ? `${finalLabels.join('')}amix=inputs=${finalLabels.length}:duration=longest:dropout_transition=0:normalize=0,` : finalLabels[0]!;
  const final = `${head}${tail}[${outputLabel}]`;
  return { inputs, filterComplex: [...chains, final].join(';'), outputLabel, durationSec };
}
