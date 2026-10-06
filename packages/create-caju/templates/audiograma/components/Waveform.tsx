import { interpolate, random, useFrame, useVideoConfig } from '@caju-motion/core';
import { defineComponent } from '@caju-motion/renderer';
import { z } from 'zod';

const schema = z.object({
  bars: z.number().int().min(4).max(96).default(36).describe('Barras'),
  color: z.string().describe('color').default('#F6B73C'),
  trackColor: z.string().describe('color').default('#3A332B'),
  /** Velocidade da animação sintética. */
  speed: z.number().min(0.1).max(4).default(1).describe('Velocidade'),
  /** Muda o "desenho" da onda sintética. */
  seed: z.string().default('caju').describe('Semente'),
  /**
   * Níveis reais do áudio (0–1), `levelsPerSecond` amostras por segundo. Vazio: onda sintética.
   * Gere a partir do seu áudio (ex.: ffmpeg astats/volumedetect) e cole aqui ou no video.ts.
   */
  levels: z.array(z.number().min(0).max(1)).default([]).describe('Níveis do áudio'),
  levelsPerSecond: z.number().min(1).max(60).default(10).describe('Níveis por segundo'),
  showProgress: z.boolean().default(true).describe('Barra de progresso'),
});

type Props = z.infer<typeof schema>;

/** Intensidade geral no frame: dos níveis reais (interpolados) ou de uma "fala" sintética. */
function envelope(frame: number, fps: number, levels: number[], perSecond: number, speed: number): number {
  if (levels.length) {
    const pos = (frame / fps) * perSecond;
    const i = Math.min(levels.length - 1, Math.floor(pos));
    const j = Math.min(levels.length - 1, i + 1);
    return levels[i]! + (levels[j]! - levels[i]!) * (pos - i);
  }
  const t = (frame / fps) * speed;
  // frases com pausas: soma de senos lentos, recortada em 0
  return Math.max(0.08, Math.min(1, 0.55 + 0.35 * Math.sin(t * 2.1) + 0.25 * Math.sin(t * 5.3 + 1.3)));
}

/** Barras animadas tipo forma de onda — 100% determinístico (só depende do frame e das props). */
function Waveform({ bars, color, trackColor, speed, seed, levels, levelsPerSecond, showProgress }: Props) {
  const frame = useFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const level = envelope(frame, fps, levels, levelsPerSecond, speed);
  const t = (frame / fps) * speed;
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1]);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 40 }}>
      <div style={{ height: '70%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1%' }}>
        {Array.from({ length: bars }, (_, i) => {
          const phase = random(`${seed}-${i}`) * Math.PI * 2;
          const rate = 6 + random(`${seed}-rate-${i}`) * 8;
          // barras do centro mais altas, bordas mais baixas
          const shape = 0.35 + 0.65 * Math.sin((Math.PI * (i + 0.5)) / bars);
          const wobble = 0.5 + 0.5 * Math.sin(t * rate + phase);
          const h = Math.max(0.06, level * shape * (0.35 + 0.65 * wobble));
          return <div key={i} style={{ flex: 1, height: `${h * 100}%`, background: color, borderRadius: 999 }} />;
        })}
      </div>
      {showProgress && (
        <div style={{ height: 10, borderRadius: 999, background: trackColor, overflow: 'hidden' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: color }} />
        </div>
      )}
    </div>
  );
}

export default defineComponent({
  name: 'Waveform',
  label: 'Onda de áudio',
  description: 'Barras animadas de audiograma; usa níveis reais do áudio se informados.',
  schema,
  width: 860,
  height: 360,
  durationInFrames: 150,
  component: Waveform,
});
