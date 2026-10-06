import { defineProject } from '@caju-motion/sdk';

/**
 * Seu primeiro vídeo por código.
 *
 * 1. Edite este arquivo e rode `npm run build` (gera o project.json).
 * 2. Abra o Studio com `npm run dev`, mexa à vontade na timeline.
 * 3. Rode o build de novo: o que você criou no Studio é preservado.
 *
 * Tempos em frames (30 fps): `p.sec(2)` = 60 frames.
 */
export default defineProject(
  { id: 'meu-video', name: 'Meu vídeo', format: 'reel-9x16', background: '#171512', duration: 90 },
  (p) => {
    const { width, height } = p.settings;

    p.scene('inicio', 'Início', 0, 90, (s) => {
      s.text('Olá, Caju!', { size: 120, weight: 800, color: '#FFF8E9' }, { id: 'titulo', x: width / 2, y: height / 2, enter: { at: 0, rise: 40 } });
      s.text('edite projects/meu-video/video.ts', { size: 44, weight: 600, color: '#F6B73C' }, { id: 'dica', x: width / 2, y: height / 2 + 120, enter: { at: 12, rise: 24 } });
    });
  },
);
