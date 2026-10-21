import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { probeMedia } from '@caju-motion/media';
import { createEmptyProject, ProjectSchema, type Project } from '@caju-motion/schema';
import {
  addCaptions,
  addVoiceover,
  alignScript,
  elevenLabsTts,
  engineNames,
  estimateWords,
  openAiStt,
  openAiTts,
  parseSubtitles,
  providerByName,
  placeholderTts,
  readCaptions,
  toneWav,
  toSrt,
  transcription,
  toVtt,
  voiceover,
  voiceoverStartSec,
  voiceStudioStt,
  voiceStudioTts,
  voiceStudioUrl,
  voiceStudioVoices,
  wordsFromCharacters,
  wordsToCues,
  type SttProvider,
  type TtsProvider,
  type Word,
} from './index';

const W = (text: string, start: number, end: number): Word => ({ text, start, end });
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(path.join(tmpdir(), 'caju-voice-'));
  dirs.push(d);
  return d;
};
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('legendas', () => {
  it('wordsToCues quebra em fim de frase, pausa e tamanho', () => {
    const words = [
      W('Todo', 0, 0.2), W('vídeo', 0.2, 0.5), W('começa', 0.5, 0.9), W('aqui.', 0.9, 1.2),
      W('Depois', 1.3, 1.6), W('vem', 1.6, 1.8), // pausa grande depois
      W('o', 3, 3.1), W('resto', 3.1, 3.5),
    ];
    expect(wordsToCues(words).map((c) => c.text)).toEqual(['Todo vídeo começa aqui.', 'Depois vem', 'o resto']);
    const long = 'um dois três quatro cinco seis sete oito nove dez'.split(' ').map((t, i) => W(t, i * 0.2, i * 0.2 + 0.2));
    const cues = wordsToCues(long, { maxChars: 16 });
    expect(cues.every((c) => c.text.length <= 16)).toBe(true);
    expect(cues.map((c) => c.text).join(' ')).toBe(long.map((w) => w.text).join(' '));
    expect(cues[0]).toMatchObject({ start: 0 });
  });

  it('estimateWords cobre a duração, em ordem, com respiro na pontuação', () => {
    const w = estimateWords('Olá, mundo. Tudo bem', 2);
    expect(w.map((x) => x.text)).toEqual(['Olá,', 'mundo.', 'Tudo', 'bem']);
    expect(w[0]!.start).toBe(0);
    expect(w[3]!.end).toBeCloseTo(2, 2);
    for (let i = 1; i < w.length; i++) expect(w[i]!.start).toBeGreaterThanOrEqual(w[i - 1]!.end);
    expect(w[2]!.start - w[1]!.end).toBeGreaterThan(0.05); // pausa depois do ponto
    expect(estimateWords('', 3)).toEqual([]);
  });

  it('alignScript usa o texto do roteiro com os tempos da transcrição', () => {
    const timed = [W('ola', 0, 0.3), W('mundo', 0.3, 0.7), W('isso', 0.9, 1.1), W('e', 1.1, 1.2), W('um', 1.2, 1.3), W('teste', 1.3, 1.8)];
    const out = alignScript('Olá, mundo! Isso é um teste.', timed);
    expect(out.map((w) => w.text)).toEqual(['Olá,', 'mundo!', 'Isso', 'é', 'um', 'teste.']);
    expect(out[0]).toMatchObject({ start: 0, end: 0.3 });
    expect(out[5]).toMatchObject({ start: 1.3, end: 1.8 });
    // palavra do roteiro que a transcrição perdeu: interpolada entre as vizinhas
    const gap = alignScript('um dois três', [W('um', 0, 0.5), W('tres', 1, 1.5)]);
    expect(gap[1]).toEqual({ text: 'dois', start: 0.5, end: 1 });
  });

  it('SRT e VTT de ida e volta', () => {
    const cues = [
      { text: 'Primeira linha', start: 0.5, end: 2.25 },
      { text: 'Segunda\ncom quebra', start: 3661.001, end: 3662 },
    ];
    const srt = toSrt(cues);
    expect(srt).toContain('00:00:00,500 --> 00:00:02,250');
    expect(srt).toContain('01:01:01,001 --> 01:01:02,000');
    expect(parseSubtitles(srt)).toEqual(cues);
    expect(parseSubtitles(toVtt(cues))).toEqual(cues);
    const vtt = 'WEBVTT\n\nNOTE comentário\n\n00:01.000 --> 00:02.500 align:start\n<i>Oi</i> {\\an8}gente\n';
    expect(parseSubtitles(vtt)).toEqual([{ text: 'Oi gente', start: 1, end: 2.5 }]);
    expect(() => parseSubtitles('1\n00:00:xx --> 00:00:01,000\noi')).toThrow(/tempo inválido/);
  });
});

describe('provedores', () => {
  it('OpenAI: fala + transcrição com tempos por palavra, alinhada ao roteiro', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init! });
      if (String(url).endsWith('/audio/speech')) return new Response(new Uint8Array([1, 2, 3]));
      return Response.json({ words: [{ word: 'ola', start: 0, end: 0.4 }, { word: 'mundo', start: 0.4, end: 0.9 }] });
    };
    const tts = openAiTts({ apiKey: 'sk-test', voice: 'nova', fetch: fake });
    expect(tts.id).toBe('openai:gpt-4o-mini-tts:nova');
    const r = await tts.synthesize({ text: 'Olá mundo.', language: 'pt', speed: 1.1, instructions: 'animado' });
    expect([...r.audio]).toEqual([1, 2, 3]);
    expect(r.words).toEqual([W('Olá', 0, 0.4), W('mundo.', 0.4, 0.9)]);

    expect(calls[0]!.url).toBe('https://api.openai.com/v1/audio/speech');
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      model: 'gpt-4o-mini-tts', voice: 'nova', input: 'Olá mundo.', response_format: 'mp3', speed: 1.1, instructions: 'animado',
    });
    const form = calls[1]!.init.body as FormData;
    expect(calls[1]!.url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(form.get('model')).toBe('whisper-1');
    expect(form.get('timestamp_granularities[]')).toBe('word');
    expect(form.get('language')).toBe('pt');
    expect((form.get('file') as File).name).toBe('speech.mp3');

    const noAlign = openAiTts({ apiKey: 'k', alignWords: false, fetch: fake });
    expect((await noAlign.synthesize({ text: 'x' })).words).toBeUndefined();
  });

  it('OpenAI: erros legíveis (sem chave, 401)', async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(openAiTts({ fetch: async () => new Response('') }).synthesize({ text: 'x' })).rejects.toThrow(/OPENAI_API_KEY/);
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    const denied = openAiTts({ apiKey: 'k', fetch: async () => new Response('{"error":"bad key"}', { status: 401 }) });
    await expect(denied.synthesize({ text: 'x' })).rejects.toThrow(/HTTP 401 \(chave de API inválida\?\).*bad key/);
  });

  it('ElevenLabs: /with-timestamps vira áudio + palavras', async () => {
    let req: { url: string; init: RequestInit } | undefined;
    const chars = [...'Oi, gente!'];
    const fake: typeof fetch = async (url, init) => {
      req = { url: String(url), init: init! };
      return Response.json({
        audio_base64: Buffer.from([9, 8, 7]).toString('base64'),
        alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.1), character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1) },
      });
    };
    const r = await elevenLabsTts({ apiKey: 'xi', voiceId: 'voz 1', fetch: fake }).synthesize({ text: 'Oi, gente!', language: 'pt' });
    expect([...r.audio]).toEqual([9, 8, 7]);
    expect(r.words).toEqual([W('Oi,', 0, 0.3), W('gente!', 0.4, 1)]);
    expect(req!.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voz%201/with-timestamps?output_format=mp3_44100_128');
    expect((req!.init.headers as Record<string, string>)['xi-api-key']).toBe('xi');
    expect(JSON.parse(req!.init.body as string)).toEqual({ text: 'Oi, gente!', model_id: 'eleven_multilingual_v2', language_code: 'pt' });
    await expect(elevenLabsTts({ apiKey: 'xi', fetch: fake }).synthesize({ text: 'x' })).rejects.toThrow(/voice_id/);
    expect(wordsFromCharacters([' ', 'a', ' ', ' '], [0, 0, 0, 0], [0, 1, 0, 0])).toEqual([W('a', 0, 1)]);
  });
});

describe('VoiceStudio (local)', () => {
  it('fala + transcrição local, sem chave, com engine, perfil e semente', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init! });
      if (String(url).endsWith('/audio/speech')) return new Response(new Uint8Array([4, 5]));
      return Response.json({ text: ' ola mundo', words: [{ word: ' ola', start: 0, end: 0.4 }, { word: 'mundo', start: 0.4, end: 0.9 }] });
    };
    const tts = voiceStudioTts({ baseUrl: 'http://localhost:3900/v1/', engine: 'cosyvoice', voice: 'Narrador', seed: 7, fetch: fake });
    expect(tts.id).toBe('voicestudio:cosyvoice:Narrador:7');
    const r = await tts.synthesize({ text: 'Olá mundo.', language: 'pt', speed: 1.1 });
    expect([...r.audio]).toEqual([4, 5]);
    expect(r.words).toEqual([W('Olá', 0, 0.4), W('mundo.', 0.4, 0.9)]);

    expect(calls[0]!.url).toBe('http://localhost:3900/v1/audio/speech');
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      model: 'cosyvoice', voice: 'Narrador', input: 'Olá mundo.', response_format: 'mp3', speed: 1.1, language: 'pt', seed: 7,
    });
    const form = calls[1]!.init.body as FormData;
    expect(calls[1]!.url).toBe('http://localhost:3900/v1/audio/transcriptions');
    expect(form.get('timestamp_granularities[]')).toBe('word');
    expect(form.get('response_format')).toBe('verbose_json');
    expect(form.get('language')).toBe('pt');
  });

  it('padrões: omnivoice, voz default, URL local e chave opcional', async () => {
    const prevUrl = process.env.VOICESTUDIO_URL;
    const prevKey = process.env.VOICESTUDIO_API_KEY;
    delete process.env.VOICESTUDIO_URL;
    process.env.VOICESTUDIO_API_KEY = 'vs-key';
    try {
      expect(voiceStudioUrl()).toBe('http://127.0.0.1:3900');
      let seen: { url: string; init: RequestInit } | undefined;
      const fake: typeof fetch = async (url, init) => {
        seen = { url: String(url), init: init! };
        return new Response(new Uint8Array([1]));
      };
      const tts = providerByName('voicestudio', {});
      expect(tts.id).toBe('voicestudio:omnivoice:default');
      await voiceStudioTts({ alignWords: false, fetch: fake }).synthesize({ text: 'x', format: 'wav' });
      expect(seen!.url).toBe('http://127.0.0.1:3900/v1/audio/speech');
      expect((seen!.init.headers as Record<string, string>).authorization).toBe('Bearer vs-key');
      expect(JSON.parse(seen!.init.body as string)).toEqual({ model: 'omnivoice', voice: 'default', input: 'x', response_format: 'wav' });
    } finally {
      if (prevUrl === undefined) delete process.env.VOICESTUDIO_URL;
      else process.env.VOICESTUDIO_URL = prevUrl;
      if (prevKey === undefined) delete process.env.VOICESTUDIO_API_KEY;
      else process.env.VOICESTUDIO_API_KEY = prevKey;
    }
  });

  it('fechado: erro que explica como abrir ou trocar de provedor; texto longo demais', async () => {
    const down: typeof fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(voiceStudioTts({ baseUrl: 'http://127.0.0.1:3900', fetch: down }).synthesize({ text: 'x' })).rejects.toThrow(
      /VoiceStudio não respondeu em http:\/\/127\.0\.0\.1:3900.*--provider placeholder/,
    );
    const bad = voiceStudioTts({ fetch: async () => Response.json({ error: { message: 'unknown voice' } }, { status: 400 }) });
    await expect(bad.synthesize({ text: 'x' })).rejects.toThrow(/VoiceStudio: HTTP 400.*unknown voice/);
    await expect(voiceStudioTts({ fetch: down }).synthesize({ text: 'a'.repeat(5000) })).rejects.toThrow(/máximo 4096/);
  });

  it('transcrição avulsa e lista de vozes', async () => {
    const fake: typeof fetch = async (url) => {
      if (String(url).endsWith('/audio/voices')) {
        return Response.json({
          voices: [
            { voice_id: 'alloy', id: 'alloy', name: 'Alloy', type: 'openai_alias' },
            { voice_id: 'p1', id: 'p1', name: 'Minha voz', type: 'profile', language: 'pt' },
          ],
          engines: [{ id: 'omnivoice' }, 'cosyvoice'],
        });
      }
      return Response.json({ text: 'oi gente', language: 'pt', duration: 1.2, words: [{ word: 'oi', start: 0.1, end: 0.3 }, { word: ' gente', start: 0.35, end: 0.9 }] });
    };
    const tr = await voiceStudioStt({ fetch: fake }).transcribe({ audio: new Uint8Array([1]), filename: 'fala.wav' });
    expect(tr).toEqual({ words: [W('oi', 0.1, 0.3), W('gente', 0.35, 0.9)], text: 'oi gente', language: 'pt', durationSec: 1.2 });
    const cat = await voiceStudioVoices({ fetch: fake });
    expect(cat.voices.map((v) => v.id)).toEqual(['alloy', 'p1']);
    expect(engineNames(cat.engines)).toEqual(['omnivoice', 'cosyvoice']);
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(openAiStt({ fetch: fake }).transcribe({ audio: new Uint8Array(), filename: 'a.mp3' })).rejects.toThrow(/OPENAI_API_KEY/);
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  });
});

describe('locução no projeto', () => {
  function project(): Project {
    return ProjectSchema.parse(createEmptyProject({ id: 'p', format: 'reel-9x16', now: '2030-01-01T00:00:00.000Z' }));
  }

  it('gera áudio + words.json + srt, e reaproveita sem chamar o provedor de novo', async () => {
    const dir = tmp();
    let calls = 0;
    const base = placeholderTts();
    const counting: TtsProvider = { id: base.id, synthesize: (r) => (calls++, base.synthesize(r)) };
    const text = 'Todo vídeo começa com uma ideia. O Caju transforma código em vídeo.';
    const a = await voiceover({ projectDir: dir, name: 'vo-01', text, provider: counting });
    expect(a).toMatchObject({ audioSrc: 'assets/audio/vo/vo-01.wav', timed: false, cached: false }); // voz provisória: tempos estimados
    expect(a.durationSec).toBeGreaterThan(3);
    expect((await probeMedia(path.join(dir, a.audioSrc))).durationSec).toBeCloseTo(a.durationSec, 2);
    expect(a.cues.map((c) => c.text)).toEqual(['Todo vídeo começa com uma ideia.', 'O Caju transforma código em', 'vídeo.']);
    expect(readFileSync(path.join(dir, a.srtSrc), 'utf8')).toContain('Todo vídeo começa com uma ideia.');
    expect(await readCaptions(path.join(dir, a.wordsSrc))).toEqual(a.cues);
    expect(await readCaptions(path.join(dir, a.srtSrc))).toHaveLength(3);

    const b = await voiceover({ projectDir: dir, name: 'vo-01', text, provider: counting });
    expect(b.cached).toBe(true);
    expect(calls).toBe(1);
    // texto, voz ou --force mudam a chave
    await voiceover({ projectDir: dir, name: 'vo-01', text: text + ' Fim.', provider: counting });
    await voiceover({ projectDir: dir, name: 'vo-01', text, provider: counting, voice: 'outra' });
    await voiceover({ projectDir: dir, name: 'vo-01', text, provider: counting, voice: 'outra', force: true });
    expect(calls).toBe(4);
    await expect(voiceover({ projectDir: dir, name: '../fora', text, provider: counting })).rejects.toThrow(/nome inválido/);
  }, 30_000);

  it('addVoiceover + addCaptions geram um projeto válido e substituem o que já existia', () => {
    const cues = [
      { text: 'Primeira', start: 0, end: 1.2 },
      { text: 'Segunda', start: 1, end: 2 }, // começa antes da anterior acabar: a anterior é cortada
      { text: 'Terceira', start: 2.5, end: 3 },
    ];
    let p = addVoiceover(project(), { audioSrc: 'assets/audio/vo/locucao.mp3', durationSec: 3.2 }, { assetId: 'locucao', startSec: 0.5 });
    p = addCaptions(p, cues, { prefix: 'locucao-legenda', offsetSec: 0.5, style: { y: 0.7 } });
    const parsed = ProjectSchema.safeParse(p);
    expect(parsed.success, parsed.success ? '' : String(parsed.error)).toBe(true);

    const audio = p.tracks.find((t) => t.id === 'trilha-locucao')!;
    expect(audio.kind).toBe('audio');
    expect(audio.clips).toMatchObject([{ id: 'locucao-clip', assetId: 'locucao', start: 15, duration: 96 }]);
    expect(p.assets).toMatchObject([{ id: 'locucao', kind: 'audio', meta: { durationSec: 3.2 } }]);

    const caps = p.tracks.find((t) => t.id === 'trilha-legendas')!.clips;
    expect(caps.map((c) => [c.id, c.start, c.duration])).toEqual([
      ['locucao-legenda-1', 15, 45 - 15], // 0,5–1,7 s, cortada onde a próxima começa (frame 45)
      ['locucao-legenda-2', 45, 75 - 45],
      ['locucao-legenda-3', 90, 15],
    ]);
    expect(caps[0]!.transform).toMatchObject({ x: 540, y: 1344 });
    expect(caps[0]!.props).toMatchObject({ text: 'Primeira', fontSize: 54, fontWeight: 800 });

    // de novo: substitui em vez de duplicar
    const again = addCaptions(addVoiceover(p, { audioSrc: 'assets/audio/vo/locucao.mp3', durationSec: 4 }, { assetId: 'locucao' }), cues.slice(0, 1), { prefix: 'locucao-legenda' });
    expect(again.assets).toHaveLength(1);
    expect(again.tracks.find((t) => t.id === 'trilha-locucao')!.clips).toMatchObject([{ start: 15, duration: 120 }]); // mantém a posição; só a duração muda
    expect(again.tracks.find((t) => t.id === 'trilha-legendas')!.clips).toHaveLength(1);
    expect(ProjectSchema.safeParse(again).success).toBe(true);
  });

  it('duas locuções no mesmo trecho vão para trilhas diferentes (o schema não aceita sobreposição)', () => {
    let p = addVoiceover(project(), { audioSrc: 'assets/audio/vo/vo-01.wav', durationSec: 2 });
    p = addVoiceover(p, { audioSrc: 'assets/audio/vo/vo-02.wav', durationSec: 2 });
    p = addVoiceover(p, { audioSrc: 'assets/audio/vo/vo-03.wav', durationSec: 1 }, { startSec: 2 }); // cabe na 1ª
    expect(ProjectSchema.safeParse(p).success).toBe(true);
    const where = (id: string) => p.tracks.find((t) => t.clips.some((c) => c.id === id))!.id;
    expect([where('vo-01-clip'), where('vo-02-clip'), where('vo-03-clip')]).toEqual(['trilha-locucao', 'trilha-locucao-2', 'trilha-locucao']);
  });

  it('rodar de novo mantém o que foi editado no Studio (trilha, posição, volume)', () => {
    let p = addVoiceover(project(), { audioSrc: 'assets/audio/vo/locucao.wav', durationSec: 2 });
    // no Studio: move para 3 s numa trilha própria e baixa o volume
    const clip = p.tracks.flatMap((t) => t.clips).find((c) => c.id === 'locucao-clip')!;
    p.tracks = p.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== 'locucao-clip') }));
    p.tracks.push({
      ...p.tracks[0]!,
      id: 'minha-trilha',
      kind: 'audio',
      name: 'Minha',
      clips: [{ ...clip, start: 90, audio: { volume: 0.4, fadeIn: 3, fadeOut: 0, pan: 0 } }],
    });
    // texto corrigido: áudio novo com 2,5 s
    p = addVoiceover(p, { audioSrc: 'assets/audio/vo/locucao.wav', durationSec: 2.5 });
    const after = p.tracks.find((t) => t.id === 'minha-trilha')!.clips[0]!;
    expect(after).toMatchObject({ id: 'locucao-clip', start: 90, duration: 75, audio: { volume: 0.4, fadeIn: 3 } });
    expect(voiceoverStartSec(p, 'locucao')).toBe(3);
    expect(p.tracks.flatMap((t) => t.clips).filter((c) => c.id === 'locucao-clip')).toHaveLength(1);
    expect(ProjectSchema.safeParse(p).success).toBe(true);
  });

  it('transcription: extrai a fala, grava words.json + srt legíveis pelo caju captions e reaproveita', async () => {
    const dir = tmp();
    const { writeFileSync } = await import('node:fs');
    writeFileSync(path.join(dir, 'fala.wav'), toneWav(1.5));
    let calls = 0;
    let sent: { filename: string; language?: string; size: number } | undefined;
    const stt: SttProvider = {
      id: 'fake-stt',
      async transcribe(req) {
        calls++;
        sent = { filename: req.filename, language: req.language, size: req.audio.length };
        return { words: [W('Oi', 0.1, 0.4), W('gente.', 0.5, 1)], text: 'Oi gente.' };
      },
    };
    const r = await transcription({ projectDir: dir, name: 'talk', file: 'fala.wav', provider: stt, language: 'pt' });
    expect(sent).toMatchObject({ filename: 'talk.mp3', language: 'pt' });
    expect(sent!.size).toBeGreaterThan(0);
    expect(r).toMatchObject({ wordsSrc: 'assets/data/talk.words.json', source: 'fala.wav', cached: false, text: 'Oi gente.' });
    expect(r.durationSec).toBeCloseTo(1.5, 1);
    expect(readFileSync(path.join(dir, r.srtSrc), 'utf8')).toContain('Oi gente.');
    expect(await readCaptions(path.join(dir, r.wordsSrc))).toEqual(r.cues);
    const again = await transcription({ projectDir: dir, name: 'talk', file: path.join(dir, 'fala.wav'), provider: stt, language: 'pt' });
    expect(again.cached).toBe(true);
    expect(calls).toBe(1);
    await expect(transcription({ projectDir: dir, name: 'x', file: 'nao-existe.wav', provider: stt })).rejects.toThrow(/não encontrado/);
  });
});
