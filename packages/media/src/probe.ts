import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFfmpeg } from './ffmpeg';

export type MediaKind = 'video' | 'image' | 'audio' | 'font';

export type MediaInfo = {
  kind: MediaKind;
  /** Duração em segundos (vídeo/áudio). */
  durationSec?: number;
  /** Tamanho de exibição (já com a rotação do arquivo aplicada). */
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  videoCodec?: string;
  audioCodec?: string;
  sampleRate?: number;
  /** Rotação gravada no arquivo (celulares), em graus. */
  rotation?: number;
};

const IMAGE_CODECS = new Set(['png', 'mjpeg', 'jpegls', 'webp', 'bmp', 'tiff', 'gif', 'av1_image', 'jpeg2000', 'qoi', 'pam', 'ppm']);

const EXT: Record<string, MediaKind> = {
  mp4: 'video', mov: 'video', webm: 'video', m4v: 'video', mkv: 'video', avi: 'video',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', avif: 'image', bmp: 'image',
  mp3: 'audio', wav: 'audio', m4a: 'audio', aac: 'audio', ogg: 'audio', oga: 'audio', opus: 'audio', flac: 'audio',
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font',
};

/** Tipo de mídia pela extensão (`null` se desconhecida). */
export function kindOfFile(file: string): MediaKind | null {
  return EXT[path.extname(file).slice(1).toLowerCase()] ?? null;
}

/**
 * Lê duração, tamanho, fps e trilhas de uma mídia. Usa o cabeçalho do `ffmpeg -i` (o `ffmpeg-static`
 * não traz ffprobe), e lê SVGs direto do XML.
 */
export async function probeMedia(file: string): Promise<MediaInfo> {
  const ext = kindOfFile(file);
  if (ext === 'font') return { kind: 'font', hasAudio: false, hasVideo: false };
  if (path.extname(file).toLowerCase() === '.svg') return { kind: 'image', hasAudio: false, hasVideo: false, ...svgSize(await readFile(file, 'utf8')) };

  const { stderr } = await execFfmpeg(['-i', file]);
  if (/No such file or directory|does not exist/i.test(stderr)) throw new Error(`arquivo não encontrado: ${file}`);
  const info = parseFfmpegHeader(stderr);
  if (!info) throw new Error(`não foi possível ler a mídia ${path.basename(file)} (formato desconhecido ou arquivo corrompido)`);
  return isStillImage(info, ext) ? { kind: 'image', hasAudio: false, hasVideo: false, width: info.width, height: info.height } : info;
}

/**
 * Imagem estática? O FFmpeg vê uma imagem como "vídeo" de um quadro. Decide pela extensão ou por um
 * codec de imagem, nunca só pela falta de duração: WebM do MediaRecorder vem sem duração e é vídeo.
 */
export function isStillImage(info: MediaInfo, extKind: MediaKind | null): boolean {
  if (extKind === 'image') return true;
  if (extKind === 'video' || extKind === 'audio') return false;
  return !info.hasAudio && info.durationSec === undefined && IMAGE_CODECS.has(info.videoCodec ?? '');
}

/** Interpreta o cabeçalho que o `ffmpeg -i <arquivo>` escreve no stderr. */
export function parseFfmpegHeader(stderr: string): MediaInfo | null {
  if (!/^Input #0/m.test(stderr)) return null;
  const streams = stderr.split(/\r?\n/).filter((l) => /^\s*Stream #0:\d+/.test(l));
  const video = streams.find((l) => /: Video: /.test(l) && !/attached pic/.test(l));
  const audio = streams.find((l) => /: Audio: /.test(l));
  const info: MediaInfo = { kind: video ? 'video' : 'audio', hasAudio: !!audio, hasVideo: !!video };

  const d = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (d) {
    const sec = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
    if (sec > 0) info.durationSec = sec;
  }
  if (video) {
    info.videoCodec = /: Video: (\w+)/.exec(video)?.[1];
    const size = /, (\d{2,5})x(\d{2,5})[\s,[]/.exec(`${video} `);
    if (size) {
      info.width = Number(size[1]);
      info.height = Number(size[2]);
    }
    const fps = /, (\d+(?:\.\d+)?) fps/.exec(video) ?? /, (\d+(?:\.\d+)?) tbr/.exec(video);
    if (fps) info.fps = Number(fps[1]);
    const rot = /rotation of (-?\d+(?:\.\d+)?) degrees/.exec(stderr) ?? /rotate\s*:\s*(-?\d+)/.exec(stderr);
    if (rot) {
      const deg = ((Math.round(Number(rot[1])) % 360) + 360) % 360;
      if (deg) {
        info.rotation = deg;
        if ((deg === 90 || deg === 270) && info.width && info.height) [info.width, info.height] = [info.height, info.width];
      }
    }
  }
  if (audio) {
    info.audioCodec = /: Audio: (\w+)/.exec(audio)?.[1];
    const hz = /, (\d+) Hz/.exec(audio);
    if (hz) info.sampleRate = Number(hz[1]);
  }
  return info;
}

/** width/height de um SVG (atributos em px, ou o viewBox). */
export function svgSize(svg: string): { width?: number; height?: number } {
  const tag = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? '';
  const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, 'i').exec(tag);
  const w = attr('width');
  const h = attr('height');
  if (w && h) return { width: Math.round(Number(w[1])), height: Math.round(Number(h[1])) };
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
  if (vb) return { width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) };
  return {};
}
