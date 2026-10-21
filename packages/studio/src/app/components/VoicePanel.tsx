import { useCallback, useEffect, useState } from 'react';
import { Captions, LoaderCircle, Mic, RefreshCw } from 'lucide-react';
import { api, type VoiceStatus } from '../api';
import { autoCaptions, generateVoiceover } from '../commands';
import { useEditor } from '../store';
import { formatSeconds } from '../time';

const LANGUAGES = [
  ['pt', 'Português'],
  ['en', 'Inglês'],
  ['es', 'Espanhol'],
] as const;

/** Painel "Voz": locução (VoiceStudio local por padrão) e legendas automáticas de áudio/vídeo do projeto. */
export function VoicePanel() {
  const project = useEditor((s) => s.project);
  const frame = useEditor((s) => s.frame);
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [text, setText] = useState('');
  const [provider, setProvider] = useState('voicestudio');
  const [voice, setVoice] = useState('');
  const [engine, setEngine] = useState('');
  const [language, setLanguage] = useState('pt');
  const [name, setName] = useState('locucao');
  const [captions, setCaptions] = useState(true);
  const [atPlayhead, setAtPlayhead] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await api.voiceStatus());
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  if (!project) return null;

  const vs = status?.voicestudio;
  const providers = [
    { id: 'voicestudio', label: 'VoiceStudio (local, grátis)', ok: !!vs?.ok, off: 'fechado' },
    { id: 'placeholder', label: 'Provisória (tom + tempos estimados)', ok: true, off: '' },
    { id: 'openai', label: 'OpenAI (pago)', ok: !!status?.keys.openai, off: 'sem chave' },
    { id: 'elevenlabs', label: 'ElevenLabs (pago)', ok: !!status?.keys.elevenlabs, off: 'sem chave' },
  ];
  const ready = providers.find((p) => p.id === provider)?.ok ?? false;
  const validName = /^[\w.-]+$/.test(name);
  const speechAssets = project.assets.filter((a) => a.kind === 'audio' || (a.kind === 'video' && a.meta?.hasAudio !== false));
  const fps = project.settings.fps;

  const generate = async () => {
    setBusy('tts');
    const ok = await generateVoiceover({
      text,
      name,
      provider,
      voice: voice || undefined,
      model: provider === 'voicestudio' ? engine || undefined : undefined,
      language,
      captions,
      startSec: atPlayhead ? frame / fps : undefined,
    });
    setBusy(null);
    if (ok) setText('');
  };

  return (
    <div className="panel-body">
      <div className="voice-status">
        <span className={`voice-dot ${vs?.ok ? 'is-ok' : status ? 'is-off' : ''}`} />
        <span>{!status ? 'Verificando…' : vs?.ok ? `VoiceStudio conectado · ${vs.voices.length} voz(es) própria(s)` : 'VoiceStudio fechado'}</span>
        <button type="button" className="voice-refresh" title="Verificar de novo" disabled={checking} onClick={() => void refresh()}>
          <RefreshCw size={14} className={checking ? 'spin' : ''} />
        </button>
      </div>
      {vs && !vs.ok && (
        <p className="panel-hint">Abra o app VoiceStudio (porta 3900) para gerar vozes grátis no seu computador, ou use a voz provisória para montar o vídeo.</p>
      )}

      <label className="export-field">
        <span className="prop-label">Roteiro</span>
        <textarea className="text-field" rows={6} value={text} placeholder="Escreva o que a voz vai falar…" onChange={(e) => setText(e.target.value)} />
        <small className="export-hint">{text.length} caracteres</small>
      </label>

      <label className="export-field">
        <span className="prop-label">Provedor</span>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.ok && p.id !== 'voicestudio'}>
              {p.label}
              {p.ok ? '' : ` — ${p.off}`}
            </option>
          ))}
        </select>
      </label>

      {provider === 'voicestudio' && vs?.ok && (
        <>
          <label className="export-field">
            <span className="prop-label">Voz</span>
            <select value={voice} onChange={(e) => setVoice(e.target.value)}>
              <option value="">Padrão do engine</option>
              {vs.voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.language ? ` (${v.language})` : ''}
                </option>
              ))}
            </select>
          </label>
          {vs.engines.length > 0 && (
            <label className="export-field">
              <span className="prop-label">Engine</span>
              <select value={engine} onChange={(e) => setEngine(e.target.value)}>
                <option value="">Padrão (omnivoice)</option>
                {vs.engines.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      {(provider === 'openai' || provider === 'elevenlabs') && (
        <label className="export-field">
          <span className="prop-label">Voz</span>
          <input
            className="text-input"
            value={voice}
            placeholder={provider === 'openai' ? 'alloy, nova…' : 'voice_id'}
            onChange={(e) => setVoice(e.target.value)}
          />
        </label>
      )}

      <div className="prop-row">
        <span className="prop-label">Idioma</span>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="prop-row">
        <span className="prop-label">Nome</span>
        <input className="text-input" value={name} title="O mesmo nome substitui a locução anterior" onChange={(e) => setName(e.target.value)} />
      </div>
      <label className="export-check">
        <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} /> Criar legendas
      </label>
      <label className="export-check">
        <input type="checkbox" checked={atPlayhead} onChange={(e) => setAtPlayhead(e.target.checked)} /> Começar no playhead ({formatSeconds(frame / fps)})
      </label>
      <button type="button" className="export-btn voice-go" disabled={!text.trim() || !ready || !validName || !!busy} onClick={() => void generate()}>
        {busy === 'tts' ? <LoaderCircle size={16} className="spin" /> : <Mic size={16} />} Gerar locução
      </button>
      {(provider === 'openai' || provider === 'elevenlabs') && <p className="panel-hint">Vozes pagas usam a sua chave e geram custo na sua conta.</p>}

      <p className="panel-subtitle">Legendas automáticas</p>
      <p className="panel-hint">Transcreve a fala de um áudio ou vídeo do projeto, no seu computador, pelo VoiceStudio.</p>
      {speechAssets.length === 0 && <p className="panel-hint">Nenhum áudio ou vídeo no projeto.</p>}
      <ul className="voice-assets">
        {speechAssets.map((a) => (
          <li key={a.id}>
            <span title={a.src}>{a.name ?? a.src}</span>
            <button
              type="button"
              className="link-btn"
              disabled={!vs?.ok || !!busy}
              title={vs?.ok ? 'Gerar legendas' : 'Abra o VoiceStudio'}
              onClick={async () => {
                setBusy(a.id);
                await autoCaptions(a, language);
                setBusy(null);
              }}
            >
              {busy === a.id ? <LoaderCircle size={14} className="spin" /> : <Captions size={14} />} Legendar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
