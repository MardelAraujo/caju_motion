import { Easing, interpolate, useFrame, useVideoConfig } from '@caju-motion/core';
import { defineComponent } from '@caju-motion/renderer';
import { z } from 'zod';

const schema = z.object({
  /** Barras, na ordem. No video.ts vêm do JSON em assets/data/. */
  data: z
    .array(z.object({ label: z.string(), value: z.number() }))
    .default([
      { label: 'A', value: 40 },
      { label: 'B', value: 75 },
      { label: 'C', value: 55 },
    ])
    .describe('Dados'),
  /** Topo da escala; 0 = maior valor dos dados. */
  max: z.number().min(0).default(0).describe('Máximo da escala'),
  prefix: z.string().default('').describe('Prefixo'),
  suffix: z.string().default('').describe('Sufixo'),
  /** Segundos que cada barra leva para crescer. */
  seconds: z.number().min(0.1).max(5).default(1).describe('Duração (s)'),
  /** Atraso entre uma barra e a próxima, em frames. */
  stagger: z.number().int().min(0).max(30).default(6).describe('Intervalo (frames)'),
  barColor: z.string().describe('color').default('#F6B73C'),
  textColor: z.string().describe('color').default('#FFF8E9'),
  gridColor: z.string().describe('color').default('#3A332B'),
});

type Props = z.infer<typeof schema>;

function BarChart({ data, max, prefix, suffix, seconds, stagger, barColor, textColor, gridColor }: Props) {
  const frame = useFrame();
  const { fps } = useVideoConfig();
  const top = max > 0 ? max : Math.max(1, ...data.map((d) => d.value));
  const grow = Math.max(1, Math.round(seconds * fps));
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        gap: '4%',
        padding: '0 4%',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: textColor,
      }}
    >
      {data.map((d, i) => {
        const t = interpolate(frame, [i * stagger, i * stagger + grow], [0, 1], { easing: Easing.expoOut });
        const value = d.value * t;
        return (
          <div key={`${i}-${d.label}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ fontSize: 44, fontWeight: 800, marginBottom: 12, opacity: t, fontVariantNumeric: 'tabular-nums' }}>
              {prefix}
              {Math.round(value)}
              {suffix}
            </div>
            <div style={{ width: '100%', height: `${(value / top) * 72}%`, background: barColor, borderRadius: '12px 12px 0 0' }} />
            <div style={{ width: '100%', height: 4, background: gridColor }} />
            <div style={{ fontSize: 36, fontWeight: 700, marginTop: 14, opacity: interpolate(frame, [i * stagger, i * stagger + 10], [0, 1]) }}>
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default defineComponent({
  name: 'BarChart',
  label: 'Gráfico de barras',
  description: 'Barras que crescem uma a uma, com o valor em cima.',
  schema,
  width: 920,
  height: 820,
  durationInFrames: 120,
  component: BarChart,
});
