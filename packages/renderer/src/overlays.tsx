import type { CSSProperties } from 'react';
import { clipValue } from '@caju-motion/core';
import type { Clip } from '@caju-motion/schema';
import { OVERLAYS, type FrameSize, type OverlayName } from './motion';

/** Parâmetro do clipe de efeito: `props.<nome>` (animável por keyframe), senão o padrão do catálogo. */
function param<T extends number | string>(clip: Clip, name: string, frame: number, fallback: T): T {
  const raw = clip.props[name];
  const base = (typeof raw === typeof fallback ? raw : fallback) as T;
  return clipValue(clip, `props.${name}`, frame, base);
}

/**
 * Clipe `effect`: sobreposição que cobre o quadro inteiro (vinheta, faixas de cinema, cor, flash,
 * granulado). O tipo vem de `props.effect`. Determinístico: o granulado usa o frame como semente.
 */
export function OverlayElement({ clip, frame, size }: { clip: Clip; frame: number; size: FrameSize }) {
  const kind = String(clip.props.effect ?? '') as OverlayName;
  if (!(kind in OVERLAYS)) return null;
  const box: CSSProperties = { position: 'absolute', left: 0, top: 0, width: size.width, height: size.height, pointerEvents: 'none' };

  switch (kind) {
    case 'vignette': {
      const amount = param(clip, 'amount', frame, 0.6);
      const color = param(clip, 'color', frame, '#000000');
      return <div style={{ ...box, opacity: amount, background: `radial-gradient(ellipse at center, transparent 45%, ${color} 100%)` }} />;
    }
    case 'letterbox': {
      const ratio = Math.max(0.1, param(clip, 'ratio', frame, 2.39));
      const color = param(clip, 'color', frame, '#000000');
      const horizontal = size.width / size.height < ratio;
      // faixas em cima/embaixo quando a proporção pedida é mais larga que o quadro; senão, nas laterais
      const bar = horizontal ? Math.max(0, (size.height - size.width / ratio) / 2) : Math.max(0, (size.width - size.height * ratio) / 2);
      const strip = (s: CSSProperties) => <div style={{ position: 'absolute', background: color, ...s }} />;
      return (
        <div style={box}>
          {horizontal ? strip({ left: 0, top: 0, width: '100%', height: bar }) : strip({ left: 0, top: 0, height: '100%', width: bar })}
          {horizontal ? strip({ left: 0, bottom: 0, width: '100%', height: bar }) : strip({ right: 0, top: 0, height: '100%', width: bar })}
        </div>
      );
    }
    case 'colorOverlay':
      return <div style={{ ...box, background: param(clip, 'color', frame, '#F47B35'), opacity: param(clip, 'opacity', frame, 0.25) }} />;
    case 'flash': {
      // acende no início do clipe e apaga até o fim
      const t = clip.duration > 1 ? (frame - clip.start) / (clip.duration - 1) : 1;
      return <div style={{ ...box, background: param(clip, 'color', frame, '#FFFFFF'), opacity: Math.max(0, 1 - t) }} />;
    }
    case 'grain': {
      const id = `caju-grain-${clip.id}`;
      return (
        <svg style={{ ...box, opacity: param(clip, 'amount', frame, 0.12), mixBlendMode: 'overlay' }} width={size.width} height={size.height}>
          <filter id={id}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 997} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#${id})`} />
        </svg>
      );
    }
    default:
      return null;
  }
}
