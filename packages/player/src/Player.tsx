import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type Ref,
} from 'react';
import {
  clipVolumeAt,
  ComponentsProvider,
  ProjectRenderer,
  sourceTimeAt,
  type AssetResolver,
  type ComponentDefinition,
} from '@caju-motion/renderer';
import { projectDuration, safeParseProject, type Asset, type Clip, type Project } from '@caju-motion/schema';
import { advance, clamp, fitScale, formatTime, resolveRange } from './clock';

export type PlayerRef = {
  play(): void;
  pause(): void;
  toggle(): void;
  /** Vai para o frame (limitado à faixa `inFrame`–`outFrame`). */
  seekTo(frame: number): void;
  getCurrentFrame(): number;
  isPlaying(): boolean;
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
  /** Volume geral, 0–1. */
  setVolume(volume: number): void;
  getVolume(): number;
  getContainer(): HTMLDivElement | null;
};

export type PlayerProps = {
  /** O `project.json` (qualquer versão de schema conhecida; é migrado e validado) ou um `Project` já lido. */
  project: unknown;
  /** URL de cada asset. Tem prioridade sobre `assetBase`. */
  resolveAsset?: AssetResolver;
  /** Prefixo das URLs dos assets: `assetBase + asset.src` (ex.: `/videos/meu-video/`). Sem os dois, usa `asset.src`. */
  assetBase?: string;
  /** Componentes `defineComponent` usados pelos clipes `component` (só deste player; o registro global também vale). */
  components?: ComponentDefinition[];
  /** Barra com play/pausa, busca, tempo e mudo. */
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  initialFrame?: number;
  /** Faixa tocada (frames, inclusiva). Padrão: o vídeo inteiro. */
  inFrame?: number;
  outFrame?: number;
  /** Velocidade (padrão 1). */
  playbackRate?: number;
  initiallyMuted?: boolean;
  /** Volume inicial, 0–1 (padrão 1). */
  initialVolume?: number;
  /** Clique no vídeo alterna play/pausa (padrão: igual a `controls`). */
  clickToPlay?: boolean;
  /** Espaço alterna play/pausa e ←/→ andam um frame com o player em foco (padrão true). */
  keyboard?: boolean;
  style?: CSSProperties;
  className?: string;
  onFrameUpdate?: (frame: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  /** Projeto inválido (mensagem legível do schema). */
  onError?: (message: string) => void;
  ref?: Ref<PlayerRef>;
};

const NO_COMPONENTS: readonly ComponentDefinition[] = [];

const encodePath = (src: string) => src.split('/').map(encodeURIComponent).join('/');

export function Player(props: PlayerProps) {
  const parsed = useMemo(() => safeParseProject(props.project), [props.project]);
  const error = parsed.success ? null : parsed.error;

  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    if (error) latest.current.onError?.(error);
  }, [error]);

  if (!parsed.success) {
    return (
      <div role="alert" className={props.className} style={{ ...containerStyle(16 / 9), ...props.style }}>
        <div style={errorStyle}>
          <strong>Caju Player: invalid project</strong>
          <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0', fontSize: 12 }}>{error}</pre>
        </div>
      </div>
    );
  }
  return <PlayerView {...props} parsed={parsed.project} />;
}

function PlayerView({
  parsed: project,
  resolveAsset,
  assetBase,
  components,
  controls = false,
  autoPlay = false,
  loop = false,
  initialFrame,
  inFrame,
  outFrame,
  playbackRate = 1,
  initiallyMuted = false,
  initialVolume = 1,
  clickToPlay = controls,
  keyboard = true,
  style,
  className,
  ref,
  ...events
}: PlayerProps & { parsed: Project }) {
  const { width, height, fps } = project.settings;
  const duration = projectDuration(project);
  const range = resolveRange(duration, inFrame, outFrame);

  const [frame, setFrameState] = useState(() => clamp(Math.floor(initialFrame ?? range.inFrame), range.inFrame, range.outFrame));
  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState(initiallyMuted);
  const [volume, setVolumeState] = useState(clamp(initialVolume, 0, 1));
  const [box, setBox] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const playingRef = useRef(playing);
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  /** Base do relógio: tempo real e frame em que a reprodução (re)começou. */
  const baseRef = useRef({ t0: 0, f0: frame });
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const setFrame = useCallback((f: number) => {
    frameRef.current = f;
    setFrameState(f);
  }, []);

  const seekTo = useCallback(
    (f: number) => {
      const { inFrame: a, outFrame: b } = rangeRef.current;
      const next = clamp(Math.round(f), a, b);
      baseRef.current = { t0: performance.now(), f0: next };
      setFrame(next);
    },
    [setFrame],
  );

  const play = useCallback(() => {
    if (playingRef.current) return;
    // no fim, "play" recomeça do início da faixa
    if (frameRef.current >= rangeRef.current.outFrame) setFrame(rangeRef.current.inFrame);
    playingRef.current = true;
    setPlaying(true);
    eventsRef.current.onPlay?.();
  }, [setFrame]);

  const pause = useCallback(() => {
    if (!playingRef.current) return;
    playingRef.current = false;
    setPlaying(false);
    eventsRef.current.onPause?.();
  }, []);

  const toggle = useCallback(() => (playingRef.current ? pause() : play()), [play, pause]);

  const setMutedBoth = useCallback((m: boolean) => {
    mutedRef.current = m;
    setMuted(m);
  }, []);

  useImperativeHandle(
    ref,
    (): PlayerRef => ({
      play,
      pause,
      toggle,
      seekTo,
      getCurrentFrame: () => frameRef.current,
      isPlaying: () => playingRef.current,
      mute: () => setMutedBoth(true),
      unmute: () => setMutedBoth(false),
      isMuted: () => mutedRef.current,
      setVolume: (v: number) => {
        volumeRef.current = clamp(v, 0, 1);
        setVolumeState(volumeRef.current);
      },
      getVolume: () => volumeRef.current,
      getContainer: () => containerRef.current,
    }),
    [play, pause, toggle, seekTo, setMutedBoth],
  );

  // faixa ou projeto mudou: mantém o frame dentro dela
  useEffect(() => {
    if (frameRef.current < range.inFrame || frameRef.current > range.outFrame) seekTo(frameRef.current);
  }, [range.inFrame, range.outFrame, seekTo]);

  // relógio: avança pelo tempo real enquanto toca
  useEffect(() => {
    if (!playing) return;
    baseRef.current = { t0: performance.now(), f0: frameRef.current };
    let raf = 0;
    const tick = (now: number) => {
      const { t0, f0 } = baseRef.current;
      const r = rangeRef.current;
      const { frame: f, ended } = advance({ startFrame: f0, elapsedMs: now - t0, fps, rate: playbackRate, loop, ...r });
      if (f < f0) baseRef.current = { t0: now, f0: f }; // deu a volta (loop)
      if (f !== frameRef.current) setFrame(f);
      if (ended) {
        playingRef.current = false;
        setPlaying(false);
        eventsRef.current.onPause?.();
        eventsRef.current.onEnded?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, fps, playbackRate, loop, setFrame]);

  useEffect(() => {
    eventsRef.current.onFrameUpdate?.(frame);
  }, [frame]);

  // tamanho do contêiner → escala do quadro
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resolve = useCallback<AssetResolver>(
    (asset: Asset) => (resolveAsset ? resolveAsset(asset) : assetBase ? assetBase + encodePath(asset.src) : asset.src),
    [resolveAsset, assetBase],
  );

  const fit = fitScale(box, { width, height });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!keyboard || e.target !== e.currentTarget) return;
    if (e.key === ' ') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.shiftKey ? fps : 1;
      seekTo(frameRef.current + (e.key === 'ArrowLeft' ? -step : step));
    }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ ...containerStyle(width / height), ...style }}
      tabIndex={keyboard ? 0 : undefined}
      onKeyDown={onKeyDown}
      data-caju-player=""
    >
      <div
        onClick={clickToPlay ? toggle : undefined}
        style={{
          position: 'absolute',
          left: fit.left,
          top: fit.top,
          width,
          height,
          transform: `scale(${fit.scale})`,
          transformOrigin: '0 0',
          visibility: fit.scale > 0 ? 'visible' : 'hidden',
          cursor: clickToPlay ? 'pointer' : undefined,
        }}
      >
        <ComponentsProvider components={components ?? NO_COMPONENTS}>
          <ProjectRenderer project={project} frame={frame} resolveAsset={resolve} playing={playing} muted={muted} volume={volume} />
        </ComponentsProvider>
      </div>
      <AudioLayer project={project} frame={frame} playing={playing} muted={muted} volume={volume} resolve={resolve} />
      {controls && (
        <Controls
          frame={frame}
          fps={fps}
          inFrame={range.inFrame}
          outFrame={range.outFrame}
          playing={playing}
          muted={muted}
          onToggle={toggle}
          onSeek={seekTo}
          onMute={() => setMutedBoth(!mutedRef.current)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- áudio

/** Um <audio> por clipe das trilhas de áudio, sincronizado ao frame. */
function AudioLayer({
  project,
  frame,
  playing,
  muted,
  volume,
  resolve,
}: {
  project: Project;
  frame: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  resolve: AssetResolver;
}) {
  const assets = new Map(project.assets.map((a) => [a.id, a]));
  return (
    <>
      {project.tracks
        .filter((t) => t.kind === 'audio')
        .flatMap((t) =>
          t.clips.map((clip) => {
            const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
            if (!asset || clip.hidden) return null;
            return (
              <AudioClip
                key={clip.id}
                clip={clip}
                src={resolve(asset)}
                fps={project.settings.fps}
                frame={frame}
                playing={playing}
                muted={muted || t.muted}
                volume={volume}
              />
            );
          }),
        )}
    </>
  );
}

function AudioClip({
  clip,
  src,
  fps,
  frame,
  playing,
  muted,
  volume,
}: {
  clip: Clip;
  src: string;
  fps: number;
  frame: number;
  playing: boolean;
  muted: boolean;
  volume: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const active = frame >= clip.start && frame < clip.start + clip.duration;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.playbackRate = clip.speed;
    el.muted = muted;
    el.volume = clamp(clipVolumeAt(clip, frame) * volume, 0, 1);
    if (!playing || !active) {
      if (!el.paused) el.pause();
      return;
    }
    const t = sourceTimeAt(clip, frame, fps);
    if (el.paused) {
      el.currentTime = t;
      // autoplay com som pode ser bloqueado pelo navegador até um clique
      void el.play().catch(() => undefined);
    } else if (Math.abs(el.currentTime - t) > 0.25) {
      el.currentTime = t;
    }
  }, [frame, playing, active, clip, muted, volume, fps]);

  return <audio ref={ref} src={src} preload="auto" />;
}

// ---------------------------------------------------------------- controles

function Controls({
  frame,
  fps,
  inFrame,
  outFrame,
  playing,
  muted,
  onToggle,
  onSeek,
  onMute,
}: {
  frame: number;
  fps: number;
  inFrame: number;
  outFrame: number;
  playing: boolean;
  muted: boolean;
  onToggle: () => void;
  onSeek: (frame: number) => void;
  onMute: () => void;
}) {
  return (
    <div style={controlsStyle} onClick={(e) => e.stopPropagation()}>
      <button type="button" style={buttonStyle} aria-label={playing ? 'Pause' : 'Play'} onClick={onToggle}>
        {playing ? '❚❚' : '▶'}
      </button>
      <input
        type="range"
        aria-label="Seek"
        min={inFrame}
        max={outFrame}
        step={1}
        value={frame}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ flex: 1, minWidth: 0, accentColor: '#ff7a1a' }}
      />
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {formatTime(frame - inFrame, fps)} / {formatTime(outFrame - inFrame + 1, fps)}
      </span>
      <button type="button" style={buttonStyle} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} onClick={onMute}>
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- estilos

const containerStyle = (aspect: number): CSSProperties => ({
  position: 'relative',
  width: '100%',
  aspectRatio: String(aspect),
  overflow: 'hidden',
  background: '#000',
  outline: 'none',
});

const errorStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'auto',
  padding: 16,
  color: '#ffb4a8',
  background: '#2a1210',
  font: '14px system-ui, sans-serif',
};

const controlsStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '16px 10px 8px',
  color: '#fff',
  font: '12px system-ui, sans-serif',
  background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
};

const buttonStyle: CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  border: 0,
  borderRadius: 4,
  color: '#fff',
  background: 'transparent',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 14,
};
