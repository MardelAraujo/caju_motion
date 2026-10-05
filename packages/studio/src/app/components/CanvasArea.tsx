import { useShallow } from 'zustand/react/shallow';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import {
  ChevronDown,
  Copy,
  FlipHorizontal2,
  Maximize,
  Minimize,
  RectangleHorizontal,
  RectangleVertical,
  RotateCw,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import { clipValue } from '@caju-motion/core';
import { ProjectRenderer, shapeProps } from '@caju-motion/renderer';
import { FORMATS, FORMAT_IDS, type Clip, type FormatId, type Project } from '@caju-motion/schema';
import { assetUrl } from '../api';
import { deleteSelected, duplicateSelected, fitSelected, flipSelected } from '../commands';
import { dropPayload, hasPayload, readPayload } from '../dnd';
import { findClip, updateClip } from '../ops';
import { selectedClip, useEditor } from '../store';
import { Dropdown } from '../ui';

const SNAP_PX = 6;
const FORMAT_ICON: Record<FormatId, typeof Square> = {
  'reel-9x16': RectangleVertical,
  'feed-4x5': RectangleVertical,
  'square-1x1': Square,
  'landscape-16x9': RectangleHorizontal,
};
const FORMAT_SHORT: Record<FormatId, string> = {
  'reel-9x16': '9:16',
  'feed-4x5': '4:5',
  'square-1x1': '1:1',
  'landscape-16x9': '16:9',
};

type Drag =
  | { kind: 'move'; x0: number; y0: number; tx: number; ty: number; id: string }
  | { kind: 'scale'; cx: number; cy: number; d0: number; s0: number; id: string }
  | { kind: 'rotate'; cx: number; cy: number; a0: number; r0: number; id: string }
  | {
      kind: 'resize';
      handle: Handle;
      x0: number;
      y0: number;
      w0: number;
      h0: number;
      tx: number;
      ty: number;
      /** rotação (graus) e escala do clipe no início do gesto */
      rot: number;
      s: number;
      ax: number;
      ay: number;
      id: string;
    }
  | { kind: 'pan'; x0: number; y0: number; px: number; py: number };

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const CORNERS: Handle[] = ['nw', 'ne', 'sw', 'se'];
const SHAPE_HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Soma `delta` ao valor estático e aos keyframes numéricos de uma propriedade. */
function offsetProp(clip: Clip, path: 'transform.x' | 'transform.y', base: number, delta: number) {
  if (path === 'transform.x') clip.transform.x = base + delta;
  else clip.transform.y = base + delta;
  const kfs = clip.keyframes[path];
  if (kfs) for (const k of kfs) if (typeof k.value === 'number') k.value += delta;
}

export function CanvasArea() {
  const project = useEditor((s) => s.project);
  const frame = useEditor((s) => s.frame);
  const playing = useEditor((s) => s.playing);
  const tool = useEditor((s) => s.tool);
  const zoom = useEditor((s) => s.canvasZoom);
  const editingTextId = useEditor((s) => s.editingTextId);
  const sel = useEditor(useShallow(selectedClip));
  const { select, setEditingText, apply, beginGesture, applyFromBase, endGesture, set } = useEditor.getState();

  const areaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 800, h: 500 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setArea({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (zoom === 'fit') setPan({ x: 0, y: 0 });
  }, [zoom]);

  // mede o tamanho real (px do projeto) do elemento selecionado
  const selId = sel?.clip.id;
  useLayoutEffect(() => {
    const el = selId ? stageRef.current?.querySelector<HTMLElement>(`[data-clip-id="${selId}"]`) : null;
    const next = el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
    setBox((prev) => (prev?.w === next?.w && prev?.h === next?.h ? prev : next));
  });

  const resolveAsset = useCallback(
    (a: Parameters<typeof assetUrl>[1]) => (project ? assetUrl(project.id, a) : ''),
    [project?.id],
  );

  if (!project) return <div className="canvas-area" ref={areaRef} />;

  const { width: pw, height: ph } = project.settings;
  const fit = Math.max(0.05, Math.min((area.w - 96) / pw, (area.h - 64) / ph));
  const scale = zoom === 'fit' ? fit : zoom;
  const ox = (area.w - pw * scale) / 2 + pan.x;
  const oy = (area.h - ph * scale) / 2 + pan.y;

  const toClient = (x: number, y: number) => {
    const r = areaRef.current!.getBoundingClientRect();
    return { x: r.left + ox + x * scale, y: r.top + oy + y * scale };
  };

  // ------------------------------------------------ gestos

  const startMove = (e: RPointerEvent, clip: Clip) => {
    beginGesture();
    drag.current = { kind: 'move', x0: e.clientX, y0: e.clientY, tx: clip.transform.x, ty: clip.transform.y, id: clip.id };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onStagePointerDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    if (tool === 'hand') {
      drag.current = { kind: 'pan', x0: e.clientX, y0: e.clientY, px: pan.x, py: pan.y };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    const id = pickClip(e.clientX, e.clientY);
    if (id && id === editingTextId) return;
    if (!id) {
      select(null);
      return;
    }
    select(id);
    const ref = findClip(project, id);
    if (ref && !ref.track.locked && !ref.clip.locked) startMove(e, ref.clip);
  };

  /**
   * Clipe sob o cursor: o mais alto que NÃO esteja travado (camadas de tela cheia —
   * céu, luz, vinheta, letterbox — costumam ser travadas e deixam o clique passar).
   */
  const pickClip = (clientX: number, clientY: number): string | null => {
    const ids: string[] = [];
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      const id = (el as HTMLElement).closest?.<HTMLElement>('[data-clip-id]')?.dataset.clipId;
      if (id && !ids.includes(id)) ids.push(id);
    }
    return (
      ids.find((id) => {
        const ref = findClip(project, id);
        return ref && !ref.clip.locked && !ref.track.locked;
      }) ?? null
    );
  };

  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pan') {
      setPan({ x: d.px + e.clientX - d.x0, y: d.py + e.clientY - d.y0 });
      return;
    }
    if (d.kind === 'move') {
      let nx = d.tx + (e.clientX - d.x0) / scale;
      let ny = d.ty + (e.clientY - d.y0) / scale;
      const snapV = Math.abs(nx - pw / 2) * scale < SNAP_PX;
      const snapH = Math.abs(ny - ph / 2) * scale < SNAP_PX;
      if (snapV) nx = pw / 2;
      if (snapH) ny = ph / 2;
      setGuides({ v: snapV, h: snapH });
      applyFromBase((p) =>
        updateClip(p, d.id, (c) => {
          offsetProp(c, 'transform.x', d.tx, nx - d.tx);
          offsetProp(c, 'transform.y', d.ty, ny - d.ty);
        }),
      );
      return;
    }
    if (d.kind === 'scale') {
      const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
      const s = Math.min(20, Math.max(0.02, (d.s0 * dist) / d.d0));
      applyFromBase((p) => updateClip(p, d.id, (c) => void (c.transform.scale = s)));
      return;
    }
    if (d.kind === 'resize') {
      // delta do cursor → eixos locais do clipe (desfaz rotação) → px da forma (desfaz zoom e escala)
      const rad = (d.rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      const k = scale * d.s;
      const lx = (dx * cos + dy * sin) / k;
      const ly = (-dx * sin + dy * cos) / k;
      const h = d.handle;
      let dw = h.includes('e') ? lx : h.includes('w') ? -lx : 0;
      let dh = h.includes('s') ? ly : h.includes('n') ? -ly : 0;
      // Shift nos cantos: mantém a proporção
      if (e.shiftKey && h.length === 2) {
        const f = Math.max((d.w0 + dw) / d.w0, (d.h0 + dh) / d.h0);
        dw = d.w0 * f - d.w0;
        dh = d.h0 * f - d.h0;
      }
      const w = Math.max(1, Math.round(d.w0 + dw));
      const hgt = Math.max(1, Math.round(d.h0 + dh));
      dw = w - d.w0;
      dh = hgt - d.h0;
      // a borda oposta fica parada: desloca o ponto de âncora (em px locais) e leva para o quadro
      const sx = (h.includes('e') ? d.ax * dw : h.includes('w') ? -(1 - d.ax) * dw : 0) * d.s;
      const sy = (h.includes('s') ? d.ay * dh : h.includes('n') ? -(1 - d.ay) * dh : 0) * d.s;
      applyFromBase((p) =>
        updateClip(p, d.id, (c) => {
          c.props.width = w;
          c.props.height = hgt;
          offsetProp(c, 'transform.x', d.tx, sx * cos - sy * sin);
          offsetProp(c, 'transform.y', d.ty, sx * sin + sy * cos);
        }),
      );
      return;
    }
    if (d.kind === 'rotate') {
      const a =(Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI;
      let r = d.r0 + a - d.a0;
      r = ((((r + 180) % 360) + 360) % 360) - 180;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      else for (const snap of [-180, -90, 0, 90, 180]) if (Math.abs(r - snap) < 3) r = snap;
      applyFromBase((p) => updateClip(p, d.id, (c) => void (c.transform.rotation = Math.round(r * 10) / 10)));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setGuides({ v: false, h: false });
    if (d && d.kind !== 'pan') endGesture();
  };

  // ------------------------------------------------ overlay de seleção

  let overlay = null;
  if (sel && box && sel.clip.type !== 'audio' && frame >= sel.clip.start && frame < sel.clip.start + sel.clip.duration) {
    const c = sel.clip;
    const x = clipValue(c, 'transform.x', frame, c.transform.x);
    const y = clipValue(c, 'transform.y', frame, c.transform.y);
    const s = clipValue(c, 'transform.scale', frame, c.transform.scale);
    const rot = clipValue(c, 'transform.rotation', frame, c.transform.rotation);
    const W = box.w * s * scale;
    const H = box.h * s * scale;
    const px = ox + x * scale;
    const py = oy + y * scale;
    const locked = sel.track.locked || c.locked;
    const editing = editingTextId === c.id;

    const startScale = (e: RPointerEvent) => {
      e.stopPropagation();
      const center = toClient(x, y);
      beginGesture();
      drag.current = {
        kind: 'scale',
        cx: center.x,
        cy: center.y,
        d0: Math.max(1, Math.hypot(e.clientX - center.x, e.clientY - center.y)),
        s0: c.transform.scale,
        id: c.id,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const isShape = c.type === 'shape';
    const startResize = (e: RPointerEvent, handle: Handle) => {
      e.stopPropagation();
      const p = shapeProps(c);
      beginGesture();
      drag.current = {
        kind: 'resize',
        handle,
        x0: e.clientX,
        y0: e.clientY,
        w0: p.width,
        h0: p.height,
        tx: c.transform.x,
        ty: c.transform.y,
        rot,
        s,
        ax: c.transform.anchorX,
        ay: c.transform.anchorY,
        id: c.id,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const startRotate = (e: RPointerEvent) => {
      e.stopPropagation();
      const center = toClient(x, y);
      beginGesture();
      drag.current = {
        kind: 'rotate',
        cx: center.x,
        cy: center.y,
        a0: (Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180) / Math.PI,
        r0: c.transform.rotation,
        id: c.id,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

    const toolbarTop = Math.max(8, py - H * c.transform.anchorY - 52);
    overlay = (
      <>
        <div className="sel-pivot" style={{ left: px, top: py, transform: `rotate(${rot}deg)` }}>
          <div
            className={`sel-box ${editing ? 'is-editing' : ''}`}
            style={{ left: -c.transform.anchorX * W, top: -c.transform.anchorY * H, width: W, height: H }}
            onPointerDown={(e) => {
              if (editing || tool !== 'select' || e.button !== 0) return;
              e.stopPropagation();
              if (!locked) startMove(e, c);
            }}
            onDoubleClick={() => c.type === 'text' && setEditingText(c.id)}
          >
            {!locked && !editing && (
              <>
                {(isShape ? SHAPE_HANDLES : CORNERS).map((h) => (
                  <span
                    key={h}
                    className={`sel-handle ${h}`}
                    title={isShape ? 'Arraste para mudar largura/altura (Shift nos cantos mantém a proporção)' : undefined}
                    onPointerDown={isShape ? (e) => startResize(e, h) : startScale}
                  />
                ))}
                <span className="sel-rotate" onPointerDown={startRotate}>
                  <RotateCw size={12} />
                </span>
              </>
            )}
          </div>
        </div>
        {!editing && !playing && (
          <div className="float-toolbar" style={{ left: px, top: toolbarTop }} onPointerDown={(e) => e.stopPropagation()}>
            {c.type === 'text' ? (
              <button type="button" title="Editar texto (duplo clique)" onClick={() => setEditingText(c.id)}>
                <Type size={16} />
              </button>
            ) : (
              <>
                {(c.type === 'image' || c.type === 'video') && (
                  <>
                    <button type="button" title="Ajustar ao quadro" onClick={() => fitSelected('contain')}>
                      <Minimize size={16} />
                    </button>
                    <button type="button" title="Preencher o quadro" onClick={() => fitSelected('cover')}>
                      <Maximize size={16} />
                    </button>
                  </>
                )}
                <button type="button" title="Espelhar" onClick={() => flipSelected('x')}>
                  <FlipHorizontal2 size={16} />
                </button>
              </>
            )}
            <span className="float-sep" />
            <button type="button" title="Duplicar (Ctrl+D)" onClick={duplicateSelected}>
              <Copy size={16} />
            </button>
            <button type="button" title="Excluir (Delete)" onClick={deleteSelected}>
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </>
    );
  }

  const format = project.settings.format;
  const FormatIcon = format !== 'custom' ? FORMAT_ICON[format] : Square;

  return (
    <div
      ref={areaRef}
      className={`canvas-area tool-${tool}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          if (tool === 'hand') onStagePointerDown(e);
          else select(null);
        }
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={(e) => {
        if (!e.ctrlKey) return;
        const next = Math.min(4, Math.max(0.05, scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        set({ canvasZoom: Math.round(next * 100) / 100 });
      }}
      onDragOver={(e) => {
        if (hasPayload(e)) e.preventDefault();
      }}
      onDrop={(e) => {
        const payload = readPayload(e);
        if (payload) {
          e.preventDefault();
          dropPayload(payload);
        }
      }}
    >
      <Dropdown
        trigger={(open, toggle) => (
          <button type="button" className={`format-chip ${open ? 'is-open' : ''}`} onClick={toggle} title="Proporção">
            <FormatIcon size={18} strokeWidth={1.5} />
            <span>{format !== 'custom' ? FORMAT_SHORT[format] : `${pw}×${ph}`}</span>
            <ChevronDown size={12} />
          </button>
        )}
      >
        {(close) =>
          FORMAT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`menu-item ${id === format ? 'is-active' : ''}`}
              onClick={() => {
                close();
                apply((p) => changeFormat(p, id));
              }}
            >
              <span>{FORMAT_SHORT[id]}</span>
              <small>{FORMATS[id].label}</small>
            </button>
          ))
        }
      </Dropdown>

      <div
        ref={stageRef}
        className="stage"
        style={{ left: ox, top: oy, width: pw, height: ph, transform: `scale(${scale})` }}
        onPointerDown={onStagePointerDown}
        onDoubleClick={(e) => {
          const id = pickClip(e.clientX, e.clientY);
          const ref = id ? findClip(project, id) : null;
          if (ref?.clip.type === 'text') setEditingText(ref.clip.id);
        }}
      >
        <ProjectRenderer
          project={project}
          frame={frame}
          playing={playing}
          resolveAsset={resolveAsset}
          editingClipId={editingTextId}
          onTextCommit={(id, text) => {
            setEditingText(null);
            apply((p) =>
              updateClip(p, id, (c) => {
                if (c.props.text !== text) c.props.text = text;
              }),
            );
          }}
        />
      </div>

      <div className="stage-frame" style={{ left: ox, top: oy, width: pw * scale, height: ph * scale }} />
      {guides.v && <div className="snap-guide v" style={{ left: ox + (pw / 2) * scale, top: oy, height: ph * scale }} />}
      {guides.h && <div className="snap-guide h" style={{ top: oy + (ph / 2) * scale, left: ox, width: pw * scale }} />}
      {overlay}
    </div>
  );
}

/** Troca o formato mantendo a composição proporcional. */
function changeFormat(p: Project, id: FormatId) {
  const f = FORMATS[id];
  const sx = f.width / p.settings.width;
  const sy = f.height / p.settings.height;
  if (sx === 1 && sy === 1) return;
  for (const t of p.tracks)
    for (const c of t.clips) {
      c.transform.x *= sx;
      c.transform.y *= sy;
      for (const path of ['transform.x', 'transform.y'] as const) {
        const k = path === 'transform.x' ? sx : sy;
        for (const kf of c.keyframes[path] ?? []) if (typeof kf.value === 'number') kf.value *= k;
      }
    }
  p.settings.format = id;
  p.settings.width = f.width;
  p.settings.height = f.height;
}
