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
  /** Original file size before compression (bytes) */
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
 * Full pipeline: compress (if video) then upload with progress.
 *
 * @param file          File to process
 * @param onProgress    Called as (stage, 0–100):
 *                        stage = 'Comprimiendo' during ffmpeg compression
 *                        stage = 'Subiendo'     during XHR upload
 * @param onCompressed  Optional — called with the compressed file size (bytes)
 *                      right before upload starts, so the UI can show
 *                      "150 MB → 12 MB" while the upload is in progress.
 */
export async function uploadFile(
  file: File,
  onProgress?: (stage: string, percent: number) => void,
  onCompressed?: (compressedSize: number) => void,
): Promise<UploadedFile> {
  let fileToUpload = file;

  if (file.type.startsWith('video/')) {
    onProgress?.('Comprimiendo', 0);
    try {
      const { compressVideo } = await import('./compressVideo');
      fileToUpload = await compressVideo(file, (pct) =>
        onProgress?.('Comprimiendo', pct),
      );
    } catch {
      // compressVideo already handles all its own errors and returns the
      // original file on failure, so this catch is an extra safety net.
      fileToUpload = file;
    }
    onCompressed?.(fileToUpload.size);
  }

  onProgress?.('Subiendo', 0);

  const result = await uploadFileXHR(fileToUpload, (pct) =>
    onProgress?.('Subiendo', pct),
  );

  onProgress?.('Subiendo', 100);
  return { ...result, originalSize: file.size };
}

/** Legacy helper — uploads without compression or progress tracking. */
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
