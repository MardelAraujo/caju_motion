import { FORMATS, type FormatId } from './formats';
import { CURRENT_SCHEMA_VERSION, type Project } from './project';

/** Projeto vazio com uma trilha principal e uma de áudio. */
export function createEmptyProject(opts: { id: string; name?: string; format?: FormatId; now?: string }): Project {
  const format = FORMATS[opts.format ?? 'reel-9x16'];
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: opts.id,
    name: opts.name ?? opts.id,
    settings: {
      format: format.id,
      width: format.width,
      height: format.height,
      fps: format.fps,
      background: '#000000',
    },
    assets: [],
    tracks: [
      { id: 'main', kind: 'main', name: 'Principal', locked: false, hidden: false, muted: false, clips: [] },
      { id: 'audio-1', kind: 'audio', name: 'Áudio', locked: false, hidden: false, muted: false, clips: [] },
    ],
    markers: [],
    meta: opts.now ? { createdAt: opts.now, updatedAt: opts.now, generator: 'caju-motion' } : { generator: 'caju-motion' },
  };
}
