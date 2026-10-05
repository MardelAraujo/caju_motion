import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ColorPicker } from './ColorPicker';

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>;

export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  size = 18,
  className = '',
  children,
}: {
  icon: IconType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'is-active' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <Icon size={size} strokeWidth={1.75} />
      {children}
    </button>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="prop-section">
      <header>
        <h4>{title}</h4>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Slider + campo numérico sincronizados (padrão dos painéis do CapCut). */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  format = (v) => String(Math.round(v * 100) / 100),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="slider-row">
      <span className="slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${((value - min) / (max - min)) * 100}%` }}
      />
      <NumberField value={value} min={min} max={max} step={step} onChange={onChange} format={format} unit={unit} />
    </label>
  );
}

/** Campo numérico que só confirma no Enter/blur (não cria histórico a cada tecla). */
export function NumberField({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  unit = '',
  format = (v) => String(Math.round(v)),
  prefix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  format?: (v: number) => string;
  prefix?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };
  return (
    <span className="num-field">
      {prefix && <span className="num-prefix">{prefix}</span>}
      <input
        value={draft ?? format(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(null);
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            onChange(Math.min(max, Math.max(min, value + d)));
          }
        }}
      />
      {unit && <span className="num-unit">{unit}</span>}
    </span>
  );
}

export function Swatches({
  colors,
  value,
  onChange,
  allowNone,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
  allowNone?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const inPalette = value === '' || colors.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <div className="swatch-field">
      <div className="swatches">
        {allowNone && (
          <button
            type="button"
            className={`swatch none ${value === '' ? 'is-active' : ''}`}
            title="Sem cor"
            onClick={() => onChange('')}
          />
        )}
        {colors.map((c) => (
          <button
            type="button"
            key={c}
            className={`swatch ${value.toLowerCase() === c.toLowerCase() ? 'is-active' : ''}`}
            style={{ background: c }}
            title={c}
            onClick={() => onChange(c)}
          />
        ))}
        <button
          type="button"
          className={`swatch custom ${!inPalette ? 'is-active' : ''} ${pickerOpen ? 'is-open' : ''}`}
          title={pickerOpen ? 'Fechar seletor de cor' : 'Seletor de cor (RGB, transparência, conta-gotas)'}
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((o) => !o)}
        >
          {!inPalette && <span className="checker" style={{ ['--swatch' as string]: value }} />}
        </button>
      </div>
      {pickerOpen && <ColorPicker value={value || '#FFFFFF'} onChange={onChange} />}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={o.value === value ? 'is-active' : ''}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Menu suspenso simples, fecha ao clicar fora. */
export function Dropdown({
  trigger,
  children,
  align = 'left',
  menuClassName = '',
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);
  return (
    <div className="dropdown" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && <div className={`dropdown-menu align-${align} ${menuClassName}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
