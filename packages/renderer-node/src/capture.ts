import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser';

/**
 * Captura de um site para virar vídeo: screenshots (página inteira e primeira dobra), tokens de
 * marca (cores por papel, fontes), textos visíveis e imagens grandes/logo. O agente usa as imagens
 * reais em vez de redesenhar o site.
 */

export type CapturedColor = { hex: string; role: 'background' | 'text' | 'accent'; weight: number };
export type CapturedFont = { family: string; weights: number[]; role: 'heading' | 'body' };
export type CapturedImage = { src: string; alt: string; width: number; height: number; logo: boolean };
export type SiteTokens = { url: string; title: string; description: string; colors: CapturedColor[]; fonts: CapturedFont[]; ogImage?: string };

export type CaptureResult = {
  dir: string;
  files: { page: string; viewport: string; tokens: string; text: string; images: string };
  tokens: SiteTokens;
  images: CapturedImage[];
  textChars: number;
};

type PageData = Omit<SiteTokens, 'url'> & { text: string[]; images: CapturedImage[] };

/** Roda dentro da página: lê estilos calculados e o DOM visível. */
function collect(): PageData {
  const toHex = (c: string): string | null => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.6)) return null;
    return `#${[m[1], m[2], m[3]].map((v) => Math.round(Number(v)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.1;
  };
  const colors = new Map<string, { hex: string; role: CapturedColor['role']; weight: number }>();
  const add = (hex: string | null, role: CapturedColor['role'], w: number) => {
    if (!hex || w <= 0) return;
    const key = `${role}:${hex}`;
    const cur = colors.get(key);
    if (cur) cur.weight += w;
    else colors.set(key, { hex, role, weight: w });
  };
  const fonts = new Map<string, { family: string; weights: Set<number>; role: CapturedFont['role']; weight: number }>();
  const all = [...document.querySelectorAll('body, body *')].slice(0, 6000);
  for (const el of all) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    add(toHex(s.backgroundColor), 'background', (r.width * r.height) / 1e4);
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
    if (ownText) {
      add(toHex(s.color), 'text', ownText.length);
      const heading = /^H[1-3]$/.test(el.tagName) || Number(s.fontSize.replace('px', '')) >= 28;
      const family = s.fontFamily.split(',')[0]!.replace(/["']/g, '').trim();
      const key = `${heading ? 'heading' : 'body'}:${family}`;
      const f = fonts.get(key) ?? { family, weights: new Set<number>(), role: heading ? 'heading' : 'body', weight: 0 };
      f.weights.add(Number(s.fontWeight) || 400);
      f.weight += ownText.length;
      fonts.set(key, f);
    }
    if (el.matches('a, button, [role=button], input[type=submit]')) {
      add(toHex(s.backgroundColor), 'accent', 50);
      if (el.tagName === 'A') add(toHex(s.color), 'accent', 5);
    }
  }
  const text: string[] = [];
  const seen = new Set<string>();
  for (const sel of ['h1', 'h2', 'h3', 'p, li, button, a']) {
    for (const el of document.querySelectorAll(sel)) {
      const t = (el as HTMLElement).innerText?.replace(/\s+/g, ' ').trim();
      if (!t || t.length < 3 || seen.has(t) || !visible(el)) continue;
      seen.add(t);
      text.push(sel.startsWith('h') ? `${sel.toUpperCase()}: ${t}` : t);
    }
  }
  const images: CapturedImage[] = [];
  for (const img of document.querySelectorAll('img')) {
    const r = img.getBoundingClientRect();
    const hint = `${img.src} ${img.alt} ${img.className} ${img.id}`.toLowerCase();
    const logo = hint.includes('logo') || !!img.closest('header, nav, [class*=logo]');
    if (!img.currentSrc && !img.src) continue;
    if (!logo && (img.naturalWidth < 200 || img.naturalHeight < 150 || r.width < 120)) continue;
    images.push({ src: img.currentSrc || img.src, alt: img.alt, width: img.naturalWidth, height: img.naturalHeight, logo });
  }
  const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"], meta[property="${name}"]`)?.content ?? '';
  const top = (role: CapturedColor['role'], n: number) =>
    [...colors.values()].filter((c) => c.role === role).sort((a, b) => b.weight - a.weight).slice(0, n);
  return {
    title: document.title,
    description: meta('description') || meta('og:description'),
    ogImage: meta('og:image') || undefined,
    colors: [...top('background', 5), ...top('text', 4), ...top('accent', 4)].map((c) => ({ ...c, weight: Math.round(c.weight) })),
    fonts: [...fonts.values()]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 4)
      .map((f) => ({ family: f.family, weights: [...f.weights].sort((a, b) => a - b), role: f.role })),
    text: text.slice(0, 200),
    images: images.slice(0, 40),
  };
}

export async function captureSite(
  url: string,
  outDir: string,
  { width = 1440, height = 900, timeoutMs = 45_000 }: { width?: number; height?: number; timeoutMs?: number } = {},
): Promise<CaptureResult> {
  if (!/^https?:\/\//i.test(url)) throw new Error(`URL inválida: ${url} (use http:// ou https://)`);
  await mkdir(outDir, { recursive: true });
  const files = {
    page: path.join(outDir, 'page.png'),
    viewport: path.join(outDir, 'viewport.png'),
    tokens: path.join(outDir, 'tokens.json'),
    text: path.join(outDir, 'text.txt'),
    images: path.join(outDir, 'images.json'),
  };
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // o esbuild (tsx/tsup) pode inserir `__name(...)` nas funções enviadas à página
    await page.evaluate('globalThis.__name = globalThis.__name || ((f) => f)');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.screenshot({ path: files.viewport });
    // desce a página para carregar imagens "lazy" e volta ao topo antes da captura inteira
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight && y < 30_000; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    await page.screenshot({ path: files.page, fullPage: true });
    const data = await page.evaluate(collect);
    await context.close();

    const tokens: SiteTokens = { url, title: data.title, description: data.description, colors: data.colors, fonts: data.fonts, ...(data.ogImage ? { ogImage: data.ogImage } : {}) };
    await writeFile(files.tokens, JSON.stringify(tokens, null, 2) + '\n');
    await writeFile(files.text, data.text.join('\n') + '\n');
    await writeFile(files.images, JSON.stringify(data.images, null, 2) + '\n');
    return { dir: outDir, files, tokens, images: data.images, textChars: data.text.join('\n').length };
  } finally {
    await browser.close();
  }
}
