import { defineProject, type SceneCtx } from '@caju-motion/sdk';

/**
 * Explainer 16:9 em três cenas: pergunta, passos (cartões) e resultado (CountUp).
 * Cada `p.scene(id, rótulo, de, até, ...)` usa frames absolutos; dentro da cena os tempos são relativos.
 */
const ACCENT = '#F6B73C';
const INK = '#171512';
const PAPER = '#FFF8E9';
const CARD = '#2A2520';

const STEPS = [
  { n: '1', title: 'Escreva', text: 'o vídeo em código' },
  { n: '2', title: 'Edite', text: 'na timeline do Studio' },
  { n: '3', title: 'Renderize', text: 'MP4, WebM, GIF…' },
];

export default defineProject({ id: 'explainer', name: 'Explainer 16:9', format: 'landscape-16x9', background: INK, duration: 300 }, (p) => {
  const { width, height } = p.settings;
  const cx = width / 2;
  const fundo = (s: SceneCtx, id: string) =>
    s.rect(width, height, { fill: INK }, { id, x: cx, y: height / 2, exit: false, locked: true, track: 'Fundo' });

  p.tracks(['Fundo']);

  p.scene('pergunta', 'Pergunta', 0, 90, (s) => {
    fundo(s, 'fundo-1');
    s.rect(420, 420, { stroke: ACCENT, sw: 6, ellipse: true }, { id: 'anel', x: 1540, y: 300, enter: { at: 0, dur: 24, pop: true } });
    s.rect(180, 180, { fill: ACCENT, ellipse: true }, { id: 'bola', x: 1540, y: 300, enter: { at: 8, pop: true } });
    s.rect(200, 12, { fill: ACCENT }, { id: 'traco', x: 260, y: 420, anchorX: 0, enter: { at: 4, dx: -80 } });
    s.text('Como fazer um vídeo\nsem abrir um editor?', { size: 96, weight: 800, color: PAPER, align: 'left', lh: 1.08 }, { id: 'pergunta', x: 260, y: 560, enter: { at: 6, rise: 40 } });
  });

  p.scene('passos', 'Passos', 90, 210, (s) => {
    fundo(s, 'fundo-2');
    s.text('Em três passos', { size: 72, weight: 800, color: PAPER }, { id: 'passos-titulo', x: cx, y: 220, enter: { at: 0, rise: 30 } });
    STEPS.forEach((step, i) => {
      const x = cx + (i - 1) * 520;
      const at = 12 + i * 14;
      s.rect(440, 420, { fill: CARD }, { id: `cartao-${step.n}`, x, y: 600, enter: { at, rise: 60 } });
      s.rect(120, 120, { fill: ACCENT, ellipse: true }, { id: `numero-bg-${step.n}`, x, y: 480, enter: { at: at + 4, pop: true } });
      s.text(step.n, { size: 64, weight: 800, color: INK }, { id: `numero-${step.n}`, x, y: 480, enter: { at: at + 4, pop: true } });
      s.text(step.title, { size: 60, weight: 800, color: PAPER }, { id: `passo-${step.n}`, x, y: 630, enter: { at: at + 6, rise: 20 } });
      s.text(step.text, { size: 34, weight: 600, color: ACCENT }, { id: `passo-texto-${step.n}`, x, y: 710, enter: { at: at + 8, rise: 20 } });
    });
  });

  p.scene('resultado', 'Resultado', 210, 300, (s) => {
    fundo(s, 'fundo-3');
    s.component('CountUp', { from: 0, to: 5, suffix: ' min', seconds: 1.4 }, { id: 'contador', x: cx, y: 460, at: [0, 90], enter: { at: 0 } });
    s.text('do zero ao MP4', { size: 64, weight: 700, color: PAPER }, { id: 'resultado-legenda', x: cx, y: 680, enter: { at: 16, rise: 24 } });
  });
});
