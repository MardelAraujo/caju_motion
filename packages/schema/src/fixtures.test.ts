import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { safeParseProject } from './index';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/projects');

describe('fixtures', () => {
  const ids = readdirSync(FIXTURES);
  it('existem fixtures', () => expect(ids.length).toBeGreaterThanOrEqual(3));

  it.each(ids)('%s é um projeto válido', (id) => {
    const raw = JSON.parse(readFileSync(path.join(FIXTURES, id, 'project.json'), 'utf8'));
    const r = safeParseProject(raw);
    if (!r.success) throw new Error(r.error);
    expect(r.project.id).toBe(id);
  });
});
