/** Utilitários HTTP internos dos provedores de voz (não exportados pelo pacote). */

export type FetchLike = typeof fetch;

export const env = (name: string): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];

export async function failure(res: Response, provider: string): Promise<Error> {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 400);
  } catch {
    // corpo ilegível
  }
  const hint = res.status === 401 ? ' (chave de API inválida?)' : res.status === 429 ? ' (limite de uso/créditos)' : '';
  return new Error(`${provider}: HTTP ${res.status}${hint}${detail ? ` — ${detail}` : ''}`);
}

export function mimeOf(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'ogg':
    case 'opus':
      return 'audio/ogg';
    case 'webm':
      return 'audio/webm';
    case 'flac':
      return 'audio/flac';
    default:
      return 'application/octet-stream';
  }
}
