import { existsSync } from 'node:fs';
import path from 'node:path';
import { lintProject } from '@caju-motion/renderer';
import { lintDeterminismDir } from '@caju-motion/sdk';
import { createProjectStore } from '@caju-motion/server';
import { loadComponentsInNode, type LoadedComponents } from '../components';

/** Componentes do usuário: compila, aplica o lint de determinismo e lista os nomes. */
async function checkComponents(componentsDir: string, log: (line: string) => void): Promise<{ failures: number; loaded: LoadedComponents | null }> {
  if (!existsSync(componentsDir)) return { failures: 0, loaded: null };
  let failures = 0;
  const rel = path.relative(process.cwd(), componentsDir) || '.';
  const loaded = await loadComponentsInNode(componentsDir);
  if (!loaded.ok) {
    failures++;
    log(`✗ componentes (${rel}):\n    ${loaded.errors.join('\n    ')}`);
  }
  const problems = await lintDeterminismDir(componentsDir);
  if (problems.length) {
    failures++;
    log(`✗ componentes (${rel}): código não determinístico:`);
    for (const p of problems) log(`    ${path.relative(componentsDir, p.file)}:${p.line}  ${p.message}`);
  }
  if (loaded.ok && !problems.length) {
    log(`✓ componentes (${rel}): ${loaded.names.length ? loaded.names.join(', ') : `${loaded.files.length} arquivo(s)`}`);
    if (loaded.skipped) log(`    (${loaded.skipped})`);
  }
  return { failures, loaded };
}

/** Valida todos os projetos de uma pasta (e os componentes). Retorna o exit code. */
export async function checkCommand({ dir, ids, componentsDir, json = false }: { dir: string; ids: string[]; componentsDir?: string; json?: boolean }): Promise<number> {
  // --json: um objeto só no fim (para agentes); sem ele, linhas legíveis
  const log = json ? () => {} : (line: string) => console.log(line);
  const results: { id: string; ok: boolean; problems: string[]; lint: ReturnType<typeof lintProject> }[] = [];
  const store = createProjectStore(dir);
  const comps = componentsDir ? await checkComponents(componentsDir, log) : { failures: 0, loaded: null };
  const known = comps.loaded?.ok && !comps.loaded.skipped ? new Set(comps.loaded.names) : null;

  const summaries = await store.list();
  const targets = ids.length > 0 ? ids : summaries.map((s) => s.id);
  if (targets.length === 0) {
    log(`nenhum projeto encontrado em ${store.root}`);
    if (json) console.log(JSON.stringify({ ok: comps.failures === 0, projects: [] }));
    return comps.failures === 0 ? 0 : 1;
  }

  let failures = 0;
  for (const id of targets) {
    try {
      const project = await store.read(id);
      const problems: string[] = [];
      const missing = await store.missingAssets(project);
      if (missing.length > 0) problems.push(`assets ausentes no disco:\n    ${missing.join('\n    ')}`);

      const used = new Map<string, string[]>();
      for (const t of project.tracks) {
        for (const c of t.clips) {
          if (c.type !== 'component') continue;
          const name = typeof c.props.component === 'string' ? c.props.component : '';
          if (!name) problems.push(`clipe "${c.id}" (component) sem props.component`);
          else used.set(name, [...(used.get(name) ?? []), c.id]);
        }
      }
      if (used.size && !comps.loaded) {
        problems.push(`usa componentes (${[...used.keys()].join(', ')}), mas a pasta de componentes não existe (${componentsDir ?? '--components'})`);
      } else if (known) {
        for (const [name, clips] of used) {
          if (!known.has(name)) problems.push(`componente "${name}" não existe em components/ (clipes: ${clips.join(', ')})`);
        }
      }

      const lint = lintProject(project);
      const describe = (l: (typeof lint)[number]) => `${l.code}${l.clipId ? ` clipe "${l.clipId}"` : ''}: ${l.message}`;
      for (const l of lint.filter((x) => x.severity === 'error')) problems.push(describe(l));
      const warnings = lint.filter((x) => x.severity === 'warn').map(describe);

      if (problems.length) {
        failures++;
        log(`✗ ${id}: ${problems.join('\n  ')}`);
      } else {
        log(`✓ ${id}${warnings.length ? ` (${warnings.length} aviso(s))` : ''}`);
      }
      for (const w of warnings) log(`  ! ${w}`);
      results.push({ id, ok: !problems.length, problems, lint });
    } catch (err) {
      failures++;
      log(`✗ ${id}:\n${String((err as Error).message).replace(/^/gm, '    ')}`);
      results.push({ id, ok: false, problems: [(err as Error).message], lint: [] });
    }
  }
  log(`\n${targets.length - failures}/${targets.length} projeto(s) válidos`);
  if (json) console.log(JSON.stringify({ ok: failures + comps.failures === 0, componentsOk: comps.failures === 0, projects: results }));
  return failures + comps.failures === 0 ? 0 : 1;
}
