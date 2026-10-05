import { useEffect, useState } from 'react';
import { Share } from 'lucide-react';
import { projectDuration } from '@caju-motion/schema';
import {
  defaultExportSettings,
  estimateBytes,
  EXPORT_FORMATS,
  EXPORT_FPS,
  EXPORT_QUALITIES,
  EXPORT_RESOLUTIONS,
  formatBytes,
  outputSize,
  type ExportSettings,
} from '../exportSettings';
import { useEditor } from '../store';
import { Dropdown, Segmented } from '../ui';

const STORAGE_KEY = 'caju.export-settings';

function loadSaved(): Partial<ExportSettings> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<ExportSettings>;
  } catch {
    return {};
  }
}

/** Botão "Exportar" + balão com formato, resolução, fps e qualidade. */
export function ExportPopover() {
  return (
    <Dropdown
      align="right"
      menuClassName="export-pop"
      trigger={(open, toggle) => (
        <button type="button" className={`export-btn ${open ? 'is-open' : ''}`} onClick={toggle} aria-expanded={open}>
          <Share size={16} strokeWidth={2} />
          Exportar
        </button>
      )}
    >
      {(close) => <ExportForm onDone={close} />}
    </Dropdown>
  );
}

function ExportForm({ onDone }: { onDone: () => void }) {
  const project = useEditor((s) => s.project);
  const showToast = useEditor((s) => s.showToast);
  const settings = project?.settings ?? { width: 1920, height: 1080, fps: 30 };
  const [s, setS] = useState<ExportSettings>(() => ({ ...defaultExportSettings(settings), ...loadSaved() }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // armazenamento indisponível: a configuração vale só nesta sessão
    }
  }, [s]);

  const patch = (p: Partial<ExportSettings>) => setS((prev) => ({ ...prev, ...p }));
  const fmt = EXPORT_FORMATS.find((f) => f.id === s.format)!;
  const size = outputSize(settings, s.resolution);
  const seconds = project ? projectDuration(project) / project.settings.fps : 0;
  const qualityLabel = EXPORT_QUALITIES.find((q) => q.id === s.quality)!.label;
  const fpsOptions = [...new Set([...EXPORT_FPS, settings.fps])].sort((a, b) => a - b);

  return (
    <div className="export-form">
      <header>
        <h4>Exportar vídeo</h4>
        <span className="muted">{project?.name}</span>
      </header>

      <div className="export-field">
        <span className="prop-label">Formato</span>
        <div className="export-formats">
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`export-format ${s.format === f.id ? 'is-active' : ''}`}
              onClick={() => patch({ format: f.id })}
            >
              <strong>{f.label}</strong>
              <small>{f.detail}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="export-field">
        <span className="prop-label">Resolução</span>
        <Segmented
          value={String(s.resolution)}
          onChange={(v) => patch({ resolution: Number(v) as ExportSettings['resolution'] })}
          options={EXPORT_RESOLUTIONS.map((r) => ({ value: String(r.id), label: r.label }))}
        />
        <small className="export-hint">
          {size.width}×{size.height}
          {size.width === settings.width && size.height === settings.height ? ' · nativa do projeto' : ''}
        </small>
      </div>

      <div className="export-field">
        <span className="prop-label">Quadros por segundo</span>
        <Segmented
          value={String(s.fps)}
          onChange={(v) => patch({ fps: Number(v) })}
          options={fpsOptions.map((f) => ({ value: String(f), label: String(f) }))}
        />
      </div>

      {fmt.video && (
        <div className="export-field">
          <span className="prop-label">Qualidade</span>
          <Segmented
            value={s.quality}
            onChange={(v) => patch({ quality: v })}
            options={EXPORT_QUALITIES.map((q) => ({ value: q.id, label: q.label, title: `CRF ${q.crf}` }))}
          />
        </div>
      )}

      {fmt.audio && (
        <label className="export-check">
          <input type="checkbox" checked={s.audio} onChange={(e) => patch({ audio: e.target.checked })} />
          Incluir áudio
        </label>
      )}

      <footer>
        <span className="export-estimate">
          {seconds > 0 ? `≈ ${formatBytes(estimateBytes(s, settings, seconds))}` : '—'}
          <small>{Math.round(seconds)} s</small>
        </span>
        <button
          type="button"
          className="export-btn"
          onClick={() => {
            onDone();
            showToast(
              `Renderização chega na Fase 1 (Chromium + FFmpeg). Configuração salva: ${fmt.label} · ${size.width}×${size.height} · ${s.fps} fps${fmt.video ? ` · ${qualityLabel}` : ''}.`,
            );
          }}
        >
          <Share size={16} strokeWidth={2} />
          Exportar
        </button>
      </footer>
    </div>
  );
}
