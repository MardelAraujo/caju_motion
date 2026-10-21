import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Diamond } from 'lucide-react';
import { EASING_PRESETS, type Clip, type Easing } from '@caju-motion/schema';
import { bezierOf, hasKeyframeAt, isAnimated, keyframeFrames, localFrame, setEasingAt, toggleKeyframe } from '../keyframes';
import { updateClip } from '../ops';
import { useEditor } from '../store';
import { formatClock } from '../time';
import { Section } from '../ui';

const EASING_LABEL: Record<string, string> = {
  linear: 'Linear',
  hold: 'Degrau (segura)',
  easeIn: 'Acelera',
  easeOut: 'Desacelera',
  easeInOut: 'Suave',
  expoOut: 'Rápido → suave',
  expoInOut: 'Dramático',
  softOut: 'Leve',
  backOut: 'Elástico',
};

const PATH_LABEL: Record<string, string> = {
  'transform.x': 'X',
  'transform.y': 'Y',
  'transform.scale': 'escala',
  'transform.rotation': 'rotação',
  opacity: 'opacidade',
};

/** Botão ◆ de uma propriedade: cheio = keyframe neste quadro; contorno laranja = animada. */
export function KeyframeButton({ clip, paths }: { clip: Clip; paths: readonly string[] }) {
  const frame = useEditor((s) => s.frame);
  const apply = useEditor((s) => s.apply);
  const local = localFrame(clip, frame);
  const inside = frame >= clip.start && frame < clip.start + clip.duration;
  const here = paths.every((p) => hasKeyframeAt(clip, p, local));
  const animated = paths.some((p) => isAnimated(clip, p));
  return (
    <button
      type="button"
      className={`kf-btn ${here ? 'is-here' : ''} ${animated ? 'is-animated' : ''}`}
      disabled={!inside}
      title={!inside ? 'Leve o playhead para dentro do clipe' : here ? 'Remover keyframe deste quadro' : 'Adicionar keyframe neste quadro'}
      onClick={() => apply((p) => updateClip(p, clip.id, (c) => toggleKeyframe(c, paths, frame)))}
    >
      <Diamond size={12} fill={here ? 'currentColor' : 'none'} />
    </button>
  );
}

/** Lista de keyframes do clipe + curva do trecho que sai do keyframe escolhido. */
export function KeyframesSection({ clip }: { clip: Clip }) {
  const frame = useEditor((s) => s.frame);
  const fps = useEditor((s) => s.project?.settings.fps ?? 30);
  const apply = useEditor((s) => s.apply);
  const setFrame = useEditor((s) => s.setFrame);
  const frames = keyframeFrames(clip);
  if (!frames.length) return null;
  const local = localFrame(clip, frame);
  // o keyframe "da vez": o do playhead, ou o último antes dele (o trecho que está tocando)
  const current = [...frames].reverse().find((f) => f.frame <= local) ?? frames[0]!;
  const isLast = current === frames[frames.length - 1];
  const setEasing = (e: Easing) => apply((p) => updateClip(p, clip.id, (c) => setEasingAt(c, current.frame, e)), { coalesce: `${clip.id}:kf-ease` });
  const preset = typeof current.easing === 'string' ? current.easing : 'custom';

  return (
    <Section title="Keyframes">
      <div className="kf-list">
        {frames.map((f) => (
          <button
            type="button"
            key={f.frame}
            className={`kf-item ${f === current ? 'is-current' : ''}`}
            onClick={() => setFrame(clip.start + f.frame)}
            title="Ir para este keyframe"
          >
            <Diamond size={10} fill="currentColor" /> {formatClock(f.frame, fps)}
            <small>{f.paths.map((p) => PATH_LABEL[p] ?? p.replace(/^props\./, '')).join(', ')}</small>
          </button>
        ))}
      </div>
      {isLast ? (
        <p className="panel-hint">Depois do último keyframe o valor fica parado. Escolha um keyframe anterior para ajustar a curva.</p>
      ) : (
        <>
          <label className="export-field">
            <span className="prop-label">Curva até o próximo keyframe</span>
            <select
              value={preset}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'custom') setEasing({ bezier: bezierOf(current.easing) ?? [0.42, 0, 0.58, 1] });
                else setEasing(v as Easing);
              }}
            >
              {EASING_PRESETS.map((e) => (
                <option key={e} value={e}>
                  {EASING_LABEL[e] ?? e}
                </option>
              ))}
              <option value="custom">Personalizada (arraste os pontos)</option>
            </select>
          </label>
          <BezierEditor easing={current.easing} onChange={(b) => setEasing({ bezier: b })} />
        </>
      )}
    </Section>
  );
}

const SIZE = 180;
const PAD = 24;
type Bez = [number, number, number, number];

/** Curva cúbica editável: arraste os dois pontos de controle (y pode passar de 0–1: "elástico"). */
function BezierEditor({ easing, onChange }: { easing: Easing; onChange: (b: Bez) => void }) {
  const bez = bezierOf(easing);
  const svg = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<0 | 1 | null>(null);
  if (!bez) return <p className="panel-hint">Degrau: o valor salta no próximo keyframe, sem transição.</p>;
  const toX = (x: number) => PAD + x * (SIZE - 2 * PAD);
  const toY = (y: number) => SIZE - PAD - y * (SIZE - 2 * PAD);
  const [x1, y1, x2, y2] = bez;

  const onMove = (e: RPointerEvent) => {
    if (dragging === null || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const scale = SIZE / r.width;
    const x = Math.min(1, Math.max(0, ((e.clientX - r.left) * scale - PAD) / (SIZE - 2 * PAD)));
    const y = Math.min(2, Math.max(-1, (SIZE - PAD - (e.clientY - r.top) * scale) / (SIZE - 2 * PAD)));
    const round = (v: number) => Math.round(v * 100) / 100;
    onChange(dragging === 0 ? [round(x), round(y), x2, y2] : [x1, y1, round(x), round(y)]);
  };

  return (
    <div className="bezier">
      <svg
        ref={svg}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        onPointerMove={onMove}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        <rect x={PAD} y={PAD} width={SIZE - 2 * PAD} height={SIZE - 2 * PAD} className="bezier-frame" />
        <line x1={toX(0)} y1={toY(0)} x2={toX(x1)} y2={toY(y1)} className="bezier-arm" />
        <line x1={toX(1)} y1={toY(1)} x2={toX(x2)} y2={toY(y2)} className="bezier-arm" />
        <path d={`M ${toX(0)} ${toY(0)} C ${toX(x1)} ${toY(y1)}, ${toX(x2)} ${toY(y2)}, ${toX(1)} ${toY(1)}`} className="bezier-curve" />
        {[
          [x1, y1],
          [x2, y2],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={toX(x!)}
            cy={toY(y!)}
            r={7}
            className="bezier-handle"
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              setDragging(i as 0 | 1);
            }}
          />
        ))}
      </svg>
      <code className="bezier-values">{bez.map((v) => v.toFixed(2)).join(', ')}</code>
    </div>
  );
}
