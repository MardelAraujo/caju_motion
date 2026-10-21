import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../../../create-caju/src/templates';
import { buildCatalog, searchCatalog, TEMPLATE_ENTRIES } from './catalog';

describe('caju catalog', () => {
  it('lista poses, loops, efeitos, sobreposições e os mesmos templates do create-caju', async () => {
    const all = await buildCatalog();
    const names = (kind: string) => all.filter((e) => e.kind === kind).map((e) => e.name);
    expect(names('transition')).toContain('wipe');
    expect(names('loop')).toContain('float');
    expect(names('effect')).toContain('grayscale');
    expect(names('overlay')).toEqual(['vignette', 'letterbox', 'colorOverlay', 'flash', 'grain']);
    expect(TEMPLATE_ENTRIES.map((t) => [t.name, t.description, t.components])).toEqual(TEMPLATES.map((t) => [t.name, t.description, t.components]));
  });

  it('busca sem acento, por sinônimo e ignorando palavras vazias', async () => {
    const all = await buildCatalog();
    expect(searchCatalog(all, 'faixas de cinema')[0]?.name).toBe('letterbox');
    expect(searchCatalog(all, 'preto e branco')[0]?.name).toBe('grayscale');
    expect(searchCatalog(all, 'cortina')[0]?.name).toBe('wipe');
    expect(searchCatalog(all, 'com de')).toHaveLength(all.length);
  });
});
