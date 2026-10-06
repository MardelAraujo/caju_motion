import type { DragEvent } from 'react';
import { addAssetClip, addComponent, addShape, addText, SHAPE_PRESETS, TEXT_PRESETS } from './commands';

/** Carga arrastada da biblioteca para a timeline/canvas. */
export type DragPayload =
  | { kind: 'asset'; assetId: string }
  | { kind: 'text'; presetId: string }
  | { kind: 'shape'; shapeId: string; fill: string }
  | { kind: 'component'; name: string };

const MIME = 'application/x-frame';

export function setDragPayload(e: DragEvent, payload: DragPayload) {
  e.dataTransfer.setData(MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = 'copy';
}

export function hasPayload(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(MIME);
}

export function readPayload(e: DragEvent): DragPayload | null {
  try {
    return JSON.parse(e.dataTransfer.getData(MIME)) as DragPayload;
  } catch {
    return null;
  }
}

/** Solta a carga no frame/trilha indicados (ou na posição padrão). */
export function dropPayload(payload: DragPayload, opts: { at?: number; trackId?: string } = {}) {
  if (payload.kind === 'asset') addAssetClip(payload.assetId, opts);
  if (payload.kind === 'text') {
    const preset = TEXT_PRESETS.find((p) => p.id === payload.presetId);
    if (preset) addText(preset, opts);
  }
  if (payload.kind === 'shape') {
    const shape = SHAPE_PRESETS.find((s) => s.id === payload.shapeId);
    if (shape) addShape(shape, payload.fill, opts);
  }
  if (payload.kind === 'component') addComponent(payload.name, opts);
}
