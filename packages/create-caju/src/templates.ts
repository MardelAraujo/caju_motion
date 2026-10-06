import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pasta `templates/` do pacote (de `src/` no repo ou de `dist/` publicado: os dois ficam um nível abaixo). */
export const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');

export type TemplateInfo = {
  /** Nome usado em `--template`. */
  name: string;
  title: string;
  description: string;
  /** Id (= pasta em projects/) do projeto de exemplo. */
  project: string;
  /** Um quadro representativo para `caju still` (mostrado nos próximos passos e usado nos testes). */
  stillFrame: number;
  /** Componentes em components/ que o template registra. */
  components: string[];
};

export const TEMPLATES: TemplateInfo[] = [
  {
    name: 'blank',
    title: 'Em branco',
    description: 'um reel 9:16 mínimo, para começar do zero',
    project: 'meu-video',
    stillFrame: 45,
    components: [],
  },
  {
    name: 'reel-legendado',
    title: 'Reel legendado',
    description: '9:16 com título, legendas cronometradas pela locução e tarja de nome',
    project: 'reel',
    stillFrame: 75,
    components: ['LowerThird'],
  },
  {
    name: 'explainer-16x9',
    title: 'Explainer 16:9',
    description: 'cenas com texto, formas e um contador animado (CountUp)',
    project: 'explainer',
    stillFrame: 150,
    components: ['CountUp'],
  },
  {
    name: 'data-video',
    title: 'Vídeo de dados',
    description: '4:5 com gráfico de barras (BarChart) lido de um JSON',
    project: 'dados',
    stillFrame: 90,
    components: ['BarChart'],
  },
  {
    name: 'audiograma',
    title: 'Audiograma',
    description: '1:1 para podcast, com onda animada (Waveform) e áudio opcional',
    project: 'audiograma',
    stillFrame: 60,
    components: ['Waveform'],
  },
];

export const DEFAULT_TEMPLATE = 'blank';

export function findTemplate(name: string): TemplateInfo | undefined {
  return TEMPLATES.find((t) => t.name === name);
}
