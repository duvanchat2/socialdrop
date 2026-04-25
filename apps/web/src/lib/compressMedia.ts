'use client';
/**
 * Client-side media compression.
 *
 * Videos  → ffmpeg.wasm (H.264 / AAC)
 *           - file > 50 MB or duration > 60 s  → 720 p, CRF 28
 *           - file ≤ 50 MB                     → 1080 p, CRF 23
 *
 * Images  → browser-image-compression
 *           - max 1920 px, quality 0.85
 */

import type { FFmpeg } from '@ffmpeg/ffmpeg';

// Singleton FFmpeg instance (loaded lazily on first video)
let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

const CDN = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const { FFmpeg: FFmpegClass } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');

    const ff = new FFmpegClass();
    await ff.load({
      coreURL: await toBlobURL(`${CDN}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CDN}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ff;
    loadingPromise = null;
    return ff;
  })();

  return loadingPromise;
}

/** Get video duration via HTML5 video element */
function getVideoFileDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const src = URL.createObjectURL(file);
    v.src = src;
    v.addEventListener('loadedmetadata', () => {
      const d = isFinite(v.duration) ? v.duration : 0;
      URL.revokeObjectURL(src);
      resolve(d);
    }, { once: true });
    v.addEventListener('error', () => { URL.revokeObjectURL(src); resolve(0); });
  });
}

/**
 * Compress a video file client-side using ffmpeg.wasm.
 * Returns a new File with the same name but possibly smaller size.
 * @param onProgress   Called with 0–100 during compression
 * @param onLoading    Called when FFmpeg core is being downloaded (first time)
 */
export async function compressVideo(
  file: File,
  onProgress?: (pct: number) => void,
  onLoading?: () => void,
): Promise<File> {
  onLoading?.();
  onProgress?.(0);

  const duration = await getVideoFileDuration(file);
  const sizeMB = file.size / 1024 / 1024;
  const useLower = sizeMB > 50 || duration > 60;

  const crf = useLower ? '28' : '23';
  const scale = useLower ? 'scale=-2:720' : 'scale=-2:1080';
  const ext = 'mp4';
  const inName = 'input.' + (file.name.split('.').pop() || 'mp4');
  const outName = `output.${ext}`;

  const ffmpeg = await getFFmpeg();

  // Wire up progress callback
  const onFFmpegProgress = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(99, Math.round(progress * 100)));
  };
  ffmpeg.on('progress', onFFmpegProgress);

  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await ffmpeg.writeFile(inName, await fetchFile(file));

    await ffmpeg.exec([
      '-i', inName,
      '-vcodec', 'libx264',
      '-crf', crf,
      '-vf', scale,
      '-acodec', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-preset', 'fast',
      outName,
    ]);

    const data = await ffmpeg.readFile(outName) as Uint8Array;

    // Cleanup virtual FS
    try { await ffmpeg.deleteFile(inName); } catch { /* ok */ }
    try { await ffmpeg.deleteFile(outName); } catch { /* ok */ }

    onProgress?.(100);

    // data.buffer may be a SharedArrayBuffer — copy to a plain ArrayBuffer first
    const safeBuffer = data.buffer instanceof ArrayBuffer
      ? data.buffer
      : new Uint8Array(data).buffer;

    const compressed = new File(
      [safeBuffer],
      file.name.replace(/\.[^.]+$/, `.${ext}`),
      { type: 'video/mp4' },
    );

    // If compression made it bigger (shouldn't normally), return original
    return compressed.size < file.size ? compressed : file;
  } finally {
    ffmpeg.off('progress', onFFmpegProgress);
  }
}

/**
 * Compress an image file using browser-image-compression.
 * Returns a new File (same name) at reduced size.
 */
export async function compressImage(file: File): Promise<File> {
  const imageCompression = (await import('browser-image-compression')).default;

  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1920,
    initialQuality: 0.85,
    useWebWorker: true,
    fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
  });

  // Return as File with original name
  return new File([compressed], file.name, { type: compressed.type });
}

/** True when the ffmpeg instance has already been loaded */
export function isFFmpegLoaded(): boolean {
  return ffmpegInstance !== null;
}
