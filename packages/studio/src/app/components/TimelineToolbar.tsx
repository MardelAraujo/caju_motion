import { useShallow } from 'zustand/react/shallow';
import {
  Copy,
  FlipHorizontal2,
  Expand,
  Gauge,
  Magnet,
  Maximize2,
  Pause,
  Play,
  Scissors,
  Trash2,
  Volume2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { projectDuration } from '@caju-motion/schema';
import {
  deleteSelected,
  duplicateSelected,
  editTargets,
  flipSelected,
  openSoundPanel,
  splitAtPlayhead,
  toggleFullscreen,
  togglePlay,
} from '../commands';
import { selectedClip, useEditor } from '../store';
import { formatClock } from '../time';
import { IconButton } from '../ui';

export const MIN_PPF = 0.05;
export const MAX_PPF = 24;
const toPos = (ppf: number) => ((Math.log(ppf) - Math.log(MIN_PPF)) / (Math.log(MAX_PPF) - Math.log(MIN_PPF))) * 100;
const fromPos = (pos: number) => Math.exp(Math.log(MIN_PPF) + (pos / 100) * (Math.log(MAX_PPF) - Math.log(MIN_PPF)));

export function TimelineToolbar({ onFit }: { onFit: () => void }) {
  const project = useEditor((s) => s.project);
  const frame = useEditor((s) => s.frame);
  const playing = useEditor((s) => s.playing);
  const snapping = useEditor((s) => s.snapping);
  const ppf = useEditor((s) => s.pxPerFrame);
  const hasSelection = useEditor((s) => !!selectedClip(s));
  const t = useEditor(useShallow((s) => editTargets(s.project, s.selectedClipId, s.frame)));
  const { set } = useEditor.getState();
  if (!project) return <div className="tl-toolbar" />;

  const fps = project.settings.fps;
  const zoomBy = (k: number) => set({ pxPerFrame: Math.min(MAX_PPF, Math.max(MIN_PPF, ppf * k)) });
  // o título explica por que o botão está desabilitado
  const tip = (label: string, enabled: unknown, why: string) => (enabled ? label : `${label} — ${why}`);

  return (
    <div className="tl-toolbar">
      <div className="tl-tools">
        <IconButton
          icon={Scissors}
          label={tip('Dividir (S)', t.split, 'posicione o playhead dentro de um clipe')}
          disabled={!t.split}
          onClick={splitAtPlayhead}
        />
        <IconButton
          icon={Trash2}
          label={tip('Excluir (Delete)', hasSelection, 'selecione um clipe')}
          disabled={!hasSelection}
          onClick={deleteSelected}
        />
        <IconButton
          icon={Copy}
          label={tip('Duplicar (Ctrl+D)', t.clip, 'selecione um clipe')}
          disabled={!t.clip}
          onClick={duplicateSelected}
        />
        <IconButton
          icon={FlipHorizontal2}
          label={tip('Espelhar', t.visual, 'selecione um clipe visual')}
          disabled={!t.visual}
          onClick={() => flipSelected('x')}
        />
        <span className="tl-sep" />
        <IconButton
          icon={Volume2}
          label={tip('Volume', t.sound, 'selecione um vídeo ou áudio')}
          disabled={!t.sound}
          onClick={() => openSoundPanel('audio')}
        />
        <IconButton
          icon={Gauge}
          label={tip('Velocidade', t.sound, 'selecione um vídeo ou áudio')}
          disabled={!t.sound}
          onClick={() => openSoundPanel('speed')}
        />
      </div>

      <div className="tl-transport">
        <button type="button" className="play-btn" onClick={togglePlay} title={playing ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'}>
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <span className="tl-clock">
          <strong>
            <Digits text={formatClock(frame, fps)} />
          </strong>
          <span className="muted bar">|</span>
          <span className="muted">
            <Digits text={formatClock(projectDuration(project), fps)} />
          </span>
        </span>
        <IconButton icon={Expand} label="Tela cheia (F)" onClick={toggleFullscreen} />
      </div>

      <div className="tl-zoom">
        <IconButton
          icon={Magnet}
          label={snapping ? 'Ímã ligado (encaixe)' : 'Ímã desligado'}
          active={snapping}
          onClick={() => set({ snapping: !snapping })}
        />
        <span className="tl-sep" />
        <IconButton icon={ZoomOut} label="Diminuir zoom (-)" onClick={() => zoomBy(1 / 1.4)} />
        <input
          type="range"
          className="zoom-slider"
          min={0}
          max={100}
          step={0.5}
          value={toPos(ppf)}
          onChange={(e) => set({ pxPerFrame: fromPos(Number(e.target.value)) })}
          style={{ ['--pct' as string]: `${toPos(ppf)}%` }}
        />
        <IconButton icon={ZoomIn} label="Aumentar zoom (+)" onClick={() => zoomBy(1.4)} />
        <IconButton icon={Maximize2} label="Ajustar timeline à janela" onClick={onFit} />
      </div>
    </div>
  );
}

/** Texto do contador com cada caractere em célula de largura fixa (não "treme" ao mudar). */
function Digits({ text }: { text: string }) {
  return (
    <span className="digits">
      {text.split('').map((ch, i) => (
        <span key={i} className={ch === ':' ? 'sep' : undefined}>
          {ch}
        </span>
      ))}
    </span>
  );
}
