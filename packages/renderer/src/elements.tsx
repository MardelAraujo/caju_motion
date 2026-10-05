import { useEffect, useLayoutEffect, useRef } from 'react';
import type { TextProps } from './props';

export function TextElement({
  props,
  editing,
  onCommit,
}: {
  props: TextProps;
  editing?: boolean;
  onCommit?: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);

  return (
    <div
      ref={ref}
      contentEditable={editing ? 'plaintext-only' : undefined}
      suppressContentEditableWarning
      onBlur={editing ? (e) => onCommit?.(e.currentTarget.innerText) : undefined}
      onKeyDown={
        editing
          ? (e) => {
              e.stopPropagation();
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) e.currentTarget.blur();
            }
          : undefined
      }
      style={{
        fontFamily: `'${props.fontFamily}', sans-serif`,
        fontSize: props.fontSize,
        fontWeight: props.fontWeight,
        color: props.color,
        textAlign: props.align,
        lineHeight: props.lineHeight,
        letterSpacing: props.letterSpacing,
        whiteSpace: 'pre',
        background: props.background || undefined,
        padding: props.background ? '0.15em 0.35em' : undefined,
        outline: 'none',
        cursor: editing ? 'text' : undefined,
      }}
    >
      {props.text}
    </div>
  );
}

/**
 * Vídeo na PREVIEW: <video> nativo sincronizado ao playhead.
 * Parado → seek exato; tocando → deixa o decoder correr e só corrige drift grande.
 * (No export, a Fase 1 troca isto por decode frame-exato via WebCodecs.)
 */
export function VideoElement({
  src,
  width,
  height,
  time,
  playing,
  volume,
  muted,
  rate,
  fps,
}: {
  src: string;
  width: number;
  height: number;
  time: number;
  playing: boolean;
  volume: number;
  muted: boolean;
  rate: number;
  fps: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, volume));
    v.muted = muted;
    v.playbackRate = rate;
  }, [volume, muted, rate]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!playing) {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - time) > 0.5 / fps) v.currentTime = time;
      return;
    }
    if (v.paused) {
      v.currentTime = time;
      void v.play().catch(() => undefined);
    } else if (Math.abs(v.currentTime - time) > 0.25) {
      v.currentTime = time;
    }
  }, [time, playing, fps]);

  useEffect(() => () => ref.current?.pause(), []);

  return (
    <video
      ref={ref}
      src={src}
      preload="auto"
      playsInline
      style={{ display: 'block', width, height, objectFit: 'fill' }}
    />
  );
}
