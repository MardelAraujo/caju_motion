import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { continueRender, delayRender } from '@caju-motion/core';
import type { TextProps } from './props';

/**
 * Modo de render (export): `true` dentro da página `?render=` usada pelo exportador.
 * Muda o comportamento de mídias: vídeo vai para o quadro exato (seek + espera de decode)
 * e fica mudo — o áudio do export é mixado à parte pelo FFmpeg.
 */
export const RenderModeContext = createContext(false);
export const useRenderMode = () => useContext(RenderModeContext);

/** Abre um handle no render gate e devolve uma função idempotente que o fecha. */
function holdRender(label: string): () => void {
  const handle = delayRender(label);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    continueRender(handle);
  };
}

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
 * Imagem: segura o render gate até o arquivo carregar E decodificar (`img.decode()`),
 * para o exportador nunca capturar um quadro com a imagem faltando. Erro de carga também
 * libera o gate (o quadro sai sem a imagem, em vez de travar o export).
 */
export function ImageElement({ src, width, height }: { src: string; width: number; height: number }) {
  const ref = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const img = ref.current;
    if (!img) return;
    const release = holdRender(`imagem ${src}`);
    img.decode().then(release, release);
    return release;
  }, [src]);

  return <img ref={ref} src={src} draggable={false} alt="" style={{ display: 'block', width, height }} />;
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** Espera um evento do <video> (rejeita em `error` ou se `signal` abortar). */
function videoEvent(v: HTMLVideoElement, type: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      v.removeEventListener(type, onEvent);
      v.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(v.error?.message || 'erro ao carregar o vídeo'));
    };
    const onAbort = () => {
      cleanup();
      reject(new Error('cancelado'));
    };
    v.addEventListener(type, onEvent);
    v.addEventListener('error', onError);
    signal.addEventListener('abort', onAbort);
  });
}

/**
 * Leva o <video> ao tempo `time` e espera o quadro correspondente estar decodificado e
 * apresentado (`seeked` + `requestVideoFrameCallback` quando disponível).
 */
async function seekExact(v: VideoWithFrameCallback, time: number, signal: AbortSignal): Promise<void> {
  if (v.readyState < HTMLMediaElement.HAVE_METADATA) await videoEvent(v, 'loadedmetadata', signal);
  // meio milissegundo à frente: evita cair no quadro anterior por arredondamento do timestamp
  const end = Number.isFinite(v.duration) ? Math.max(0, v.duration - 0.001) : Infinity;
  const target = Math.min(Math.max(0, time + 0.0005), end);
  let newFrame = false;
  if (v.seeking || Math.abs(v.currentTime - target) > 0.0001) {
    const seeked = videoEvent(v, 'seeked', signal);
    v.currentTime = target;
    await seeked;
    newFrame = true;
  }
  if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await videoEvent(v, 'loadeddata', signal);
    newFrame = true;
  }
  // só espera apresentação se um quadro novo vai mesmo ser desenhado (senão o callback nunca dispara)
  if (newFrame && v.requestVideoFrameCallback) {
    await new Promise<void>((resolve, reject) => {
      const id = v.requestVideoFrameCallback!(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      });
      const onAbort = () => {
        v.cancelVideoFrameCallback?.(id);
        reject(new Error('cancelado'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

/**
 * Vídeo: <video> nativo.
 * - PREVIEW: sincronizado ao playhead. Parado → seek exato; tocando → deixa o decoder correr
 *   e só corrige drift grande.
 * - RENDER (`RenderModeContext`): mudo, seek exato para cada quadro, segurando o render gate até
 *   o quadro estar decodificado. Ainda depende do seek do decoder do navegador; decode
 *   frame-exato via WebCodecs (independente de keyframes/timestamps) fica para uma fase seguinte.
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
  const renderMode = useRenderMode();

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, volume));
    v.muted = renderMode || muted;
    v.playbackRate = rate;
  }, [volume, muted, rate, renderMode]);

  // export: seek exato, segurando o gate até o quadro estar pronto
  useLayoutEffect(() => {
    const v = ref.current;
    if (!renderMode || !v) return;
    if (!v.paused) v.pause();
    const release = holdRender(`vídeo ${src} @ ${time.toFixed(3)}s`);
    const abort = new AbortController();
    seekExact(v, time, abort.signal).then(release, (err: Error) => {
      if (!abort.signal.aborted) console.error(`[caju] vídeo ${src}: ${err.message}`);
      release();
    });
    return () => {
      abort.abort();
      release();
    };
  }, [renderMode, src, time]);

  useEffect(() => {
    const v = ref.current;
    if (!v || renderMode) return;
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
  }, [time, playing, fps, renderMode]);

  useEffect(() => () => ref.current?.pause(), []);

  return (
    <video
      ref={ref}
      src={src}
      preload="auto"
      playsInline
      muted={renderMode || muted}
      style={{ display: 'block', width, height, objectFit: 'fill' }}
    />
  );
}
