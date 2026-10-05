import { useEffect, useState } from 'react';
import { ProjectRenderer } from '@caju-motion/renderer';
import type { Project } from '@caju-motion/schema';
import { api, assetUrl } from './api';

/**
 * Modo de render: `/?render=<projeto>&frame=<n>` mostra SÓ o quadro, em tamanho real
 * (sem editor). Base do export (Fase 1) e das capturas de verificação.
 * Quando fontes e imagens terminam de carregar, marca `data-frame-ready="1"` no <html>.
 */
export function RenderView({ projectId, frame }: { projectId: string; frame: number }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProject(projectId).then((r) => setProject(r.project), (e: Error) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    let alive = true;
    const imgs = [...document.querySelectorAll('img')];
    Promise.all([
      document.fonts.ready,
      ...imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => img.addEventListener('load', r, { once: true })))),
    ]).then(() => {
      if (alive) document.documentElement.dataset.frameReady = '1';
    });
    return () => {
      alive = false;
    };
  }, [project, frame]);

  if (error) return <pre style={{ color: 'red' }}>{error}</pre>;
  if (!project) return null;
  const { width, height } = project.settings;
  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      <ProjectRenderer project={project} frame={frame} resolveAsset={(a) => assetUrl(project.id, a)} />
    </div>
  );
}
