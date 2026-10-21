import type { CSSProperties, ReactNode } from 'react';
import { clipValue, Fill, FrameProvider, isClipActive, Sequence } from '@caju-motion/core';
import { projectDuration, type Asset, type Clip, type Project } from '@caju-motion/schema';
import { ImageElement, TextElement, VideoElement } from './elements';
import { ComponentElement } from './components';
import { clipMotion, effectsFilter, motionCss, REST, type MotionState } from './motion';
import { OverlayElement } from './overlays';
import { clipVolumeAt, intrinsicSize, resolvedProps, shapeProps, sourceTimeAt, textProps } from './props';

export type AssetResolver = (asset: Asset) => string;

export type ProjectRendererProps = {
  project: Project;
  frame: number;
  resolveAsset: AssetResolver;
  /** Preview tocando (vídeos rodam soltos em vez de seek por frame). */
  playing?: boolean;
  /** Silencia tudo (ex.: botão de mudo de um player). */
  muted?: boolean;
  /** Volume geral, multiplicado pelo volume de cada clipe (padrão 1). */
  volume?: number;
  /** Velocidade da reprodução (preview), multiplicada pela velocidade de cada clipe (padrão 1). */
  playbackRate?: number;
  /** Clipe de texto em edição inline no canvas. */
  editingClipId?: string | null;
  onTextCommit?: (clipId: string, text: string) => void;
};

/**
 * Estilo do "invólucro" do clipe: âncora em (x, y), rotação/escala/espelho em torno da âncora,
 * mais o movimento (transições/animações, deslocamento na tela) e os efeitos (filtros CSS).
 */
export function clipTransformStyle(clip: Clip, frame: number, motion: MotionState = REST): CSSProperties {
  const x = clipValue(clip, 'transform.x', frame, clip.transform.x);
  const y = clipValue(clip, 'transform.y', frame, clip.transform.y);
  const scale = clipValue(clip, 'transform.scale', frame, clip.transform.scale);
  const rotation = clipValue(clip, 'transform.rotation', frame, clip.transform.rotation);
  const opacity = clipValue(clip, 'opacity', frame, clip.opacity);
  const { anchorX, anchorY, flipX, flipY } = clip.transform;
  const m = motionCss(motion);
  const filter = [effectsFilter(clip, frame), m.filter].filter(Boolean).join(' ');
  return {
    position: 'absolute',
    left: x,
    top: y,
    // sem isto o navegador "espreme" o elemento perto da borda direita e a âncora desloca
    width: 'max-content',
    transformOrigin: `${anchorX * 100}% ${anchorY * 100}%`,
    transform: `${m.prefix}translate(${-anchorX * 100}%, ${-anchorY * 100}%) rotate(${rotation}deg) scale(${scale * (flipX ? -1 : 1)}, ${scale * (flipY ? -1 : 1)})${m.suffix}`,
    opacity: opacity * m.opacity,
    mixBlendMode: clip.blendMode === 'normal' ? undefined : clip.blendMode,
    ...(filter ? { filter } : {}),
    ...(m.clipPath ? { clipPath: m.clipPath } : {}),
  };
}

/** Clipe `effect` (sobreposição): ocupa o quadro inteiro; só opacidade, movimento e filtros. */
function overlayStyle(clip: Clip, frame: number, motion: MotionState): CSSProperties {
  const m = motionCss(motion);
  const filter = [effectsFilter(clip, frame), m.filter].filter(Boolean).join(' ');
  return {
    position: 'absolute',
    inset: 0,
    opacity: clipValue(clip, 'opacity', frame, clip.opacity) * m.opacity,
    transform: m.prefix || m.suffix ? `${m.prefix}${m.suffix}` : undefined,
    mixBlendMode: clip.blendMode === 'normal' ? undefined : clip.blendMode,
    ...(filter ? { filter } : {}),
    ...(m.clipPath ? { clipPath: m.clipPath } : {}),
  };
}

export function ProjectRenderer({
  project,
  frame,
  resolveAsset,
  playing = false,
  muted = false,
  volume = 1,
  playbackRate = 1,
  editingClipId,
  onTextCommit,
}: ProjectRendererProps) {
  const { width, height, fps, background } = project.settings;
  const assets = new Map(project.assets.map((a) => [a.id, a]));

  const renderClip = (clip: Clip, trackMuted: boolean): ReactNode => {
    const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
    const live = { props: resolvedProps(clip, frame) };
    // tamanho com keyframes (ex.: props.width animado revela um SVG com preserveAspectRatio="… slice")
    const size = intrinsicSize({ ...clip, props: live.props }, asset);
    let content: ReactNode = null;

    switch (clip.type) {
      case 'text':
        content = (
          <TextElement
            props={textProps(editingClipId === clip.id ? clip : live)}
            editing={editingClipId === clip.id}
            onCommit={(t) => onTextCommit?.(clip.id, t)}
          />
        );
        break;
      case 'shape': {
        const p = shapeProps(live);
        content = (
          <div
            style={{
              boxSizing: 'border-box',
              width: Math.max(0, p.width),
              height: Math.max(0, p.height),
              background: p.fill || undefined,
              border: p.stroke && p.strokeWidth > 0 ? `${p.strokeWidth}px solid ${p.stroke}` : undefined,
              borderRadius: p.shape === 'ellipse' ? '50%' : 0,
            }}
          />
        );
        break;
      }
      case 'image':
        if (asset && size) content = <ImageElement src={resolveAsset(asset)} width={size.width} height={size.height} />;
        break;
      case 'video':
        if (asset && size)
          content = (
            <VideoElement
              src={resolveAsset(asset)}
              width={size.width}
              height={size.height}
              time={sourceTimeAt(clip, frame, fps)}
              playing={playing}
              volume={clipVolumeAt(clip, frame) * volume}
              muted={trackMuted || muted}
              rate={clip.speed * playbackRate}
              fps={fps}
            />
          );
        break;
      case 'component': {
        const name = typeof live.props.component === 'string' ? live.props.component : '';
        content = <ComponentElement name={name} props={live.props} frameSize={{ width, height }} />;
        break;
      }
      case 'effect':
        content = <OverlayElement clip={clip} frame={frame} size={{ width, height }} />;
        break;
      default:
        content = null;
    }
    if (!content) return null;
    const motion = clipMotion(clip, frame, { width, height }, fps);

    return (
      <Sequence key={clip.id} from={clip.start} duration={clip.duration}>
        <div data-clip-id={clip.id} style={clip.type === 'effect' ? overlayStyle(clip, frame, motion) : clipTransformStyle(clip, frame, motion)}>
          {content}
        </div>
      </Sequence>
    );
  };

  /**
   * Camadas de baixo para cima. Uma trilha com clipes de ajuste (`adjustment`) aplica os efeitos
   * do clipe ativo a tudo o que está abaixo dela. O invólucro existe sempre (filtro vazio fora do
   * clipe) para a árvore não mudar e os vídeos de baixo não serem remontados.
   */
  // o fundo é a primeira camada: um clipe de ajuste acima dele também o filtra
  let layers: ReactNode[] = [<div key="background" style={{ position: 'absolute', inset: 0, background }} />];
  for (const track of project.tracks) {
    if (track.kind === 'audio' || track.hidden) continue;
    const adjustments = track.clips.filter((c) => c.type === 'adjustment');
    layers.push(
      ...track.clips.filter((c) => c.type !== 'adjustment' && !c.hidden && isClipActive(c, frame)).map((c) => renderClip(c, track.muted)),
    );
    if (adjustments.length) {
      const active = adjustments.find((c) => !c.hidden && isClipActive(c, frame));
      const filter = active ? [effectsFilter(active, frame), motionCss(clipMotion(active, frame, { width, height }, fps)).filter].filter(Boolean).join(' ') : '';
      layers = [
        <div key={`adjust-${track.id}`} data-adjustment-track={track.id} style={{ position: 'absolute', inset: 0, filter: filter || undefined }}>
          {layers}
        </div>,
      ];
    }
  }

  return (
    <FrameProvider frame={frame} config={{ width, height, fps, durationInFrames: projectDuration(project) }}>
      <Fill style={{ background, overflow: 'hidden', width, height }}>{layers}</Fill>
    </FrameProvider>
  );
}
