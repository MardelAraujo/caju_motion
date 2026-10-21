import { useShallow } from 'zustand/react/shallow';
import { useState, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  FlipHorizontal2,
  FlipVertical2,
  Gauge,
  Link2,
  Unlink2,
  Lock,
  LockOpen,
  Music,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import {
  componentBox,
  describeProps,
  resolveComponentProps,
  shapeProps,
  textProps,
  useComponents,
  type PropField,
  type TextAlign,
} from '@caju-motion/renderer';
import { FORMATS, projectDuration, type Clip, type Track } from '@caju-motion/schema';
import { BRAND_COLORS } from '../commands';
import { setSpeed, updateClip } from '../ops';
import { selectedClip, useEditor, type RightTab } from '../store';
import { formatClock } from '../time';
import { NumberField, Section, Segmented, SliderRow, Swatches } from '../ui';
import { EffectsPanel, MotionPanel, OverlaySection } from './MotionPanels';
import { KeyframeButton, KeyframesSection } from './KeyframeUI';
import { setAnimatable, valueAt } from '../keyframes';

type TabDef = { id: RightTab; label: string; icon: typeof Music };

const ALL_TABS: Record<RightTab, TabDef> = {
  basic: { id: 'basic', label: 'Básico', icon: SlidersHorizontal },
  motion: { id: 'motion', label: 'Animação', icon: Sparkles },
  effects: { id: 'effects', label: 'Efeitos', icon: Wand2 },
  audio: { id: 'audio', label: 'Áudio', icon: Music },
  speed: { id: 'speed', label: 'Velocidade', icon: Gauge },
  project: { id: 'project', label: 'Projeto', icon: Settings2 },
};

export function tabsFor(clip: Clip | null): RightTab[] {
  if (!clip) return ['project'];
  switch (clip.type) {
    case 'video':
      return ['basic', 'motion', 'effects', 'audio', 'speed'];
    case 'audio':
      return ['audio', 'speed'];
    case 'effect':
      return ['basic', 'motion'];
    case 'adjustment':
      return ['effects'];
    default:
      return ['basic', 'motion', 'effects'];
  }
}

export function RightRail() {
  const sel = useEditor(useShallow(selectedClip));
  const rightTab = useEditor((s) => s.rightTab);
  const { set } = useEditor.getState();
  const tabs = tabsFor(sel?.clip ?? null);
  const active = rightTab && tabs.includes(rightTab) ? rightTab : null;

  return (
    <>
      {active && (
        <aside className="right-panel">
          <header className="right-panel-head">
            <h3>{ALL_TABS[active].label}</h3>
            <button type="button" className="icon-btn" title="Fechar" onClick={() => set({ rightTab: null })}>
              <X size={16} />
            </button>
          </header>
          <div className="right-panel-body">
            {active === 'project' && <ProjectPanel />}
            {sel && active === 'basic' && (sel.clip.type === 'effect' ? <OverlaySection clip={sel.clip} /> : <BasicPanel clip={sel.clip} />)}
            {sel && active === 'motion' && <MotionPanel clip={sel.clip} />}
            {sel && active === 'effects' && <EffectsPanel clip={sel.clip} />}
            {sel && active === 'audio' && <AudioPanel clip={sel.clip} track={sel.track} />}
            {sel && active === 'speed' && <SpeedPanel clip={sel.clip} />}
          </div>
        </aside>
      )}
      <nav className="right-rail">
        {tabs.map((id) => {
          const t = ALL_TABS[id];
          return (
            <button
              key={id}
              type="button"
              className={`rail-tab ${active === id ? 'is-active' : ''}`}
              onClick={() => set({ rightTab: active === id ? null : id })}
            >
              <t.icon size={20} strokeWidth={1.75} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

// ---------------------------------------------------------------- helpers

function useClipEdit(clip: Clip) {
  const apply = useEditor((s) => s.apply);
  return (key: string, fn: (c: Clip) => void) => apply((p) => updateClip(p, clip.id, fn), { coalesce: `${clip.id}:${key}` });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      <div className="prop-control">{children}</div>
    </div>
  );
}

const pct = (v: number) => String(Math.round(v));

// ---------------------------------------------------------------- Básico

function BasicPanel({ clip }: { clip: Clip }) {
  const edit = useClipEdit(clip);
  const project = useEditor((s) => s.project)!;
  const t = clip.transform;
  const frame = useEditor((s) => s.frame);
  // valores no playhead (com keyframes); mudar uma propriedade animada grava o keyframe ali
  const v = (path: string) => valueAt(clip, path, frame);
  const anim = (key: string, path: string, value: number) => edit(key, (c) => setAnimatable(c, path, frame, value));

  return (
    <>
      {clip.type === 'text' && <TextSection clip={clip} />}
      {clip.type === 'shape' && <ShapeSection clip={clip} />}
      {clip.type === 'component' && <ComponentSection clip={clip} />}

      <Section
        title="Transformar"
        aside={
          <button
            type="button"
            className="link-btn"
            title="Redefinir posição, escala e rotação"
            onClick={() =>
              edit('reset', (c) => {
                c.transform.x = project.settings.width / 2;
                c.transform.y = project.settings.height / 2;
                c.transform.rotation = 0;
                if (c.type === 'text' || c.type === 'shape') c.transform.scale = 1;
              })
            }
          >
            <RotateCcw size={13} /> Redefinir
          </button>
        }
      >
        <div className="kf-row">
          <Row label="Posição">
            <NumberField prefix="X" value={v('transform.x')} onChange={(n) => anim('x', 'transform.x', n)} />
            <NumberField prefix="Y" value={v('transform.y')} onChange={(n) => anim('y', 'transform.y', n)} />
          </Row>
          <KeyframeButton clip={clip} paths={['transform.x', 'transform.y']} />
        </div>
        <div className="kf-row">
          <SliderRow
            label="Escala"
            value={v('transform.scale') * 100}
            min={1}
            max={400}
            unit="%"
            format={pct}
            onChange={(n) => anim('scale', 'transform.scale', Math.max(0.01, n / 100))}
          />
          <KeyframeButton clip={clip} paths={['transform.scale']} />
        </div>
        <div className="kf-row">
          <SliderRow
            label="Rotação"
            value={v('transform.rotation')}
            min={-180}
            max={180}
            unit="°"
            format={pct}
            onChange={(n) => anim('rotation', 'transform.rotation', n)}
          />
          <KeyframeButton clip={clip} paths={['transform.rotation']} />
        </div>
        <Row label="Espelhar">
          <button
            type="button"
            className={`chip-btn ${t.flipX ? 'is-active' : ''}`}
            onClick={() => edit('flipX', (c) => void (c.transform.flipX = !c.transform.flipX))}
          >
            <FlipHorizontal2 size={15} /> Horizontal
          </button>
          <button
            type="button"
            className={`chip-btn ${t.flipY ? 'is-active' : ''}`}
            onClick={() => edit('flipY', (c) => void (c.transform.flipY = !c.transform.flipY))}
          >
            <FlipVertical2 size={15} /> Vertical
          </button>
        </Row>
      </Section>

      <Section title="Mistura">
        <div className="kf-row">
          <SliderRow
            label="Opacidade"
            value={v('opacity') * 100}
            min={0}
            max={100}
            unit="%"
            format={pct}
            onChange={(n) => anim('opacity', 'opacity', n / 100)}
          />
          <KeyframeButton clip={clip} paths={['opacity']} />
        </div>
        <Row label="Clipe">
          <button
            type="button"
            className={`chip-btn ${clip.locked ? 'is-active' : ''}`}
            title="Travado: não é selecionado nem arrastado pelo canvas (continua editável aqui e na timeline)"
            onClick={() => edit('locked', (c) => void (c.locked = !c.locked))}
          >
            {clip.locked ? <Lock size={14} /> : <LockOpen size={14} />} {clip.locked ? 'Travado' : 'Destravado'}
          </button>
        </Row>
      </Section>
      <KeyframesSection clip={clip} />
    </>
  );
}

/** Fontes de conteúdo embutidas no Studio (licença OFL). Fontes locais extras aparecem quando um clipe já as usa. */
const FONTS = ['Plus Jakarta Sans', 'Red Hat Display'];
const WEIGHTS = [
  { value: '400', label: 'Regular' },
  { value: '700', label: 'Negrito' },
  { value: '800', label: 'Extra' },
];

function TextSection({ clip }: { clip: Clip }) {
  const edit = useClipEdit(clip);
  const p = textProps(clip);
  return (
    <Section title="Texto">
      <textarea
        className="text-input"
        value={p.text}
        rows={3}
        onChange={(e) => edit('text', (c) => void (c.props.text = e.target.value))}
      />
      <Row label="Fonte">
        <select value={p.fontFamily} onChange={(e) => edit('font', (c) => void (c.props.fontFamily = e.target.value))}>
          {[...new Set([...FONTS, p.fontFamily])].map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          value={String(p.fontWeight)}
          onChange={(e) => edit('weight', (c) => void (c.props.fontWeight = Number(e.target.value)))}
        >
          {WEIGHTS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </Row>
      <SliderRow
        label="Tamanho"
        value={p.fontSize}
        min={8}
        max={400}
        format={pct}
        onChange={(v) => edit('size', (c) => void (c.props.fontSize = v))}
      />
      <SliderRow
        label="Espaçamento"
        value={p.letterSpacing}
        min={-10}
        max={40}
        format={pct}
        onChange={(v) => edit('spacing', (c) => void (c.props.letterSpacing = v))}
      />
      <Row label="Alinhamento">
        <Segmented<TextAlign>
          value={p.align}
          onChange={(v) => edit('align', (c) => void (c.props.align = v))}
          options={[
            { value: 'left', label: <AlignLeft size={15} />, title: 'Esquerda' },
            { value: 'center', label: <AlignCenter size={15} />, title: 'Centro' },
            { value: 'right', label: <AlignRight size={15} />, title: 'Direita' },
          ]}
        />
      </Row>
      <div className="prop-stack">
        <span className="prop-label">Cor</span>
        <Swatches colors={BRAND_COLORS} value={p.color} onChange={(v) => edit('color', (c) => void (c.props.color = v))} />
      </div>
      <div className="prop-stack">
        <span className="prop-label">Fundo</span>
        <Swatches
          colors={BRAND_COLORS}
          value={p.background}
          allowNone
          onChange={(v) => edit('bg', (c) => void (c.props.background = v))}
        />
      </div>
    </Section>
  );
}

/** Props de um componente do usuário, a partir do schema (`describeProps`). */
function ComponentSection({ clip }: { clip: Clip }) {
  const edit = useClipEdit(clip);
  const settings = useEditor((s) => s.project!.settings);
  const defs = useComponents();
  const name = typeof clip.props.component === 'string' ? clip.props.component : '';
  const defn = defs.find((d) => d.name === name);
  const box = componentBox(clip.props, defn, settings);
  const maxSize = Math.max(settings.width, settings.height) * 2;

  if (!defn) {
    return (
      <Section title={name || 'Componente'}>
        <p className="prop-note">
          Componente "{name}" não encontrado em <code>components/</code>. As props ficam guardadas no clipe.
        </p>
      </Section>
    );
  }
  const fields = describeProps(defn);
  const { props, invalid } = resolveComponentProps(defn, clip.props);
  const set = (key: string, value: unknown) => edit(`prop:${key}`, (c) => void (c.props[key] = value));
  const animated = (key: string) => (clip.keyframes[`props.${key}`]?.length ?? 0) > 0;

  return (
    <>
      <Section
        title={defn.label ?? defn.name}
        aside={
          <button
            type="button"
            className="link-btn"
            title="Voltar todas as props para o padrão do componente"
            onClick={() =>
              edit('reset-props', (c) => {
                for (const k of Object.keys(c.props)) if (k !== 'component' && k !== 'width' && k !== 'height') delete c.props[k];
              })
            }
          >
            <RotateCcw size={13} /> Padrão
          </button>
        }
      >
        {defn.description && <p className="prop-note">{defn.description}</p>}
        {fields.length === 0 && <p className="prop-note">Este componente não tem props editáveis.</p>}
        {fields.map((f) => (
          <PropFieldRow key={f.key} field={f} value={props[f.key]} onChange={(v) => set(f.key, v)} />
        ))}
        {invalid.length > 0 && <p className="prop-note">Props inválidas usando o padrão: {invalid.join(', ')}.</p>}
        {fields.some((f) => animated(f.key)) && <p className="prop-note">Algumas props têm keyframes; os valores acima são a base.</p>}
      </Section>
      <Section title="Caixa">
        <Row label="Tamanho">
          <NumberField
            prefix="L"
            value={box.width}
            min={1}
            max={maxSize}
            onChange={(v) => edit('box', (c) => void (c.props.width = Math.max(1, Math.round(v))))}
          />
          <NumberField
            prefix="A"
            value={box.height}
            min={1}
            max={maxSize}
            onChange={(v) => edit('box', (c) => void (c.props.height = Math.max(1, Math.round(v))))}
          />
        </Row>
      </Section>
    </>
  );
}

function PropFieldRow({ field, value, onChange }: { field: PropField; value: unknown; onChange: (v: unknown) => void }) {
  const label = field.label ?? field.key;
  switch (field.kind) {
    case 'string':
      return (
        <div className="prop-stack">
          <span className="prop-label">{label}</span>
          <textarea
            className="text-input"
            rows={String(value ?? '').includes('\n') ? 3 : 1}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case 'color':
      return (
        <div className="prop-stack">
          <span className="prop-label">{label}</span>
          <Swatches colors={BRAND_COLORS} value={String(value ?? '')} onChange={onChange} />
        </div>
      );
    case 'number': {
      const n = typeof value === 'number' ? value : field.default;
      if (field.min !== undefined && field.max !== undefined) {
        return <SliderRow label={label} value={n} min={field.min} max={field.max} step={field.step ?? 1} onChange={onChange} />;
      }
      return (
        <Row label={label}>
          <NumberField
            value={n}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            format={(v) => String(Math.round(v * 1000) / 1000)}
            onChange={onChange}
          />
        </Row>
      );
    }
    case 'boolean':
      return (
        <Row label={label}>
          <button type="button" className={`chip-btn ${value ? 'is-active' : ''}`} onClick={() => onChange(!value)}>
            {value ? 'Sim' : 'Não'}
          </button>
        </Row>
      );
    case 'enum':
      return (
        <Row label={label}>
          <select value={String(value ?? field.default)} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Row>
      );
    case 'json':
      return <JsonField label={label} value={value} onChange={onChange} />;
  }
}

/** Valores compostos (listas, objetos): edita o JSON; só confirma se for válido. */
function JsonField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: unknown) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  let valid = true;
  if (draft !== null) {
    try {
      JSON.parse(draft);
    } catch {
      valid = false;
    }
  }
  return (
    <div className="prop-stack">
      <span className="prop-label">{label}</span>
      <textarea
        className={`text-input prop-json ${valid ? '' : 'is-invalid'}`}
        value={draft ?? JSON.stringify(value ?? null, null, 2)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null && valid) onChange(JSON.parse(draft));
          setDraft(null);
        }}
      />
    </div>
  );
}

function ShapeSection({ clip }: { clip: Clip }) {
  const edit = useClipEdit(clip);
  const settings = useEditor((s) => s.project!.settings);
  const [keepRatio, setKeepRatio] = useState(false);
  const p = shapeProps(clip);
  const maxSize = Math.max(settings.width, settings.height) * 2;
  const setSize = (axis: 'w' | 'h', v: number) =>
    edit('size', (c) => {
      const w = Number(c.props.width) || p.width;
      const h = Number(c.props.height) || p.height;
      const n = Math.max(1, Math.round(v));
      if (axis === 'w') {
        c.props.width = n;
        if (keepRatio) c.props.height = Math.max(1, Math.round((n * h) / w));
      } else {
        c.props.height = n;
        if (keepRatio) c.props.width = Math.max(1, Math.round((n * w) / h));
      }
    });

  return (
    <>
      <Section title="Forma">
        <Row label="Tipo">
          <Segmented
            value={p.shape}
            onChange={(v) => edit('shape', (c) => void (c.props.shape = v))}
            options={[
              { value: 'rect', label: 'Retângulo' },
              { value: 'ellipse', label: 'Elipse' },
            ]}
          />
        </Row>
      </Section>

      <Section
        title="Dimensões"
        aside={
          <button
            type="button"
            className={`link-btn ${keepRatio ? 'is-active' : ''}`}
            title="Manter a proporção ao mudar largura ou altura"
            onClick={() => setKeepRatio((k) => !k)}
          >
            {keepRatio ? <Link2 size={13} /> : <Unlink2 size={13} />} Proporção
          </button>
        }
      >
        <SliderRow label="Largura" value={p.width} min={1} max={maxSize} unit="px" format={pct} onChange={(v) => setSize('w', v)} />
        <SliderRow label="Altura" value={p.height} min={1} max={maxSize} unit="px" format={pct} onChange={(v) => setSize('h', v)} />
        <Row label="Ocupar quadro">
          <button
            type="button"
            className="chip-btn"
            title={`Largura igual à do quadro (${settings.width}px)`}
            onClick={() => edit('size', (c) => void (c.props.width = settings.width))}
          >
            Largura
          </button>
          <button
            type="button"
            className="chip-btn"
            title={`Altura igual à do quadro (${settings.height}px)`}
            onClick={() => edit('size', (c) => void (c.props.height = settings.height))}
          >
            Altura
          </button>
        </Row>
        <p className="prop-note">No canvas, arraste as alças laterais para mudar só a largura ou a altura. Shift nos cantos mantém a proporção.</p>
      </Section>

      <Section title="Cor">
        <div className="prop-stack">
          <span className="prop-label">Preenchimento</span>
          <Swatches colors={BRAND_COLORS} value={p.fill} allowNone onChange={(v) => edit('fill', (c) => void (c.props.fill = v))} />
        </div>
        <div className="prop-stack">
          <span className="prop-label">Contorno</span>
          <Swatches
            colors={BRAND_COLORS}
            value={p.stroke}
            allowNone
            onChange={(v) =>
              edit('stroke', (c) => {
                c.props.stroke = v;
                if (v && !(Number(c.props.strokeWidth) > 0)) c.props.strokeWidth = 2;
              })
            }
          />
        </div>
        {p.stroke && (
          <SliderRow
            label="Espessura"
            value={p.strokeWidth}
            min={0}
            max={40}
            format={pct}
            onChange={(v) => edit('strokeW', (c) => void (c.props.strokeWidth = v))}
          />
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- Áudio

function AudioPanel({ clip, track }: { clip: Clip; track: Track }) {
  const edit = useClipEdit(clip);
  const apply = useEditor((s) => s.apply);
  const fps = useEditor((s) => s.project!.settings.fps);
  const audio = clip.audio ?? { volume: 1, fadeIn: 0, fadeOut: 0, pan: 0 };
  const ensure = (c: Clip) => (c.audio ??= { volume: 1, fadeIn: 0, fadeOut: 0, pan: 0 });
  const maxFade = Math.max(0, Math.min(10, clip.duration / fps / 2));

  return (
    <>
      <Section title="Volume">
        <SliderRow
          label="Volume"
          value={audio.volume * 100}
          min={0}
          max={100}
          unit="%"
          format={pct}
          onChange={(v) => edit('volume', (c) => void (ensure(c).volume = v / 100))}
        />
        <Row label="Trilha">
          <button
            type="button"
            className={`chip-btn ${track.muted ? 'is-active' : ''}`}
            onClick={() =>
              apply((p) => {
                const t = p.tracks.find((t) => t.id === track.id);
                if (t) t.muted = !t.muted;
              })
            }
          >
            {track.muted ? 'Trilha sem som' : 'Silenciar trilha'}
          </button>
        </Row>
      </Section>
      <Section title="Fade">
        <SliderRow
          label="Fade in"
          value={audio.fadeIn / fps}
          min={0}
          max={maxFade}
          step={0.1}
          unit="s"
          format={(v) => v.toFixed(1)}
          onChange={(v) => edit('fadeIn', (c) => void (ensure(c).fadeIn = Math.round(v * fps)))}
        />
        <SliderRow
          label="Fade out"
          value={audio.fadeOut / fps}
          min={0}
          max={maxFade}
          step={0.1}
          unit="s"
          format={(v) => v.toFixed(1)}
          onChange={(v) => edit('fadeOut', (c) => void (ensure(c).fadeOut = Math.round(v * fps)))}
        />
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- Velocidade

const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 3, 5];
/** Slider logarítmico: posição 0..100 ↔ 0.1x..10x. */
const toPos = (s: number) => (Math.log10(s) + 1) * 50;
const fromPos = (p: number) => Math.round(10 ** (p / 50 - 1) * 100) / 100;

function SpeedPanel({ clip }: { clip: Clip }) {
  const apply = useEditor((s) => s.apply);
  const fps = useEditor((s) => s.project!.settings.fps);
  const change = (v: number) => apply((p) => setSpeed(p, clip.id, v), { coalesce: `${clip.id}:speed` });

  return (
    <Section title="Normal">
      <label className="slider-row">
        <span className="slider-label">Velocidade</span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={toPos(clip.speed)}
          onChange={(e) => change(fromPos(Number(e.target.value)))}
          style={{ ['--pct' as string]: `${toPos(clip.speed)}%` }}
        />
        <NumberField value={clip.speed} min={0.1} max={10} step={0.1} unit="x" format={(v) => v.toFixed(2)} onChange={change} />
      </label>
      <div className="speed-presets">
        {SPEED_PRESETS.map((s) => (
          <button key={s} type="button" className={`chip-btn ${clip.speed === s ? 'is-active' : ''}`} onClick={() => change(s)}>
            {s}x
          </button>
        ))}
      </div>
      <p className="prop-note">
        Duração na timeline: <strong>{formatClock(clip.duration, fps)}</strong>. O tom da voz é preservado.
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------- Projeto

function ProjectPanel() {
  const project = useEditor((s) => s.project)!;
  const apply = useEditor((s) => s.apply);
  const { settings } = project;
  return (
    <>
      <Section title="Projeto">
        <Row label="Nome">
          <input
            className="text-field"
            value={project.name}
            onChange={(e) => apply((p) => void (p.name = e.target.value || p.name), { coalesce: 'name' })}
          />
        </Row>
        <Row label="Formato">
          <span className="prop-value">{settings.format === 'custom' ? 'Personalizado' : FORMATS[settings.format].label}</span>
        </Row>
        <Row label="Resolução">
          <span className="prop-value">
            {settings.width}×{settings.height} · {settings.fps} fps
          </span>
        </Row>
        <Row label="Duração">
          <span className="prop-value">{formatClock(projectDuration(project), settings.fps)}</span>
        </Row>
      </Section>
      <Section title="Fundo do quadro">
        <Swatches
          colors={BRAND_COLORS}
          value={settings.background}
          onChange={(v) => apply((p) => void (p.settings.background = v), { coalesce: 'bg' })}
        />
      </Section>
    </>
  );
}
