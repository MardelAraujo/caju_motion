import { defineProject } from '@caju-motion/sdk';

/**
 * Audiograma quadrado (1:1) para divulgar podcast/entrevista: título, convidado e a onda animada
 * (componente `Waveform`, determinístico — não analisa o áudio; passe `levels` para seguir o som real).
 *
 * Áudio (opcional): coloque o arquivo em projects/audiograma/assets/audio/vo/trecho.mp3,
 * ajuste DURACAO para a duração dele e descomente as duas linhas marcadas com "áudio" abaixo.
 * Sem o arquivo, o vídeo funciona mudo (o `caju check` acusa assets registrados que não existem).
 */
const DURACAO = 8; // segundos

const ACCENT = '#F6B73C';
const INK = '#171512';
const PAPER = '#FFF8E9';

export default defineProject({ id: 'audiograma', name: 'Audiograma', format: 'square-1x1', background: INK }, (p) => {
  const { width, height } = p.settings;
  const cx = width / 2;
  const end = p.sec(DURACAO);

  // áudio: p.asset({ id: 'trecho', kind: 'audio', src: 'assets/audio/vo/trecho.mp3', meta: { durationSec: DURACAO } });
  // áudio: p.audioClip('trecho', 0, end, 'Trecho do episódio', { fadeIn: 6, fadeOut: 12 });

  p.tracks(['Fundo']);

  p.scene('audiograma', 'Audiograma', 0, end, (s) => {
    s.rect(width, height, { fill: INK }, { id: 'fundo', x: cx, y: height / 2, exit: false, locked: true, track: 'Fundo' });
    s.rect(120, 120, { fill: ACCENT, ellipse: true }, { id: 'selo', x: 150, y: 150, enter: { at: 0, pop: true } });
    s.text('EP 01', { size: 30, weight: 800, color: INK }, { id: 'selo-texto', x: 150, y: 150, enter: { at: 4 } });
    s.text('PODCAST CAJU', { size: 34, weight: 800, color: ACCENT, spacing: 4, align: 'left' }, { id: 'programa', x: 240, y: 150, enter: { at: 6, dx: -30 } });
    s.text('Como fazer vídeo\ncom código', { size: 76, weight: 800, color: PAPER, lh: 1.05 }, { id: 'titulo', x: cx, y: 340, enter: { at: 8, rise: 30 } });
    s.component('Waveform', { seed: 'episodio-1' }, { id: 'onda', x: cx, y: 700, enter: { at: 12 }, exit: false });
    s.text('com Seu Convidado', { size: 40, weight: 600, color: PAPER }, { id: 'convidado', x: cx, y: 960, enter: { at: 18, rise: 20 } });
  });
});
