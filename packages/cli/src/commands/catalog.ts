import { existsSync } from 'node:fs';
import { EFFECTS, LOOPS, OVERLAYS, POSES } from '@caju-motion/renderer';
import { loadComponentsInNode } from '../components';

/**
 * `caju catalog`: o que já existe pronto (poses de entrada/saída, loops, efeitos, sobreposições,
 * componentes do usuário e templates), com busca por palavra. Os agentes consultam antes de
 * escrever um visual "na mão".
 */

export type CatalogKind = 'transition' | 'loop' | 'effect' | 'overlay' | 'component' | 'template';
export type CatalogEntry = {
  kind: CatalogKind;
  name: string;
  label: string;
  description: string;
  params?: Record<string, unknown>;
  /** Como usar (project.json / video.ts / CLI). */
  usage: string;
};

/** Mesma lista do `create-caju` (o teste garante que não divergem). */
export const TEMPLATE_ENTRIES: { name: string; description: string; components: string[] }[] = [
  { name: 'blank', description: 'um reel 9:16 mínimo, para começar do zero', components: [] },
  { name: 'reel-legendado', description: '9:16 com título, legendas cronometradas pela locução e tarja de nome', components: ['LowerThird'] },
  { name: 'explainer-16x9', description: 'cenas com texto, formas e um contador animado (CountUp)', components: ['CountUp'] },
  { name: 'data-video', description: '4:5 com gráfico de barras (BarChart) lido de um JSON', components: ['BarChart'] },
  { name: 'audiograma', description: '1:1 para podcast, com onda animada (Waveform) e áudio opcional', components: ['Waveform'] },
];

/** Palavras extras para a busca (pt e en), além do nome e do rótulo. */
const KEYWORDS: Record<string, string> = {
  fade: 'esmaecer dissolver aparecer sumir opacidade crossfade dissolve',
  slide: 'deslizar empurrar push lateral entrar sair direcao',
  rise: 'subir surgir fade-up texto titulo',
  drop: 'descer cair fade-down',
  zoom: 'aproximar escala scale zoom-in',
  pop: 'pular saltar elastico bounce destaque',
  blur: 'desfocar foco desfoque',
  spin: 'girar rodar rotacao',
  wipe: 'cortina revelar reveal limpar',
  iris: 'circulo abertura revelar',
  pulse: 'pulsar batida coracao destaque',
  float: 'flutuar boiar suave',
  wiggle: 'balancar tremer chamar atencao',
  breathe: 'respirar brilho suave',
  grayscale: 'preto e branco pb cinza memoria flashback',
  sepia: 'antigo retro vintage',
  dropShadow: 'sombra profundidade',
  hueRotate: 'cor matiz',
  vignette: 'vinheta bordas escuras cinema foco',
  letterbox: 'faixas pretas cinema widescreen cinematografico',
  colorOverlay: 'cor filtro tinta tom',
  flash: 'flash clarao branco transicao impacto',
  grain: 'granulado filme textura ruido analogico',
};

const STOPWORDS = new Set(['com', 'de', 'da', 'do', 'das', 'dos', 'um', 'uma', 'para', 'que', 'em', 'no', 'na', 'and', 'the', 'with', 'for', 'of']);

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export async function buildCatalog(componentsDir?: string): Promise<CatalogEntry[]> {
  const out: CatalogEntry[] = [];
  for (const [name, def] of Object.entries(POSES)) {
    out.push({
      kind: 'transition',
      name,
      label: def.label,
      description: `pose de entrada/saída (easing padrão ${def.easing})`,
      ...('params' in def && def.params ? { params: def.params } : {}),
      usage: `"transitionIn": { "type": "${name}", "duration": 12 } · "animationIn": { "preset": "${name}", "duration": 15 } · video.ts: transitionIn: { type: '${name}', dur: 12 }`,
    });
  }
  for (const [name, def] of Object.entries(LOOPS)) {
    out.push({
      kind: 'loop',
      name,
      label: def.label,
      description: 'animação contínua; duration = período em frames, params.amplitude multiplica',
      usage: `"animationLoop": { "preset": "${name}", "duration": 60, "params": { "amplitude": 1 } } · video.ts: loop: { type: '${name}', dur: 60 }`,
    });
  }
  for (const [name, def] of Object.entries(EFFECTS)) {
    out.push({
      kind: 'effect',
      name,
      label: def.label,
      description: 'filtro no clipe (ou num clipe de ajuste, para tudo abaixo); parâmetros animáveis em effects.<id>.<param>',
      params: def.params,
      usage: `"effects": [{ "id": "fx1", "type": "${name}", "params": {} }] · video.ts: effects: [{ type: '${name}' }] ou s.adjust([{ type: '${name}' }])`,
    });
  }
  for (const [name, def] of Object.entries(OVERLAYS)) {
    out.push({
      kind: 'overlay',
      name,
      label: def.label,
      description: 'clipe "effect" em tela cheia numa trilha de efeitos',
      params: def.params,
      usage: `{ "type": "effect", "props": { "effect": "${name}" } } · video.ts: s.overlay('${name}', {})`,
    });
  }
  if (componentsDir && existsSync(componentsDir)) {
    const loaded = await loadComponentsInNode(componentsDir);
    if (loaded.ok) {
      for (const name of loaded.names) {
        out.push({
          kind: 'component',
          name,
          label: name,
          description: 'componente React do projeto (components/); props aparecem no Studio',
          usage: `{ "type": "component", "props": { "component": "${name}" } } · video.ts: s.component('${name}', {...})`,
        });
      }
    }
  }
  for (const t of TEMPLATE_ENTRIES) {
    out.push({
      kind: 'template',
      name: t.name,
      label: t.name,
      description: `${t.description}${t.components.length ? ` (componentes: ${t.components.join(', ')})` : ''}`,
      usage: `npm create caju@latest meu-video -- --template ${t.name}`,
    });
  }
  return out;
}

/** Busca por palavras (sem acento, qualquer ordem): mais palavras encontradas = mais relevante. */
export function searchCatalog(entries: CatalogEntry[], query: string): CatalogEntry[] {
  const words = fold(query).split(/[^a-z0-9-]+/).filter((w) => w.length > 1 && !STOPWORDS.has(w));
  if (!words.length) return entries;
  const scored = entries.map((e) => {
    const name = fold(e.name);
    const hay = fold(`${e.name} ${e.label} ${e.description} ${KEYWORDS[e.name] ?? ''} ${Object.keys(e.params ?? {}).join(' ')}`);
    const score = words.reduce((n, w) => n + (name === w ? 3 : name.includes(w) ? 2 : hay.includes(w) ? 1 : 0), 0);
    return { e, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.e);
}

const KIND_LABEL: Record<CatalogKind, string> = {
  transition: 'Transições / animações de entrada e saída',
  loop: 'Loops',
  effect: 'Efeitos (filtros)',
  overlay: 'Sobreposições (clipe de efeito)',
  component: 'Componentes do projeto',
  template: 'Templates (npm create caju)',
};

export async function catalogCommand(o: { query?: string; kind?: string; json: boolean; componentsDir: string }): Promise<number> {
  if (o.kind && !(o.kind in KIND_LABEL)) throw new Error(`--kind inválido: ${o.kind} (use ${Object.keys(KIND_LABEL).join(', ')})`);
  let entries = await buildCatalog(o.componentsDir);
  if (o.kind) entries = entries.filter((e) => e.kind === o.kind);
  if (o.query) entries = searchCatalog(entries, o.query);
  if (o.json) {
    console.log(JSON.stringify(entries));
    return 0;
  }
  if (!entries.length) {
    console.log(`nada encontrado${o.query ? ` para "${o.query}"` : ''}; rode sem --query para ver tudo`);
    return 0;
  }
  const kinds = o.query ? [null] : (Object.keys(KIND_LABEL) as CatalogKind[]);
  for (const kind of kinds) {
    const group = kind ? entries.filter((e) => e.kind === kind) : entries;
    if (!group.length) continue;
    if (kind) console.log(`\n${KIND_LABEL[kind]}`);
    for (const e of group) {
      console.log(`  ${e.name.padEnd(14)} ${e.label}${o.query ? ` [${e.kind}]` : ''}`);
      if (o.query) console.log(`  ${''.padEnd(14)} ${e.usage}`);
    }
  }
  return 0;
}
