import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useFrame } from '@caju-motion/core';
import { createEmptyProject, ProjectSchema } from '@caju-motion/schema';
import {
  componentDefaults,
  componentsFromModule,
  ComponentsProvider,
  defineComponent,
  describeProps,
  getComponent,
  listComponents,
  registerComponent,
  resolveComponentProps,
  setComponents,
} from './components';
import { ProjectRenderer } from './ProjectRenderer';

const schema = z.object({
  label: z.string().default('Olá'),
  to: z.number().min(0).max(1000).default(100),
  color: z.string().describe('color').default('#FF0000'),
  mode: z.enum(['a', 'b']).default('a'),
  on: z.boolean().default(true),
  items: z.array(z.string()).default([]),
});

const Counter = defineComponent({
  name: 'Counter',
  schema,
  width: 300,
  height: 100,
  component: ({ label, to }: { label: string; to: number }) => {
    const f = useFrame();
    return <span>{`${label}:${Math.min(f, to)}`}</span>;
  },
});

const Boom = defineComponent({
  name: 'Boom',
  component: () => {
    throw new Error('kaput');
  },
});

afterEach(() => setComponents([]));

describe('defineComponent / registro', () => {
  it('é puro e reconhecido nos exports de um módulo', () => {
    expect(listComponents()).toEqual([]);
    const found = componentsFromModule({ default: Counter, other: [Boom], x: 1 });
    expect(found.map((d) => d.name)).toEqual(['Counter', 'Boom']);
    setComponents(found);
    expect(listComponents().map((d) => d.name)).toEqual(['Boom', 'Counter']);
    registerComponent({ ...Counter, label: 'novo' });
    expect(getComponent('Counter')?.label).toBe('novo');
  });

  it('rejeita definição sem nome', () => {
    expect(() => defineComponent({ name: '', component: () => null })).toThrow();
  });
});

describe('props', () => {
  it('descreve o schema para o inspector', () => {
    const fields = describeProps(Counter);
    expect(fields.map((f) => [f.key, f.kind])).toEqual([
      ['label', 'string'],
      ['to', 'number'],
      ['color', 'color'],
      ['mode', 'enum'],
      ['on', 'boolean'],
      ['items', 'json'],
    ]);
    const to = fields.find((f) => f.key === 'to');
    expect(to).toMatchObject({ default: 100, min: 0, max: 1000 });
    expect(fields.find((f) => f.key === 'mode')).toMatchObject({ options: ['a', 'b'] });
  });

  it('sem schema, infere dos defaultProps', () => {
    const d = { defaultProps: { n: 1, c: '#fff', t: 'x' } };
    expect(describeProps(d).map((f) => f.kind)).toEqual(['number', 'color', 'string']);
    expect(componentDefaults(d)).toEqual({ n: 1, c: '#fff', t: 'x' });
  });

  it('prop inválida volta para o padrão; chaves de layout não vão para o componente', () => {
    const r = resolveComponentProps(Counter, { component: 'Counter', width: 10, to: -5, label: 'Oi' });
    expect(r.props).toMatchObject({ label: 'Oi', to: 100, mode: 'a' });
    expect(r.props).not.toHaveProperty('component');
    expect(r.props).not.toHaveProperty('width');
    expect(r.invalid).toEqual(['to']);
  });
});

function project(component: string, props: Record<string, unknown> = {}) {
  const p = createEmptyProject({ id: 'p', name: 'p', format: 'reel-9x16' });
  return ProjectSchema.parse({
    ...p,
    tracks: [
      {
        id: 't',
        kind: 'overlay',
        clips: [{ id: 'c', type: 'component', start: 10, duration: 50, props: { component, ...props } }],
      },
    ],
  });
}

const html = (proj: ReturnType<typeof project>, frame: number) =>
  renderToStaticMarkup(<ProjectRenderer project={proj} frame={frame} resolveAsset={() => ''} />);

describe('clipe component no ProjectRenderer', () => {
  it('renderiza com frame relativo ao clipe e caixa padrão do componente', () => {
    setComponents([Counter]);
    const out = html(project('Counter', { label: 'N', to: 30 }), 25);
    expect(out).toContain('N:15');
    expect(out).toContain('width:300px');
    expect(html(project('Counter', { to: 30 }), 59)).toContain('Olá:30');
  });

  it('placeholder quando o componente não existe', () => {
    expect(html(project('Nada'), 20)).toContain('não encontrado');
    expect(html(project(''), 20)).toContain('sem props.component');
  });

  it('ComponentsProvider vale só para a árvore e vence o registro global', () => {
    registerComponent(defineComponent({ name: 'Local', component: () => <i>global</i> }));
    const local = defineComponent({ name: 'Local', component: () => <i>local</i> });
    const proj = project('Local');
    const scoped = renderToStaticMarkup(
      <ComponentsProvider components={[local]}>
        <ProjectRenderer project={proj} frame={20} resolveAsset={() => ''} />
      </ComponentsProvider>,
    );
    expect(scoped).toContain('<i>local</i>');
    expect(html(proj, 20)).toContain('<i>global</i>');
  });
});
