import { useEffect, useRef } from 'react';
import { clipVolumeAt, sourceTimeAt } from '@caju-motion/renderer';
import { projectDuration, type Clip } from '@caju-motion/schema';
import { assetUrl } from './api';
import {
  deleteSelected,
  duplicateSelected,
  splitAtPlayhead,
  togglePlay,
} from './commands';
import { useEditor } from './store';

/** Relógio de reprodução: avança o frame pelo tempo real enquanto `playing`. */
export function usePlaybackClock() {
  const playing = useEditor((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    const { project, frame } = useEditor.getState();
    if (!project) return;
    const fps = project.settings.fps;
    const t0 = performance.now();
    const f0 = frame;
    let raf = 0;
    const tick = (now: number) => {
      const s = useEditor.getState();
      if (!s.project || !s.playing) return;
      const end = projectDuration(s.project) - 1;
      const f = Math.floor(f0 + ((now - t0) / 1000) * fps);
      if (f >= end) {
        useEditor.setState({ frame: end, playing: false });
        return;
      }
      if (f !== s.frame) useEditor.setState({ frame: f });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

/** Um <audio> por clipe das trilhas de áudio, sincronizado ao playhead. */
export function AudioLayer() {
  const project = useEditor((s) => s.project);
  if (!project) return null;
  const clips = project.tracks
    .filter((t) => t.kind === 'audio')
    .flatMap((t) => t.clips.map((c) => ({ clip: c, muted: t.muted })));
  return (
    <>
      {clips.map(({ clip, muted }) => {
        const asset = project.assets.find((a) => a.id === clip.assetId);
        return asset ? <AudioClip key={clip.id} clip={clip} src={assetUrl(project.id, asset)} muted={muted} fps={project.settings.fps} /> : null;
      })}
    </>
  );
}

function AudioClip({ clip, src, muted, fps }: { clip: Clip; src: string; muted: boolean; fps: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const frame = useEditor((s) => s.frame);
  const playing = useEditor((s) => s.playing);
  const active = frame >= clip.start && frame < clip.start + clip.duration;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.playbackRate = clip.speed;
    el.muted = muted;
    el.volume = Math.min(1, Math.max(0, clipVolumeAt(clip, frame)));
    if (!playing || !active) {
      if (!el.paused) el.pause();
      return;
    }
    const t = sourceTimeAt(clip, frame, fps);
    if (el.paused) {
      el.currentTime = t;
      void el.play().catch(() => undefined);
    } else if (Math.abs(el.currentTime - t) > 0.25) {
      el.currentTime = t;
    }
  }, [frame, playing, active, clip, muted, fps]);

  return <audio ref={ref} src={src} preload="auto" />;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Atalhos de teclado no padrão do CapCut. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+S salva mesmo com o foco num campo de texto
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void useEditor.getState().save();
        return;
      }
      if (isTyping(e.target)) return;
      const s = useEditor.getState();
      if (!s.project) return;
      const mod = e.ctrlKey || e.metaKey;
      const fps = s.project.settings.fps;
      const key = e.key.toLowerCase();

      if (key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      } else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        s.redo();
      } else if (mod && key === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if ((mod && key === 'b') || (!mod && key === 's')) {
        e.preventDefault();
        splitAtPlayhead();
      } else if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (key === 'arrowleft' || key === 'arrowright') {
        e.preventDefault();
        const step = e.shiftKey ? fps : 1;
        s.setFrame(s.frame + (key === 'arrowleft' ? -step : step));
      } else if (key === 'home') {
        s.setFrame(0);
      } else if (key === 'end') {
        s.setFrame(projectDuration(s.project));
      } else if (key === 'escape') {
        s.select(null);
      } else if (!mod && key === 'v') {
        s.set({ tool: 'select' });
      } else if (!mod && key === 'h') {
        s.set({ tool: 'hand' });
      } else if (key === '=' || key === '+') {
        s.set({ pxPerFrame: Math.min(24, s.pxPerFrame * 1.4) });
      } else if (key === '-') {
        s.set({ pxPerFrame: Math.max(0.05, s.pxPerFrame / 1.4) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export const SHORTCUTS: [string, string][] = [
  ['Ctrl+S', 'Salvar alterações'],
  ['Espaço', 'Reproduzir / pausar'],
  ['S  ou  Ctrl+B', 'Dividir no playhead'],
  ['Delete', 'Excluir clipe'],
  ['Ctrl+D', 'Duplicar clipe'],
  ['Ctrl+Z / Ctrl+Shift+Z', 'Desfazer / refazer'],
  ['← / →', 'Frame anterior / próximo (Shift: 1 s)'],
  ['Home / End', 'Início / fim'],
  ['+ / −', 'Zoom da timeline'],
  ['Ctrl+roda', 'Zoom (timeline ou canvas)'],
  ['V / H', 'Ferramenta selecionar / mover tela'],
  ['Duplo clique', 'Editar texto no canvas'],
  ['Esc', 'Tirar seleção'],
];
