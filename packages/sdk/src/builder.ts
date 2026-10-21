/**
 * Construtor de projetos por código (base do `defineProject`).
 *
 * Escreve o vídeo por CENAS, com tempos relativos à cena (como o roteiro), e
 * gera um project.json onde CADA elemento é um clipe separado e editável:
 *  - textos em trilhas de texto, formas/imagens em trilhas de sobreposição;
 *  - dentro de uma cena, a ordem de declaração = ordem de empilhamento;
 *  - trilhas são reaproveitadas entre cenas (camada N da cena A e da cena B
 *    ficam na mesma trilha, já que não se sobrepõem no tempo).
 */
import {
  CURRENT_SCHEMA_VERSION,
  FORMATS,
  ProjectSchema,
  type Asset,
  type AudioSettings,
  type ClipInput,
  type EasingPreset,
  type FormatId,
  type Project,
} from '@caju-motion/schema';

export type KF = [frame: number, value: number | string, easing?: EasingPreset];

export type ElOpts = {
  /** Id fixo do clipe. Padrão: `<cena>-<ordem>-<tipo>` (estável enquanto a ordem no código não mudar). */
  id?: string;
  name?: string;
  /** Janela do clipe relativa à cena. Padrão: [entrada, fim da cena]. */
  at?: [number, number];
  x: number;
  y: number;
  anchorX?: number;
  anchorY?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  flipX?: boolean;
  /** Entrada: fade (+ subida `rise`, deslize `dx`, ou `pop` de escala). */
  enter?: { at: number; dur?: number; rise?: number; dx?: number; pop?: boolean; easing?: EasingPreset };
  /** Travado: não é selecionado por clique no canvas nem arrastado (fundo, luz, vinheta…). */
  locked?: boolean;
  /** Modo de mistura (ex.: 'multiply' para sombra/luz fria, 'soft-light' para luz quente). */
  blend?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'darken' | 'lighten';
  /** Frames de fade no fim do clipe (false = sem saída). Padrão: o da cena. */
  exit?: number | false;
  /** Keyframes extras, em frames RELATIVOS À CENA. */
  kf?: Record<string, KF[]>;
  /**
   * Trilha nomeada (declarada com `builder.tracks()`): clipes com o mesmo nome
   * dividem a trilha; se dois se sobrepuserem no tempo, o excedente vai para
   * "<nome> 2", "<nome> 3"… logo acima. Sem nome: uma camada por elemento da cena.
   */
  track?: string;
  /** Transição de entrada/saída do renderer (fade, slide, rise, zoom, pop, blur, spin, wipe, iris…). */
  transitionIn?: MotionOpts;
  transitionOut?: MotionOpts;
  /** Animação de entrada/saída (mesmas poses das transições, sem easing próprio no schema). */
  animIn?: MotionOpts;
  animOut?: MotionOpts;
  /** Loop: pulse, float, wiggle, breathe, spin (`dur` = período em frames). */
  loop?: { type: string; dur: number; amplitude?: number };
  /** Efeitos (filtros): blur, brightness, contrast, saturate, grayscale, sepia, hueRotate, invert, dropShadow. */
  effects?: { type: string; params?: Record<string, unknown>; id?: string }[];
};

/** Movimento de clipe: `type` = pose, `dur` em frames, `params` (ex.: `{ direction: 'left' }`). */
export type MotionOpts = { type: string; dur: number; easing?: EasingPreset; params?: Record<string, unknown> };

/** Campos de movimento/efeitos do clipe a partir das opções do elemento. */
function motionFields(el: ElOpts, clipId: string): Partial<ClipInput> {
  const tr = (m?: MotionOpts) => m && { type: m.type, duration: m.dur, easing: m.easing ?? undefined, params: m.params ?? {} };
  const an = (m?: MotionOpts) => m && { preset: m.type, duration: m.dur, params: { ...(m.params ?? {}), ...(m.easing ? { easing: m.easing } : {}) } };
  const out: Partial<ClipInput> = {};
  if (el.transitionIn) out.transitionIn = tr(el.transitionIn);
  if (el.transitionOut) out.transitionOut = tr(el.transitionOut);
  if (el.animIn) out.animationIn = an(el.animIn);
  if (el.animOut) out.animationOut = an(el.animOut);
  if (el.loop) out.animationLoop = { preset: el.loop.type, duration: el.loop.dur, params: el.loop.amplitude !== undefined ? { amplitude: el.loop.amplitude } : {} };
  if (el.effects?.length) out.effects = el.effects.map((e, i) => ({ id: e.id ?? `${clipId}-fx${i + 1}`, type: e.type, params: e.params ?? {} }));
  return out;
}

export type TextStyle = {
  size: number;
  weight?: number;
  /** Fontes embutidas no Studio; outras famílias só com fontes locais (public/fonts/local). */
  font?: 'Plus Jakarta Sans' | 'Red Hat Display' | (string & {});
  color?: string;
  align?: 'left' | 'center' | 'right';
  spacing?: number;
  lh?: number;
  bg?: string;
};

/** Tamanho da caixa de um componente (padrão: tamanho do projeto). */
export type ComponentBox = { width?: number; height?: number };

/** Opções de um clipe de componente: como `ElOpts`, mas a posição padrão é o centro do quadro. */
export type ComponentOpts = Omit<ElOpts, 'x' | 'y'> & Partial<Pick<ElOpts, 'x' | 'y'>> & ComponentBox;

type Pending = { scene: number; order: number; lane: 'text' | 'visual'; clip: ClipInput; track?: string };

export class SceneCtx {
  private order = 0;
  constructor(
    private readonly b: ProjectBuilder,
    readonly index: number,
    readonly id: string,
    readonly from: number,
    readonly to: number,
    private readonly exitDefault: number,
  ) {}

  get duration() {
    return this.to - this.from;
  }

  /** `el.align` (atalho) define alinhamento E âncora: left → x é a borda esquerda, right → a direita. */
  text(text: string, style: TextStyle, el: ElOpts & { align?: TextStyle['align'] }) {
    const align = el.align ?? style.align ?? 'center';
    const anchorX = el.anchorX ?? (align === 'left' ? 0 : align === 'right' ? 1 : 0.5);
    return this.push('text', 'text', { ...el, anchorX }, {
      text,
      fontFamily: style.font ?? 'Plus Jakarta Sans',
      fontSize: style.size,
      fontWeight: style.weight ?? 400,
      color: style.color ?? '#F3F3F0',
      align,
      lineHeight: style.lh ?? 1.15,
      letterSpacing: style.spacing ?? 0,
      background: style.bg ?? '',
    }, el.name ?? text.split('\n')[0]!.slice(0, 40));
  }

  /**
   * Legendas: um clipe de texto por linha (cue), com tempos em SEGUNDOS desde o início da cena
   * (`offsetSec` desloca todas). Cues vêm de `readCaptions()`/`voiceover()` do @caju-motion/voice,
   * de um SRT, ou escritas à mão. Linhas seguidas nunca se sobrepõem.
   */
  captions(
    cues: { text: string; start: number; end: number }[],
    style: TextStyle,
    el: Omit<ElOpts, 'at' | 'id' | 'enter' | 'name'> & { idPrefix?: string; offsetSec?: number; pop?: boolean },
  ) {
    const { idPrefix = `${this.id}-legenda`, offsetSec = 0, pop = true, ...rest } = el;
    const spans = cues.map((c) => ({
      c,
      from: Math.max(0, this.b.sec(c.start + offsetSec)),
      to: this.b.sec(c.end + offsetSec),
    }));
    return spans.map(({ c, from, to }, i) => {
      const end = Math.max(from + 1, Math.min(to, spans[i + 1]?.from ?? Infinity));
      return this.text(c.text, style, {
        exit: false,
        ...rest,
        id: `${idPrefix}-${i + 1}`,
        at: [from, end],
        enter: pop ? { at: from, dur: Math.min(6, end - from), pop: true } : { at: from, dur: 1 },
      });
    });
  }

  rect(w: number, h: number, look: { fill?: string; stroke?: string; sw?: number; ellipse?: boolean }, el: ElOpts) {
    return this.push('shape', 'visual', el, {
      shape: look.ellipse ? 'ellipse' : 'rect',
      width: w,
      height: h,
      fill: look.fill ?? '',
      stroke: look.stroke ?? '',
      strokeWidth: look.stroke ? (look.sw ?? 2) : 0,
    }, el.name ?? (look.ellipse ? 'Círculo' : 'Retângulo'));
  }

  image(assetId: string, w: number, h: number, el: ElOpts) {
    const asset = this.b.getAsset(assetId);
    return this.push('image', 'visual', el, { width: w, height: h }, el.name ?? asset.name ?? assetId, assetId);
  }

  /**
   * Componente React registrado com `defineComponent` (pasta `components/`).
   * Gera um clipe `type: 'component'` com `props.component = name` + as props dadas.
   */
  component(name: string, props: Record<string, unknown>, el: ComponentOpts = {}) {
    const { width, height } = this.b.settings;
    const box: Record<string, unknown> = {};
    if (el.width !== undefined) box.width = el.width;
    if (el.height !== undefined) box.height = el.height;
    const pos = { ...el, x: el.x ?? width / 2, y: el.y ?? height / 2 };
    return this.push('component', 'visual', pos, { ...props, ...box, component: name }, el.name ?? name);
  }

  /** Sobreposição em tela cheia (vignette, letterbox, colorOverlay, flash, grain). */
  overlay(effect: string, params: Record<string, unknown> = {}, el: Omit<Partial<ElOpts>, 'x' | 'y'> = {}) {
    return this.push('effect', 'visual', { ...el, x: 0, y: 0 }, { ...params, effect }, el.name ?? effect);
  }

  /** Clipe de ajuste: aplica os efeitos a tudo o que está abaixo dele (declare depois das camadas). */
  adjust(effects: NonNullable<ElOpts['effects']>, el: Omit<Partial<ElOpts>, 'x' | 'y' | 'effects'> = {}) {
    return this.push('adjustment', 'visual', { ...el, x: 0, y: 0, effects }, {}, el.name ?? 'Ajuste');
  }

  private push(
    type: 'text' | 'shape' | 'image' | 'component' | 'effect' | 'adjustment',
    lane: 'text' | 'visual',
    el: ElOpts,
    props: Record<string, unknown>,
    name: string,
    assetId?: string,
  ) {
    const a0 = el.at?.[0] ?? el.enter?.at ?? 0;
    const a1 = Math.min(el.at?.[1] ?? this.duration, this.duration);
    if (a1 <= a0) throw new Error(`[${this.id}] "${name}": janela vazia (${a0}–${a1})`);

    const opacity = el.opacity ?? 1;
    const scale = el.scale ?? 1;
    const tracks: Record<string, KF[]> = {};
    const add = (path: string, k: KF) => (tracks[path] ??= []).push(k);

    if (el.enter) {
      const { at, dur = 18, rise, dx, pop, easing = 'softOut' } = el.enter;
      add('opacity', [at, 0, easing]);
      add('opacity', [at + dur, opacity]);
      if (rise) {
        add('transform.y', [at, el.y + rise, easing]);
        add('transform.y', [at + dur, el.y]);
      }
      if (dx) {
        add('transform.x', [at, el.x + dx, easing]);
        add('transform.x', [at + dur, el.x]);
      }
      if (pop) {
        add('transform.scale', [at, scale * 0.6, 'backOut']);
        add('transform.scale', [at + dur, scale]);
      }
    }
    const exit = el.exit === undefined ? this.exitDefault : el.exit;
    if (exit && a1 === this.duration) {
      add('opacity', [a1 - exit, opacity, 'easeIn']);
      add('opacity', [a1 - 1, 0]);
    }
    for (const [path, list] of Object.entries(el.kf ?? {})) for (const k of list) add(path, k);

    // frames relativos ao clipe, dentro de [0, duração); último valor por frame vence
    const keyframes: Record<string, { frame: number; value: number | string; easing: EasingPreset }[]> = {};
    for (const [path, list] of Object.entries(tracks)) {
      const byFrame = new Map<number, { frame: number; value: number | string; easing: EasingPreset }>();
      for (const [f, value, easing] of list.sort((p, q) => p[0] - q[0])) {
        const frame = Math.round(f - a0);
        if (frame < 0 || frame >= a1 - a0) continue;
        byFrame.set(frame, { frame, value, easing: easing ?? 'linear' });
      }
      if (byFrame.size) keyframes[path] = [...byFrame.values()].sort((p, q) => p.frame - q.frame);
    }

    const clip: ClipInput = {
      id: el.id ?? `${this.id}-${String(this.order).padStart(2, '0')}-${type}`,
      type,
      name,
      start: this.from + a0,
      duration: a1 - a0,
      assetId,
      transform: {
        x: el.x,
        y: el.y,
        scale,
        rotation: el.rotation ?? 0,
        anchorX: el.anchorX ?? 0.5,
        anchorY: el.anchorY ?? 0.5,
        flipX: el.flipX ?? false,
        flipY: false,
      },
      opacity,
      blendMode: el.blend ?? 'normal',
      locked: el.locked ?? false,
      keyframes,
      props,
      origin: 'code',
    };
    Object.assign(clip, motionFields(el, clip.id));
    this.b.pending.push({ scene: this.index, order: this.order++, lane, clip, ...(el.track ? { track: el.track } : {}) });
    return clip;
  }
}

export type BuilderOptions = {
  id: string;
  name?: string;
  format: FormatId;
  background?: string;
  /** Duração em frames. Omitida: fim do último clipe. */
  duration?: number;
  /** Mixagem do export: ducking da música sob a locução e loudness final. */
  audio?: Partial<{ ducking: Partial<NonNullable<AudioSettings['ducking']>>; loudness: Partial<NonNullable<AudioSettings['loudness']>> }>;
};

/**
 * Ids são globais no projeto (assets, trilhas, clipes, marcadores). Os ids de trilha gerados aqui
 * (`locucao`, `texto-1`, `audio-sfx-0`…) ganham o sufixo `-trilha` (`-trilha-2`…) só quando colidem
 * com algum outro id; sem colisão ficam iguais, então projetos existentes não mudam.
 */
function uniqueTrackIds<T extends { id: string; clips: { id: string }[] }>(tracks: T[], otherIds: string[]): T[] {
  const taken = new Set([...otherIds, ...tracks.flatMap((t) => t.clips.map((c) => c.id))]);
  const out: T[] = [];
  for (const t of tracks) {
    let id = t.id;
    for (let n = 1; taken.has(id); n++) id = n === 1 ? `${t.id}-trilha` : `${t.id}-trilha-${n}`;
    taken.add(id);
    out.push(id === t.id ? t : { ...t, id });
  }
  return out;
}

export class ProjectBuilder {
  readonly pending: Pending[] = [];
  private assets: Asset[] = [];
  private audio: ClipInput[] = [];
  private markers: Project['markers'] = [];
  private sceneCount = 0;
  private trackOrder: string[] = [];
  private root: SceneCtx | null = null;

  constructor(private readonly opts: BuilderOptions) {}

  /** Configuração do projeto (formato, tamanho e fps já resolvidos). */
  get settings() {
    const f = FORMATS[this.opts.format];
    return { format: this.opts.format, width: f.width, height: f.height, fps: f.fps, duration: this.opts.duration };
  }

  /** Converte segundos em frames inteiros do projeto. */
  sec(seconds: number): number {
    return Math.round(seconds * this.settings.fps);
  }

  asset(a: Asset) {
    this.assets.push(a);
    return a.id;
  }

  getAsset(id: string): Asset {
    const a = this.assets.find((x) => x.id === id);
    if (!a) throw new Error(`asset "${id}" não registrado`);
    return a;
  }

  /** Declara as trilhas nomeadas, de BAIXO para CIMA (ordem de empilhamento). */
  tracks(names: string[]) {
    this.trackOrder = names;
  }

  marker(id: string, frame: number, label: string) {
    this.markers.push({ id: `m-${id}`, frame, label, color: '#F6B73C' });
  }

  scene(
    id: string,
    label: string,
    from: number,
    to: number,
    build: (s: SceneCtx) => void,
    opts: { exit?: number; marker?: boolean } = {},
  ) {
    if (opts.marker !== false) this.marker(id, from, label);
    build(new SceneCtx(this, this.sceneCount++, id, from, to, opts.exit ?? 10));
  }

  /**
   * Componente fora de cena, com tempos ABSOLUTOS (`el.at`, padrão: o vídeo inteiro).
   * Sem `at`, o projeto precisa de `duration`. Vai para a trilha nomeada `el.track` (padrão "Componentes"),
   * abaixo das camadas das cenas; para ficar por cima, declare-o dentro de uma cena.
   */
  component(name: string, props: Record<string, unknown>, el: ComponentOpts = {}) {
    const end = el.at?.[1] ?? this.opts.duration;
    if (end === undefined) throw new Error(`componente "${name}": informe \`at\` ou a duração do projeto`);
    this.root ??= new SceneCtx(this, this.sceneCount++, 'root', 0, Number.MAX_SAFE_INTEGER, 0);
    // fora de cena o clipe se sobrepõe às cenas: vai para uma trilha nomeada (com transbordo automático)
    return this.root.component(name, props, { exit: false, track: 'Componentes', ...el, at: [el.at?.[0] ?? 0, end] });
  }

  audioClip(
    assetId: string,
    start: number,
    duration: number,
    name: string,
    opts: { volume?: number; fadeIn?: number; fadeOut?: number; id?: string; trimIn?: number } = {},
  ) {
    this.audio.push({
      id: opts.id ?? `vo-${assetId}`,
      type: 'audio',
      name,
      assetId,
      start,
      duration,
      trimIn: opts.trimIn ?? 0,
      audio: { volume: opts.volume ?? 1, fadeIn: opts.fadeIn ?? 0, fadeOut: opts.fadeOut ?? 0, pan: 0 },
      origin: 'code',
    });
  }

  /** Trilhas nomeadas, com transbordo automático quando há sobreposição. */
  private namedTracks() {
    const named = this.pending.filter((p) => p.track);
    const order = [...this.trackOrder];
    for (const p of named) if (!order.includes(p.track!)) order.push(p.track!);
    const out: { id: string; kind: 'overlay' | 'text'; name: string; clips: ClipInput[] }[] = [];
    order.forEach((name, i) => {
      const clips = named.filter((p) => p.track === name).map((p) => p.clip).sort((a, b) => a.start - b.start);
      if (!clips.length) return;
      const lanes: ClipInput[][] = [];
      for (const c of clips) {
        const lane = lanes.find((l) => l[l.length - 1]!.start + l[l.length - 1]!.duration <= c.start);
        if (lane) lane.push(c);
        else lanes.push([c]);
      }
      const kind = clips.every((c) => c.type === 'text') ? 'text' : 'overlay';
      lanes.forEach((l, j) =>
        out.push({ id: `t${String(i).padStart(2, '0')}-${j}`, kind, name: j === 0 ? name : `${name} ${j + 1}`, clips: l }),
      );
    });
    return out;
  }

  /** Áudio: uma trilha por prefixo de id (vo-, amb-, sfx-), sem sobreposição. */
  private audioTracks() {
    const groups: Record<string, { name: string; clips: ClipInput[] }> = {};
    const label: Record<string, string> = { vo: 'Locução', mus: 'Trilha sonora', amb: 'Ambiente', sfx: 'Efeitos' };
    for (const c of this.audio) {
      const key = c.id.split('-')[0]!;
      (groups[key] ??= { name: label[key] ?? 'Áudio', clips: [] }).clips.push(c);
    }
    const role: Record<string, 'voice' | 'music' | 'sfx'> = { vo: 'voice', mus: 'music', amb: 'music', sfx: 'sfx' };
    const out: { id: string; kind: 'audio'; name: string; role?: 'voice' | 'music' | 'sfx'; clips: ClipInput[] }[] = [];
    for (const [key, g] of Object.entries(groups)) {
      const lanes: ClipInput[][] = [];
      for (const c of g.clips.sort((a, b) => a.start - b.start)) {
        const lane = lanes.find((l) => l[l.length - 1]!.start + l[l.length - 1]!.duration <= c.start);
        if (lane) lane.push(c);
        else lanes.push([c]);
      }
      lanes.forEach((l, j) =>
        out.push({
          id: key === 'vo' && j === 0 ? 'locucao' : `audio-${key}-${j}`,
          kind: 'audio',
          name: j ? `${g.name} ${j + 1}` : g.name,
          ...(role[key] ? { role: role[key] } : {}),
          clips: l,
        }),
      );
    }
    return out;
  }

  build(): Project {
    // camada = posição do elemento entre os do mesmo tipo na sua cena
    const layer = new Map<Pending, number>();
    const counters = new Map<string, number>();
    for (const p of this.pending) {
      if (p.track) continue;
      const key = `${p.scene}:${p.lane}`;
      const n = counters.get(key) ?? 0;
      layer.set(p, n);
      counters.set(key, n + 1);
    }
    const unnamed = this.pending.filter((p) => !p.track);
    const maxVisual = Math.max(0, ...unnamed.filter((p) => p.lane === 'visual').map((p) => layer.get(p)! + 1));
    const maxText = Math.max(0, ...unnamed.filter((p) => p.lane === 'text').map((p) => layer.get(p)! + 1));

    const visualTracks = Array.from({ length: maxVisual }, (_, i) => ({
      id: `camada-${i + 1}`,
      kind: 'overlay' as const,
      name: `Camada ${i + 1}`,
      clips: unnamed.filter((p) => p.lane === 'visual' && layer.get(p) === i).map((p) => p.clip),
    }));
    const textTracks = Array.from({ length: maxText }, (_, i) => ({
      id: `texto-${i + 1}`,
      kind: 'text' as const,
      name: `Texto ${i + 1}`,
      clips: unnamed.filter((p) => p.lane === 'text' && layer.get(p) === i).map((p) => p.clip),
    }));

    const f = FORMATS[this.opts.format];
    const tracks = uniqueTrackIds(
      [
        { id: 'main', kind: 'main' as const, name: 'Principal', clips: [] as ClipInput[] },
        ...this.namedTracks(),
        ...visualTracks,
        ...textTracks,
        ...this.audioTracks(),
      ],
      [...this.assets.map((a) => a.id), ...this.markers.map((m) => m.id)],
    );
    return ProjectSchema.parse({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: this.opts.id,
      name: this.opts.name ?? this.opts.id,
      settings: {
        format: this.opts.format,
        width: f.width,
        height: f.height,
        fps: f.fps,
        background: this.opts.background ?? '#000000',
        ...(this.opts.duration !== undefined ? { duration: this.opts.duration } : {}),
        ...(this.opts.audio ? { audio: this.opts.audio } : {}),
      },
      assets: this.assets,
      tracks,
      markers: this.markers,
      meta: { generator: 'caju-motion/sdk' },
    });
  }
}
