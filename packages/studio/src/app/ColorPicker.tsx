import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Pipette } from 'lucide-react';
import { hsvToRgb, parseHex, rgbToHsv, toHex, type HSV } from './color';
import { NumberField } from './ui';

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
const EyeDropper = (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper;

/**
 * Seletor completo: área saturação/brilho, matiz, transparência, Hex/RGB/A
 * e conta-gotas (EyeDropper API: pega a cor de qualquer ponto da tela, inclusive do vídeo).
 */
export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const parsed = parseHex(value) ?? { r: 255, g: 255, b: 255, a: 1 };
  // HSV fica em estado local para não perder o matiz quando a cor vira cinza/preto
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(parsed));
  const [alpha, setAlpha] = useState(parsed.a);
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    const p = parseHex(value);
    if (!p) return;
    lastEmitted.current = value;
    setHsv(rgbToHsv(p));
    setAlpha(p.a);
  }, [value]);

  const emit = (next: HSV, a: number) => {
    setHsv(next);
    setAlpha(a);
    const hex = toHex(hsvToRgb(next, a));
    lastEmitted.current = hex;
    onChange(hex);
  };
  const emitRgb = (r: number, g: number, b: number, a: number) => {
    const hex = toHex({ r, g, b, a });
    lastEmitted.current = hex;
    setHsv((prev) => {
      const n = rgbToHsv({ r, g, b, a });
      return n.s === 0 || n.v === 0 ? { ...n, h: prev.h } : n;
    });
    setAlpha(a);
    onChange(hex);
  };

  const rgb = hsvToRgb(hsv, alpha);
  const opaque = toHex({ ...rgb, a: 1 });

  // ------------------------------------------------ área saturação × brilho
  const svRef = useRef<HTMLDivElement>(null);
  const dragSv = (e: RPointerEvent) => {
    const r = svRef.current!.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    emit({ h: hsv.h, s, v }, alpha);
  };

  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const commitHex = () => {
    const p = hexDraft !== null ? parseHex(hexDraft) : null;
    if (p) emitRgb(p.r, p.g, p.b, p.a);
    setHexDraft(null);
  };

  const pick = async () => {
    if (!EyeDropper) return;
    try {
      const { sRGBHex } = await new EyeDropper().open();
      const p = parseHex(sRGBHex);
      if (p) emitRgb(p.r, p.g, p.b, alpha);
    } catch {
      // usuário cancelou (Esc)
    }
  };

  return (
    <div className="color-picker">
      <div
        ref={svRef}
        className="cp-sv"
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragSv(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && dragSv(e)}
      >
        <span className="cp-sv-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: opaque }} />
      </div>

      <div className="cp-controls">
        <button
          type="button"
          className="cp-eyedropper"
          disabled={!EyeDropper}
          title={EyeDropper ? 'Conta-gotas: pegar cor do vídeo ou da tela' : 'Conta-gotas indisponível neste navegador (use Chrome ou Edge)'}
          onClick={() => void pick()}
        >
          <Pipette size={16} />
        </button>
        <span className="cp-preview checker">
          <span style={{ background: toHex(rgb) }} />
        </span>
        <div className="cp-sliders">
          <input
            type="range"
            className="cp-hue"
            aria-label="Matiz"
            min={0}
            max={360}
            step={1}
            value={hsv.h}
            onChange={(e) => emit({ ...hsv, h: Number(e.target.value) }, alpha)}
          />
          <input
            type="range"
            className="cp-alpha checker"
            aria-label="Transparência"
            min={0}
            max={100}
            step={1}
            value={Math.round(alpha * 100)}
            onChange={(e) => emit(hsv, Number(e.target.value) / 100)}
            style={{ ['--cp-color' as string]: opaque }}
          />
        </div>
      </div>

      <div className="cp-fields">
        <label className="cp-hex">
          <span className="num-field">
            <span className="num-prefix">#</span>
            <input
              value={hexDraft ?? toHex(rgb).slice(1)}
              spellCheck={false}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setHexDraft(null);
              }}
            />
          </span>
          <small>Hex</small>
        </label>
        {(['r', 'g', 'b'] as const).map((k) => (
          <label key={k}>
            <NumberField
              value={rgb[k]}
              min={0}
              max={255}
              onChange={(v) => emitRgb(k === 'r' ? v : rgb.r, k === 'g' ? v : rgb.g, k === 'b' ? v : rgb.b, alpha)}
            />
            <small>{k.toUpperCase()}</small>
          </label>
        ))}
        <label>
          <NumberField value={Math.round(alpha * 100)} min={0} max={100} unit="%" onChange={(v) => emit(hsv, v / 100)} />
          <small>A</small>
        </label>
      </div>
    </div>
  );
}
