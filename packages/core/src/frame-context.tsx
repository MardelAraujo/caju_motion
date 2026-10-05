import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';

export type VideoConfig = {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

type FrameContextValue = {
  /** Frame relativo à <Sequence> atual. */
  frame: number;
  /** Frame absoluto do projeto. */
  absoluteFrame: number;
  config: VideoConfig;
};

const FrameContext = createContext<FrameContextValue | null>(null);

function useFrameContext(hook: string): FrameContextValue {
  const ctx = useContext(FrameContext);
  if (!ctx) throw new Error(`${hook}() precisa estar dentro de <FrameProvider> (renderer do Caju)`);
  return ctx;
}

export function FrameProvider({ frame, config, children }: { frame: number; config: VideoConfig; children: ReactNode }) {
  return <FrameContext.Provider value={{ frame, absoluteFrame: frame, config }}>{children}</FrameContext.Provider>;
}

/** Frame atual relativo à sequência onde o componente está. */
export function useFrame(): number {
  return useFrameContext('useFrame').frame;
}

/** Frame absoluto do projeto (ignora <Sequence>). */
export function useAbsoluteFrame(): number {
  return useFrameContext('useAbsoluteFrame').absoluteFrame;
}

export function useVideoConfig(): VideoConfig {
  return useFrameContext('useVideoConfig').config;
}

/**
 * Monta os filhos só em [from, from + duration) e desloca o frame para começar em 0.
 * Sequências aninhadas se compõem.
 */
export function Sequence({ from, duration, children }: { from: number; duration?: number; children: ReactNode }) {
  const parent = useFrameContext('Sequence');
  const local = parent.frame - from;
  const end = duration ?? Infinity;
  if (local < 0 || local >= end) return null;
  return (
    <FrameContext.Provider
      value={{
        frame: local,
        absoluteFrame: parent.absoluteFrame,
        config: duration === undefined ? parent.config : { ...parent.config, durationInFrames: duration },
      }}
    >
      {children}
    </FrameContext.Provider>
  );
}

/** Div de tela cheia, posicionamento absoluto (base de toda camada). */
export function Fill({ style, children }: { style?: CSSProperties; children?: ReactNode }) {
  return <div style={{ position: 'absolute', inset: 0, ...style }}>{children}</div>;
}
