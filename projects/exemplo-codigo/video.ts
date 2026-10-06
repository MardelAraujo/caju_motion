import { defineProject } from '@caju-motion/sdk';

/**
 * Template feito só em código. Gere o project.json com:
 *   npm run caju -- build exemplo-codigo
 * Abra no Studio (`npm run studio`), edite à vontade e rode o build de novo:
 * clipes criados no Studio são preservados; os do código são regerados.
 * Os componentes (CountUp, LowerThird) vêm da pasta `components/` na raiz.
 */
export default defineProject(
  { id: 'exemplo-codigo', name: 'Exemplo por código', format: 'reel-9x16', background: '#171512', duration: 180 },
  (p) => {
    const { width, height } = p.settings;
    p.tracks(['Fundo']);

    p.scene('abertura', 'Abertura', 0, 90, (s) => {
      s.rect(width, height, { fill: '#171512' }, { id: 'fundo', x: width / 2, y: height / 2, exit: false, locked: true, track: 'Fundo' });
      s.rect(220, 12, { fill: '#F6B73C' }, { id: 'traco', x: width / 2, y: 640, enter: { at: 4, dx: -80 } });
      s.text('Vídeo por código', { size: 104, weight: 800, color: '#FFF8E9' }, { id: 'titulo', x: width / 2, y: 760, enter: { at: 0, rise: 40 } });
      s.text('e editável no Studio', { size: 56, weight: 600, color: '#F6B73C' }, { id: 'subtitulo', x: width / 2, y: 880, enter: { at: 10, rise: 30 } });
    });

    p.scene('numero', 'Número', 90, 180, (s) => {
      s.rect(width, height, { fill: '#171512' }, { id: 'fundo-2', x: width / 2, y: height / 2, exit: false, locked: true, track: 'Fundo' });
      s.component('CountUp', { from: 0, to: 87, suffix: '%', seconds: 1.6 }, { id: 'contador', y: 820, at: [0, 90], enter: { at: 0 } });
      s.text('menos tempo no editor', { size: 60, weight: 700, color: '#FFF8E9' }, { id: 'legenda', x: width / 2, y: 1040, enter: { at: 20, rise: 24 } });
      s.component('LowerThird', { title: 'Caju Motion', subtitle: 'code it, then move it' }, { id: 'tarja', x: width / 2, y: 1560, at: [30, 90] });
    });
  },
);
