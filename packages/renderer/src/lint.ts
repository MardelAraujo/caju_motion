import type { Clip, Project } from '@caju-motion/schema';
import { EFFECTS, LOOPS, OVERLAYS, poseByName, POSES } from './motion';

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

export function lintProject(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      lintClip(clip, (code, detail, severity = 'warn') =>
        issues.push({ code, severity, clipId: clip.id, message: `${LINT_CODES[code]}${detail ? ` (${detail})` : ''}` }),
      );
    }
  }
  return issues;
}

/** Nomes aceitos (para mensagens e para as skills). */
export function motionCatalog() {
  return { poses: Object.keys(POSES), loops: Object.keys(LOOPS), effects: Object.keys(EFFECTS), overlays: Object.keys(OVERLAYS) };
}
