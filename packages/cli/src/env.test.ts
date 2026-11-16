import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkVoiceKeys, checkVoiceStudio } from './commands/doctor';
import { loadDotEnv, parseDotEnv, setDotEnvValue } from './env';

describe('.env', () => {
  it('parseDotEnv: comentários, aspas, export, valor com =', () => {
    const env = parseDotEnv(
      [
        '# chaves do Caju',
        'OPENAI_API_KEY=sk-abc=123',
        "export ELEVENLABS_API_KEY='xi-456'",
        'COM_ESPACO = "a b"  ',
        'COMENTADO=valor # nota',
        'QUEBRA="linha1\\nlinha2"',
        'lixo sem igual',
        '',
      ].join('\r\n'),
    );
    expect(env).toEqual({
      OPENAI_API_KEY: 'sk-abc=123',
      ELEVENLABS_API_KEY: 'xi-456',
      COM_ESPACO: 'a b',
      COMENTADO: 'valor',
      QUEBRA: 'linha1\nlinha2',
    });
  });

  it('loadDotEnv não sobrescreve o que já está no ambiente', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'caju-env-'));
    try {
      writeFileSync(path.join(dir, '.env'), 'A=do-arquivo\nB=do-arquivo\n');
      const env: NodeJS.ProcessEnv = { A: 'do-terminal' };
      expect(loadDotEnv(dir, env)).toEqual(['B']);
      expect(env).toEqual({ A: 'do-terminal', B: 'do-arquivo' });
      expect(loadDotEnv(path.join(dir, 'nao-existe'), env)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('setDotEnvValue grava, troca e remove sem mexer no resto do arquivo', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'caju-env-'));
    try {
      const file = path.join(dir, '.env');
      await setDotEnvValue(file, 'ELEVENLABS_API_KEY', 'xi-1');
      expect(readFileSync(file, 'utf8')).toBe('ELEVENLABS_API_KEY=xi-1\n');
      writeFileSync(file, '# minhas chaves\r\nOUTRA=1\r\nexport ELEVENLABS_API_KEY=velha\r\nELEVENLABS_API_KEY=dup\r\n');
      await setDotEnvValue(file, 'ELEVENLABS_API_KEY', 'xi-2');
      await setDotEnvValue(file, 'OPENAI_API_KEY', 'sk a#b');
      expect(readFileSync(file, 'utf8')).toBe('# minhas chaves\r\nOUTRA=1\r\nELEVENLABS_API_KEY=xi-2\r\nOPENAI_API_KEY="sk a#b"\r\n');
      expect(parseDotEnv(readFileSync(file, 'utf8')).OPENAI_API_KEY).toBe('sk a#b');
      await setDotEnvValue(file, 'ELEVENLABS_API_KEY', null);
      expect(readFileSync(file, 'utf8')).toBe('# minhas chaves\r\nOUTRA=1\r\nOPENAI_API_KEY="sk a#b"\r\n');
      await expect(setDotEnvValue(file, 'X', 'a\nB=2')).rejects.toThrow(/quebra de linha/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('doctor mostra quais vozes estão configuradas, sem revelar a chave', () => {
    const none = checkVoiceKeys({});
    expect(none.status).toBe('ok');
    expect(none.detail).toContain('placeholder');
    const both = checkVoiceKeys({ OPENAI_API_KEY: 'sk-secreta-123', ELEVENLABS_API_KEY: 'xi' });
    expect(both.detail).toContain('openai');
    expect(both.detail).toContain('elevenlabs');
    expect(JSON.stringify(both)).not.toContain('secreta');
  });

  it('doctor mostra o VoiceStudio: engines e perfis, ou como abrir', () => {
    const up = checkVoiceStudio({
      url: 'http://127.0.0.1:3900',
      voices: [
        { id: 'alloy', name: 'Alloy', type: 'openai_alias' },
        { id: 'p1', name: 'Minha voz', type: 'profile', language: 'pt' },
      ],
      engines: ['omnivoice'],
    });
    expect(up.status).toBe('ok');
    expect(up.detail).toContain('omnivoice');
    expect(up.detail).toContain('Minha voz');
    const down = checkVoiceStudio({ url: 'http://127.0.0.1:3900', error: 'fetch failed' });
    expect(down.status).toBe('warn');
    expect(down.hint).toContain('--provider placeholder');
  });
});
