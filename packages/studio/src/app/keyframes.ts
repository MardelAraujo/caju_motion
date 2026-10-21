import { clipValue } from '@caju-motion/core';
import type { Clip, Easing, Keyframe } from '@caju-motion/schema';

/**
 * Keyframes no editor (estilo CapCut): uma propriedade com keyframes passa a ser editada no
 * playhead (mudar o valor grava/atualiza o keyframe daquele quadro); sem keyframes, muda a base.
 * Funções que MUTAM o clipe (rascunho do immer).
 */

/** Propriedades animáveis pelo painel Básico. */
export const ANIMATABLE = ['transform.x', 'transform.y', 'transform.scale', 'transform.rotation', 'opacity'] as const;
export type AnimatablePath = (typeof ANIMATABLE)[number];

export const localFrame = (clip: Pick<Clip, 'start' | 'duration'>, projectFrame: number) =>
  Math.min(clip.duration - 1, Math.max(0, Math.round(projectFrame - clip.start)));

export const isAnimated = (clip: Pick<Clip, 'keyframes'>, path: string) => (clip.keyframes[path]?.length ?? 0) > 0;

export const hasKeyframeAt = (clip: Pick<Clip, 'keyframes'>, path: string, local: number) =>
  !!clip.keyframes[path]?.some((k) => k.frame === local);

function baseValue(clip: Clip, path: string): number {
  if (path === 'opacity') return clip.opacity;
  const key = path.split('.')[1] as keyof Clip['transform'];
  return Number(clip.transform[key]);
}

function setBase(clip: Clip, path: string, value: number) {
  if (path === 'opacity') clip.opacity = value;
  else (clip.transform as Record<string, unknown>)[path.split('.')[1]!] = value;
}

/** Valor da propriedade no quadro do projeto (com keyframes aplicados). */
export function valueAt(clip: Clip, path: string, projectFrame: number): number {
  return Number(clipValue(clip, path, projectFrame, baseValue(clip, path)));
}

/** Cria ou atualiza o keyframe de `path` no quadro local (mantém o easing que já estava ali). */
export function upsertKeyframe(clip: Clip, path: string, local: number, value: number) {
  const list = (clip.keyframes[path] ??= []);
  const at = list.find((k) => k.frame === local);
  if (at) at.value = value;
  else {
    list.push({ frame: local, value, easing: 'easeInOut' });
    list.sort((a, b) => a.frame - b.frame);
  }
}

export function removeKeyframe(clip: Clip, path: string, local: number) {
  const list = clip.keyframes[path];
  if (!list) return;
  const next = list.filter((k) => k.frame !== local);
  if (next.length) clip.keyframes[path] = next;
  else delete clip.keyframes[path];
}

/**
 * Botão ◆: com keyframe no quadro, remove; sem, cria com o valor atual (no primeiro keyframe de
 * uma propriedade, a base vira o valor de partida). Posição liga X e Y juntos.
 */
export function toggleKeyframe(clip: Clip, paths: readonly string[], projectFrame: number) {
  const local = localFrame(clip, projectFrame);
  const on = paths.every((p) => hasKeyframeAt(clip, p, local));
  for (const p of paths) {
    if (on) removeKeyframe(clip, p, local);
    else upsertKeyframe(clip, p, local, valueAt(clip, p, projectFrame));
  }
}

/** Muda o valor como o CapCut: animada → keyframe no playhead; senão → valor base. */
export function setAnimatable(clip: Clip, path: string, projectFrame: number, value: number) {
  if (isAnimated(clip, path)) upsertKeyframe(clip, path, localFrame(clip, projectFrame), value);
  else setBase(clip, path, value);
}

/** Quadros (locais) que têm algum keyframe, com as propriedades de cada um. */
export function keyframeFrames(clip: Pick<Clip, 'keyframes'>): { frame: number; paths: string[]; easing: Easing }[] {
  const byFrame = new Map<number, { paths: string[]; easing: Easing }>();
  for (const [path, list] of Object.entries(clip.keyframes)) {
    for (const k of list) {
      const cur = byFrame.get(k.frame) ?? { paths: [], easing: k.easing };
      cur.paths.push(path);
      byFrame.set(k.frame, cur);
    }
  }
  return [...byFrame.entries()].sort((a, b) => a[0] - b[0]).map(([frame, v]) => ({ frame, ...v }));
}

/** Easing que sai do quadro `local` (em todas as propriedades com keyframe ali). */
export function setEasingAt(clip: Clip, local: number, easing: Easing) {
  for (const list of Object.values(clip.keyframes)) {
    for (const k of list as Keyframe[]) if (k.frame === local) k.easing = easing;
  }
}

/** Move todos os keyframes de um quadro para outro (arrastar o ◆ na timeline). */
export function moveKeyframesAt(clip: Clip, from: number, to: number) {
  const target = Math.min(clip.duration - 1, Math.max(0, Math.round(to)));
  if (target === from) return;
  for (const [path, list] of Object.entries(clip.keyframes)) {
    const moving = list.find((k) => k.frame === from);
    if (!moving) continue;
    const rest = list.filter((k) => k !== moving && k.frame !== target);
    clip.keyframes[path] = [...rest, { ...moving, frame: target }].sort((a, b) => a.frame - b.frame);
  }
}

/** Curva cúbica do easing, para desenhar e editar (pontos de controle). */
export const EASING_BEZIER: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  expoOut: [0.16, 1, 0.3, 1],
  expoInOut: [0.87, 0, 0.13, 1],
  softOut: [0.25, 0.1, 0.25, 1],
  backOut: [0.34, 1.56, 0.64, 1],
};

export function bezierOf(e: Easing): [number, number, number, number] | null {
  if (typeof e === 'object') return e.bezier;
  return EASING_BEZIER[e] ?? null;
}
