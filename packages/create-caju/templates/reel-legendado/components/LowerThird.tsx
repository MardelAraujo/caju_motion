import { interpolate, spring, useFrame, useVideoConfig } from '@caju-motion/core';
import { defineComponent } from '@caju-motion/renderer';
import { z } from 'zod';

const schema = z.object({
  title: z.string().default('Seu Nome').describe('Título'),
  subtitle: z.string().default('Caju Motion').describe('Subtítulo'),
  accent: z.string().describe('color').default('#F6B73C'),
  background: z.string().describe('color').default('#171512'),
  textColor: z.string().describe('color').default('#FFF8E9'),
});

type Props = z.infer<typeof schema>;

/** Entra com mola; a saída fica por conta do clipe (fade/keyframes de opacidade no Studio ou no video.ts). */
function LowerThird({ title, subtitle, accent, background, textColor }: Props) {
  const frame = useFrame();
  const { fps, width } = useVideoConfig();
  const bar = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const textIn = interpolate(spring({ frame, fps, delay: 6, config: { damping: 20 } }), [0, 1], [0, 1]);
  const scale = width / 1080;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          transform: `translateX(${(1 - bar) * -110}%)`,
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ width: 14 * scale, background: accent }} />
        <div
          style={{
            padding: `${22 * scale}px ${36 * scale}px`,
            background,
            color: textColor,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            opacity: textIn,
            transform: `translateY(${(1 - textIn) * 20}px)`,
          }}
        >
          <div style={{ fontSize: 56 * scale, fontWeight: 800, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 34 * scale, fontWeight: 600, color: accent, marginTop: 6 * scale, whiteSpace: 'nowrap' }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default defineComponent({
  name: 'LowerThird',
  label: 'Tarja de nome',
  description: 'Nome e cargo que entram deslizando da esquerda.',
  schema,
  width: 900,
  height: 240,
  durationInFrames: 120,
  component: LowerThird,
});
