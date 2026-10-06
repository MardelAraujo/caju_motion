import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi } from './api';
import { buildComponentsBundle, componentEntries, componentsRoutes, componentsVersion } from './components';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'caju-components-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const COUNTER = `
import { useFrame } from '@caju-motion/core';
import { defineComponent } from '@caju-motion/renderer';
import { label } from './lib/text';
export default defineComponent({ name: 'Counter', component: () => <b>{label(useFrame())}</b> });
`;

describe('bundle de componentes', () => {
  it('lista entradas (topo + pasta/index), ignora testes e helpers', async () => {
    await mkdir(path.join(dir, 'lib'));
    await mkdir(path.join(dir, 'Card'));
    await writeFile(path.join(dir, 'Counter.tsx'), COUNTER);
    await writeFile(path.join(dir, 'Counter.test.tsx'), '');
    await writeFile(path.join(dir, 'lib', 'text.ts'), 'export const label = (n: number) => `n=${n}`;');
    await writeFile(path.join(dir, 'Card', 'index.tsx'), 'export const x = 1;');
    const entries = (await componentEntries(dir)).map((f) => path.relative(dir, f).split(path.sep).join('/'));
    expect(entries).toEqual(['Card/index.tsx', 'Counter.tsx']);
  });

  it('empacota com React/Caju vindos de globalThis.__cajuRuntime e avalia', async () => {
    await mkdir(path.join(dir, 'lib'));
    await writeFile(path.join(dir, 'Counter.tsx'), COUNTER);
    await writeFile(path.join(dir, 'lib', 'text.ts'), 'export const label = (n: number) => `n=${n}`;');
    const r = await buildComponentsBundle(dir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('__cajuRuntime');
    expect(r.code).not.toMatch(/function useState\b/);

    const React = await import('react');
    const jsx = await import('react/jsx-runtime');
    const core = await import('@caju-motion/core');
    const renderer = await import('@caju-motion/renderer');
    (globalThis as Record<string, unknown>).__cajuRuntime = { react: React, 'react/jsx-runtime': jsx, '@caju-motion/core': core, '@caju-motion/renderer': renderer };
    const mod = (await import(`data:text/javascript;base64,${Buffer.from(r.code).toString('base64')}`)) as { modules: Record<string, unknown>[] };
    const defs = mod.modules.flatMap((m) => renderer.componentsFromModule(m));
    expect(defs.map((d) => d.name)).toEqual(['Counter']);
    delete (globalThis as Record<string, unknown>).__cajuRuntime;
  });

  it('erro de compilação vira lista de mensagens com arquivo:linha', async () => {
    await writeFile(path.join(dir, 'Bad.tsx'), 'export const x = <div>;\n');
    const r = await buildComponentsBundle(dir);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatch(/^Bad\.tsx:\d+:\d+: /);
  });

  it('pasta vazia/inexistente → bundle vazio; versão muda quando um arquivo muda', async () => {
    expect((await buildComponentsBundle(path.join(dir, 'nada'))).ok).toBe(true);
    expect(await componentsVersion(dir)).toBe('empty');
    await writeFile(path.join(dir, 'A.tsx'), 'export const a = 1;');
    const v1 = await componentsVersion(dir);
    await writeFile(path.join(dir, 'A.tsx'), 'export const a = 22;');
    expect(await componentsVersion(dir)).not.toBe(v1);
  });

  it('rotas /api/components', async () => {
    await writeFile(path.join(dir, 'Counter.tsx'), COUNTER.replace("import { label } from './lib/text';", 'const label = String;'));
    const api = createApi({ projectsDir: path.join(dir, 'projects'), extensions: [componentsRoutes({ componentsDir: dir })] });
    const v = await (await api.request('/api/components/version')).json();
    expect(v).toMatchObject({ ok: true, files: ['Counter.tsx'] });
    const b = await api.request('/api/components/bundle.js');
    expect(b.status).toBe(200);
    expect(b.headers.get('content-type')).toContain('javascript');
    expect(b.headers.get('x-caju-components-version')).toBe(v.version);

    await writeFile(path.join(dir, 'Counter.tsx'), 'export const = ;');
    const bad = await api.request('/api/components/bundle.js');
    expect(bad.status).toBe(422);
    expect((await (await api.request('/api/components/version')).json()).ok).toBe(false);
  });
});
