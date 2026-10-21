import { existsSync } from 'node:fs';
import path from 'node:path';
import { captureSite } from '@caju-motion/renderer-node';
import { assertProjectId } from '@caju-motion/server';

/**
 * `caju capture <url> --project <id>`: screenshots, cores, fontes, textos e imagens do site em
 * `assets/capture/` do projeto, para montar o vídeo com o material real da marca.
 */
export async function captureCommand(o: { dir: string; url: string | undefined; project?: string; width?: string; height?: string; json: boolean }): Promise<number> {
  if (!o.url || !o.project) throw new Error('uso: caju capture <url> --project <id> [--width 1440] [--height 900] [--json]');
  assertProjectId(o.project);
  const projectDir = path.resolve(o.dir, o.project);
  if (!existsSync(projectDir)) throw new Error(`projeto "${o.project}" não encontrado em ${path.resolve(o.dir)} (crie com caju new)`);
  const size = (v: string | undefined, fallback: number, flag: string) => {
    if (v === undefined) return fallback;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 320 || n > 3840) throw new Error(`${flag} precisa ser um inteiro entre 320 e 3840`);
    return n;
  };
  const r = await captureSite(o.url, path.join(projectDir, 'assets', 'capture'), {
    width: size(o.width, 1440, '--width'),
    height: size(o.height, 900, '--height'),
  });
  const rel = (f: string) => path.relative(projectDir, f).split(path.sep).join('/');
  if (o.json) {
    console.log(JSON.stringify({ files: Object.fromEntries(Object.entries(r.files).map(([k, v]) => [k, rel(v)])), tokens: r.tokens, images: r.images.length }));
    return 0;
  }
  console.log(`✓ ${o.url} → ${rel(r.dir)}/`);
  console.log(`  ${r.tokens.title || '(sem título)'}`);
  const colors = (role: string) => r.tokens.colors.filter((c) => c.role === role).map((c) => c.hex).join(' ');
  console.log(`  fundo: ${colors('background') || '—'} · texto: ${colors('text') || '—'} · destaque: ${colors('accent') || '—'}`);
  console.log(`  fontes: ${r.tokens.fonts.map((f) => `${f.family} (${f.role}, ${f.weights.join('/')})`).join(', ') || '—'}`);
  console.log(`  ${r.images.length} imagem(ns) (${r.images.filter((i) => i.logo).length} possível(is) logo), ${r.textChars} caracteres de texto`);
  console.log(`  arquivos: ${Object.values(r.files).map(rel).join(', ')}`);
  return 0;
}
