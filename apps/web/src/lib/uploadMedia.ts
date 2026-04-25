import { API_URL } from './api';

export interface UploadedFile {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  mediaType: 'IMAGE' | 'VIDEO';
  /** Image blob-URL or video first-frame thumbnail data-URL */
  preview?: string;
  /** Video duration in seconds */
  duration?: number;
  /** Original file size before any server compression (bytes) */
  originalSize?: number;
}

/**
 * Upload a single file via XHR so we get granular progress events.
 * @param onProgress  Called with 0–100 as bytes are transmitted
 */
export function uploadFileXHR(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadedFile);
        } catch {
          reject(new Error('Respuesta inválida del servidor'));
        }
      } else {
        reject(new Error(xhr.responseText || xhr.statusText));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Error de red al subir archivo')));
    xhr.addEventListener('abort', () => reject(new Error('Subida cancelada')));

    xhr.open('POST', `${API_URL}/api/media/upload-standalone`);
    xhr.send(form);
  });
}

/**
 * Upload a file with real-time speed and ETA feedback.
 *
 * @param file        File to upload
 * @param onProgress  Called as (percent, speed, remaining):
 *                      percent   = 0–99 during upload
 *                      speed     = "2.3 MB/s" | "450 KB/s"
 *                      remaining = "~12s restantes" | "~2min restantes"
 */
export async function uploadFile(
  file: File,
  onProgress?: (percent: number, speed: string, remaining: string) => void,
): Promise<UploadedFile> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
      const elapsed = (Date.now() - startTime) / 1000;
      const bps = elapsed > 0.1 ? e.loaded / elapsed : 0;

      const speedStr = bps > 1024 * 1024
        ? `${(bps / 1024 / 1024).toFixed(1)} MB/s`
        : bps > 0
          ? `${(bps / 1024).toFixed(0)} KB/s`
          : '';

      let remainingStr = '';
      if (bps > 0 && e.total > e.loaded) {
        const secs = Math.ceil((e.total - e.loaded) / bps);
        remainingStr = secs > 60
          ? `~${Math.ceil(secs / 60)}min restantes`
          : `~${secs}s restantes`;
      }

      onProgress?.(pct, speedStr, remainingStr);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as UploadedFile;
          resolve({ ...data, originalSize: file.size });
        } catch {
          reject(new Error('Respuesta inválida del servidor'));
        }
      } else {
        reject(new Error(xhr.responseText || xhr.statusText));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Error de red al subir archivo')));
    xhr.addEventListener('abort', () => reject(new Error('Subida cancelada')));

    xhr.open('POST', `${API_URL}/api/media/upload-standalone`);
    xhr.send(form);
  });
}

/** Legacy helper — uploads without progress tracking. */
export async function uploadFiles(files: FileList | File[]): Promise<UploadedFile[]> {
  const arr = Array.from(files);
  if (!arr.length) return [];
  const results = await Promise.allSettled(
    arr.map((f) => uploadFileXHR(f)),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<UploadedFile> => r.status === 'fulfilled')
    .map((r) => r.value);
}
