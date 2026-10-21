import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Eye, EyeOff, Lock, LockOpen, Plus, Puzzle, Shapes, Type, Volume2, VolumeX } from 'lucide-react';
import { OVERLAYS, shapeProps, textProps } from '@caju-motion/renderer';
import { projectDuration, type Asset, type Clip, type Project, type Track } from '@caju-motion/schema';
import { assetUrl } from '../api';
import { dropPayload, hasPayload, readPayload } from '../dnd';
import { PEAKS_PER_SECOND, usePeaks, useThumbnail } from '../media';
import { keyframeFrames, moveKeyframesAt } from '../keyframes';
import { clipEnd, moveClip, moveClips, trimClip, updateClip } from '../ops';
import { useEditor } from '../store';
import { formatClock, formatShort } from '../time';
import { MAX_PPF, MIN_PPF } from './TimelineToolbar';

const HEADER_W = 84;
const SNAP_PX = 8;
const ROW_H: Record<Track['kind'], number> = { main: 64, overlay: 44, text: 36, audio: 48, effect: 36 };
const TICK_STEPS_SEC = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

/** Prévia do arraste: o clipe puxado (e, em grupo, o deslocamento aplicado aos outros). */
type Ghost = { id: string; start: number; trackId: string | 'new'; group?: string[]; delta?: number };
type Drag =
  | { kind: 'move'; id: string; x0: number; y0: number; start0: number; trackId0: string; moved: boolean; group: string[] | null }
  | { kind: 'trim'; id: string; edge: 'start' | 'end'; x0: number; edge0: number }
  | { kind: 'scrub' }
  | { kind: 'box'; x0: number; y0: number; x1: number; y1: number; additive: boolean; moved: boolean };
type Box = { left: number; top: number; width: number; height: number };

/** Ordem de exibição: trilhas visuais de cima (última desenhada) para baixo, depois áudio. */
function displayTracks(p: Project): Track[] {
  const visual = p.tracks.filter((t) => t.kind !== 'audio').reverse();
  const audio = p.tracks.filter((t) => t.kind === 'audio');
  return [...visual, ...audio];
}

export function useFitTimeline(scrollRef: React.RefObject<HTMLDivElement | null>) {
  return () => {
    const { project, set } = useEditor.getState();
    const el = scrollRef.current;
    if (!project || !el) return;
    const frames = Math.max(projectDuration(project), project.settings.fps * 5);
    set({ pxPerFrame: Math.min(MAX_PPF, Math.max(MIN_PPF, (el.clientWidth - HEADER_W - 60) / frames)) });
  };
}

export function Timeline({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const project = useEditor((s) => s.project);
  const frame = useEditor((s) => s.frame);
  const playing = useEditor((s) => s.playing);
  const ppf = useEditor((s) => s.pxPerFrame);
  const snapping = useEditor((s) => s.snapping);
  const selectedId = useEditor((s) => s.selectedClipId);
  const selectedIds = useEditor((s) => s.selectedClipIds);
  const { select, selectMany, setFrame, apply, beginGesture, applyFromBase, endGesture, set } = useEditor.getState();
  const [box, setBox] = useState<Box | null>(null);

  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [dropHint, setDropHint] = useState<{ trackId: string; frame: number } | null>(null);
  const [viewW, setViewW] = useState(1000);
  const drag = useRef<Drag | null>(null);
  const ghostRef = useRef<Ghost | null>(null);
  const fittedFor = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  // ajusta o zoom ao abrir um projeto
  useEffect(() => {
    const el = scrollRef.current;
    if (!project || !el || fittedFor.current === project.id) return;
    fittedFor.current = project.id;
    const frames = Math.max(projectDuration(project), project.settings.fps * 10);
    set({ pxPerFrame: Math.min(MAX_PPF, Math.max(MIN_PPF, (el.clientWidth - HEADER_W - 60) / frames)) });
  }, [project, scrollRef, set]);

  // segue o playhead durante a reprodução
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    const x = frame * ppf;
    const visible = el.clientWidth - HEADER_W;
    if (x < el.scrollLeft || x > el.scrollLeft + visible - 40) el.scrollLeft = Math.max(0, x - visible * 0.2);
  }, [frame, playing, ppf, scrollRef]);

  if (!project) return <div className="timeline" />;

  const fps = project.settings.fps;
  const duration = projectDuration(project);
  const rows = displayTracks(project);
  const contentFrames = Math.max(duration + fps * 10, (viewW - HEADER_W) / ppf);
  const contentW = contentFrames * ppf;

  // ------------------------------------------------ utilidades

  const laneFrame = (clientX: number) => {
    const el = scrollRef.current!;
    const r = el.getBoundingClientRect();
    return Math.max(0, (clientX - r.left - HEADER_W + el.scrollLeft) / ppf);
  };

  const snapPoints = (ignoreId: string) => {
    const pts = [0, frame, ...project.markers.map((m) => m.frame)];
    for (const t of project.tracks) for (const c of t.clips) if (c.id !== ignoreId) pts.push(c.start, clipEnd(c));
    return pts;
  };

  const snap = (value: number, ignoreId: string, extraEdge?: number) => {
    if (!snapping) return { value, line: null as number | null };
    const threshold = SNAP_PX / ppf;
    let best: { d: number; value: number; line: number } | null = null;
    for (const p of snapPoints(ignoreId)) {
      const d1 = Math.abs(value - p);
      if (d1 < threshold && (!best || d1 < best.d)) best = { d: d1, value: p, line: p };
      if (extraEdge !== undefined) {
        const d2 = Math.abs(value + extraEdge - p);
        if (d2 < threshold && (!best || d2 < best.d)) best = { d: d2, value: p - extraEdge, line: p };
      }
    }
    return best ? { value: best.value, line: best.line } : { value, line: null };
  };

  const trackUnder = (clientX: number, clientY: number): string | 'new' | null => {
    const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-track-id]');
    return el?.dataset.trackId ?? null;
  };

  // ------------------------------------------------ gestos

  const onClipPointerDown = (e: RPointerEvent, clip: Clip, track: Track) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Ctrl/Shift: inclui ou tira da seleção, sem arrastar
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      select(clip.id, 'toggle');
      return;
    }
    const ids = useEditor.getState().selectedClipIds;
    const group = ids.length > 1 && ids.includes(clip.id) ? ids : null;
    if (group) useEditor.setState({ selectedClipId: clip.id });
    else select(clip.id);
    if (track.locked || clip.locked) return;
    drag.current = { kind: 'move', id: clip.id, x0: e.clientX, y0: e.clientY, start0: clip.start, trackId0: track.id, moved: false, group };
    scrollRef.current?.setPointerCapture(e.pointerId);
  };

  /** Arrastar no vazio de uma trilha: retângulo de seleção. Clique simples: tira a seleção e move o playhead. */
  const onLanePointerDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { kind: 'box', x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, additive: e.ctrlKey || e.metaKey || e.shiftKey, moved: false };
    scrollRef.current?.setPointerCapture(e.pointerId);
  };

  const onTrimPointerDown = (e: RPointerEvent, clip: Clip, edge: 'start' | 'end') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(clip.id);
    beginGesture();
    drag.current = { kind: 'trim', id: clip.id, edge, x0: e.clientX, edge0: edge === 'start' ? clip.start : clipEnd(clip) };
    scrollRef.current?.setPointerCapture(e.pointerId);
  };

  const startScrub = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { kind: 'scrub' };
    set({ playing: false });
    setFrame(laneFrame(e.clientX));
    scrollRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'box') {
      d.x1 = e.clientX;
      d.y1 = e.clientY;
      if (!d.moved && Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < 4) return;
      d.moved = true;
      setBox({ left: Math.min(d.x0, d.x1), top: Math.min(d.y0, d.y1), width: Math.abs(d.x1 - d.x0), height: Math.abs(d.y1 - d.y0) });
      return;
    }
    if (d.kind === 'scrub') {
      setFrame(laneFrame(e.clientX));
      return;
    }
    if (d.kind === 'trim') {
      const raw = d.edge0 + (e.clientX - d.x0) / ppf;
      const s = snap(raw, d.id);
      setSnapLine(s.line);
      const delta = Math.round(s.value - d.edge0);
      applyFromBase((p) => trimClip(p, d.id, d.edge, delta));
      return;
    }
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
    d.moved = true;
    const clip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === d.id);
    if (!clip) return;
    const raw = Math.max(0, d.start0 + (e.clientX - d.x0) / ppf);
    const s = snap(raw, d.id, clip.duration);
    setSnapLine(s.line);
    const start = Math.max(0, Math.round(s.value));
    // em grupo, todos andam no tempo e ficam nas suas trilhas
    const g: Ghost = d.group
      ? { id: d.id, start, trackId: d.trackId0, group: d.group, delta: start - d.start0 }
      : { id: d.id, start, trackId: trackUnder(e.clientX, e.clientY) ?? d.trackId0 };
    ghostRef.current = g;
    setGhost(g);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setSnapLine(null);
    if (!d) return;
    if (d.kind === 'trim') endGesture();
    if (d.kind === 'box') {
      setBox(null);
      if (!d.moved) {
        if (!d.additive) select(null);
        set({ playing: false });
        setFrame(laneFrame(d.x0));
        return;
      }
      const r = { l: Math.min(d.x0, d.x1), r: Math.max(d.x0, d.x1), t: Math.min(d.y0, d.y1), b: Math.max(d.y0, d.y1) };
      const hits = [...(scrollRef.current?.querySelectorAll<HTMLElement>('.tl-clip[data-clip-id]') ?? [])]
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return b.right >= r.l && b.left <= r.r && b.bottom >= r.t && b.top <= r.b && !el.classList.contains('is-locked');
        })
        .map((el) => el.dataset.clipId!);
      selectMany(hits, d.additive);
      return;
    }
    if (d.kind === 'move' && d.moved && ghostRef.current) {
      const g = ghostRef.current;
      if (g.group) {
        let moved = !g.delta;
        if (g.delta) {
          apply((p) => {
            moved = moveClips(p, g.group!, g.delta!);
          });
        }
        if (!moved) useEditor.getState().showToast('Não cabe: algum clipe do grupo bateria em outro.');
      } else {
        apply((p) => moveClip(p, g.id, g.start, g.trackId));
      }
    }
    ghostRef.current = null;
    setGhost(null);
  };

  // ------------------------------------------------ drop da biblioteca

  const onLaneDragOver = (e: React.DragEvent, trackId: string) => {
    if (!hasPayload(e)) return;
    e.preventDefault();
    setDropHint({ trackId, frame: Math.round(laneFrame(e.clientX)) });
  };
  const onLaneDrop = (e: React.DragEvent, trackId: string) => {
    const payload = readPayload(e);
    setDropHint(null);
    if (!payload) return;
    e.preventDefault();
    const at = Math.round(laneFrame(e.clientX));
    dropPayload(payload, trackId === 'new' ? { at } : { at, trackId });
  };

  // ------------------------------------------------ régua

  const stepSec = TICK_STEPS_SEC.find((s) => s * fps * ppf >= 90) ?? 600;
  const majors: number[] = [];
  for (let f = 0; f <= contentFrames; f += stepSec * fps) majors.push(f);
  const minorStep = (stepSec * fps) / 5;

  const assetsById = new Map(project.assets.map((a) => [a.id, a]));
  const draggingId = ghost?.id;

  return (
    <div className="timeline">
      <div
        ref={scrollRef}
        className="tl-scroll"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => {
          if (!e.ctrlKey) return;
          e.preventDefault();
          set({ pxPerFrame: Math.min(MAX_PPF, Math.max(MIN_PPF, ppf * (e.deltaY < 0 ? 1.15 : 1 / 1.15))) });
        }}
      >
        <div className="tl-content" style={{ width: HEADER_W + contentW }}>
          {/* régua */}
          <div className="tl-ruler-row">
            <div className="tl-corner" />
            <div className="tl-ruler" style={{ width: contentW }} onPointerDown={startScrub}>
              {majors.map((f) => (
                <div key={f} className="tl-tick major" style={{ left: f * ppf }}>
                  <span>{formatShort(f, fps)}</span>
                </div>
              ))}
              {minorStep * ppf >= 10 &&
                majors.flatMap((f) =>
                  [1, 2, 3, 4].map((i) => (
                    <div key={`${f}-${i}`} className="tl-tick" style={{ left: (f + i * minorStep) * ppf }} />
                  )),
                )}
            </div>
          </div>

          {/* zona "nova trilha" */}
          <div className="tl-row tl-newtrack" data-track-id="new">
            <div className="tl-head" />
            <div
              className={`tl-lane ${ghost?.trackId === 'new' || dropHint?.trackId === 'new' ? 'is-target' : ''}`}
              style={{ width: contentW }}
              data-track-id="new"
              onPointerDown={onLanePointerDown}
              onDragOver={(e) => onLaneDragOver(e, 'new')}
              onDragLeave={() => setDropHint(null)}
              onDrop={(e) => onLaneDrop(e, 'new')}
            >
              {(ghost?.trackId === 'new' || dropHint?.trackId === 'new') && (
                <span className="tl-newtrack-hint">
                  <Plus size={12} /> Nova trilha
                </span>
              )}
            </div>
          </div>

          {rows.map((track) => (
            <div key={track.id} className={`tl-row kind-${track.kind}`} style={{ height: ROW_H[track.kind] }} data-track-id={track.id}>
              <TrackHeader track={track} />
              <div
                className={`tl-lane ${ghost?.trackId === track.id || dropHint?.trackId === track.id ? 'is-target' : ''}`}
                style={{ width: contentW }}
                data-track-id={track.id}
                onPointerDown={onLanePointerDown}
                onDragOver={(e) => onLaneDragOver(e, track.id)}
                onDragLeave={() => setDropHint(null)}
                onDrop={(e) => onLaneDrop(e, track.id)}
              >
                {track.kind === 'main' && track.clips.length === 0 && (
                  <span className="tl-empty-hint">Arraste mídia para cá</span>
                )}
                {track.clips.map((clip) => (
                  <ClipBlock
                    key={clip.id}
                    clip={clip}
                    asset={clip.assetId ? assetsById.get(clip.assetId) : undefined}
                    projectId={project.id}
                    fps={fps}
                    ppf={ppf}
                    selected={selectedIds.includes(clip.id) || clip.id === selectedId}
                    primary={clip.id === selectedId && selectedIds.length > 1}
                    dragging={clip.id === draggingId || !!ghost?.group?.includes(clip.id)}
                    locked={track.locked}
                    onPointerDown={(e) => onClipPointerDown(e, clip, track)}
                    onTrimStart={(e) => onTrimPointerDown(e, clip, 'start')}
                    onTrimEnd={(e) => onTrimPointerDown(e, clip, 'end')}
                  />
                ))}
                {ghost?.group
                  ? track.clips
                      .filter((c) => ghost.group!.includes(c.id) && track.kind !== 'main')
                      .map((c) => <div key={`g-${c.id}`} className="tl-ghost" style={{ left: Math.max(0, c.start + (ghost.delta ?? 0)) * ppf, width: c.duration * ppf }} />)
                  : ghost?.trackId === track.id && <GhostBlock ghost={ghost} project={project} ppf={ppf} />}
                {dropHint?.trackId === track.id && <div className="tl-drop-caret" style={{ left: dropHint.frame * ppf }} />}
              </div>
            </div>
          ))}

          {project.markers.map((m) => (
            <div key={m.id} className="tl-marker" style={{ left: HEADER_W + m.frame * ppf, borderColor: m.color }} title={m.label} />
          ))}
          {snapLine !== null && <div className="tl-snapline" style={{ left: HEADER_W + snapLine * ppf }} />}
          {box && <div className="tl-selbox" style={box} />}
          <div className="tl-playhead" style={{ left: HEADER_W + frame * ppf }}>
            <div className="tl-playhead-handle" onPointerDown={startScrub} title={formatClock(frame, fps)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- partes

function TrackHeader({ track }: { track: Track }) {
  const apply = useEditor((s) => s.apply);
  const toggle = (key: 'muted' | 'hidden' | 'locked') =>
    apply((p) => {
      const t = p.tracks.find((t) => t.id === track.id);
      if (t) t[key] = !t[key];
    });
  const sound = track.kind === 'audio' || track.kind === 'main';
  return (
    <div className="tl-head">
      {sound ? (
        <button type="button" className="icon-btn" title={track.muted ? 'Ativar som da trilha' : 'Silenciar trilha'} onClick={() => toggle('muted')}>
          {track.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      ) : (
        <button type="button" className="icon-btn" title={track.hidden ? 'Mostrar trilha' : 'Ocultar trilha'} onClick={() => toggle('hidden')}>
          {track.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
      <button type="button" className="icon-btn" title={track.locked ? 'Destravar trilha' : 'Travar trilha'} onClick={() => toggle('locked')}>
        {track.locked ? <Lock size={14} /> : <LockOpen size={14} />}
      </button>
    </div>
  );
}

function ClipBlock({
  clip,
  asset,
  projectId,
  fps,
  ppf,
  selected,
  primary,
  dragging,
  locked,
  onPointerDown,
  onTrimStart,
  onTrimEnd,
}: {
  clip: Clip;
  asset: Asset | undefined;
  projectId: string;
  fps: number;
  ppf: number;
  selected: boolean;
  primary: boolean;
  dragging: boolean;
  locked: boolean;
  onPointerDown: (e: RPointerEvent) => void;
  onTrimStart: (e: RPointerEvent) => void;
  onTrimEnd: (e: RPointerEvent) => void;
}) {
  const url = asset ? assetUrl(projectId, asset) : null;
  const thumb = useThumbnail(url, clip.type);
  const width = clip.duration * ppf;
  const label =
    clip.type === 'text'
      ? textProps(clip).text.split('\n')[0]
      : clip.type === 'effect'
        ? ((OVERLAYS as Record<string, { label: string }>)[String(clip.props.effect)]?.label ?? 'Efeito')
        : clip.type === 'adjustment'
          ? 'Ajuste'
          : (clip.name ?? asset?.name ?? (clip.type === 'shape' ? 'Forma' : clip.type));

  return (
    <div
      data-clip-id={clip.id}
      className={`tl-clip type-${clip.type} ${selected ? 'is-selected' : ''} ${primary ? 'is-primary' : ''} ${dragging ? 'is-dragging' : ''} ${locked ? 'is-locked' : ''}`}
      style={{
        left: clip.start * ppf,
        width,
        backgroundImage: thumb && (clip.type === 'video' || clip.type === 'image') ? `url("${thumb}")` : undefined,
      }}
      onPointerDown={onPointerDown}
      title={`${label} · ${formatClock(clip.duration, fps)}${clip.speed !== 1 ? ` · ${clip.speed}x` : ''}`}
    >
      {clip.type === 'audio' && url && <Waveform url={url} clip={clip} fps={fps} width={width} />}
      {clip.type === 'shape' && <span className="tl-shape-dot" style={{ background: shapeProps(clip).fill }} />}
      <span className="tl-clip-label">
        {clip.type === 'text' && <Type size={11} />}
        {clip.type === 'shape' && <Shapes size={11} />}
        {clip.type === 'component' && <Puzzle size={11} />}
        {width > 50 && <span className="tl-clip-name">{label}</span>}
        {width > 110 && <span className="tl-clip-dur">{formatClock(clip.duration, fps)}</span>}
        {clip.speed !== 1 && width > 150 && <span className="tl-clip-dur">{clip.speed}x</span>}
      </span>
      {selected && !locked && <KeyframeMarks clip={clip} ppf={ppf} />}
      {!locked && (
        <>
          <span className="tl-trim start" onPointerDown={onTrimStart} />
          <span className="tl-trim end" onPointerDown={onTrimEnd} />
        </>
      )}
    </div>
  );
}

/** ◆ dos keyframes do clipe selecionado: clique leva o playhead; arrastar move o keyframe. */
function KeyframeMarks({ clip, ppf }: { clip: Clip; ppf: number }) {
  const drag = useRef<{ from: number; x0: number; moved: boolean } | null>(null);
  const frames = keyframeFrames(clip);
  if (!frames.length) return null;
  const st = () => useEditor.getState();
  return (
    <>
      {frames.map((f) => (
        <span
          key={f.frame}
          className="tl-kf"
          style={{ left: f.frame * ppf }}
          title={f.paths.join(', ')}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            (e.target as Element).setPointerCapture(e.pointerId);
            drag.current = { from: f.frame, x0: e.clientX, moved: false };
            st().beginGesture();
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            if (!d.moved && Math.abs(e.clientX - d.x0) < 3) return;
            d.moved = true;
            const to = d.from + Math.round((e.clientX - d.x0) / ppf);
            st().applyFromBase((p) => updateClip(p, clip.id, (c) => moveKeyframesAt(c, d.from, to)));
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            st().endGesture();
            if (d && !d.moved) st().setFrame(clip.start + d.from);
            else if (d) st().setFrame(clip.start + Math.min(clip.duration - 1, Math.max(0, d.from + Math.round((e.clientX - d.x0) / ppf))));
          }}
        />
      ))}
    </>
  );
}

function GhostBlock({ ghost, project, ppf }: { ghost: Ghost; project: Project; ppf: number }) {
  const clip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === ghost.id);
  if (!clip) return null;
  return <div className="tl-ghost" style={{ left: ghost.start * ppf, width: clip.duration * ppf }} />;
}

function Waveform({ url, clip, fps, width }: { url: string; clip: Clip; fps: number; width: number }) {
  const peaks = usePeaks(url);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !peaks) return;
    const w = Math.max(1, Math.min(8000, Math.round(width)));
    const h = canvas.clientHeight || 40;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(243, 243, 240, 0.75)';
    const startSec = clip.trimIn / fps;
    const spanSec = (clip.duration * clip.speed) / fps;
    for (let x = 0; x < w; x++) {
      const idx = Math.floor((startSec + (x / w) * spanSec) * PEAKS_PER_SECOND);
      const v = peaks[idx] ?? 0;
      const bar = Math.max(1, v * (h - 4));
      ctx.fillRect(x, (h - bar) / 2, 1, bar);
    }
  }, [peaks, width, clip.trimIn, clip.duration, clip.speed, fps]);
  return <canvas ref={ref} className="tl-wave" />;
}
