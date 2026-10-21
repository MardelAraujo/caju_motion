import { describe, expect, it } from 'vitest';
import { BEAT_SAMPLE_RATE, detectBeats } from './beats';

/** Faixa sintética: bumbo (ruído curto decaindo) a cada batida, acento forte no 1 do compasso. */
function clickTrack(bpm: number, seconds: number, offset = 0.25): Float32Array {
  const sr = BEAT_SAMPLE_RATE;
  const out = new Float32Array(Math.round(seconds * sr));
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; offset + (i * 60) / bpm < seconds; i++) {
    const start = Math.round((offset + (i * 60) / bpm) * sr);
    const gain = i % 4 === 0 ? 1 : 0.5;
    for (let j = 0; j < sr * 0.08 && start + j < out.length; j++) out[start + j]! += gain * Math.exp(-j / (sr * 0.015)) * rand();
  }
  for (let i = 0; i < out.length; i++) out[i]! += 0.01 * rand(); // um pouco de fundo
  return out;
}

describe('detectBeats', () => {
  it.each([90, 120, 128, 150])('acha %i BPM e as batidas no lugar', (bpm) => {
    const r = detectBeats(clickTrack(bpm, 20));
    expect(Math.abs(r.bpm - bpm)).toBeLessThan(2);
    const period = 60 / bpm;
    // as batidas detectadas caem a menos de 40 ms das verdadeiras
    for (const t of r.beats.slice(1, -1)) {
      const k = Math.round((t - 0.25) / period);
      expect(Math.abs(t - (0.25 + k * period))).toBeLessThan(0.04);
    }
    expect(r.confidence).toBeGreaterThan(0.3);
  });

  it('downbeats seguem o acento do compasso', () => {
    const r = detectBeats(clickTrack(120, 20));
    expect(r.downbeats.length).toBeGreaterThan(5);
    for (const t of r.downbeats.slice(0, -1)) {
      const beat = Math.round((t - 0.25) / 0.5);
      expect(Math.abs(beat % 4)).toBe(0);
    }
  });

  it('silêncio ou áudio curto: sem batidas', () => {
    expect(detectBeats(new Float32Array(BEAT_SAMPLE_RATE * 10))).toMatchObject({ bpm: 0, beats: [] });
    expect(detectBeats(new Float32Array(100)).beats).toEqual([]);
  });
});
