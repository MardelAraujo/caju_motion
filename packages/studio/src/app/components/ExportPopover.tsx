import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import {
  crfFor,
  projectDuration,
  defaultExportSettings,
  estimateBytes,
  EXPORT_FORMATS,
  EXPORT_FPS,
  EXPORT_QUALITIES,
  EXPORT_RESOLUTIONS,
  formatBytes,
  outputSize,
  type ExportSettings,
} from '@caju-motion/schema';
import { isActive, jobFileUrl, jobFraction, useRenderJobs, type RenderJob } from '../renderJobs';
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
  const job = useRenderJobs((j) => j.job);
  const active = isActive(job);
  return (
    <Dropdown
      align="right"
      menuClassName="export-pop"
      trigger={(open, toggle) => (
        <button type="button" className={`export-btn ${open ? 'is-open' : ''}`} onClick={toggle} aria-expanded={open}>
          <Share size={16} strokeWidth={2} />
          {active ? `Exportando ${Math.round(jobFraction(job!) * 100)}%` : 'Exportar'}
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
  const saveState = useEditor((s) => s.saveState);
  const save = useEditor((s) => s.save);
  const job = useRenderJobs((j) => j.job);
  const startJob = useRenderJobs((j) => j.start);
  const [starting, setStarting] = useState(false);
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
            options={EXPORT_QUALITIES.map((q) => {
              const crf = crfFor(s.format, q.id);
              return { value: q.id, label: q.label, ...(crf !== null ? { title: `CRF ${crf}` } : {}) };
            })}
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
          disabled={!project || starting || isActive(job)}
          onClick={async () => {
            if (!project) return;
            setStarting(true);
            try {
              if (saveState === 'dirty' || saveState === 'error') await save();
              await startJob(project.id, s);
            } catch (e) {
              showToast(`Não foi possível exportar: ${(e as Error).message}`);
            } finally {
              setStarting(false);
            }
          }}
        >
          <Share size={16} strokeWidth={2} />
          {saveState === 'dirty' ? 'Salvar e exportar' : 'Exportar'}
        </button>
      </footer>

      {job && job.projectId === project?.id && <JobPanel job={job} onDone={onDone} />}
    </div>
  );
}

const STATUS_LABEL: Record<RenderJob['status'], string> = {
  queued: 'Na fila…',
  running: 'Renderizando…',
  done: 'Pronto',
  error: 'Falhou',
  canceled: 'Cancelado',
};

/** Andamento do export atual: barra, velocidade, cancelar e baixar. */
function JobPanel({ job, onDone }: { job: RenderJob; onDone: () => void }) {
  const cancel = useRenderJobs((j) => j.cancel);
  const clear = useRenderJobs((j) => j.clear);
  const active = isActive(job);
  const pct = Math.round(jobFraction(job) * 100);
  const { frame, total, speed, etaSec, stage } = job.progress;
  const detail =
    job.status === 'running'
      ? stage === 'preparing'
        ? 'abrindo o navegador…'
        : stage === 'encoding'
          ? 'finalizando o arquivo…'
          : `quadro ${frame}/${total} · ${speed.toFixed(1)} q/s${etaSec !== null ? ` · ~${Math.ceil(etaSec)} s` : ''}`
      : job.status === 'done'
        ? `${job.fileName ?? ''}${job.sizeBytes ? ` · ${formatBytes(job.sizeBytes)}` : ''}`
        : (job.error ?? '');

  return (
    <div className={`export-job is-${job.status}`} role="status" aria-live="polite">
      <div className="export-job-head">
        <strong>{STATUS_LABEL[job.status]}</strong>
        <span>{active || job.status === 'done' ? `${pct}%` : ''}</span>
      </div>
      <div className="export-job-bar" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </div>
      <small className="export-job-detail" title={detail}>
        {detail}
      </small>
      <div className="export-job-actions">
        {active && (
          <button type="button" className="link-btn" onClick={() => void cancel()}>
            <X size={14} /> Cancelar
          </button>
        )}
        {job.status === 'done' && job.fileName && (
          <a className="export-btn export-download" href={jobFileUrl(job)} download={job.fileName} onClick={onDone}>
            <Download size={16} strokeWidth={2} />
            Baixar
          </a>
        )}
        {!active && (
          <button type="button" className="link-btn" onClick={clear}>
            Fechar
          </button>
        )}
      </div>
    </div>
  );
}
