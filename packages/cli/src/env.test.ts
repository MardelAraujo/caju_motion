import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkVoiceKeys } from './commands/doctor';
import { loadDotEnv, parseDotEnv } from './env';

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

  it('doctor mostra quais vozes estão configuradas, sem revelar a chave', () => {
    const none = checkVoiceKeys({});
    expect(none.status).toBe('ok');
    expect(none.detail).toContain('placeholder');
    const both = checkVoiceKeys({ OPENAI_API_KEY: 'sk-secreta-123', ELEVENLABS_API_KEY: 'xi' });
    expect(both.detail).toContain('openai');
    expect(both.detail).toContain('elevenlabs');
    expect(JSON.stringify(both)).not.toContain('secreta');
  });
});
