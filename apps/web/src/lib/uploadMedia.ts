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
  /** Original file size before compression */
  originalSize?: number;
}

/** Upload a single already-compressed file via XHR so we get progress events. */
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

/** Legacy helper — uploads without progress (used by existing code). */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/media/upload-standalone`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(err);
  }
  const data = (await res.json()) as UploadedFile;
  const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
  return { ...data, preview };
}

export async function uploadFiles(files: FileList | File[]): Promise<UploadedFile[]> {
  const arr = Array.from(files);
  if (!arr.length) return [];
  const results = await Promise.allSettled(arr.map(uploadFile));
  return results
    .filter((r): r is PromiseFulfilledResult<UploadedFile> => r.status === 'fulfilled')
    .map((r) => r.value);
}
