import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Captions, Check, Eye, EyeOff, KeyRound, LoaderCircle, Mic, Play, RefreshCw, Search, Square, Trash2 } from 'lucide-react';
import { api, type KeyProvider, type VoiceInfo, type VoiceStatus } from '../api';
import { autoCaptions, generateVoiceover } from '../commands';
import { useEditor } from '../store';
import { formatSeconds } from '../time';

const LANGUAGES = [
  ['pt', 'Português'],
  ['en', 'Inglês'],
  ['es', 'Espanhol'],
] as const;

const KEY_LABEL: Record<KeyProvider, string> = { openai: 'OpenAI', elevenlabs: 'ElevenLabs' };
const KEY_HELP: Record<KeyProvider, string> = {
  openai: 'platform.openai.com → API keys (começa com sk-)',
  elevenlabs: 'elevenlabs.io → Developers → API Keys',
};
/** Acima disso o texto é gerado em partes (VoiceStudio e OpenAI). */
const MAX_INPUT = 4096;

type ProviderId = 'voicestudio' | 'placeholder' | KeyProvider;

/** Painel "Voz": chaves de API, escolha de voz com amostra, locução e legendas automáticas. */
export function VoicePanel() {
  const project = useEditor((s) => s.project);
  const frame = useEditor((s) => s.frame);
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [text, setText] = useState('');
  const [provider, setProvider] = useState<ProviderId>('voicestudio');
  const [voice, setVoice] = useState('');
  const [model, setModel] = useState('');
  const [language, setLanguage] = useState('pt');
  const [name, setName] = useState('locucao');
  const [captions, setCaptions] = useState(true);
  const [atPlayhead, setAtPlayhead] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [chosen, setChosen] = useState(false);

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

  // primeira abertura: se o VoiceStudio estiver fechado e houver uma chave, já começa no provedor pago
  useEffect(() => {
    if (!status || chosen) return;
    if (!status.voicestudio.ok) {
      if (status.keys.elevenlabs) setProvider('elevenlabs');
      else if (status.keys.openai) setProvider('openai');
    }
    setChosen(true);
  }, [status, chosen]);

  const pickProvider = (p: ProviderId) => {
    setProvider(p);
    setVoice('');
    setModel('');
  };

  if (!project) return null;

  const vs = status?.voicestudio;
  const keyReady = (p: KeyProvider) => !!status?.keys[p];
  const providers: { id: ProviderId; label: string; ok: boolean; off: string }[] = [
    { id: 'voicestudio', label: 'VoiceStudio (local, grátis)', ok: !!vs?.ok, off: 'fechado' },
    { id: 'elevenlabs', label: 'ElevenLabs (pago)', ok: keyReady('elevenlabs'), off: 'sem chave' },
    { id: 'openai', label: 'OpenAI (pago)', ok: keyReady('openai'), off: 'sem chave' },
    { id: 'placeholder', label: 'Provisória (tom + tempos estimados)', ok: true, off: '' },
  ];
  const ready = providers.find((p) => p.id === provider)?.ok ?? false;
  const needsVoice = provider === 'elevenlabs';
  const validName = /^[\w.-]+$/.test(name);
  const speechAssets = project.assets.filter((a) => a.kind === 'audio' || (a.kind === 'video' && a.meta?.hasAudio !== false));
  const fps = project.settings.fps;
  const paid = provider === 'openai' || provider === 'elevenlabs';
  const models = provider === 'openai' || provider === 'elevenlabs' ? (status?.models?.[provider] ?? []) : [];

  const generate = async () => {
    setBusy('tts');
    const ok = await generateVoiceover({
      text,
      name,
      provider,
      voice: voice || undefined,
      model: model || undefined,
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

      <label className="export-field">
        <span className="prop-label">Roteiro</span>
        <textarea className="text-field" rows={6} value={text} placeholder="Escreva o que a voz vai falar…" onChange={(e) => setText(e.target.value)} />
        <small className="export-hint">
          {text.length} caracteres
          {provider !== 'placeholder' && provider !== 'elevenlabs' && text.length > MAX_INPUT ? ' · será gerado em partes e juntado num áudio só' : ''}
        </small>
      </label>

      <label className="export-field">
        <span className="prop-label">Provedor</span>
        <select value={provider} onChange={(e) => pickProvider(e.target.value as ProviderId)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.ok ? '' : ` — ${p.off}`}
            </option>
          ))}
        </select>
      </label>

      {provider === 'voicestudio' && vs && !vs.ok && (
        <p className="panel-hint">
          Abra o app VoiceStudio (porta 3900) para gerar vozes grátis no seu computador, ou escolha ElevenLabs/OpenAI com a sua chave, ou a voz provisória para
          montar o vídeo.
        </p>
      )}

      {(provider === 'openai' || provider === 'elevenlabs') && !keyReady(provider) && (
        <KeyForm provider={provider} status={status} onSaved={refresh} intro />
      )}

      {ready && provider !== 'placeholder' && (
        <>
          {models.length > 0 && (
            <label className="export-field">
              <span className="prop-label">Modelo</span>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m, i) => (
                  <option key={m.id} value={i === 0 ? '' : m.id}>
                    {m.label} — {m.description}
                  </option>
                ))}
              </select>
            </label>
          )}
          {provider === 'voicestudio' && vs?.ok && vs.engines.length > 0 && (
            <label className="export-field">
              <span className="prop-label">Engine</span>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">Padrão (omnivoice)</option>
                {vs.engines.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
          )}
          <VoicePicker
            provider={provider}
            value={voice}
            onChange={setVoice}
            model={model || models[0]?.id}
            language={language}
            allowDefault={provider === 'voicestudio'}
          />
        </>
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
      {!validName && <p className="panel-hint voice-error">Use só letras, números, - _ . no nome.</p>}
      <label className="export-check">
        <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} /> Criar legendas
      </label>
      <label className="export-check">
        <input type="checkbox" checked={atPlayhead} onChange={(e) => setAtPlayhead(e.target.checked)} /> Começar no playhead ({formatSeconds(frame / fps)})
      </label>
      <button
        type="button"
        className="export-btn voice-go"
        disabled={!text.trim() || !ready || (needsVoice && !voice) || !validName || !!busy}
        title={needsVoice && !voice ? 'Escolha uma voz' : undefined}
        onClick={() => void generate()}
      >
        {busy === 'tts' ? <LoaderCircle size={16} className="spin" /> : <Mic size={16} />} Gerar locução
      </button>
      {paid && ready && <p className="panel-hint">Vozes pagas usam a sua chave e geram custo na sua conta.</p>}

      <details className="voice-keys">
        <summary>
          <KeyRound size={14} /> Chaves de API
          <span className="voice-keys-state">
            {(['elevenlabs', 'openai'] as const).map((p) => (
              <span key={p} className={keyReady(p) ? 'is-ok' : ''}>
                {KEY_LABEL[p]} {keyReady(p) ? '✓' : '—'}
              </span>
            ))}
          </span>
        </summary>
        <KeyForm provider="elevenlabs" status={status} onSaved={refresh} />
        <KeyForm provider="openai" status={status} onSaved={refresh} />
        <p className="panel-hint">
          As chaves ficam só neste computador, no arquivo {status?.envFile ? <code>{status.envFile}</code> : '.env'} (fora do Git), e nunca são mostradas de
          novo.
        </p>
      </details>

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

// ---------------------------------------------------------------- chaves

function KeyForm({ provider, status, onSaved, intro = false }: { provider: KeyProvider; status: VoiceStatus | null; onSaved: () => Promise<void>; intro?: boolean }) {
  const showToast = useEditor((s) => s.showToast);
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = !!status?.keys[provider];
  const hint = status?.keyHints?.[provider];

  const save = async (key: string | null) => {
    setSaving(true);
    setError(null);
    try {
      const r = await api.saveVoiceKeys({ [provider]: key });
      setValue('');
      await onSaved();
      const warning = r[provider]?.warning;
      showToast(key === null ? `Chave da ${KEY_LABEL[provider]} removida.` : `Chave da ${KEY_LABEL[provider]} salva e testada.${warning ? ` Aviso: ${warning}.` : ''}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="voice-key"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) void save(value.trim());
      }}
    >
      <div className="voice-key-head">
        <strong>{KEY_LABEL[provider]}</strong>
        {configured ? (
          <span className="voice-key-ok">
            <Check size={12} /> {hint ?? 'configurada'}
          </span>
        ) : (
          <span className="voice-key-missing">não configurada</span>
        )}
        {configured && (
          <button type="button" className="link-btn voice-key-remove" disabled={saving} title="Remover a chave" onClick={() => void save(null)}>
            <Trash2 size={12} /> Remover
          </button>
        )}
      </div>
      {intro && <p className="panel-hint">Cole a sua chave da {KEY_LABEL[provider]} para usar as vozes dela.</p>}
      <div className="voice-key-row">
        <input
          className="text-input"
          type={show ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={configured ? 'Trocar a chave…' : 'Cole a chave aqui'}
          aria-label={`Chave da ${KEY_LABEL[provider]}`}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="button" className="voice-icon-btn" title={show ? 'Esconder' : 'Mostrar'} onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button type="submit" className="chip-btn" disabled={!value.trim() || saving}>
          {saving ? <LoaderCircle size={14} className="spin" /> : 'Salvar'}
        </button>
      </div>
      <small className="export-hint">{KEY_HELP[provider]}</small>
      {error && <p className="panel-hint voice-error">{error}</p>}
    </form>
  );
}

// ---------------------------------------------------------------- vozes

/** Toca uma amostra por vez; amostras geradas ficam guardadas enquanto o painel estiver aberto. */
function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Map<string, string>());
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const stop = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    setPlaying(null);
  }, []);

  useEffect(
    () => () => {
      audio.current?.pause();
      for (const u of urls.current.values()) URL.revokeObjectURL(u);
    },
    [],
  );

  const play = useCallback(
    async (key: string, source: () => Promise<string>) => {
      if (playing === key) return stop();
      stop();
      setLoading(key);
      try {
        let url = urls.current.get(key);
        if (!url) {
          url = await source();
          urls.current.set(key, url);
        }
        const a = new Audio(url);
        audio.current = a;
        a.onended = () => setPlaying((p) => (p === key ? null : p));
        await a.play();
        setPlaying(key);
      } finally {
        setLoading(null);
      }
    },
    [playing, stop],
  );

  return { play, stop, playing, loading };
}

function VoicePicker({
  provider,
  value,
  onChange,
  model,
  language,
  allowDefault,
}: {
  provider: ProviderId;
  value: string;
  onChange: (id: string) => void;
  model?: string;
  language: string;
  allowDefault: boolean;
}) {
  const showToast = useEditor((s) => s.showToast);
  const [voices, setVoices] = useState<VoiceInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState('');
  const { play, playing, loading } = usePreview();

  const load = useCallback(
    async (refresh = false) => {
      setError(null);
      setVoices(null);
      try {
        setVoices(await api.voices(provider, refresh));
      } catch (err) {
        setError((err as Error).message);
        setVoices([]);
      }
    },
    [provider],
  );
  useEffect(() => {
    void load();
  }, [load]);

  // ElevenLabs precisa de uma voz: escolhe a primeira para não travar o botão
  useEffect(() => {
    if (!allowDefault && !value && voices?.length) onChange(voices[0]!.id);
  }, [voices, value, allowDefault, onChange]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (voices ?? []).filter((v) => !q || `${v.name} ${v.description} ${v.language ?? ''}`.toLowerCase().includes(q));
  }, [voices, query]);

  const preview = (v: VoiceInfo, generated: boolean) => {
    const key = `${provider}|${v.id}|${generated ? `${model ?? ''}|${language}` : 'pronta'}`;
    return play(key, async () =>
      !generated && v.previewUrl ? v.previewUrl : URL.createObjectURL(await api.voicePreview({ provider, voice: v.id || undefined, model, language })),
    ).catch((err: Error) => showToast(`Amostra: ${err.message}`));
  };

  const playBtn = (v: VoiceInfo, generated: boolean, label: string) => {
    const key = `${provider}|${v.id}|${generated ? `${model ?? ''}|${language}` : 'pronta'}`;
    return (
      <button
        key={generated ? 'gerada' : 'pronta'}
        type="button"
        className="voice-play"
        title={label}
        aria-label={`${label}: ${v.name}`}
        onClick={(e) => {
          e.stopPropagation();
          void preview(v, generated);
        }}
      >
        {loading === key ? <LoaderCircle size={13} className="spin" /> : playing === key ? <Square size={11} /> : <Play size={12} />}
        {generated && v.previewUrl ? <span>{language.toUpperCase()}</span> : null}
      </button>
    );
  };

  const list: VoiceInfo[] = allowDefault ? [{ id: '', name: 'Padrão do engine', description: 'voz padrão do VoiceStudio' }, ...shown] : shown;
  const incompatible = (v: VoiceInfo) => !!(model && v.models && !v.models.includes(model));

  return (
    <div className="export-field">
      <div className="voice-picker-head">
        <span className="prop-label">Voz</span>
        {voices && voices.length > 0 && <small className="export-hint">{voices.length} disponíveis</small>}
        {provider === 'elevenlabs' && (
          <button type="button" className="voice-icon-btn" title="Recarregar as vozes da conta" onClick={() => void load(true)}>
            <RefreshCw size={12} />
          </button>
        )}
      </div>
      {voices && voices.length > 8 && (
        <div className="voice-search">
          <Search size={13} />
          <input className="text-input" value={query} placeholder="Buscar por nome, gênero, sotaque…" onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      {!voices && (
        <p className="panel-hint">
          <LoaderCircle size={12} className="spin" /> Carregando vozes…
        </p>
      )}
      {error && <p className="panel-hint voice-error">{error}</p>}
      {voices && (
        <ul className="voice-list" role="listbox" aria-label="Vozes">
          {list.map((v) => {
            const off = incompatible(v);
            return (
              <li
                key={v.id || 'default'}
                role="option"
                aria-selected={value === v.id}
                aria-disabled={off}
                className={`voice-item${value === v.id ? ' is-active' : ''}${off ? ' is-disabled' : ''}`}
                title={off ? `Não disponível no modelo ${model}` : `${v.name}: ${v.description}${v.language ? ` (${v.language})` : ''}`}
                onClick={() => !off && onChange(v.id)}
              >
                <div className="voice-item-text">
                  <strong>
                    {v.name}
                    {v.category && v.category !== 'premade' && v.category !== 'profile' ? <em>{v.category === 'cloned' ? 'clonada' : 'sua'}</em> : null}
                  </strong>
                  <small>
                    {v.description}
                    {v.language ? ` · ${v.language}` : ''}
                    {off ? ` · só no ${v.models!.join(', ')}` : ''}
                  </small>
                </div>
                {v.previewUrl && playBtn(v, false, 'Ouvir amostra pronta (grátis)')}
                {!off &&
                  playBtn(
                    v,
                    true,
                    provider === 'voicestudio'
                      ? 'Ouvir amostra'
                      : `Ouvir amostra em ${LANGUAGES.find(([l]) => l === language)?.[1] ?? language} (gerada uma vez, usa poucos créditos)`,
                  )}
              </li>
            );
          })}
          {voices.length === 0 && !error && !allowDefault && <li className="panel-hint">Nenhuma voz na conta.</li>}
        </ul>
      )}
      {provider === 'elevenlabs' && (
        <div className="voice-key-row">
          <input
            className="text-input"
            value={manual}
            placeholder="ou cole um voice_id da biblioteca"
            spellCheck={false}
            onChange={(e) => setManual(e.target.value)}
          />
          <button type="button" className="chip-btn" disabled={!manual.trim()} onClick={() => onChange(manual.trim())}>
            Usar
          </button>
        </div>
      )}
      {value && !list.some((v) => v.id === value) && (
        <small className="export-hint">
          voz escolhida: <code>{value}</code>
        </small>
      )}
    </div>
  );
}
