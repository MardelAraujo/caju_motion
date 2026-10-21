import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { ProjectSchema } from '@caju-motion/schema';
import { applyCaptionStyle, CAPTION_STYLES } from './components/CaptionStyles';

describe('estilos de legenda', () => {
  it('aplica a todos os textos da trilha, mantendo texto e posição', () => {
    const p = ProjectSchema.parse({
      schemaVersion: 1,
      id: 'p',
      name: 'p',
      settings: { width: 1080, height: 1920, fps: 30 },
      tracks: [
        {
          id: 'leg',
          kind: 'text',
          clips: [
            { id: 'a', type: 'text', start: 0, duration: 30, transform: { x: 540, y: 1500 }, props: { text: 'Oi' } },
            { id: 'b', type: 'text', start: 30, duration: 4, props: { text: 'gente' } },
          ],
        },
      ],
    });
    const pill = CAPTION_STYLES.find((s) => s.id === 'pill')!;
    const out = produce(p, (d) => applyCaptionStyle(d, 'leg', pill));
    const [a, b] = out.tracks[0]!.clips;
    expect(a!.props).toMatchObject({ text: 'Oi', background: '#F6B73C', fontWeight: 800 });
    expect(a!.transform).toMatchObject({ x: 540, y: 1500 });
    expect(a!.animationIn).toEqual({ preset: 'pop', duration: 6, params: {} });
    expect(b!.animationIn!.duration).toBe(4); // não passa do clipe
    const classic = produce(out, (d) => applyCaptionStyle(d, 'leg', CAPTION_STYLES[0]!));
    expect(classic.tracks[0]!.clips[0]!.animationIn).toBeUndefined();
  });
});
