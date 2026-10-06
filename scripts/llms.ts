/**
 * Generates the llms.txt files of the docs site and validates the docs.
 *
 *   npx tsx scripts/llms.ts           validate + write docs-site/public/llms.txt and llms-full.txt
 *   npx tsx scripts/llms.ts --check   validate only (frontmatter, EN/PT parity, internal links); writes nothing
 *
 * - llms.txt: index (llmstxt.org convention), one line per English page: [title](absolute URL): description.
 * - llms-full.txt: every English page as Markdown (links made absolute), followed by the Agent Skills.
 * Output is deterministic: fixed page order, sorted skills, LF line endings, no timestamps.
 * `DOCS_SITE_URL` overrides the site URL (default: the GitHub Pages project site).
 * Exits non-zero when a page is missing, unlisted, lacks title/description, has no Portuguese
 * counterpart, or links to a page that doesn't exist.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs-site');
const SKILLS = path.join(ROOT, 'packages', 'skills', 'skills');
const DEFAULT_SITE_URL = 'https://mardelaraujo.github.io/caju_motion';

/** English pages in reading order (= sidebar order). Paths relative to docs-site, without `.md`. */
export const SECTIONS: { title: string; pages: string[] }[] = [
  { title: 'Overview', pages: ['index'] },
  {
    title: 'Introduction',
    pages: ['guide/getting-started', 'guide/project-structure', 'guide/concepts', 'guide/comparison'],
  },
  {
    title: 'Guides',
    pages: [
      'guide/video-by-code',
      'guide/components',
      'guide/animation',
      'guide/assets',
      'guide/audio',
      'guide/voice-captions',
      'guide/studio',
      'guide/rendering',
      'guide/ai-agents',
    ],
  },
  { title: 'Reference', pages: ['reference/cli', 'reference/core', 'reference/player', 'reference/media', 'reference/project-json', 'reference/formats'] },
  { title: 'Project', pages: ['roadmap', 'license', 'contributing'] },
];

const LOCALES = ['pt'];
const SKIP_DIRS = new Set(['.vitepress', 'public', 'node_modules', ...LOCALES]);

export type Page = { id: string; file: string; data: Record<string, string>; body: string; raw: string };

const lf = (s: string) => s.replace(/\r\n?/g, '\n');

/** Minimal frontmatter parser: top-level `key: value` pairs (nested YAML is kept in `raw`). */
export function parseFrontmatter(source: string): { data: Record<string, string>; body: string; yaml: string } {
  const text = lf(source);
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { data: {}, body: text, yaml: '' };
  const yaml = m[1]!;
  const data: Record<string, string> = {};
  for (const line of yaml.split('\n')) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv || !kv[2]) continue;
    data[kv[1]!] = kv[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return { data, body: text.slice(m[0].length), yaml };
}

function listMarkdown(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (rel === '' && SKIP_DIRS.has(name)) continue;
      out.push(...listMarkdown(full, rel ? `${rel}/${name}` : name));
    } else if (name.endsWith('.md')) {
      out.push((rel ? `${rel}/${name}` : name).replace(/\.md$/, ''));
    }
  }
  return out;
}

function readPage(id: string, base = DOCS): Page | null {
  const file = path.join(base, `${id}.md`);
  if (!existsSync(file)) return null;
  const raw = lf(readFileSync(file, 'utf8'));
  const { data, body } = parseFrontmatter(raw);
  return { id, file, data, body, raw };
}

export function pageUrl(siteUrl: string, id: string): string {
  if (id === 'index') return `${siteUrl}/`;
  if (id.endsWith('/index')) return `${siteUrl}/${id.slice(0, -'index'.length)}`;
  return `${siteUrl}/${id}`;
}

/** Resolves a Markdown link target from page `fromId` to a page id, or null if external/anchor-only. */
export function resolveLink(fromId: string, target: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('//')) return null;
  let p = target.split('#')[0]!.split('?')[0]!;
  if (!p) return null;
  p = p.replace(/\.(md|html)$/, '');
  const resolved = p.startsWith('/') ? p.slice(1) : path.posix.join(path.posix.dirname(fromId), p);
  const clean = path.posix.normalize(resolved).replace(/^\.\//, '');
  if (clean === '' || clean === '.') return 'index';
  return clean.endsWith('/') ? `${clean}index` : clean;
}

const LINK_RE = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** Strips fenced code blocks so example links inside code are not checked or rewritten. */
function splitFences(body: string): { text: string; code: boolean }[] {
  const parts: { text: string; code: boolean }[] = [];
  const re = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;
  let last = 0;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index), code: false });
    parts.push({ text: m[0], code: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last), code: false });
  return parts;
}

function pageExists(id: string): boolean {
  return existsSync(path.join(DOCS, `${id}.md`));
}

/** Validation problems for the whole site (empty array = ok). */
export function validateDocs(): string[] {
  const problems: string[] = [];
  const listed = SECTIONS.flatMap((s) => s.pages);
  const found = listMarkdown(DOCS);

  for (const id of listed) if (!found.includes(id)) problems.push(`listed page is missing: docs-site/${id}.md`);
  for (const id of found) if (!listed.includes(id)) problems.push(`page not listed in scripts/llms.ts SECTIONS: docs-site/${id}.md`);

  const check = (page: Page) => {
    const rel = path.relative(ROOT, page.file).replace(/\\/g, '/');
    if (!page.data.title) problems.push(`${rel}: frontmatter needs a title`);
    if (!page.data.description) problems.push(`${rel}: frontmatter needs a description`);
    for (const part of splitFences(page.body)) {
      if (part.code) continue;
      for (const m of part.text.matchAll(LINK_RE)) {
        const target = resolveLink(page.id, m[1]!);
        if (target && !pageExists(target)) problems.push(`${rel}: broken link "${m[1]}"`);
      }
    }
  };

  for (const id of listed) {
    const en = readPage(id);
    if (!en) continue;
    check(en);
    for (const locale of LOCALES) {
      const tr = readPage(`${locale}/${id}`);
      if (!tr) problems.push(`missing translation: docs-site/${locale}/${id}.md`);
      else check(tr);
    }
  }
  for (const locale of LOCALES) {
    for (const id of listMarkdown(path.join(DOCS, locale))) {
      if (!listed.includes(id)) problems.push(`translation without English page: docs-site/${locale}/${id}.md`);
    }
  }
  return problems;
}

/** Turns VitePress-only Markdown into plain Markdown and makes internal links absolute. */
export function toPlainMarkdown(page: Page, siteUrl: string): string {
  const out = splitFences(page.body).map((part) => {
    if (part.code) return part.text;
    return part.text
      .replace(/^(#{1,6} .*?)\s*\{#[\w-]+\}\s*$/gm, '$1')
      .replace(/^:::\s*(\w+)\s*(.*)$/gm, (_m, kind: string, title: string) => `> **${title || kind[0]!.toUpperCase() + kind.slice(1)}**`)
      .replace(/^:::\s*$/gm, '')
      .replace(LINK_RE, (whole, target: string) => {
        const id = resolveLink(page.id, target);
        if (!id) return whole;
        const hash = target.includes('#') ? `#${target.split('#')[1]}` : '';
        return `](${pageUrl(siteUrl, id)}${hash})`;
      });
  });
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

/** The home page is mostly frontmatter (hero + features): render it as Markdown. */
function homeMarkdown(page: Page, siteUrl: string): string {
  const { yaml } = parseFrontmatter(page.raw);
  const field = (name: string) => new RegExp(`^\\s+${name}:\\s*(.+)$`, 'm').exec(yaml)?.[1]?.trim().replace(/^"(.*)"$/, '$1') ?? '';
  const features: string[] = [];
  const re = /^\s+- title:\s*(.+)\n\s+details:\s*(.+)$/gm;
  for (let m = re.exec(yaml); m; m = re.exec(yaml)) {
    features.push(`- **${m[1]!.trim()}**: ${m[2]!.trim().replace(/^"(.*)"$/, '$1')}`);
  }
  return [
    `# ${field('name') || page.data.title}`,
    `> ${field('text')} ${field('tagline')}`.trim(),
    features.join('\n'),
    toPlainMarkdown(page, siteUrl),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function skillFiles(): string[] {
  if (!existsSync(SKILLS)) return [];
  const files: string[] = [];
  for (const skill of readdirSync(SKILLS).sort()) {
    const dir = path.join(SKILLS, skill);
    if (!statSync(dir).isDirectory()) continue;
    const mds = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort((a, b) => (a === 'SKILL.md' ? -1 : b === 'SKILL.md' ? 1 : a.localeCompare(b)));
    for (const f of mds) files.push(path.join(dir, f));
  }
  return files;
}

export type LlmsOutput = { llms: string; full: string };

export function generateLlms(siteUrl = DEFAULT_SITE_URL): LlmsOutput {
  const url = siteUrl.replace(/\/+$/, '');
  const pages = SECTIONS.map((s) => ({ ...s, pages: s.pages.map((id) => readPage(id)).filter((p): p is Page => !!p) }));

  const llms: string[] = [
    '# Caju Motion',
    '',
    '> Open-source (MIT) video framework: video by code (`video.ts` + `defineProject`) and a visual timeline editor (Caju Studio) on the same `project.json`, custom React components (`defineComponent`), and local render to MP4 with `caju render`. Tagline: "Code it. Then move it."',
    '',
    'Time is always in integer frames, rendering is a pure function of (project, frame), and `caju build` regenerates code clips while keeping Studio edits. Documentation is also available in Portuguese under /pt/.',
    '',
  ];
  for (const section of pages) {
    llms.push(`## ${section.title}`, '');
    for (const p of section.pages) llms.push(`- [${p.data.title}](${pageUrl(url, p.id)}): ${p.data.description}`);
    llms.push('');
  }
  llms.push(
    '## Optional',
    '',
    `- [Full documentation](${url}/llms-full.txt): every English page plus the Caju Agent Skills in one Markdown file`,
    '- [Agent Skills source](https://github.com/MardelAraujo/caju_motion/tree/main/packages/skills/skills): SKILL.md files for Claude Code and compatible agents',
    '- [Repository](https://github.com/MardelAraujo/caju_motion): source code, MIT license',
    '',
  );

  const full: string[] = [
    '# Caju Motion: full documentation',
    '',
    `> Generated from ${url}/ (English pages) and packages/skills/skills (Agent Skills). Index: ${url}/llms.txt`,
    '',
  ];
  for (const section of pages) {
    for (const p of section.pages) {
      full.push('---', '', `<!-- page: ${pageUrl(url, p.id)} -->`, '');
      full.push(p.data.layout === 'home' ? homeMarkdown(p, url) : toPlainMarkdown(p, url), '');
    }
  }
  full.push('---', '', '# Caju Agent Skills', '', 'The skills below are what `caju skills add` installs for coding agents. Each skill starts with a SKILL.md; the other files are rules it loads on demand.', '');
  for (const file of skillFiles()) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    full.push('---', '', `<!-- source: ${rel} -->`, '', lf(readFileSync(file, 'utf8')).trim(), '');
  }

  return { llms: llms.join('\n'), full: `${full.join('\n').trim()}\n` };
}

function main(argv: string[]): number {
  const checkOnly = argv.includes('--check');
  const problems = validateDocs();
  if (problems.length) {
    console.error(`docs: ${problems.length} problem(s)\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`);
    return 1;
  }
  const pageCount = SECTIONS.reduce((n, s) => n + s.pages.length, 0);
  if (checkOnly) {
    console.log(`✓ docs ok (${pageCount} pages × ${1 + LOCALES.length} languages)`);
    return 0;
  }
  const { llms, full } = generateLlms(process.env.DOCS_SITE_URL || DEFAULT_SITE_URL);
  const outDir = path.join(DOCS, 'public');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'llms.txt'), llms);
  writeFileSync(path.join(outDir, 'llms-full.txt'), full);
  console.log(`✓ llms.txt (${pageCount} pages) and llms-full.txt (${Math.round(full.length / 1024)} KB) in docs-site/public`);
  return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
