import { defineProject } from '@caju-motion/sdk';
import vendas from './assets/data/vendas.json';

/**
 * Vídeo guiado por dados: o gráfico e os textos saem de assets/data/vendas.json.
 * Mude o JSON e rode `npm run build` — o vídeo inteiro se atualiza.
 * O gráfico é o componente `BarChart` (components/BarChart.tsx), que recebe os dados por props.
 */
const ACCENT = '#F6B73C';
const INK = '#171512';
const PAPER = '#FFF8E9';

const series = vendas.series.map((s) => ({ label: s.rotulo, value: s.valor }));
const total = series.reduce((sum, s) => sum + s.value, 0);
const best = series.reduce((a, b) => (b.value > a.value ? b : a));

export default defineProject({ id: 'dados', name: 'Vídeo de dados', format: 'feed-4x5', background: INK, duration: 240 }, (p) => {
  const { width, height } = p.settings;
  const cx = width / 2;

  p.tracks(['Fundo']);

  p.scene('grafico', 'Gráfico', 0, 150, (s) => {
    s.rect(width, height, { fill: INK }, { id: 'fundo-1', x: cx, y: height / 2, exit: false, locked: true, track: 'Fundo' });
    s.text(vendas.titulo, { size: 64, weight: 800, color: PAPER }, { id: 'titulo', x: cx, y: 170, enter: { at: 0, rise: 30 } });
    s.text(`em ${vendas.unidade}`, { size: 36, weight: 600, color: ACCENT }, { id: 'unidade', x: cx, y: 250, enter: { at: 6, rise: 20 } });
    s.component('BarChart', { data: series, suffix: '', barColor: ACCENT, textColor: PAPER }, { id: 'grafico', x: cx, y: 760, width: 920, height: 820 });
    s.text(vendas.fonte, { size: 26, weight: 500, color: '#8C8579' }, { id: 'fonte', x: cx, y: 1260, enter: { at: 20 } });
  });

  p.scene('destaque', 'Destaque', 150, 240, (s) => {
    s.rect(width, height, { fill: INK }, { id: 'fundo-2', x: cx, y: height / 2, exit: false, locked: true, track: 'Fundo' });
    s.text('Total no ano', { size: 56, weight: 700, color: PAPER }, { id: 'total-rotulo', x: cx, y: 480, enter: { at: 0, rise: 24 } });
    s.text(`${total} ${vendas.unidade}`, { size: 150, weight: 800, color: ACCENT }, { id: 'total', x: cx, y: 640, enter: { at: 6, pop: true } });
    s.text(`melhor trimestre: ${best.label}`, { size: 48, weight: 600, color: PAPER }, { id: 'melhor', x: cx, y: 820, enter: { at: 16, rise: 24 } });
  });
});
