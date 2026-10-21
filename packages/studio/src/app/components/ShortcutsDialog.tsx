import { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { ACTIONS, bindings, comboOf, formatCombo, resetBindings, setBinding, type ActionGroup } from '../actions';

const GROUPS: ActionGroup[] = ['Arquivo', 'Reprodução', 'Navegação', 'Edição', 'Seleção', 'Ferramentas'];
const MOUSE: [string, string][] = [
  ['Ctrl/Shift + clique', 'Incluir ou tirar clipe da seleção'],
  ['Arrastar no vazio da timeline', 'Selecionar vários (retângulo)'],
  ['Ctrl + roda', 'Zoom (timeline ou canvas)'],
  ['Duplo clique', 'Editar texto no canvas'],
];

/** Atalhos gerados do registro de ações; clique num atalho e aperte a nova combinação. */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const [map, setMap] = useState(bindings);
  const [recording, setRecording] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    document.body.dataset.capturingShortcut = '1';
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecording(null);
        return;
      }
      const combo = comboOf(e);
      if (!combo) return;
      const taken = setBinding(recording, combo);
      setNotice(taken ? `${formatCombo(combo)} saiu de "${taken}".` : null);
      setMap(bindings());
      setRecording(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      delete document.body.dataset.capturingShortcut;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [recording]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Atalhos de teclado</h3>
          <button
            type="button"
            className="link-btn"
            title="Voltar aos atalhos padrão"
            onClick={() => {
              resetBindings();
              setMap(bindings());
              setNotice('Atalhos padrão restaurados.');
            }}
          >
            <RotateCcw size={13} /> Padrão
          </button>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <p className="panel-hint">Clique num atalho e aperte a nova combinação (Esc cancela).</p>
        {notice && <p className="shortcut-notice">{notice}</p>}
        <div className="shortcut-groups">
          {GROUPS.map((g) => (
            <section key={g}>
              <h4>{g}</h4>
              <dl className="shortcut-list">
                {ACTIONS.filter((a) => a.group === g).map((a) => (
                  <div key={a.id}>
                    <dt>
                      <button type="button" className={`shortcut-key ${recording === a.id ? 'is-recording' : ''}`} onClick={() => setRecording(a.id)}>
                        {recording === a.id ? 'aperte…' : map[a.id]!.length ? map[a.id]!.map(formatCombo).join('  ou  ') : '—'}
                      </button>
                    </dt>
                    <dd>{a.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section>
            <h4>Mouse</h4>
            <dl className="shortcut-list">
              {MOUSE.map(([k, v]) => (
                <div key={k}>
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
