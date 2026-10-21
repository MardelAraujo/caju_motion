import { isHexColor, parseHex } from '@caju-motion/core';
import { FORMATS, projectDuration, type Clip, type Project } from '@caju-motion/schema';
import { EFFECTS, LOOPS, OVERLAYS, poseByName, POSES } from './motion';
import { textProps } from './props';

/**
 * Lint do projeto: o que o schema aceita, mas não sai como o autor espera. Cada aviso tem um
 * código estável (`CAJU_…`) para as skills citarem como "pegadinhas da primeira passada".
 */

export type LintSeverity = 'error' | 'warn';
export type LintIssue = { code: string; severity: LintSeverity; clipId?: string; message: string };

export const LINT_CODES = {
  CAJU_UNKNOWN_TRANSITION: 'transição desconhecida: o clipe entra/sai sem movimento',
  CAJU_UNKNOWN_ANIMATION: 'animação de entrada/saída desconhecida',
  CAJU_UNKNOWN_LOOP: 'animação em loop desconhecida',
  CAJU_UNKNOWN_EFFECT: 'efeito desconhecido: ignorado no render',
  CAJU_UNKNOWN_OVERLAY: 'clipe de efeito sem props.effect válido: não desenha nada',
  CAJU_MOTION_OVERLAP: 'entrada e saída somadas passam da duração do clipe',
  CAJU_ADJUSTMENT_EMPTY: 'clipe de ajuste sem efeitos: não muda nada',
  CAJU_OFFSCREEN: 'âncora fora do quadro: o elemento pode não aparecer',
  CAJU_UNSAFE_AREA: 'texto na área coberta pela interface da plataforma (safe area)',
  CAJU_TEXT_TOO_SMALL: 'texto pequeno demais para ler no celular',
  CAJU_LOW_CONTRAST: 'pouco contraste entre o texto e o fundo',
  CAJU_EMPTY_FRAME: 'trecho sem nenhum elemento visível (só o fundo)',
} as const;

export type LintCode = keyof typeof LINT_CODES;

const known = <T extends object>(catalog: T, name: string) => Object.prototype.hasOwnProperty.call(catalog, name);

function lintClip(clip: Clip, push: (code: LintCode, message: string, severity?: LintSeverity) => void) {
  for (const t of [clip.transitionIn, clip.transitionOut]) {
    if (t && !poseByName(t.type)) push('CAJU_UNKNOWN_TRANSITION', `"${t.type}"`);
  }
  for (const a of [clip.animationIn, clip.animationOut]) {
    if (a && !poseByName(a.preset)) push('CAJU_UNKNOWN_ANIMATION', `"${a.preset}"`);
  }
  if (clip.animationLoop && !known(LOOPS, clip.animationLoop.preset)) push('CAJU_UNKNOWN_LOOP', `"${clip.animationLoop.preset}"`);
  for (const e of clip.effects) {
    if (!known(EFFECTS, e.type)) push('CAJU_UNKNOWN_EFFECT', `"${e.type}"`);
  }
  if (clip.type === 'effect' && !known(OVERLAYS, String(clip.props.effect ?? ''))) {
    push('CAJU_UNKNOWN_OVERLAY', `props.effect = ${JSON.stringify(clip.props.effect ?? null)}`, 'error');
  }
  if (clip.type === 'adjustment' && !clip.effects.some((e) => e.enabled)) push('CAJU_ADJUSTMENT_EMPTY', '');
  const inDur = Math.max(clip.transitionIn?.duration ?? 0, clip.animationIn?.duration ?? 0);
  const outDur = Math.max(clip.transitionOut?.duration ?? 0, clip.animationOut?.duration ?? 0);
  if (inDur + outDur > clip.duration) push('CAJU_MOTION_OVERLAP', `${inDur} + ${outDur} > ${clip.duration} frames`);
}

/** Luminância relativa (WCAG) de uma cor hex; `null` se não for hex. */
function luminance(hex: string): number | null {
  if (!isHexColor(hex)) return null;
  const { r, g, b } = parseHex(hex);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Razão de contraste WCAG (1–21) entre duas cores hex; `null` se alguma não for hex opaca. */
export function contrastRatio(a: string, b: string): number | null {
  if (!isHexColor(a) || !isHexColor(b) || parseHex(a).a < 1 || parseHex(b).a < 1) return null;
  const la = luminance(a)!;
  const lb = luminance(b)!;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const VISUAL_TYPES = new Set<Clip['type']>(['video', 'image', 'text', 'shape', 'component', 'effect']);
const animated = (clip: Clip, path: string) => !!clip.keyframes[path]?.length;

/** Avisos de leitura/enquadramento (dependem do quadro e do formato). */
function lintLayout(project: Project, push: (clip: Clip | undefined, code: LintCode, detail: string, severity?: LintSeverity) => void) {
  const { width, height, fps, background } = project.settings;
  const safe = project.settings.format !== 'custom' ? FORMATS[project.settings.format].safe : null;
  const minFont = Math.round(height * 0.022);
  const visualTracks = project.tracks.filter((t) => t.kind !== 'audio' && !t.hidden);

  visualTracks.forEach((track, ti) => {
    for (const clip of track.clips) {
      if (clip.hidden || clip.type === 'effect' || clip.type === 'adjustment') continue;
      const { x, y } = clip.transform;
      const moving = animated(clip, 'transform.x') || animated(clip, 'transform.y');
      if (!moving && (x < 0 || x > width || y < 0 || y > height)) push(clip, 'CAJU_OFFSCREEN', `x=${x}, y=${y} num quadro ${width}×${height}`);
      if (clip.type !== 'text') continue;

      const tp = textProps(clip);
      if (!animated(clip, 'props.fontSize') && tp.fontSize * clip.transform.scale < minFont) {
        push(clip, 'CAJU_TEXT_TOO_SMALL', `${Math.round(tp.fontSize * clip.transform.scale)} px; mínimo ~${minFont} px neste formato`);
      }
      if (safe && !moving && (y < safe.top || y > height - safe.bottom || x < safe.left || x > width - safe.right)) {
        push(clip, 'CAJU_UNSAFE_AREA', `âncora em x=${x}, y=${y}; área segura: x ${safe.left}–${width - safe.right}, y ${safe.top}–${height - safe.bottom}`);
      }
      // fundo atrás do texto: o da própria caixa, ou o do projeto quando nada visual passa por baixo dele
      const end = clip.start + clip.duration;
      const covered = visualTracks
        .slice(0, ti)
        .some((t) => t.clips.some((c) => !c.hidden && c.type !== 'text' && VISUAL_TYPES.has(c.type) && c.start < end && c.start + c.duration > clip.start));
      const behind = tp.background || (covered ? null : background);
      const ratio = behind ? contrastRatio(tp.color, behind) : null;
      const large = tp.fontSize * clip.transform.scale >= height * 0.04;
      if (ratio !== null && ratio < (large ? 3 : 4.5)) {
        push(clip, 'CAJU_LOW_CONTRAST', `${tp.color} sobre ${behind}: ${ratio.toFixed(2)}:1 (mínimo ${large ? 3 : 4.5}:1)`);
      }
    }
  });

  // trechos vazios: só o fundo por mais de meio segundo
  const total = projectDuration(project);
  const spans = visualTracks
    .flatMap((t) => t.clips)
    .filter((c) => !c.hidden && VISUAL_TYPES.has(c.type))
    .map((c) => [c.start, c.start + c.duration] as const)
    .sort((a, b) => a[0] - b[0]);
  let cursor = 0;
  for (const [a, b] of [...spans, [total, total] as const]) {
    if (a - cursor > fps / 2) push(undefined, 'CAJU_EMPTY_FRAME', `${(cursor / fps).toFixed(2)}–${(a / fps).toFixed(2)} s`);
    cursor = Math.max(cursor, b);
  }
}

export function lintProject(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  const push = (clip: Clip | undefined, code: LintCode, detail: string, severity: LintSeverity = 'warn') =>
    issues.push({ code, severity, ...(clip ? { clipId: clip.id } : {}), message: `${LINT_CODES[code]}${detail ? ` (${detail})` : ''}` });
  for (const track of project.tracks) {
    for (const clip of track.clips) lintClip(clip, (code, detail, severity) => push(clip, code, detail, severity));
  }
  lintLayout(project, push);
  return issues;
}

/** Nomes aceitos (para mensagens e para as skills). */
export function motionCatalog() {
  return { poses: Object.keys(POSES), loops: Object.keys(LOOPS), effects: Object.keys(EFFECTS), overlays: Object.keys(OVERLAYS) };
}
