/**
 * Mapeamento de quadros de SAÍDA (fps do export) para quadros do PROJETO (fps do documento).
 * Funções puras: o export pode usar outro fps (ex.: projeto 30 → arquivo 60 ou 24).
 */

/** Quantos quadros o arquivo final terá para `totalFrames` quadros do projeto. */
export function outputFrameCount(totalFrames: number, projectFps: number, outputFps: number): number {
  if (totalFrames <= 0) return 0;
  return Math.max(1, Math.round((totalFrames * outputFps) / projectFps));
}

/** Quadro do projeto mostrado no quadro de saída `j` (amostragem no instante j / outputFps). */
export function projectFrameFor(j: number, totalFrames: number, projectFps: number, outputFps: number): number {
  const f = Math.floor((j * projectFps) / outputFps + 1e-9);
  return Math.min(Math.max(0, f), Math.max(0, totalFrames - 1));
}
