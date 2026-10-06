import { defineProject } from '@caju-motion/sdk';

/**
 * Reel 9:16 com título, legendas por trecho de locução e tarja de nome (LowerThird).
 *
 * As legendas são cronometradas pela lista VO abaixo: cada trecho dura `sec` segundos.
 * Troque pelos tempos reais da sua locução (ex.: medidos com `measureMedia` do
 * @caju-motion/sdk ou com `ffprobe`) e, se quiser o áudio, registre o arquivo:
 *
 *   p.asset({ id: 'locucao', kind: 'audio', src: 'assets/audio/vo/locucao.mp3', meta: { durationSec: 9.1 } });
 *   p.audioClip('locucao', p.sec(0.5), p.sec(9.1), 'Locução');
 */
const VO = [
  { text: 'Todo vídeo começa com uma ideia.', sec: 2.2 },
  { text: 'O Caju transforma código', sec: 1.6 },
  { text: 'em vídeo editável no Studio.', sec: 2.0 },
  { text: 'Edite, renderize e publique.', sec: 1.8 },
];

/** Respiro antes da primeira fala e depois da última (s). */
const LEAD_IN = 0.5;
const TAIL = 1;

const ACCENT = '#F6B73C';
const INK = '#171512';
const PAPER = '#FFF8E9';

export default defineProject({ id: 'reel', name: 'Reel legendado', format: 'reel-9x16', background: INK }, (p) => {
  const { width, height } = p.settings;

  // tempos de cada legenda, em frames, a partir das durações da locução
  let t = p.sec(LEAD_IN);
  const captions = VO.map((c) => {
    const from = t;
    t += p.sec(c.sec);
    return { ...c, from, to: t };
  });
  const end = t + p.sec(TAIL);

  p.tracks(['Fundo', 'Legendas']);

  p.scene('reel', 'Reel', 0, end, (s) => {
    s.rect(width, height, { fill: INK }, { id: 'fundo', x: width / 2, y: height / 2, exit: false, locked: true, track: 'Fundo' });
    s.rect(560, 560, { fill: '#2A2520', ellipse: true }, { id: 'circulo', x: width - 120, y: 420, enter: { at: 0, dur: 24, pop: true }, exit: false });
    s.rect(160, 12, { fill: ACCENT }, { id: 'traco', x: width / 2, y: 470, enter: { at: 4, dx: -60 } });
    s.text('Como o Caju\nfunciona', { size: 104, weight: 800, color: PAPER, lh: 1.05 }, { id: 'titulo', x: width / 2, y: 640, enter: { at: 0, rise: 40 } });

    captions.forEach((c, i) => {
      s.text(c.text, { size: 54, weight: 800, color: INK, bg: ACCENT }, {
        id: `legenda-${i + 1}`,
        x: width / 2,
        y: 1180,
        at: [c.from, c.to],
        enter: { at: c.from, dur: 6, pop: true },
        exit: false,
        track: 'Legendas',
      });
    });

    s.component('LowerThird', { title: 'Seu Nome', subtitle: '@seu_perfil' }, { id: 'tarja', x: width / 2, y: 1500, at: [p.sec(1), p.sec(5)] });
  });
});
