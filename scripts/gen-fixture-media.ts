/**
 * Gera a mídia sintética dos fixtures (determinística, commitada no repo).
 * - landscape-audio/assets/beep.wav: 1 s mono 48 kHz, beep de 1 kHz nos primeiros 100 ms
 *   (a "claquete" do teste de sincronia A/V: o beep começa junto com o flash branco).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function beepWav({ sampleRate = 48000, seconds = 1, toneHz = 1000, toneSeconds = 0.1 } = {}): Buffer {
  const n = Math.round(sampleRate * seconds);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = i < sampleRate * toneSeconds ? Math.round(Math.sin((2 * Math.PI * toneHz * i) / sampleRate) * 0.8 * 32767) : 0;
    buf.writeInt16LE(v, 44 + i * 2);
  }
  return buf;
}

const out = path.join(ROOT, 'fixtures/projects/landscape-audio/assets');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'beep.wav'), beepWav());
console.log('✓ fixtures/projects/landscape-audio/assets/beep.wav');
