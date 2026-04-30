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
 *
 * Each compressVideo() call gets its OWN ffmpeg instance so progress
 * events never cross between parallel compressions.
 * WASM blob-URLs are fetched once and reused (browser caches the binary).
 */

const CDN = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

// Cached blob URLs — fetched once, shared across all instances
let cachedCoreURL: string | null = null;
let cachedWasmURL: string | null = null;
let urlLoadPromise: Promise<void> | null = null;

async function ensureWasmURLs(): Promise<{ coreURL: string; wasmURL: string }> {
  if (cachedCoreURL && cachedWasmURL) {
    return { coreURL: cachedCoreURL, wasmURL: cachedWasmURL };
  }
  if (!urlLoadPromise) {
    urlLoadPromise = (async () => {
      const { toBlobURL } = await import('@ffmpeg/util');
      cachedCoreURL = await toBlobURL(`${CDN}/ffmpeg-core.js`, 'text/javascript');
      cachedWasmURL = await toBlobURL(`${CDN}/ffmpeg-core.wasm`, 'application/wasm');
    })();
  }
  await urlLoadPromise;
  return { coreURL: cachedCoreURL!, wasmURL: cachedWasmURL! };
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
 * Each call creates its own isolated FFmpeg instance — safe to run in parallel.
 */
export async function compressVideo(
  file: File,
  onProgress?: (pct: number) => void,
  onLoading?: () => void,
): Promise<File> {
  onLoading?.();
  onProgress?.(0);

  const duration = await getVideoFileDuration(file);
  const sizeMB   = file.size / 1024 / 1024;
  const useLower = sizeMB > 50 || duration > 60;

  const crf    = useLower ? '28' : '23';
  const scale  = useLower ? 'scale=-2:720' : 'scale=-2:1080';
  const ext    = 'mp4';
  // Unique filenames per call — no conflicts when running in parallel
  const uid    = Math.random().toString(36).slice(2, 8);
  const inName = `in_${uid}.${file.name.split('.').pop() || 'mp4'}`;
  const outName = `out_${uid}.${ext}`;

  // Create a fresh isolated instance for this file
  const { FFmpeg: FFmpegClass } = await import('@ffmpeg/ffmpeg');
  const { coreURL, wasmURL }   = await ensureWasmURLs();
  const ffmpeg = new FFmpegClass();
  await ffmpeg.load({ coreURL, wasmURL });

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
      '-profile:v', 'baseline',
      '-level', '3.1',
      '-crf', crf,
      '-preset', 'fast',
      '-vf', scale,
      '-pix_fmt', 'yuv420p',
      '-acodec', 'aac',
      '-ar', '44100',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outName,
    ]);

    const data = await ffmpeg.readFile(outName) as Uint8Array;

    try { await ffmpeg.deleteFile(inName);  } catch { /* ok */ }
    try { await ffmpeg.deleteFile(outName); } catch { /* ok */ }

    onProgress?.(100);

    const safeBuffer = data.buffer instanceof ArrayBuffer
      ? data.buffer
      : new Uint8Array(data).buffer;

    const compressed = new File(
      [safeBuffer],
      file.name.replace(/\.[^.]+$/, `.${ext}`),
      { type: 'video/mp4' },
    );

    return compressed.size < file.size ? compressed : file;
  } finally {
    ffmpeg.off('progress', onFFmpegProgress);
    // Free WASM memory for this instance
    try { ffmpeg.terminate(); } catch { /* ok */ }
  }
}

/**
 * Compress an image file using browser-image-compression.
 */
export async function compressImage(file: File): Promise<File> {
  const imageCompression = (await import('browser-image-compression')).default;
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1920,
    initialQuality: 0.85,
    useWebWorker: true,
    fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
  });
  return new File([compressed], file.name, { type: compressed.type });
}

/** True once the WASM blob URLs have been cached */
export function isFFmpegLoaded(): boolean {
  return cachedCoreURL !== null;
}
