import { useAbsoluteFrame } from '@caju-motion/core';
import {
  Component as ReactComponent,
  createContext,
  useContext,
  useSyncExternalStore,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

/**
 * Componentes de usuário (clip `type: 'component'`).
 *
 * Um componente é React determinístico (só depende de `useFrame()`/props) declarado com
 * `defineComponent` na pasta `components/`. O clipe guarda `props.component = <name>` e as props.
 *
 * O renderer NÃO depende de zod: o `schema` é tipado estruturalmente (qualquer objeto com
 * `safeParse`, como um `z.object(...)` do zod 4). O bundle do usuário traz o próprio zod.
 * Campos de cor: `z.string().describe('color')`.
 */

// ---------------------------------------------------------------- schema estrutural

type SafeParseResult = { success: true; data: unknown } | { success: false; error: { issues?: { path: PropertyKey[] }[] } };

/** Mínimo que o renderer usa de um schema (compatível com zod 4). */
export type PropsSchema = {
  safeParse(value: unknown): SafeParseResult;
  _zod?: { def?: unknown };
  description?: string;
};

export type ComponentConfig<P extends object = Record<string, unknown>> = {
  /** Nome único — é o que vai em `clip.props.component`. */
  name: string;
  /** Rótulo na aba Componentes (padrão: `name`). */
  label?: string;
  description?: string;
  /** Schema das props (ex.: `z.object({...})`). Valores inválidos voltam para o padrão. */
  schema?: PropsSchema;
  /** Props padrão (mescladas por cima dos defaults do schema). */
  defaultProps?: Partial<P>;
  /** Caixa padrão em px do projeto (padrão: o quadro inteiro). */
  width?: number;
  height?: number;
  /** Duração padrão ao arrastar para a timeline (frames). */
  durationInFrames?: number;
  component: ComponentType<P>;
};

/** Definição registrada (props apagadas: o registro guarda componentes de tipos diferentes). */
export type ComponentDefinition = Omit<ComponentConfig, 'component' | 'defaultProps'> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  defaultProps?: Record<string, unknown>;
  readonly __caju: 'component';
};

/**
 * Declara um componente. Puro: não registra nada (o Studio/exportador registram os exports
 * de `components/`). Retorna um objeto simples, então funciona mesmo com cópias duplicadas do pacote.
 */
export function defineComponent<P extends object>(config: ComponentConfig<P>): ComponentDefinition {
  if (!config.name || typeof config.name !== 'string') throw new Error('defineComponent: `name` é obrigatório');
  if (typeof config.component !== 'function' && typeof config.component !== 'object') {
    throw new Error(`defineComponent("${config.name}"): \`component\` precisa ser um componente React`);
  }
  return { ...(config as ComponentConfig as Omit<ComponentDefinition, '__caju'>), __caju: 'component' };
}

export function isComponentDefinition(value: unknown): value is ComponentDefinition {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { __caju?: unknown }).__caju === 'component' &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}

// ---------------------------------------------------------------- descrição das props (inspector)

export type PropField =
  | { key: string; kind: 'string'; default: string; label?: string }
  | { key: string; kind: 'color'; default: string; label?: string }
  | { key: string; kind: 'number'; default: number; min?: number; max?: number; step?: number; label?: string }
  | { key: string; kind: 'boolean'; default: boolean; label?: string }
  | { key: string; kind: 'enum'; default: string; options: string[]; label?: string }
  | { key: string; kind: 'json'; default: unknown; label?: string };

type ZDef = { type?: string; innerType?: ZNode; defaultValue?: unknown; shape?: Record<string, ZNode>; entries?: Record<string, unknown>; values?: unknown[]; checks?: ZNode[] };
type ZNode = { _zod?: { def?: ZDef }; description?: string; minValue?: number | null; maxValue?: number | null; isInt?: boolean };

const def = (n: ZNode | undefined): ZDef => (n?._zod?.def ?? {}) as ZDef;

/** Desembrulha optional/default/nullable; devolve o nó base, o default e a descrição mais externa. */
function unwrap(node: ZNode): { node: ZNode; dflt: unknown; description?: string } {
  let cur = node;
  let dflt: unknown;
  let description = node.description;
  for (let i = 0; i < 10; i++) {
    const d = def(cur);
    if ((d.type === 'default' || d.type === 'prefault') && d.innerType) {
      if (dflt === undefined) dflt = typeof d.defaultValue === 'function' ? (d.defaultValue as () => unknown)() : d.defaultValue;
    } else if (!((d.type === 'optional' || d.type === 'nullable' || d.type === 'readonly') && d.innerType)) break;
    cur = d.innerType!;
    description ??= cur.description;
  }
  return { node: cur, dflt, description };
}

function objectShape(schema: PropsSchema | undefined): Record<string, ZNode> | null {
  if (!schema) return null;
  const { node } = unwrap(schema as ZNode);
  const d = def(node);
  return d.type === 'object' && d.shape ? d.shape : null;
}

/** Campos editáveis de um componente (para o inspector do Studio), com defaults resolvidos. */
export function describeProps(defn: Pick<ComponentDefinition, 'schema' | 'defaultProps'>): PropField[] {
  const shape = objectShape(defn.schema);
  const defaults = componentDefaults(defn);
  const fields: PropField[] = [];
  const keys = shape ? Object.keys(shape) : Object.keys(defaults);
  for (const key of keys) {
    if (key === 'component') continue;
    const v = defaults[key];
    if (!shape) {
      fields.push(fieldFromValue(key, v));
      continue;
    }
    const { node, description } = unwrap(shape[key]!);
    const d = def(node);
    const label = description && description !== 'color' ? description : undefined;
    switch (d.type) {
      case 'string':
        fields.push(
          description === 'color' || /^color:?/.test(description ?? '')
            ? { key, kind: 'color', default: typeof v === 'string' ? v : '#FFFFFF' }
            : { key, kind: 'string', default: typeof v === 'string' ? v : '', label },
        );
        break;
      case 'number': {
        const f: PropField = { key, kind: 'number', default: typeof v === 'number' ? v : 0, label };
        if (typeof node.minValue === 'number' && Number.isFinite(node.minValue)) f.min = node.minValue;
        if (typeof node.maxValue === 'number' && Number.isFinite(node.maxValue)) f.max = node.maxValue;
        if (node.isInt) f.step = 1;
        fields.push(f);
        break;
      }
      case 'boolean':
        fields.push({ key, kind: 'boolean', default: typeof v === 'boolean' ? v : false, label });
        break;
      case 'enum': {
        const options = Object.values(d.entries ?? {}).map(String);
        fields.push({ key, kind: 'enum', default: typeof v === 'string' ? v : (options[0] ?? ''), options, label });
        break;
      }
      case 'literal':
        break;
      default:
        fields.push({ key, kind: 'json', default: v, label });
    }
  }
  return fields;
}

function fieldFromValue(key: string, v: unknown): PropField {
  if (typeof v === 'number') return { key, kind: 'number', default: v };
  if (typeof v === 'boolean') return { key, kind: 'boolean', default: v };
  if (typeof v === 'string') return /^#[0-9a-f]{3,8}$/i.test(v) ? { key, kind: 'color', default: v } : { key, kind: 'string', default: v };
  return { key, kind: 'json', default: v };
}

/** Defaults do schema (campos com `.default()`) + `defaultProps`. */
export function componentDefaults(defn: Pick<ComponentDefinition, 'schema' | 'defaultProps'>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const shape = objectShape(defn.schema);
  if (shape) {
    for (const [key, node] of Object.entries(shape)) {
      const { dflt } = unwrap(node);
      if (dflt !== undefined) out[key] = dflt;
    }
  }
  return { ...out, ...(defn.defaultProps ?? {}) };
}

/** Chaves de layout do clipe que não são props do componente. */
const RESERVED = new Set(['component', 'width', 'height']);

/**
 * Props finais do componente: defaults + props do clipe, validadas pelo schema.
 * Campo inválido volta para o default (o vídeo não quebra por uma prop errada).
 */
export function resolveComponentProps(
  defn: Pick<ComponentDefinition, 'schema' | 'defaultProps'>,
  clipProps: Record<string, unknown>,
): { props: Record<string, unknown>; invalid: string[] } {
  const defaults = componentDefaults(defn);
  const given: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(clipProps)) if (!RESERVED.has(k) && v !== undefined) given[k] = v;
  const merged = { ...defaults, ...given };
  const schema = defn.schema;
  if (!schema) return { props: merged, invalid: [] };

  const invalid: string[] = [];
  let candidate = merged;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = schema.safeParse(candidate);
    if (r.success) return { props: { ...(r.data as Record<string, unknown>) }, invalid };
    const bad = new Set((r.error.issues ?? []).map((i) => String(i.path[0] ?? '')).filter(Boolean));
    if (bad.size === 0) break;
    candidate = { ...candidate };
    for (const k of bad) {
      if (!invalid.includes(k)) invalid.push(k);
      if (k in defaults) candidate[k] = defaults[k];
      else delete candidate[k];
    }
  }
  const r = schema.safeParse(defaults);
  return { props: r.success ? { ...(r.data as Record<string, unknown>) } : defaults, invalid: invalid.length ? invalid : Object.keys(given) };
}

// ---------------------------------------------------------------- registro

type Registry = { defs: Map<string, ComponentDefinition>; listeners: Set<() => void>; version: number; snapshot: ComponentDefinition[] };

/** Registro global (em `globalThis`, para sobreviver a cópias duplicadas do pacote). */
function registry(): Registry {
  const g = globalThis as { __cajuComponentRegistry?: Registry };
  g.__cajuComponentRegistry ??= { defs: new Map(), listeners: new Set(), version: 0, snapshot: [] };
  return g.__cajuComponentRegistry;
}

function changed(r: Registry) {
  r.version++;
  r.snapshot = [...r.defs.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const l of r.listeners) l();
}

export function registerComponent(defn: ComponentDefinition): void {
  const r = registry();
  r.defs.set(defn.name, defn);
  changed(r);
}

/** Substitui todo o registro (recarga dos componentes do usuário). */
export function setComponents(defs: Iterable<ComponentDefinition>): void {
  const r = registry();
  r.defs = new Map([...defs].map((d) => [d.name, d]));
  changed(r);
}

export function getComponent(name: string): ComponentDefinition | undefined {
  return registry().defs.get(name);
}

export function listComponents(): ComponentDefinition[] {
  return registry().snapshot;
}

export function subscribeComponents(listener: () => void): () => void {
  const r = registry();
  r.listeners.add(listener);
  return () => r.listeners.delete(listener);
}

/** Versão do registro (muda a cada recarga) — útil para invalidar caches. */
export function componentsVersion(): number {
  return registry().version;
}

/** Hook: lista de componentes registrados, re-renderiza a cada recarga. */
export function useComponents(): ComponentDefinition[] {
  return useSyncExternalStore(subscribeComponents, listComponents, listComponents);
}

/** Recolhe as definições dos exports de um módulo (`export default`, nomeados, arrays). */
export function componentsFromModule(mod: Record<string, unknown>): ComponentDefinition[] {
  const out: ComponentDefinition[] = [];
  const visit = (v: unknown) => {
    if (isComponentDefinition(v)) out.push(v);
    else if (Array.isArray(v)) v.forEach(visit);
  };
  Object.values(mod).forEach(visit);
  return out;
}

// ---------------------------------------------------------------- elemento

/** Caixa (px do projeto) do clipe de componente: props.width/height > padrão do componente > quadro. */
export function componentBox(
  clipProps: Record<string, unknown>,
  defn: Pick<ComponentDefinition, 'width' | 'height'> | undefined,
  frame: { width: number; height: number },
): { width: number; height: number } {
  const w = typeof clipProps.width === 'number' ? clipProps.width : (defn?.width ?? frame.width);
  const h = typeof clipProps.height === 'number' ? clipProps.height : (defn?.height ?? frame.height);
  return { width: Math.max(0, w), height: Math.max(0, h) };
}

class ComponentErrorBoundary extends ReactComponent<
  { name: string; resetKey: unknown; frame: number; width: number; height: number; children: ReactNode },
  { error: Error | null; key: unknown; frame: number }
> {
  override state = { error: null as Error | null, key: this.props.resetKey, frame: this.props.frame };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  /** Erro vale só para aquele frame/versão: outro frame ou recarga tenta de novo. */
  static getDerivedStateFromProps(props: { resetKey: unknown; frame: number }, state: { key: unknown; frame: number }) {
    return props.resetKey !== state.key || props.frame !== state.frame ? { error: null, key: props.resetKey, frame: props.frame } : null;
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[caju] componente "${this.props.name}" falhou:`, error, info.componentStack);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <Placeholder width={this.props.width} height={this.props.height} tone="error">
        {`${this.props.name}: ${this.state.error.message}`}
      </Placeholder>
    );
  }
}

function Placeholder({ width, height, tone, children }: { width: number; height: number; tone: 'missing' | 'error'; children: ReactNode }) {
  const color = tone === 'error' ? '#FF5A5F' : '#F6B73C';
  return (
    <div
      data-caju-placeholder={tone}
      style={{
        boxSizing: 'border-box',
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        border: `4px dashed ${color}`,
        background: `${color}22`,
        color,
        font: '600 32px/1.3 system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

const LocalComponents = createContext<readonly ComponentDefinition[] | null>(null);

/**
 * Componentes só para esta árvore (ex.: um `<Player components={...}>`), sem tocar no registro global.
 * Têm prioridade sobre o registro; nomes que não estão aqui ainda caem no registro.
 */
export function ComponentsProvider({ components, children }: { components: readonly ComponentDefinition[]; children: ReactNode }) {
  return <LocalComponents.Provider value={components}>{children}</LocalComponents.Provider>;
}

/** Desenha um clipe `component`: procura nos componentes locais e no registro, valida props e isola erros. */
export function ComponentElement({
  name,
  props,
  frameSize,
}: {
  name: string;
  /** Props do clipe (já com keyframes aplicados). */
  props: Record<string, unknown>;
  /** Tamanho do quadro do projeto (caixa padrão). */
  frameSize: { width: number; height: number };
}) {
  const local = useContext(LocalComponents);
  const defs = useComponents();
  const frame = useAbsoluteFrame();
  const defn = local?.find((d) => d.name === name) ?? defs.find((d) => d.name === name);
  const { width, height } = componentBox(props, defn, frameSize);
  if (!defn) {
    return (
      <Placeholder width={width} height={height} tone="missing">
        {name ? `componente "${name}" não encontrado` : 'clipe de componente sem props.component'}
      </Placeholder>
    );
  }
  const { props: resolved } = resolveComponentProps(defn, props);
  const C = defn.component as ComponentType<Record<string, unknown>>;
  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      <ComponentErrorBoundary name={name} resetKey={defn} frame={frame} width={width} height={height}>
        <C {...resolved} />
      </ComponentErrorBoundary>
    </div>
  );
}
