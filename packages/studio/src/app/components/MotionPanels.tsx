import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { EFFECTS, LOOPS, OVERLAYS, POSES, type PoseDef } from '@caju-motion/renderer';
import { EASING_PRESETS, type Clip } from '@caju-motion/schema';
import { BRAND_COLORS } from '../commands';
import { newId, updateClip } from '../ops';
import { useEditor } from '../store';
import { Section, SliderRow, Swatches } from '../ui';

/**
 * Painéis de movimento e efeitos do clipe. Editam os mesmos campos que o código usa
 * (`animationIn/Out/Loop`, `effects[]`, `props.effect`), então o que se vê aqui sai igual no render.
 */

type Phase = 'animationIn' | 'animationOut';

const EASING_LABEL: Record<string, string> = {
  linear: 'Linear',
  hold: 'Degrau',
  easeIn: 'Acelera',
  easeOut: 'Desacelera',
  easeInOut: 'Suave',
  expoOut: 'Rápido → suave',
  expoInOut: 'Dramático',
  softOut: 'Leve',
  backOut: 'Elástico',
};

function useEdit(clip: Clip) {
  const apply = useEditor((s) => s.apply);
  return (key: string, fn: (c: Clip) => void) => apply((p) => updateClip(p, clip.id, fn), { coalesce: `${clip.id}:${key}` });
}

/** Parâmetro de um catálogo (número com faixa, opção ou cor). */
type ParamSpec = { label: string; default: number | string; options?: readonly string[] };
const RANGES: Record<string, [number, number, number]> = {
  distance: [0, 2000, 10],
  from: [0, 2, 0.05],
  amount: [0, 3, 0.05],
  degrees: [-360, 360, 5],
  radius: [0, 60, 1],
  x: [-200, 200, 1],
  y: [-200, 200, 1],
  blur: [0, 120, 1],
  ratio: [1, 3, 0.01],
  opacity: [0, 1, 0.05],
  amplitude: [0, 4, 0.1],
};
const DIRECTION_LABEL: Record<string, string> = { left: 'Esquerda', right: 'Direita', up: 'Cima', down: 'Baixo' };

function ParamRow({ name, spec, value, onChange }: { name: string; spec: ParamSpec; value: unknown; onChange: (v: number | string) => void }) {
  if (spec.options) {
    return (
      <label className="export-field">
        <span className="prop-label">{spec.label}</span>
        <select value={String(value ?? spec.default)} onChange={(e) => onChange(e.target.value)}>
          {spec.options.map((o) => (
            <option key={o} value={o}>
              {DIRECTION_LABEL[o] ?? o}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (typeof spec.default === 'string') {
    return (
      <div className="export-field">
        <span className="prop-label">{spec.label}</span>
        <Swatches colors={['#000000', '#FFFFFF', ...BRAND_COLORS]} value={String(value ?? spec.default)} onChange={onChange} />
      </div>
    );
  }
  const [min, max, step] = RANGES[name] ?? [0, 100, 1];
  const n = typeof value === 'number' ? value : spec.default;
  return <SliderRow label={spec.label} value={n} min={min} max={max} step={step} onChange={onChange} />;
}

// ---------------------------------------------------------------- Animação

export function MotionPanel({ clip }: { clip: Clip }) {
  const edit = useEdit(clip);
  const fps = useEditor((s) => s.project?.settings.fps ?? 30);
  const sec = (frames: number) => frames / fps;

  const phaseSection = (phase: Phase, title: string) => {
    const cur = clip[phase];
    const def: PoseDef | undefined = cur ? (POSES as Record<string, PoseDef>)[cur.preset] : undefined;
    return (
      <Section title={title}>
        <div className="motion-grid">
          <button type="button" className={`motion-chip ${!cur ? 'is-active' : ''}`} onClick={() => edit(phase, (c) => void delete c[phase])}>
            Nenhuma
          </button>
          {Object.entries(POSES).map(([name, p]) => (
            <button
              type="button"
              key={name}
              className={`motion-chip ${cur?.preset === name ? 'is-active' : ''}`}
              onClick={() =>
                edit(phase, (c) => {
                  c[phase] = { preset: name, duration: c[phase]?.duration ?? Math.round(fps * 0.5), params: {} };
                })
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        {cur && (
          <>
            <SliderRow
              label="Duração"
              value={sec(cur.duration)}
              min={0.1}
              max={Math.max(0.2, Math.min(3, sec(clip.duration)))}
              step={0.05}
              unit="s"
              onChange={(v) => edit(`${phase}.dur`, (c) => void (c[phase] && (c[phase]!.duration = Math.max(1, Math.round(v * fps)))))}
            />
            <label className="export-field">
              <span className="prop-label">Curva</span>
              <select
                value={typeof cur.params.easing === 'string' ? cur.params.easing : ''}
                onChange={(e) =>
                  edit(`${phase}.easing`, (c) => {
                    const prm = c[phase]!.params;
                    if (e.target.value) prm.easing = e.target.value;
                    else delete prm.easing;
                  })
                }
              >
                <option value="">Padrão da animação{def ? ` (${EASING_LABEL[String(def.easing)] ?? def.easing})` : ''}</option>
                {EASING_PRESETS.map((e) => (
                  <option key={e} value={e}>
                    {EASING_LABEL[e] ?? e}
                  </option>
                ))}
              </select>
            </label>
            {Object.entries(def?.params ?? {}).map(([name, spec]) => (
              <ParamRow
                key={name}
                name={name}
                spec={spec}
                value={cur.params[name]}
                onChange={(v) => edit(`${phase}.${name}`, (c) => void (c[phase]!.params[name] = v))}
              />
            ))}
          </>
        )}
      </Section>
    );
  };

  const loop = clip.animationLoop;
  return (
    <>
      {phaseSection('animationIn', 'Entrada')}
      {phaseSection('animationOut', 'Saída')}
      <Section title="Loop">
        <div className="motion-grid">
          <button type="button" className={`motion-chip ${!loop ? 'is-active' : ''}`} onClick={() => edit('loop', (c) => void delete c.animationLoop)}>
            Nenhum
          </button>
          {Object.entries(LOOPS).map(([name, l]) => (
            <button
              type="button"
              key={name}
              className={`motion-chip ${loop?.preset === name ? 'is-active' : ''}`}
              onClick={() => edit('loop', (c) => void (c.animationLoop = { preset: name, duration: c.animationLoop?.duration ?? fps * 2, params: {} }))}
            >
              {l.label}
            </button>
          ))}
        </div>
        {loop && (
          <>
            <SliderRow
              label="Período"
              value={sec(loop.duration)}
              min={0.2}
              max={10}
              step={0.1}
              unit="s"
              onChange={(v) => edit('loop.dur', (c) => void (c.animationLoop && (c.animationLoop.duration = Math.max(1, Math.round(v * fps)))))}
            />
            <ParamRow
              name="amplitude"
              spec={{ label: 'Intensidade', default: 1 }}
              value={loop.params.amplitude}
              onChange={(v) => edit('loop.amp', (c) => void (c.animationLoop!.params.amplitude = v))}
            />
          </>
        )}
      </Section>
      {(clip.transitionIn || clip.transitionOut) && (
        <Section title="Transições (do código)">
          {(['transitionIn', 'transitionOut'] as const).map((k) =>
            clip[k] ? (
              <div key={k} className="motion-row">
                <span>
                  {k === 'transitionIn' ? 'Entrada' : 'Saída'}: {(POSES as Record<string, PoseDef>)[clip[k]!.type]?.label ?? clip[k]!.type} ·{' '}
                  {sec(clip[k]!.duration).toFixed(2)} s
                </span>
                <button type="button" className="icon-btn" title="Remover" onClick={() => edit(k, (c) => void delete c[k])}>
                  <Trash2 size={14} />
                </button>
              </div>
            ) : null,
          )}
        </Section>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Efeitos

export function EffectsPanel({ clip }: { clip: Clip }) {
  const edit = useEdit(clip);
  const isAdjustment = clip.type === 'adjustment';
  return (
    <>
      {isAdjustment && <p className="panel-hint">Camada de ajuste: os efeitos valem para tudo o que está abaixo dela na timeline.</p>}
      {clip.effects.map((e) => {
        const def = (EFFECTS as Record<string, { label: string; params: Record<string, ParamSpec> }>)[e.type];
        return (
          <Section
            key={e.id}
            title={def?.label ?? e.type}
            aside={
              <span className="effect-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title={e.enabled ? 'Desligar' : 'Ligar'}
                  onClick={() => edit(`fx.${e.id}.on`, (c) => void (c.effects.find((x) => x.id === e.id)!.enabled = !e.enabled))}
                >
                  {e.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Remover efeito"
                  onClick={() => edit(`fx.${e.id}.rm`, (c) => void (c.effects = c.effects.filter((x) => x.id !== e.id)))}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            }
          >
            {def &&
              Object.entries(def.params).map(([name, spec]) => (
                <ParamRow
                  key={name}
                  name={name}
                  spec={spec}
                  value={e.params[name]}
                  onChange={(v) => edit(`fx.${e.id}.${name}`, (c) => void (c.effects.find((x) => x.id === e.id)!.params[name] = v))}
                />
              ))}
          </Section>
        );
      })}
      <Section title="Adicionar efeito">
        <div className="motion-grid">
          {Object.entries(EFFECTS).map(([name, def]) => (
            <button
              type="button"
              key={name}
              className="motion-chip"
              onClick={() =>
                edit(`fx.add.${name}`, (c) => {
                  c.effects.push({ id: newId('fx'), type: name, enabled: true, params: {} });
                })
              }
            >
              <Plus size={11} /> {def.label}
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- Sobreposição (clipe de efeito)

export function OverlaySection({ clip }: { clip: Clip }) {
  const edit = useEdit(clip);
  const kind = String(clip.props.effect ?? '');
  const def = (OVERLAYS as Record<string, { label: string; params: Record<string, ParamSpec> }>)[kind];
  return (
    <Section title="Sobreposição">
      <div className="motion-grid">
        {Object.entries(OVERLAYS).map(([name, o]) => (
          <button
            type="button"
            key={name}
            className={`motion-chip ${kind === name ? 'is-active' : ''}`}
            onClick={() => edit('overlay', (c) => void (c.props = { effect: name }))}
          >
            {o.label}
          </button>
        ))}
      </div>
      {def &&
        Object.entries(def.params).map(([name, spec]) => (
          <ParamRow key={name} name={name} spec={spec} value={clip.props[name]} onChange={(v) => edit(`overlay.${name}`, (c) => void (c.props[name] = v))} />
        ))}
    </Section>
  );
}
