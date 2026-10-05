import { useEffect, useState } from 'react';
import type { Asset } from '@caju-motion/schema';

export type MediaKind = 'video' | 'image' | 'audio';

export function kindOfFile(file: File): MediaKind | null {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (['mp4', 'mov', 'webm', 'm4v', 'mkv'].includes(ext)) return 'video';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext)) return 'audio';
  return null;
}

/** Lê duração/dimensões no navegador (sem ffprobe), com tempo limite para nunca travar o upload. */
export function probeMedia(url: string, kind: MediaKind, timeoutMs = 20000): Promise<Asset['meta']> {
  return Promise.race([
    probe(url, kind),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('tempo esgotado ao ler o arquivo (a aba estava em segundo plano?)')), timeoutMs),
    ),
  ]);
}

function probe(url: string, kind: MediaKind): Promise<Asset['meta']> {
  return new Promise((resolve, reject) => {
    if (kind === 'image') {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 1080, height: img.naturalHeight || 1080 });
      img.onerror = () => reject(new Error('não foi possível ler a imagem'));
      img.src = url;
      return;
    }
    const el = document.createElement(kind);
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const meta: Asset['meta'] = { durationSec: Number.isFinite(el.duration) ? el.duration : 0 };
      if (el instanceof HTMLVideoElement) {
        meta.width = el.videoWidth || 1920;
        meta.height = el.videoHeight || 1080;
        meta.hasAudio = true;
      }
      resolve(meta);
    };
    el.onerror = () => reject(new Error(`não foi possível ler o ${kind === 'video' ? 'vídeo' : 'áudio'}`));
    el.src = url;
  });
}

// ---------------------------------------------------------------- miniaturas

const thumbCache = new Map<string, Promise<string>>();

function captureVideoThumb(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      const w = 240;
      const h = Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')?.drawImage(v, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
      v.removeAttribute('src');
      v.load();
    };
    v.onerror = () => reject(new Error('thumb'));
    v.src = url;
  });
}

/** URL de miniatura: a própria imagem, ou um frame capturado do vídeo (em cache). */
export function useThumbnail(url: string | null, kind: string): string | null {
  const [thumb, setThumb] = useState<string | null>(kind === 'image' ? url : null);
  useEffect(() => {
    if (!url) return;
    if (kind === 'image') {
      setThumb(url);
      return;
    }
    if (kind !== 'video') return;
    let alive = true;
    let p = thumbCache.get(url);
    if (!p) {
      p = captureVideoThumb(url);
      thumbCache.set(url, p);
    }
    p.then((t) => alive && setThumb(t)).catch(() => thumbCache.delete(url));
    return () => {
      alive = false;
    };
  }, [url, kind]);
  return thumb;
}

// ---------------------------------------------------------------- forma de onda

export const PEAKS_PER_SECOND = 100;
const peaksCache = new Map<string, Promise<Float32Array>>();

async function computePeaks(url: string): Promise<Float32Array> {
  const buf = await (await fetch(url)).arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const audio = await ctx.decodeAudioData(buf);
  const bucket = Math.max(1, Math.floor(audio.sampleRate / PEAKS_PER_SECOND));
  const count = Math.ceil(audio.length / bucket);
  const peaks = new Float32Array(count);
  for (let ch = 0; ch < audio.numberOfChannels; ch++) {
    const data = audio.getChannelData(ch);
    for (let i = 0; i < count; i++) {
      let max = 0;
      const end = Math.min(data.length, (i + 1) * bucket);
      for (let j = i * bucket; j < end; j++) {
        const v = Math.abs(data[j]!);
        if (v > max) max = v;
      }
      if (max > peaks[i]!) peaks[i] = max;
    }
  }
  return peaks;
}

export function usePeaks(url: string | null): Float32Array | null {
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    let p = peaksCache.get(url);
    if (!p) {
      p = computePeaks(url);
      peaksCache.set(url, p);
    }
    p.then((v) => alive && setPeaks(v)).catch(() => peaksCache.delete(url));
    return () => {
      alive = false;
    };
  }, [url]);
  return peaks;
}
