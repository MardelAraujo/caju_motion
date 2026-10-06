import { createFile, DataStream, Endianness, MP4BoxBuffer, type Sample, type Track, type VisualSampleEntry } from 'mp4box';

/**
 * Decode frame-exato de vídeo no navegador (WebCodecs + mp4box), sem `<video>`: `frameAt(t)` devolve
 * exatamente o quadro que aparece no instante `t` — o mesmo que o FFmpeg extrairia.
 *
 * Experimental. Lê o arquivo inteiro na memória (pensado para clipes, não para filmes) e só aceita
 * MP4/MOV (H.264, H.265, VP9, AV1 dentro de MP4). Leitura para a frente (quadro a quadro, como no
 * render) reaproveita o que já foi decodificado; voltar no tempo recomeça do quadro-chave anterior.
 */

export type FrameDecoderInfo = {
  codec: string;
  width: number;
  height: number;
  durationSec: number;
  frameCount: number;
  /** fps médio. */
  fps: number;
};

export type FrameDecoder = FrameDecoderInfo & {
  /** Quadro visível no instante `timeSec`. Quem chama deve dar `close()` no VideoFrame. */
  frameAt(timeSec: number): Promise<VideoFrame>;
  /** Desenha o quadro do instante `timeSec` no canvas (esticado para o tamanho dele). */
  drawFrameAt(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, timeSec: number): Promise<void>;
  close(): void;
};

export function isWebCodecsSupported(): boolean {
  return typeof globalThis.VideoDecoder === 'function' && typeof globalThis.EncodedVideoChunk === 'function';
}

type Demuxed = {
  track: Track;
  samples: Sample[];
  description?: Uint8Array;
  /** Deslocamento da edit list (unidades da trilha): subtraído do cts, como fazem os players. */
  shift: number;
  /** Atraso inicial da edit list (s), de "edições vazias". */
  delay: number;
};

type EditEntry = { segment_duration: number; media_time: number };

/**
 * Edit list (`elst`): com B-frames, o muxer desloca os cts (o 1º quadro não começa em 0) e grava o
 * deslocamento aqui. Sem aplicar isso, cada instante cairia alguns quadros antes do certo.
 */
function editList(entries: EditEntry[] | undefined, movieTimescale: number): { shift: number; delay: number } {
  let delay = 0;
  for (const e of entries ?? []) {
    if (e.media_time === -1) delay += e.segment_duration / movieTimescale;
    else return { shift: e.media_time, delay };
  }
  return { shift: 0, delay };
}

function demux(bytes: ArrayBuffer): Demuxed {
  const file = createFile();
  let track: Track | undefined;
  const samples: Sample[] = [];
  let failure: unknown;
  file.onError = (_module: string, msg: string) => {
    failure = new Error(msg);
  };
  file.onReady = (info) => {
    track = info.videoTracks[0];
    if (!track) return;
    file.setExtractionOptions(track.id, undefined, { nbSamples: track.nb_samples });
    file.start();
  };
  file.onSamples = (_id, _user, batch) => {
    samples.push(...batch);
  };
  file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(bytes, 0));
  file.flush();
  if (failure) throw failure;
  if (!track) throw new Error('nenhuma trilha de vídeo encontrada (o decoder aceita MP4/MOV)');
  if (samples.length === 0) throw new Error('trilha de vídeo vazia');

  const trak = file.getTrackById(track.id);
  const { shift, delay } = editList(
    (trak.edts?.elst?.entries as EditEntry[] | undefined),
    track.movie_timescale || track.timescale,
  );
  const entry = trak.mdia.minf.stbl.stsd.entries[0] as VisualSampleEntry;
  const box = entry.avcC ?? entry.hvcC ?? entry.vpcC ?? entry.av1C;
  let description: Uint8Array | undefined;
  if (box) {
    const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
    (box as unknown as { write(s: DataStream): void }).write(stream);
    description = new Uint8Array(stream.buffer, 8); // sem o cabeçalho da caixa (tamanho + tipo)
  }
  return { track, samples, description, shift, delay };
}

async function loadBytes(source: string | ArrayBuffer | Blob): Promise<ArrayBuffer> {
  if (source instanceof ArrayBuffer) return source;
  if (typeof Blob !== 'undefined' && source instanceof Blob) return source.arrayBuffer();
  const res = await fetch(source as string);
  if (!res.ok) throw new Error(`não foi possível baixar o vídeo (HTTP ${res.status})`);
  return res.arrayBuffer();
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function createFrameDecoder(source: string | ArrayBuffer | Blob): Promise<FrameDecoder> {
  if (!isWebCodecsSupported()) throw new Error('este navegador não tem WebCodecs (VideoDecoder)');
  const { track, samples, description, shift, delay } = demux(await loadBytes(source));
  const scale = 1e6 / track.timescale;
  const ts = (s: Sample) => Math.round(s.cts * scale); // µs, como o VideoFrame.timestamp
  // ordem de exibição (com B-frames difere da ordem de decodificação)
  const byTime = samples.map((s, i) => ({ t: (s.cts - shift) / track.timescale + delay, i })).sort((a, b) => a.t - b.t);
  const width = track.video?.width ?? track.track_width;
  const height = track.video?.height ?? track.track_height;

  const config: VideoDecoderConfig = {
    codec: track.codec,
    codedWidth: width,
    codedHeight: height,
    ...(description ? { description } : {}),
    optimizeForLatency: true,
  };
  const support = await VideoDecoder.isConfigSupported(config);
  if (!support.supported) throw new Error(`codec não suportado pelo navegador: ${track.codec}`);

  /** Quadros já decodificados que ainda podem ser pedidos (leitura para a frente), por timestamp. */
  const ready = new Map<number, VideoFrame>();
  let waiter: { ts: number; resolve: (f: VideoFrame) => void } | null = null;
  let failure: Error | null = null;
  /** Próximo sample (ordem de decodificação) a enviar; -1 = decoder precisa recomeçar num quadro-chave. */
  let next = -1;
  let floorTs = -Infinity;

  const keep = (f: VideoFrame) => {
    if (f.timestamp < floorTs) return f.close();
    ready.set(f.timestamp, f);
    if (ready.size > 12) {
      const oldest = Math.min(...ready.keys());
      ready.get(oldest)!.close();
      ready.delete(oldest);
    }
  };
  const decoder = new VideoDecoder({
    output: (f) => {
      if (waiter && f.timestamp === waiter.ts) {
        const w = waiter;
        waiter = null;
        w.resolve(f);
      } else keep(f);
    },
    error: (e) => {
      failure = e instanceof Error ? e : new Error(String(e));
    },
  });

  const restartAt = (key: number) => {
    for (const f of ready.values()) f.close();
    ready.clear();
    if (decoder.state === 'configured') decoder.reset();
    decoder.configure(config);
    next = key;
  };
  const feed = () => {
    const s = samples[next]!;
    decoder.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: ts(s), duration: Math.round(s.duration * scale), data: s.data! }));
    next++;
  };

  // um pedido por vez: o render pede quadros em sequência
  let queue: Promise<unknown> = Promise.resolve();

  const decodeAt = async (timeSec: number): Promise<VideoFrame> => {
    if (failure) throw failure;
    // último quadro com início <= t (tolerância de 0,1 ms para arredondamentos de fps)
    let lo = 0;
    let hi = byTime.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (byTime[mid]!.t <= timeSec + 1e-4) lo = mid;
      else hi = mid - 1;
    }
    const target = byTime[lo]!.i;
    const targetTs = ts(samples[target]!);
    floorTs = targetTs;
    for (const [k, f] of ready) if (k < targetTs) (f.close(), ready.delete(k));
    const hit = ready.get(targetTs);
    if (hit) {
      ready.delete(targetTs);
      return hit;
    }
    let key = target;
    while (key > 0 && !samples[key]!.is_sync) key--;
    // dá para continuar de onde parou? (mesmo trecho, para a frente, e o alvo ainda não passou)
    if (next < 0 || next <= key || next > target + 1) restartAt(key);

    const got = new Promise<VideoFrame>((resolve) => (waiter = { ts: targetTs, resolve }));
    let result: VideoFrame | null = null;
    void got.then((f) => (result = f));
    while (next <= target) feed();
    for (let spins = 0; !result; spins++) {
      if (failure) throw failure;
      await sleep(spins < 20 ? 0 : 2);
      if (result) break;
      if (decoder.decodeQueueSize === 0) {
        // o decoder segura quadros por causa dos B-frames: manda o próximo, ou esvazia no fim
        if (next < samples.length) feed();
        else {
          await decoder.flush();
          next = -1; // depois do flush o WebCodecs exige um quadro-chave
          await sleep(0);
          if (!result) throw new Error(`quadro ${timeSec.toFixed(3)} s não foi produzido pelo decoder`);
        }
      }
    }
    return result;
  };

  const frameAt = (timeSec: number) => {
    const p = queue.then(() => decodeAt(timeSec));
    queue = p.catch(() => undefined);
    return p;
  };

  const durationSec = track.duration / track.timescale || byTime[byTime.length - 1]!.t;
  return {
    codec: track.codec,
    width,
    height,
    durationSec,
    frameCount: samples.length,
    fps: durationSec > 0 ? samples.length / durationSec : 0,
    frameAt,
    async drawFrameAt(ctx, timeSec) {
      const f = await frameAt(timeSec);
      try {
        ctx.drawImage(f, 0, 0, ctx.canvas.width, ctx.canvas.height);
      } finally {
        f.close();
      }
    },
    close() {
      for (const f of ready.values()) f.close();
      ready.clear();
      if (decoder.state !== 'closed') decoder.close();
    },
  };
}
