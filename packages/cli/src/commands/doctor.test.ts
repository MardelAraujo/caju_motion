import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  browserCandidates,
  checkBrowser,
  checkDisk,
  checkMemory,
  checkNodeVersion,
  doctorExitCode,
  formatCheck,
  parseFfmpegVersion,
} from './doctor';

const GB = 1024 ** 3;

describe('caju doctor: verificações puras', () => {
  it('Node ≥ 20.11', () => {
    expect(checkNodeVersion('v20.11.0').status).toBe('ok');
    expect(checkNodeVersion('v22.3.1').status).toBe('ok');
    expect(checkNodeVersion('v20.10.9').status).toBe('fail');
    expect(checkNodeVersion('v18.20.0')).toMatchObject({ status: 'fail', hint: expect.stringContaining('Node.js 22') });
  });

  it('versão do FFmpeg', () => {
    expect(parseFfmpegVersion('ffmpeg version 6.1.1-essentials_build-www.gyan.dev Copyright (c) 2000-2023')).toBe('6.1.1-essentials_build-www.gyan.dev');
    expect(parseFfmpegVersion('ffmpeg version n7.0 Copyright')).toBe('n7.0');
    expect(parseFfmpegVersion('command not found')).toBeNull();
  });

  it('navegador: CAJU_BROWSER_PATH > Chrome > Edge', () => {
    const env = { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local', PROGRAMFILES: 'C:\\Program Files', 'PROGRAMFILES(X86)': 'C:\\Program Files (x86)' };
    const edge = path.win32.join('C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe');
    const chrome = path.win32.join('C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe');
    expect(browserCandidates('win32', env).map((c) => c.path)).toContain(edge);

    expect(checkBrowser('win32', env, (p) => p === edge)).toMatchObject({ status: 'ok', detail: expect.stringContaining('Microsoft Edge') });
    expect(checkBrowser('win32', env, (p) => p === edge || p === chrome)).toMatchObject({ detail: expect.stringContaining('Google Chrome') });
    expect(checkBrowser('linux', {}, () => false)).toMatchObject({ status: 'fail', hint: expect.stringContaining('CAJU_BROWSER_PATH') });
    expect(checkBrowser('darwin', { CAJU_BROWSER_PATH: '/x/chromium' }, (p) => p === '/x/chromium')).toMatchObject({ status: 'ok' });
    expect(checkBrowser('darwin', { CAJU_BROWSER_PATH: '/x/chromium' }, () => true).detail).toContain('CAJU_BROWSER_PATH');
    expect(checkBrowser('darwin', { CAJU_BROWSER_PATH: '/nao/existe' }, () => false).status).toBe('fail');
  });

  it('disco e memória', () => {
    expect(checkDisk(10 * GB).status).toBe('ok');
    expect(checkDisk(1 * GB).status).toBe('warn');
    expect(checkDisk(0.2 * GB).status).toBe('fail');
    expect(checkDisk(null).status).toBe('warn');
    expect(checkMemory(4 * GB, 16 * GB).status).toBe('ok');
    expect(checkMemory(0.5 * GB, 16 * GB)).toMatchObject({ status: 'warn', detail: '0.5 de 16.0 GB livres' });
  });

  it('formatação e exit code', () => {
    const ok = { label: 'Node.js', status: 'ok' as const, detail: 'v22' };
    const fail = { label: 'FFmpeg', status: 'fail' as const, detail: 'ausente', hint: 'instale' };
    expect(formatCheck(ok)).toMatch(/^✓ Node\.js\s+v22$/);
    expect(formatCheck(fail)).toMatch(/^✗ FFmpeg\s+ausente\n\s+→ instale$/);
    expect(doctorExitCode([ok, { ...ok, status: 'warn' }])).toBe(0);
    expect(doctorExitCode([ok, fail])).toBe(1);
  });
});
