import { useRef, useState, type DragEvent } from 'react';
import { Swatches } from '../ui';
import {
  AudioLines,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Keyboard,
  LoaderCircle,
  Music,
  Plus,
  Shapes,
  Type,
  Clapperboard,
  Puzzle,
  TriangleAlert,
} from 'lucide-react';
import { FrameProvider } from '@caju-motion/core';
import { ComponentElement, componentBox, TEXT_DEFAULTS, useComponents, type ComponentDefinition } from '@caju-motion/renderer';
import type { Asset } from '@caju-motion/schema';
import { assetUrl } from '../api';
import {
  addAssetClip,
  addComponent,
  addShape,
  addText,
  BRAND_COLORS,
  SHAPE_PRESETS,
  TEXT_PRESETS,
  uploadFiles,
} from '../commands';
import { setDragPayload } from '../dnd';
import { useThumbnail } from '../media';
import { useComponentsStatus } from '../components-runtime';
import { useEditor, type LeftTab } from '../store';
import { formatSeconds } from '../time';

const TABS: { id: LeftTab; label: string; icon: typeof Music }[] = [
  { id: 'media', label: 'Mídia', icon: Clapperboard },
  { id: 'audio', label: 'Áudio', icon: Music },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'elements', label: 'Elementos', icon: Shapes },
  { id: 'components', label: 'Componentes', icon: Puzzle },
];

export function LeftRail({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const leftTab = useEditor((s) => s.leftTab);
  const leftOpen = useEditor((s) => s.leftOpen);
  const { set } = useEditor.getState();

  return (
    <>
      <nav className="left-rail">
        <div className="rail-logo" title="Caju Studio">
          <img src="/brand/caju-symbol.png" alt="Caju" />
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rail-tab ${leftTab === t.id && leftOpen ? 'is-active' : ''}`}
            onClick={() => set({ leftTab: t.id, leftOpen: leftTab === t.id ? !leftOpen : true })}
          >
            <t.icon size={20} strokeWidth={1.75} />
            <span>{t.label}</span>
          </button>
        ))}
        <span className="rail-spacer" />
        <button type="button" className="rail-tab small" title="Atalhos de teclado" onClick={onShowShortcuts}>
          <Keyboard size={18} strokeWidth={1.75} />
        </button>
      </nav>

      {leftOpen && (
        <aside className="left-panel">
          {leftTab === 'media' && <MediaPanel kinds={['video', 'image']} accept="video/*,image/*" />}
          {leftTab === 'audio' && <MediaPanel kinds={['audio']} accept="audio/*" />}
          {leftTab === 'text' && <TextPanel />}
          {leftTab === 'elements' && <ElementsPanel />}
          {leftTab === 'components' && <ComponentsPanel />}
        </aside>
      )}
      <button
        type="button"
        className="panel-collapse"
        style={{ left: leftOpen ? 'calc(var(--rail-w) + var(--left-w))' : 'var(--rail-w)' }}
        title={leftOpen ? 'Recolher painel' : 'Expandir painel'}
        onClick={() => set({ leftOpen: !leftOpen })}
      >
        {leftOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </>
  );
}

// ---------------------------------------------------------------- mídia / áudio

function MediaPanel({ kinds, accept }: { kinds: Asset['kind'][]; accept: string }) {
  const project = useEditor((s) => s.project);
  const uploading = useEditor((s) => s.uploading);
  const input = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  if (!project) return null;

  const assets = project.assets.filter((a) => kinds.includes(a.kind));
  const used = new Set(project.tracks.flatMap((t) => t.clips.map((c) => c.assetId)));
  const isAudio = kinds.includes('audio');

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) void uploadFiles([...e.dataTransfer.files]);
  };

  return (
    <div
      className={`panel-body ${dragOver ? 'is-drop' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <button type="button" className="upload-btn" onClick={() => input.current?.click()}>
        <CloudUpload size={18} strokeWidth={1.75} /> Carregar
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          if (e.target.files) void uploadFiles([...e.target.files]);
          e.target.value = '';
        }}
      />
      <p className="panel-hint">Arraste arquivos para cá, ou arraste um item para a timeline.</p>

      {uploading.map((name) => (
        <div key={name} className="upload-row">
          <LoaderCircle size={14} className="spin" /> {name}
        </div>
      ))}

      {assets.length === 0 && uploading.length === 0 && (
        <div className="empty-state">
          {isAudio ? <AudioLines size={28} /> : <Clapperboard size={28} />}
          <span>{isAudio ? 'Nenhum áudio ainda' : 'Nenhuma mídia ainda'}</span>
        </div>
      )}

      {isAudio ? (
        <ul className="audio-list">
          {assets.map((a) => (
            <li
              key={a.id}
              draggable
              onDragStart={(e) => setDragPayload(e, { kind: 'asset', assetId: a.id })}
              onDoubleClick={() => addAssetClip(a.id)}
            >
              <span className="audio-icon">
                <Music size={16} />
              </span>
              <span className="audio-name" title={a.name}>
                {a.name ?? a.src}
                <small>{formatSeconds(a.meta.durationSec ?? 0)}</small>
              </span>
              {used.has(a.id) && <Check size={14} className="used" />}
              <button type="button" className="add-btn" title="Adicionar à timeline" onClick={() => addAssetClip(a.id)}>
                <Plus size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="media-grid">
          {assets.map((a) => (
            <MediaCard key={a.id} projectId={project.id} asset={a} used={used.has(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({ projectId, asset, used }: { projectId: string; asset: Asset; used: boolean }) {
  const url = assetUrl(projectId, asset);
  const thumb = useThumbnail(url, asset.kind);
  return (
    <figure
      className="media-card"
      draggable
      onDragStart={(e) => setDragPayload(e, { kind: 'asset', assetId: asset.id })}
      onDoubleClick={() => addAssetClip(asset.id)}
    >
      <div
        className="media-thumb"
        style={
          thumb
            ? { backgroundImage: `url("${thumb}")`, backgroundSize: asset.kind === 'image' ? 'contain' : 'cover' }
            : undefined
        }
      >
        {used && <span className="media-used">Adicionado</span>}
        {asset.kind === 'video' && <span className="media-duration">{formatSeconds(asset.meta.durationSec ?? 0)}</span>}
        <button type="button" className="add-btn" title="Adicionar à timeline" onClick={() => addAssetClip(asset.id)}>
          <Plus size={16} />
        </button>
      </div>
      <figcaption title={asset.name}>{asset.name ?? asset.src}</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- texto

function TextPanel() {
  const title = TEXT_PRESETS[0]!;
  return (
    <div className="panel-body">
      <button
        type="button"
        className="upload-btn"
        draggable
        onDragStart={(e) => setDragPayload(e, { kind: 'text', presetId: title.id })}
        onClick={() => addText(title)}
      >
        <Type size={18} strokeWidth={1.75} /> Adicionar título
      </button>
      <h5 className="panel-subtitle">Estilos da marca</h5>
      <div className="text-presets">
        {TEXT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="text-preset"
            draggable
            onDragStart={(e) => setDragPayload(e, { kind: 'text', presetId: p.id })}
            onClick={() => addText(p)}
            title={`Adicionar "${p.label}"`}
          >
            <span
              style={{
                fontFamily: `'${p.props.fontFamily ?? TEXT_DEFAULTS.fontFamily}'`,
                fontWeight: p.props.fontWeight ?? 800,
                color: p.props.color ?? '#FFFFFF',
                background: p.props.background || undefined,
                padding: p.props.background ? '2px 6px' : undefined,
              }}
            >
              {p.sample}
            </span>
            <small>{p.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- elementos

function ElementsPanel() {
  const [fill, setFill] = useState('#FFFFFF');
  return (
    <div className="panel-body">
      <h5 className="panel-subtitle">Cor</h5>
      <Swatches colors={BRAND_COLORS} value={fill} onChange={setFill} />
      <h5 className="panel-subtitle">Formas</h5>
      <div className="shape-grid">
        {SHAPE_PRESETS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="shape-card"
            draggable
            onDragStart={(e) => setDragPayload(e, { kind: 'shape', shapeId: s.id, fill })}
            onClick={() => addShape(s, fill)}
            title={`Adicionar ${s.label}`}
          >
            <span
              style={{
                background: fill,
                borderRadius: s.shape === 'ellipse' ? '50%' : 0,
                aspectRatio: `${s.width} / ${s.height}`,
                width: s.width >= s.height ? '70%' : undefined,
                height: s.height > s.width ? '70%' : undefined,
              }}
            />
            <small>{s.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- componentes (código do usuário)

function ComponentsPanel() {
  const defs = useComponents();
  const status = useComponentsStatus();
  const project = useEditor((s) => s.project);
  if (!project) return null;

  return (
    <div className="panel-body">
      <p className="panel-hint">
        Componentes React da pasta <code>components/</code> ({'defineComponent'}). Clique ou arraste para a timeline; ao salvar o
        arquivo, o Studio recarrega sozinho.
      </p>
      {status.dir && (
        <p className="panel-hint components-dir" title={status.dir}>
          {status.dir}
        </p>
      )}
      {status.state === 'unavailable' && <p className="panel-hint">Este servidor não carrega componentes.</p>}
      {status.state === 'loading' && (
        <div className="upload-row">
          <LoaderCircle size={14} className="spin" /> Carregando componentes…
        </div>
      )}
      {status.errors.length > 0 && (
        <div className="components-errors" role="alert">
          <strong>
            <TriangleAlert size={14} /> {status.state === 'error' ? 'Erro ao compilar componentes' : 'Aviso'}
          </strong>
          <pre>{status.errors.join('\n')}</pre>
          {status.state === 'error' && defs.length > 0 && <small>Mostrando a última versão que compilou.</small>}
        </div>
      )}
      {defs.length === 0 && status.state !== 'loading' && (
        <div className="empty-state">
          <Puzzle size={28} />
          <span>Nenhum componente ainda</span>
        </div>
      )}
      <div className="component-list">
        {defs.map((d) => (
          <ComponentCard key={d.name} defn={d} frameSize={project.settings} fps={project.settings.fps} />
        ))}
      </div>
    </div>
  );
}

const THUMB_W = 112;

function ComponentCard({ defn, frameSize, fps }: { defn: ComponentDefinition; frameSize: { width: number; height: number }; fps: number }) {
  const box = componentBox({}, defn, frameSize);
  const scale = Math.min(THUMB_W / Math.max(1, box.width), 72 / Math.max(1, box.height));
  const duration = defn.durationInFrames ?? fps * 3;
  const frame = Math.floor(duration / 2);
  return (
    <button
      type="button"
      className="component-card"
      draggable
      onDragStart={(e) => setDragPayload(e, { kind: 'component', name: defn.name })}
      onClick={() => addComponent(defn.name)}
      title={`Adicionar ${defn.label ?? defn.name}`}
    >
      <span className="component-thumb">
        <span style={{ width: box.width, height: box.height, transform: `scale(${scale})`, transformOrigin: 'center', flex: 'none' }}>
          <FrameProvider frame={frame} config={{ width: frameSize.width, height: frameSize.height, fps, durationInFrames: duration }}>
            <ComponentElement name={defn.name} props={{}} frameSize={frameSize} />
          </FrameProvider>
        </span>
      </span>
      <span className="component-meta">
        <strong>{defn.label ?? defn.name}</strong>
        {defn.description && <small>{defn.description}</small>}
        {defn.label && defn.label !== defn.name && <code>{defn.name}</code>}
      </span>
      <Plus size={16} className="component-add" />
    </button>
  );
}
