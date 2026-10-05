import { z } from 'zod';
import { FORMAT_IDS } from './formats';

/**
 * Documento do projeto — ÚNICA fonte da verdade.
 * O editor edita isto, o SDK gera isto, o renderer desenha isto.
 *
 * Convenções:
 * - tempo em frames inteiros do projeto;
 * - `Keyframe.frame` é RELATIVO ao início do clipe (mover o clipe move os keyframes);
 * - `transform.x/y` = posição do âncora em px do canvas do projeto.
 */

export const CURRENT_SCHEMA_VERSION = 1;

const Id = z.string().min(1);
const Frame = z.number().int().nonnegative();
const PositiveFrames = z.number().int().positive();

// ---------------------------------------------------------------- animação

export const EASING_PRESETS = [
  'linear',
  'hold',
  'easeIn',
  'easeOut',
  'easeInOut',
  'expoOut',
  'expoInOut',
  'softOut',
  'backOut',
] as const;

export const EasingSchema = z.union([
  z.enum(EASING_PRESETS),
  z.object({ bezier: z.tuple([z.number(), z.number(), z.number(), z.number()]) }),
]);

export const KeyframeSchema = z.object({
  frame: Frame,
  value: z.union([z.number(), z.string()]),
  /** Easing do segmento que SAI deste keyframe até o próximo. */
  easing: EasingSchema.default('linear'),
});

// ---------------------------------------------------------------- assets

export const ASSET_KINDS = ['video', 'image', 'audio', 'font', 'lottie'] as const;

export const AssetSchema = z.object({
  id: Id,
  kind: z.enum(ASSET_KINDS),
  name: z.string().optional(),
  /** Caminho relativo à pasta do projeto (`assets/x.png`) ou `library://<hash>`. */
  src: z.string().min(1),
  hash: z.string().optional(),
  meta: z
    .object({
      durationSec: z.number().nonnegative().optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      fps: z.number().positive().optional(),
      hasAudio: z.boolean().optional(),
    })
    .default({}),
});

// ---------------------------------------------------------------- clipes

export const CLIP_TYPES = [
  'video',
  'image',
  'audio',
  'text',
  'shape',
  'component',
  'effect',
  'adjustment',
] as const;
export const MEDIA_CLIP_TYPES = ['video', 'image', 'audio'] as const;

export const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'soft-light',
  'hard-light',
  'difference',
] as const;

export const TransformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  scale: z.number().default(1),
  rotation: z.number().default(0),
  anchorX: z.number().min(0).max(1).default(0.5),
  anchorY: z.number().min(0).max(1).default(0.5),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
});

export const EffectSchema = z.object({
  id: Id,
  type: z.string().min(1),
  enabled: z.boolean().default(true),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const TransitionSchema = z.object({
  type: z.string().min(1),
  duration: PositiveFrames,
  easing: EasingSchema.default('easeInOut'),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const AnimationPresetSchema = z.object({
  preset: z.string().min(1),
  duration: PositiveFrames,
  params: z.record(z.string(), z.unknown()).default({}),
});

export const ClipAudioSchema = z.object({
  volume: z.number().min(0).default(1),
  fadeIn: Frame.default(0),
  fadeOut: Frame.default(0),
  pan: z.number().min(-1).max(1).default(0),
});

export const ClipSchema = z.object({
  id: Id,
  type: z.enum(CLIP_TYPES),
  name: z.string().optional(),
  start: Frame,
  duration: PositiveFrames,

  /** Mídia de origem (video/image/audio). */
  assetId: Id.optional(),
  /** Frames da mídia de origem pulados no início (corte). */
  trimIn: Frame.default(0),
  speed: z.number().positive().default(1),

  transform: TransformSchema.default({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    flipX: false,
    flipY: false,
  }),
  opacity: z.number().min(0).max(1).default(1),
  blendMode: z.enum(BLEND_MODES).default('normal'),

  keyframes: z.record(z.string(), z.array(KeyframeSchema)).default({}),
  /** Texto/estilo ou props de componente — validadas pelo Element Type registrado. */
  props: z.record(z.string(), z.unknown()).default({}),
  effects: z.array(EffectSchema).default([]),

  transitionIn: TransitionSchema.optional(),
  transitionOut: TransitionSchema.optional(),
  animationIn: AnimationPresetSchema.optional(),
  animationOut: AnimationPresetSchema.optional(),
  animationLoop: AnimationPresetSchema.optional(),

  audio: ClipAudioSchema.optional(),

  /** Quem criou: clipes `code` podem ser regerados pelo SDK. */
  origin: z.enum(['editor', 'code']).default('editor'),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
});

// ---------------------------------------------------------------- trilhas

export const TRACK_KINDS = ['main', 'overlay', 'text', 'audio', 'effect'] as const;

export const TrackSchema = z.object({
  id: Id,
  kind: z.enum(TRACK_KINDS),
  name: z.string().optional(),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  muted: z.boolean().default(false),
  clips: z.array(ClipSchema).default([]),
});

export const MarkerSchema = z.object({
  id: Id,
  frame: Frame,
  label: z.string().default(''),
  color: z.string().default('#F6B73C'),
});

// ---------------------------------------------------------------- projeto

export const SettingsSchema = z.object({
  format: z.enum([...FORMAT_IDS, 'custom']).default('custom'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  background: z.string().default('#000000'),
  /** Se omitido, a duração é o fim do último clipe. */
  duration: PositiveFrames.optional(),
});

const ProjectShape = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: Id,
  name: z.string().min(1),
  settings: SettingsSchema,
  assets: z.array(AssetSchema).default([]),
  /** Ordem visual: índice 0 = trilha de baixo (desenhada primeiro). */
  tracks: z.array(TrackSchema).default([]),
  markers: z.array(MarkerSchema).default([]),
  meta: z
    .object({
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      generator: z.string().optional(),
    })
    .default({}),
});

export const ProjectSchema = ProjectShape.superRefine((project, ctx) => {
  const ids = new Set<string>();
  const dup = (id: string, path: (string | number)[]) => {
    if (ids.has(id)) ctx.addIssue({ code: 'custom', message: `id duplicado: "${id}"`, path });
    ids.add(id);
  };

  const assets = new Map(project.assets.map((a) => [a.id, a]));
  project.assets.forEach((a, i) => dup(a.id, ['assets', i, 'id']));
  project.markers.forEach((m, i) => dup(m.id, ['markers', i, 'id']));

  project.tracks.forEach((track, ti) => {
    dup(track.id, ['tracks', ti, 'id']);

    const sorted = [...track.clips].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (cur.start < prev.start + prev.duration) {
        ctx.addIssue({
          code: 'custom',
          message: `clipes "${prev.id}" e "${cur.id}" se sobrepõem na trilha "${track.id}"`,
          path: ['tracks', ti, 'clips'],
        });
      }
    }

    track.clips.forEach((clip, ci) => {
      const path = ['tracks', ti, 'clips', ci];
      dup(clip.id, [...path, 'id']);

      const isAudioTrack = track.kind === 'audio';
      if (isAudioTrack !== (clip.type === 'audio')) {
        ctx.addIssue({
          code: 'custom',
          message: isAudioTrack
            ? `trilha de áudio "${track.id}" só aceita clipes de áudio (clipe "${clip.id}" é "${clip.type}")`
            : `clipe de áudio "${clip.id}" precisa estar numa trilha de áudio`,
          path: [...path, 'type'],
        });
      }

      if ((MEDIA_CLIP_TYPES as readonly string[]).includes(clip.type)) {
        if (!clip.assetId) {
          ctx.addIssue({ code: 'custom', message: `clipe "${clip.id}" (${clip.type}) precisa de assetId`, path: [...path, 'assetId'] });
        } else {
          const asset = assets.get(clip.assetId);
          if (!asset) {
            ctx.addIssue({ code: 'custom', message: `asset "${clip.assetId}" não existe`, path: [...path, 'assetId'] });
          } else if (asset.kind !== clip.type) {
            ctx.addIssue({
              code: 'custom',
              message: `clipe "${clip.id}" é "${clip.type}" mas o asset "${asset.id}" é "${asset.kind}"`,
              path: [...path, 'assetId'],
            });
          }
        }
      }

      for (const [prop, kfs] of Object.entries(clip.keyframes)) {
        kfs.forEach((kf, ki) => {
          if (kf.frame >= clip.duration) {
            ctx.addIssue({
              code: 'custom',
              message: `keyframe de "${prop}" no frame ${kf.frame} está fora do clipe "${clip.id}" (duração ${clip.duration})`,
              path: [...path, 'keyframes', prop, ki, 'frame'],
            });
          }
        });
      }
    });
  });
});

export type Project = z.output<typeof ProjectSchema>;
export type ProjectInput = z.input<typeof ProjectSchema>;
export type Settings = z.output<typeof SettingsSchema>;
export type Asset = z.output<typeof AssetSchema>;
export type Track = z.output<typeof TrackSchema>;
export type Clip = z.output<typeof ClipSchema>;
export type ClipInput = z.input<typeof ClipSchema>;
export type Keyframe = z.output<typeof KeyframeSchema>;
export type Easing = z.output<typeof EasingSchema>;
export type EasingPreset = (typeof EASING_PRESETS)[number];
export type Marker = z.output<typeof MarkerSchema>;
export type ClipType = (typeof CLIP_TYPES)[number];
export type TrackKind = (typeof TRACK_KINDS)[number];

/** Duração efetiva do projeto em frames. */
export function projectDuration(project: Pick<Project, 'settings' | 'tracks'>): number {
  if (project.settings.duration) return project.settings.duration;
  let end = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) end = Math.max(end, clip.start + clip.duration);
  }
  return Math.max(end, 1);
}
