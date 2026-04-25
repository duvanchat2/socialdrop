/**
 * Extracts the first-frame thumbnail and metadata from a video File using
 * the HTML5 <video> element + Canvas. Client-side only.
 */
export interface VideoMeta {
  thumbnail: string; // JPEG data URL
  duration: number;  // seconds
  width: number;
  height: number;
}

export async function getVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const src = URL.createObjectURL(file);
    video.src = src;

    const cleanup = () => URL.revokeObjectURL(src);

    let seeked = false;

    const doCapture = () => {
      if (seeked) return;
      seeked = true;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 360;
      const scale = Math.min(1, 640 / w);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      cleanup();
      resolve({
        thumbnail: canvas.toDataURL('image/jpeg', 0.72),
        duration: isFinite(video.duration) ? video.duration : 0,
        width: w,
        height: h,
      });
    };

    video.addEventListener('seeked', doCapture, { once: true });

    video.addEventListener(
      'loadeddata',
      () => {
        // Seek to 0.5 s or halfway if the video is shorter
        video.currentTime = Math.min(0.5, video.duration / 2);
      },
      { once: true },
    );

    // Fallback: if seeked never fires (some formats) just capture on loadeddata
    video.addEventListener(
      'loadedmetadata',
      () => {
        setTimeout(() => {
          if (!seeked) doCapture();
        }, 800);
      },
      { once: true },
    );

    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('No se pudo procesar el video'));
    });
  });
}

/** Quick duration-only helper (does not render a canvas) */
export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const src = URL.createObjectURL(file);
    video.src = src;
    video.addEventListener(
      'loadedmetadata',
      () => {
        const d = isFinite(video.duration) ? video.duration : 0;
        URL.revokeObjectURL(src);
        resolve(d);
      },
      { once: true },
    );
    video.addEventListener('error', () => {
      URL.revokeObjectURL(src);
      resolve(0);
    });
  });
}

/** Format seconds → "1:23" or "12:34" */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

/**
 * Convenience alias matching the simpler signature used by upload zones.
 * Returns thumbnail data URL, duration in seconds, and original file size.
 */
export async function getVideoThumbnail(file: File): Promise<{
  thumbnail: string;
  duration: number;
  originalSize: number;
}> {
  const meta = await getVideoMeta(file);
  return {
    thumbnail: meta.thumbnail,
    duration: Math.round(meta.duration),
    originalSize: file.size,
  };
}
