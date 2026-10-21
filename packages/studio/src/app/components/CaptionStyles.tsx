import type { Clip, Project } from '@caju-motion/schema';
import { findClip } from '../ops';
import { useEditor } from '../store';
import { Section } from '../ui';

/**
 * Estilos prontos de legenda, aplicados a todos os textos da trilha do clipe selecionado
 * (ex.: a trilha "Legendas" criada pela locução ou pela transcrição) num passo só do desfazer.
 */

type CaptionStyle = {
  id: string;
  label: string;
  props: Record<string, unknown>;
  animationIn?: { preset: string; frames: number };
};

export const CAPTION_STYLES: CaptionStyle[] = [
  { id: 'classic', label: 'Clássica', props: { fontFamily: 'Plus Jakarta Sans', fontSize: 54, fontWeight: 700, color: '#FFFFFF', background: '#171512CC' } },
  { id: 'pill', label: 'Pílula amarela', props: { fontFamily: 'Plus Jakarta Sans', fontSize: 58, fontWeight: 800, color: '#171512', background: '#F6B73C' }, animationIn: { preset: 'pop', frames: 6 } },
  { id: 'clean', label: 'Limpa', props: { fontFamily: 'Red Hat Display', fontSize: 60, fontWeight: 800, color: '#FFFFFF', background: '' }, animationIn: { preset: 'fade', frames: 4 } },
  { id: 'bold', label: 'Impacto', props: { fontFamily: 'Red Hat Display', fontSize: 76, fontWeight: 800, color: '#FFF8E9', background: '#E94B35' }, animationIn: { preset: 'rise', frames: 6 } },
  { id: 'subtle', label: 'Discreta', props: { fontFamily: 'Plus Jakarta Sans', fontSize: 44, fontWeight: 600, color: '#FFF8E9', background: '#00000099' } },
];

/** Aplica o estilo a todos os textos da trilha (mantém o texto e a posição de cada legenda). */
export function applyCaptionStyle(p: Project, trackId: string, style: CaptionStyle) {
  const track = p.tracks.find((t) => t.id === trackId);
  if (!track) return;
  for (const c of track.clips) {
    if (c.type !== 'text') continue;
    Object.assign(c.props, style.props);
    if (style.animationIn) c.animationIn = { preset: style.animationIn.preset, duration: Math.min(style.animationIn.frames, c.duration), params: {} };
    else delete c.animationIn;
  }
}

export function CaptionStylesSection({ clip }: { clip: Clip }) {
  const project = useEditor((s) => s.project);
  const apply = useEditor((s) => s.apply);
  const ref = project ? findClip(project, clip.id) : null;
  if (!ref || ref.track.kind !== 'text') return null;
  const texts = ref.track.clips.filter((c) => c.type === 'text').length;
  // só faz sentido numa trilha de legendas (vários textos em sequência)
  if (texts < 2) return null;
  return (
    <Section title={`Estilo das legendas (${texts} na trilha)`}>
      <div className="motion-grid">
        {CAPTION_STYLES.map((s) => (
          <button
            type="button"
            key={s.id}
            className="motion-chip caption-chip"
            style={{ color: String(s.props.color), background: String(s.props.background) || undefined, fontWeight: Number(s.props.fontWeight) }}
            onClick={() => apply((p) => applyCaptionStyle(p, ref.track.id, s))}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="panel-hint">Aplica fonte, cores e entrada a todas as legendas da trilha. Ajustes finos continuam valendo por clipe.</p>
    </Section>
  );
}
