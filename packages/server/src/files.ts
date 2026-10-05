import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { ProjectStoreError } from './projects';

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.json': 'application/json',
  // app do Studio (build de produção)
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

export const mimeOf = (file: string) => MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';

/** Resolve `rel` dentro de `baseDir`, recusando escapar da pasta. */
export function safeJoin(baseDir: string, rel: string): string {
  const full = path.resolve(baseDir, rel);
  const base = path.resolve(baseDir);
  if (full !== base && !full.startsWith(base + path.sep)) throw new ProjectStoreError('caminho fora do projeto', 400);
  return full;
}

/** Nome de arquivo seguro: sem acentos/espaços problemáticos, mantendo a extensão. */
export function sanitizeFileName(name: string): string {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const base = path
    .basename(name, path.extname(name))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'arquivo'}${ext}`;
}

async function exists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Grava um upload (stream) em `<dir>/<nome>`, sem sobrescrever: `nome-2.ext`, `nome-3.ext`… */
export async function saveUpload(dir: string, originalName: string, body: WebReadableStream<Uint8Array>): Promise<string> {
  await mkdir(dir, { recursive: true });
  const clean = sanitizeFileName(originalName);
  const ext = path.extname(clean);
  const base = path.basename(clean, ext);
  let name = clean;
  for (let i = 2; await exists(path.join(dir, name)); i++) name = `${base}-${i}${ext}`;
  await pipeline(Readable.fromWeb(body), createWriteStream(path.join(dir, name)));
  return name;
}

/** Serve arquivo com suporte a Range (necessário para seek de vídeo/áudio no navegador). */
export async function serveFile(file: string, rangeHeader: string | undefined): Promise<Response> {
  let info;
  try {
    info = await stat(file);
  } catch {
    return new Response('não encontrado', { status: 404 });
  }
  if (!info.isFile()) return new Response('não encontrado', { status: 404 });

  const size = info.size;
  const headers: Record<string, string> = {
    'content-type': mimeOf(file),
    'accept-ranges': 'bytes',
    'cache-control': 'no-cache',
  };

  const m = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader) : null;
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as unknown as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(file)) as unknown as ReadableStream;
  return new Response(stream, { status: 200, headers: { ...headers, 'content-length': String(size) } });
}
