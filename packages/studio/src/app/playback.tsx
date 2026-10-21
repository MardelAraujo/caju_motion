import { useEffect, useRef } from 'react';
import { clipVolumeAt, sourceTimeAt } from '@caju-motion/renderer';
import { projectDuration, type Clip } from '@caju-motion/schema';
import { assetUrl } from './api';
import { actionFor, comboOf } from './actions';
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

/** Atalhos de teclado: o registro de ações (remapeáveis na janela de atalhos). */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // a janela de atalhos está gravando uma tecla nova
      if (document.body.dataset.capturingShortcut) return;
      const combo = comboOf(e);
      if (!combo) return;
      const action = actionFor(combo);
      if (!action) return;
      if (!action.global && (isTyping(e.target) || !useEditor.getState().project)) return;
      e.preventDefault();
      action.run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
