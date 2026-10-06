/**
 * Export do Caju Motion: Chromium headless (playwright-core, navegador do sistema) captura
 * o modo de render do Studio quadro a quadro e o FFmpeg codifica MP4/MOV/WebM/GIF/PNG,
 * com a mixagem de áudio montada a partir do documento (`@caju-motion/audio`).
 */
export { renderMedia, renderStill, MAX_CONCURRENCY } from './render';
export type { RenderMediaOptions, RenderMediaResult, RenderStillOptions, RenderProgress, RenderCommon } from './render';
export { renderRoutes } from './routes';
export type { RenderJob, RenderJobStatus, RenderRoutesOptions } from './routes';
export { ffmpegPath, buildEncodeArgs, startFfmpeg, runFfmpeg, probeHasAudio } from './ffmpeg';
export type { EncodeInput } from './ffmpeg';
export { launchBrowser, startRenderServer } from './browser';
export { outputFrameCount, projectFrameFor } from './frames';
