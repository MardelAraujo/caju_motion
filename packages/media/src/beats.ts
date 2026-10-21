import { runFfmpegOk } from './ffmpeg';

/**
 * Batidas de uma música (para cortar no tempo): envelope de ataques (energia que sobe) →
 * autocorrelação para o BPM → fase que mais acerta os ataques → cada batida ajustada ao pico
 * mais próximo. Determinístico e sem dependências; bom para música com pulso marcado.
 */

export type BeatAnalysis = {
  bpm: number;
  /** Segundos de cada batida. */
  beats: number[];
  /** Primeira batida de cada compasso (4/4 presumido). */
  downbeats: number[];
  durationSec: number;
  /** 0–1: quão nítido é o pulso (abaixo de ~0,3, desconfie e confira ouvindo). */
  confidence: number;
};

export const BEAT_SAMPLE_RATE = 11_025;
const HOP = 256;
const WIN = 1024;

/** Força de ataque por janela (`HOP` amostras): aumento de energia em escala log, suavizado. */
export function onsetEnvelope(samples: Float32Array): Float32Array {
  const n = Math.max(0, Math.floor((samples.length - WIN) / HOP) + 1);
  const energy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < WIN; j++) {
      const v = samples[i * HOP + j]!;
      sum += v * v;
    }
    energy[i] = Math.log1p(1000 * (sum / WIN));
  }
  const onset = new Float32Array(n);
  for (let i = 1; i < n; i++) onset[i] = Math.max(0, energy[i]! - energy[i - 1]!);
  // tira a média móvel (~0,5 s): sobra o que se destaca do entorno
  const half = Math.round((0.25 * BEAT_SAMPLE_RATE) / HOP);
  const out = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += onset[i]!;
    if (i - 2 * half - 1 >= 0) acc -= onset[i - 2 * half - 1]!;
    const count = Math.min(i + 1, 2 * half + 1);
    out[i] = Math.max(0, onset[i]! - acc / count);
  }
  return out;
}

export function detectBeats(samples: Float32Array, sampleRate = BEAT_SAMPLE_RATE, { minBpm = 60, maxBpm = 180 } = {}): BeatAnalysis {
  const durationSec = samples.length / sampleRate;
  const env = onsetEnvelope(samples);
  const fpsEnv = sampleRate / HOP;
  const empty: BeatAnalysis = { bpm: 0, beats: [], downbeats: [], durationSec, confidence: 0 };
  if (env.length < fpsEnv * 4) return empty;

  // autocorrelação nos períodos possíveis, com leve preferência por ~120 BPM (evita dobro/metade)
  const minLag = Math.floor((60 / maxBpm) * fpsEnv);
  const maxLag = Math.ceil((60 / minBpm) * fpsEnv);
  let best = 0;
  let bestLag = 0;
  let total = 0;
  let count = 0;
  const ac = (lag: number) => {
    let s = 0;
    for (let i = lag; i < env.length; i++) s += env[i]! * env[i - lag]!;
    return s / (env.length - lag);
  };
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fpsEnv) / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    const v = ac(lag) * prior;
    total += v;
    count++;
    if (v > best) {
      best = v;
      bestLag = lag;
    }
  }
  if (!bestLag || best <= 0) return empty;
  // refina o período com interpolação parabólica em torno do pico
  const [a, b, c] = [ac(bestLag - 1), ac(bestLag), ac(bestLag + 1)];
  const denom = a - 2 * b + c;
  const period = bestLag + (denom !== 0 ? (0.5 * (a - c)) / denom : 0);

  // fase: o deslocamento cuja grade de batidas soma mais ataques
  let bestPhase = 0;
  let bestScore = -1;
  for (let phase = 0; phase < Math.ceil(period); phase++) {
    let s = 0;
    for (let t = phase; t < env.length; t += period) s += env[Math.round(t)] ?? 0;
    if (s > bestScore) {
      bestScore = s;
      bestPhase = phase;
    }
  }

  // cada batida vai para o pico mais próximo (±15% do período) e a próxima é prevista a partir
  // dela: a grade acompanha o pulso real em vez de acumular o erro do BPM estimado
  const radius = Math.max(1, Math.round(period * 0.15));
  const beatIdx: number[] = [];
  for (let t = bestPhase; t < env.length; ) {
    const center = Math.round(t);
    let peak = center;
    for (let k = Math.max(0, center - radius); k <= Math.min(env.length - 1, center + radius); k++) if (env[k]! > env[peak]!) peak = k;
    const hit = env[peak]! > 0 ? peak : center;
    beatIdx.push(hit);
    t = (env[peak]! > 0 ? hit : t) + period;
  }
  // o maior salto de energia é a primeira janela que contém o ataque: ele está perto do FIM dela
  const toSec = (i: number) => Math.round(((i * HOP + WIN - HOP / 2) / sampleRate) * 1000) / 1000;
  const beats = beatIdx.map(toSec).filter((s) => s < durationSec);

  // compasso: das 4 posições possíveis, a que tem os ataques mais fortes
  let bar = 0;
  let barScore = -1;
  for (let k = 0; k < 4; k++) {
    let s = 0;
    for (let i = k; i < beatIdx.length; i += 4) s += env[beatIdx[i]!]!;
    if (s > barScore) {
      barScore = s;
      bar = k;
    }
  }
  const downbeats = beats.filter((_, i) => i % 4 === bar);
  const mean = total / count;
  const confidence = Math.max(0, Math.min(1, (best - mean) / (best + 1e-9)));
  // BPM pelo intervalo médio das batidas achadas (mais preciso que o período da autocorrelação)
  const span = beats.length >= 4 ? (beats[beats.length - 1]! - beats[0]!) / (beats.length - 1) : period / fpsEnv;
  return { bpm: Math.round((60 / span) * 10) / 10, beats, downbeats, durationSec: Math.round(durationSec * 1000) / 1000, confidence: Math.round(confidence * 100) / 100 };
}

/** Decodifica o arquivo (mono, 11 kHz) com o FFmpeg e detecta as batidas. */
export async function analyzeBeats(file: string, opts: { signal?: AbortSignal; minBpm?: number; maxBpm?: number } = {}): Promise<BeatAnalysis> {
  const { stdout } = await runFfmpegOk(['-i', file, '-vn', '-ac', '1', '-ar', String(BEAT_SAMPLE_RATE), '-f', 'f32le', 'pipe:1'], {
    captureStdout: true,
    signal: opts.signal,
  });
  const samples = new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 4));
  return detectBeats(samples, BEAT_SAMPLE_RATE, opts);
}
