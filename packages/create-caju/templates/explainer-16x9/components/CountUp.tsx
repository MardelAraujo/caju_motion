import { Easing, interpolate, useFrame, useVideoConfig } from '@caju-motion/core';
import { defineComponent } from '@caju-motion/renderer';
import { z } from 'zod';

/** Formata sem Intl (determinístico em qualquer máquina): 12345.6 → "12.345,6". */
function formatNumber(value: number, decimals: number, thousands: string, decimal: string): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return `${value < 0 ? '-' : ''}${grouped}${frac ? decimal + frac : ''}`;
}

const schema = z.object({
  from: z.number().default(0).describe('De'),
  to: z.number().default(100).describe('Até'),
  /** Segundos até chegar ao valor final. */
  seconds: z.number().min(0.1).max(10).default(1.5).describe('Duração (s)'),
  decimals: z.number().int().min(0).max(3).default(0).describe('Casas decimais'),
  prefix: z.string().default('').describe('Prefixo'),
  suffix: z.string().default('%').describe('Sufixo'),
  fontSize: z.number().min(16).max(600).default(220).describe('Tamanho'),
  color: z.string().describe('color').default('#F6B73C'),
  align: z.enum(['left', 'center', 'right']).default('center').describe('Alinhamento'),
});

type Props = z.infer<typeof schema>;

function CountUp({ from, to, seconds, decimals, prefix, suffix, fontSize, color, align }: Props) {
  const frame = useFrame();
  const { fps } = useVideoConfig();
  const value = interpolate(frame, [0, Math.max(1, Math.round(seconds * fps))], [from, to], { easing: Easing.expoOut });
  const pop = interpolate(frame, [0, 8], [0.9, 1], { easing: Easing.backOut });
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 800,
        fontSize,
        lineHeight: 1,
        color,
        fontVariantNumeric: 'tabular-nums',
        transform: `scale(${pop})`,
        whiteSpace: 'nowrap',
      }}
    >
      {prefix}
      {formatNumber(value, decimals, '.', ',')}
      {suffix}
    </div>
  );
}

export default defineComponent({
  name: 'CountUp',
  label: 'Contador',
  description: 'Número que conta de um valor até outro.',
  schema,
  width: 900,
  height: 300,
  durationInFrames: 90,
  component: CountUp,
});
