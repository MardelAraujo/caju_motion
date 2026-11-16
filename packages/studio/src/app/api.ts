import type { Asset, Project } from '@caju-motion/schema';

export type ProjectSummary =
  | { id: string; valid: true; name: string; format: string; width: number; height: number; fps: number }
  | { id: string; valid: false; error: string };

/** O projeto mudou no disco desde que foi aberto (409). */
export class ConflictError extends Error {
  override name = 'ConflictError';
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export type VoiceProfile = { id: string; name: string; language?: string | null };
export type KeyProvider = 'openai' | 'elevenlabs';
export type VoiceModel = { id: string; label: string; description: string };
/** Voz de um provedor, com descrição e (ElevenLabs) amostra pronta. */
export type VoiceInfo = {
  id: string;
  name: string;
  description: string;
  previewUrl?: string;
  language?: string;
  category?: string;
  /** Só funciona com estes modelos. */
  models?: string[];
};
export type KeyResult = Partial<Record<KeyProvider, { configured: boolean; hint: string | null; warning?: string }>>;
export type VoiceStatus = {
  defaultProvider: string;
  keys: { openai: boolean; elevenlabs: boolean };
  /** Fim da chave configurada (ex.: "…a1b2"), nunca a chave. */
  keyHints?: Record<KeyProvider, string | null>;
  /** `.env` onde as chaves são gravadas. */
  envFile?: string;
  models?: Record<KeyProvider, VoiceModel[]>;
  voicestudio: { ok: true; url: string; engines: string[]; voices: VoiceProfile[] } | { ok: false; url: string; error: string };
};
export type VoiceRequest = {
  text: string;
  name?: string;
  provider?: string;
  voice?: string;
  model?: string;
  language?: string;
  speed?: number;
  startSec?: number;
  captions?: boolean;
};
export type VoiceResult = {
  audioSrc: string;
  durationSec: number;
  timed: boolean;
  cached: boolean;
  cues: number;
  captionsAdded?: number;
  filesOnly: boolean;
  /** Em quantos pedidos o texto foi dividido (texto maior que o limite do provedor). */
  parts?: number;
  warnings?: string[];
};
export type TranscribeResult = { wordsSrc: string; srtSrc: string; cues: number; cached: boolean; captionsAdded?: number; filesOnly: boolean };

/** POST que grava no projeto: manda a versão aberta (`x-caju-base`) para o servidor recusar se o disco mudou. */
const projectPost = <T>(id: string, route: string, body: unknown, base: string | null) =>
  call<T>(`/api/projects/${encodeURIComponent(id)}/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(base ? { 'x-caju-base': base } : {}) },
    body: JSON.stringify(body),
  });

export const api = {
  voiceStatus: () => call<VoiceStatus>('/api/voice'),
  voices: (provider: string, refresh = false) =>
    call<{ provider: string; voices: VoiceInfo[] }>(`/api/voice/voices?provider=${encodeURIComponent(provider)}${refresh ? '&refresh=1' : ''}`).then((r) => r.voices),
  /** Grava (string) ou remove (null) chaves; o servidor testa antes de gravar. */
  saveVoiceKeys: (keys: Partial<Record<KeyProvider, string | null>>) => call<KeyResult>('/api/voice/keys', json('PUT', keys)),
  /** Amostra curta da voz (áudio mp3), gerada uma vez e reaproveitada. */
  async voicePreview(req: { provider: string; voice?: string; model?: string; language?: string }): Promise<Blob> {
    const res = await fetch('/api/voice/preview', json('POST', req));
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.blob();
  },
  generateVoice: (id: string, req: VoiceRequest, base: string | null) => projectPost<VoiceResult>(id, 'tts', req, base),
  transcribeAsset: (id: string, req: { src: string; language?: string; offsetSec?: number }, base: string | null) =>
    projectPost<TranscribeResult>(id, 'transcribe', req, base),
  listProjects: () => call<ProjectSummary[]>('/api/projects'),
  /** Projeto + versão do arquivo no disco (hash). */
  async getProject(id: string): Promise<{ project: Project; version: string }> {
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
    return { project: body as Project, version: res.headers.get('x-caju-version') ?? '' };
  },
  projectVersion: (id: string) => call<{ version: string }>(`/api/projects/${encodeURIComponent(id)}/version`).then((r) => r.version),
  /** Grava; com `base`, o servidor recusa (ConflictError) se o disco mudou. Retorna a nova versão. */
  async saveProject(project: Project, base: string | null, force = false): Promise<string> {
    const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...(base ? { 'x-caju-base': base } : {}),
        ...(force ? { 'x-caju-force': '1' } : {}),
      },
      body: JSON.stringify(project),
    });
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string }).error ?? `HTTP ${res.status}`;
    if (res.status === 409) throw new ConflictError(msg);
    if (!res.ok) throw new Error(msg);
    return res.headers.get('x-caju-version') ?? '';
  },
  createProject: (id: string, format: string, name?: string) => call<Project>('/api/projects', json('POST', { id, format, name })),
  uploadAsset: (projectId: string, file: File) =>
    call<{ src: string; name: string }>(
      `/api/projects/${encodeURIComponent(projectId)}/assets?name=${encodeURIComponent(file.name)}`,
      { method: 'POST', body: file },
    ),
};

export function assetUrl(projectId: string, asset: Pick<Asset, 'src'>): string {
  const path = asset.src.split('/').map(encodeURIComponent).join('/');
  return `/api/projects/${encodeURIComponent(projectId)}/files/${path}`;
}
