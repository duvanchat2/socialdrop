'use client';
/**
 * Client-side video compression via ffmpeg.wasm.
 *
 * Bug-fix notes:
 *  - Progress is capped at 95 % — the remaining 5 % is reserved for the
 *    readFile() step after exec() resolves. Never trigger readFile from
 *    the progress event; always wait for exec() to settle first.
 *  - A 3-minute timeout falls back gracefully to the original file so the
 *    upload never stalls indefinitely.
 *  - Output file existence is verified before reading to handle edge cases
 *    where ffmpeg silently produces no output.
 *  - Blob URLs for the WASM core are cached so subsequent calls are instant
 *    (avoids re-downloading the 20 MB core on every video).
 */

import type { FFmpeg } from '@ffmpeg/ffmpeg';

// Cache the blob URLs after the first fetch so re-loading is instant
let coreBlobCache: { coreURL: string; wasmURL: string } | null = null;
let cachingPromise: Promise<{ coreURL: string; wasmURL: string }> | null = null;

// jsdelivr is more reliable than unpkg and supports CORS correctly
const CDN_CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js';
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm';
const COMPRESS_TIMEOUT_MS = 180_000; // 3 minutes

async function getCoreBlobURLs(): Promise<{ coreURL: string; wasmURL: string }> {
  if (coreBlobCache) return coreBlobCache;
  if (cachingPromise) return cachingPromise;

  cachingPromise = (async () => {
    const { toBlobURL } = await import('@ffmpeg/util');
    const result = {
      coreURL: await toBlobURL(CDN_CORE, 'text/javascript'),
      wasmURL: await toBlobURL(CDN_WASM, 'application/wasm'),
    };
    coreBlobCache = result;
    cachingPromise = null;
    return result;
  })();

  return cachingPromise;
}

/**
 * Compress a video File client-side.
 *
 * @param file        Original video File
 * @param onProgress  Called with 0–100 during compression
 * @returns           Compressed File, or original File if compression fails / times out
 */
export async function compressVideo(
  file: File,
  onProgress: (percent: number) => void,
): Promise<File> {
  // --- Load ffmpeg ---
  let ffmpeg: FFmpeg;
  try {
    const { FFmpeg: FFmpegClass } = await import('@ffmpeg/ffmpeg');
    const blobs = await getCoreBlobURLs();
    ffmpeg = new FFmpegClass();
    await ffmpeg.load({ coreURL: blobs.coreURL, wasmURL: blobs.wasmURL });
  } catch {
    console.warn('[compressVideo] ffmpeg failed to load — uploading original');
    onProgress(100);
    return file;
  }

  // Cap progress at 95 % — reserve last 5 % for readFile step
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress(Math.min(Math.round(progress * 100), 95));
  };
  ffmpeg.on('progress', progressHandler);

  const inputName = 'input.mp4';
  const outputName = 'output.mp4';

  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), COMPRESS_TIMEOUT_MS),
    );

    try {
      await Promise.race([
        ffmpeg.exec([
          '-i', inputName,
          '-vcodec', 'libx264',
          '-crf', '23',
          '-preset', 'fast',
          '-vf', 'scale=-2:1080',
          '-acodec', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          outputName,
        ]),
        timeout,
      ]);
    } catch (e) {
      if ((e as Error).message === 'timeout') {
        console.warn('[compressVideo] Timed out after 3 min — uploading original');
        onProgress(100);
        return file;
      }
      throw e;
    }

    // Verify the output file was actually written before trying to read it
    const entries = await ffmpeg.listDir('/') as Array<{ name: string; isDir: boolean }>;
    const outputExists = entries.some((f) => f.name === outputName && !f.isDir);
    if (!outputExists) {
      console.warn('[compressVideo] No output file produced — uploading original');
      onProgress(100);
      return file;
    }

    onProgress(98);
    const data = await ffmpeg.readFile(outputName) as Uint8Array;
    onProgress(100);

    // data.buffer may be a SharedArrayBuffer — copy to a plain ArrayBuffer
    const safeBuffer = data.buffer instanceof ArrayBuffer
      ? data.buffer
      : new Uint8Array(data).buffer;

    const compressed = new File(
      [safeBuffer],
      file.name.replace(/\.[^.]+$/, '_compressed.mp4'),
      { type: 'video/mp4' },
    );

    // If somehow larger (rare with CRF), return the original
    if (compressed.size >= file.size) {
      console.warn('[compressVideo] Compressed file is larger — using original');
      return file;
    }

    return compressed;
  } catch (err) {
    console.warn('[compressVideo] Compression failed:', (err as Error).message, '— uploading original');
    onProgress(100);
    return file;
  } finally {
    ffmpeg.off('progress', progressHandler);
    try { await ffmpeg.deleteFile(inputName); } catch { /* ok */ }
    try { await ffmpeg.deleteFile(outputName); } catch { /* ok */ }
  }
}
