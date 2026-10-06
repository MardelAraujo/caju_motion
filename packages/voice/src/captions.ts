/**
 * Legendas: palavras com tempo → linhas (cues), SRT/VTT de ida e volta, e alinhamento de um roteiro
 * com palavras transcritas. Tempos em segundos. Funções puras (Node e navegador).
 */

export type Word = { text: string; start: number; end: number };
export type Cue = { text: string; start: number; end: number; words?: Word[] };

export type CueOptions = {
  /** Caracteres por linha de legenda (padrão 32; reels costumam usar 20–32). */
  maxChars?: number;
  /** Duração máxima de uma legenda (s, padrão 3,5). */
  maxDurationSec?: number;
  /** Pausa entre palavras que força nova legenda (s, padrão 0,6). */
  maxGapSec?: number;
};

const SENTENCE_END = /[.!?…]["')\]]?$/;
const CLAUSE_END = /[,;:—–]$/;

/** Agrupa palavras em legendas legíveis: quebra em fim de frase, pausa, tamanho ou duração. */
export function wordsToCues(words: Word[], { maxChars = 32, maxDurationSec = 3.5, maxGapSec = 0.6 }: CueOptions = {}): Cue[] {
  const cues: Cue[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    cues.push({ text: cur.map((w) => w.text).join(' '), start: cur[0]!.start, end: cur[cur.length - 1]!.end, words: cur });
    cur = [];
  };
  for (const w of words) {
    if (!w.text.trim()) continue;
    const prev = cur[cur.length - 1];
    if (prev) {
      const len = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length; // com os espaços
      const breakHere =
        SENTENCE_END.test(prev.text) ||
        w.start - prev.end > maxGapSec ||
        len > maxChars ||
        w.end - cur[0]!.start > maxDurationSec ||
        (CLAUSE_END.test(prev.text) && len > maxChars * 0.6);
      if (breakHere) flush();
    }
    cur.push(w);
  }
  flush();
  return cues;
}

/**
 * Tempos estimados quando o provedor não devolve tempos por palavra: distribui `durationSec` pelas
 * palavras, proporcional ao tamanho, com respiro em vírgulas e pontos.
 */
export function estimateWords(text: string, durationSec: number, { leadSec = 0, tailSec = 0 } = {}): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length || durationSec <= 0) return [];
  const pause = (t: string) => (SENTENCE_END.test(t) ? 4 : CLAUSE_END.test(t) ? 2 : 0);
  const weights = tokens.map((t) => t.length + 1 + pause(t));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(0.001, durationSec - leadSec - tailSec);
  let t = leadSec;
  return tokens.map((text, i) => {
    const d = (weights[i]! / total) * span;
    const pauseShare = (pause(text) / weights[i]!) * d;
    const w = { text, start: round(t), end: round(t + d - pauseShare) };
    t += d;
    return w;
  });
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Usa o texto do roteiro (com pontuação e grafia certas) com os tempos de uma transcrição
 * (ex.: Whisper com tempos por palavra). Palavras sem par recebem tempos interpolados.
 */
export function alignScript(script: string, timed: Word[]): Word[] {
  const tokens = script.split(/\s+/).filter(Boolean);
  const out: (Word | null)[] = tokens.map(() => null);
  let j = 0;
  for (let i = 0; i < tokens.length && j < timed.length; i++) {
    const n = norm(tokens[i]!);
    if (!n) continue;
    for (let k = j; k < Math.min(timed.length, j + 4); k++) {
      if (norm(timed[k]!.text) === n) {
        out[i] = { text: tokens[i]!, start: timed[k]!.start, end: timed[k]!.end };
        j = k + 1;
        break;
      }
    }
  }
  // preenche os buracos entre âncoras
  const end = timed.length ? timed[timed.length - 1]!.end : 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    let a = i - 1;
    while (a >= 0 && !out[a]) a--;
    let b = i;
    while (b < out.length && !out[b]) b++;
    const from = a >= 0 ? out[a]!.end : 0;
    const to = b < out.length ? out[b]!.start : end;
    const gap = b - a - 1;
    const step = (to - from) / gap;
    for (let k = a + 1; k < b; k++) {
      const s = from + step * (k - a - 1);
      out[k] = { text: tokens[k]!, start: round(s), end: round(s + step) };
    }
    i = b;
  }
  return out as Word[];
}

// ---------------------------------------------------------------- SRT / VTT

/** Tempos em milissegundos inteiros (evita 0.30000000000000004 nos arquivos). */
export const round = (n: number) => Math.round(n * 1000) / 1000;

function stamp(sec: number, sep: ',' | '.'): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
}

function parseStamp(s: string): number {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/.exec(s.trim());
  if (!m) throw new Error(`tempo inválido na legenda: "${s}"`);
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]!.padEnd(3, '0')) / 1000;
}

export function toSrt(cues: Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n');
}

export function toVtt(cues: Cue[]): string {
  return `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`;
}

/** Lê SRT ou WebVTT (detecta pelo conteúdo). Remove tags de formatação (`<i>`, `<c.x>`, `{\an8}`). */
export function parseSubtitles(content: string): Cue[] {
  const blocks = content.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at < 0) continue; // cabeçalho WEBVTT, NOTE, STYLE, número solto
    const [a, b] = lines[at]!.split('-->');
    const text = lines
      .slice(at + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .trim();
    if (!text) continue;
    cues.push({ text, start: parseStamp(a!), end: parseStamp(b!.trim().split(/\s+/)[0]!) });
  }
  return cues;
}
