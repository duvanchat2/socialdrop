import { API_URL } from './api';

export interface UploadedFile {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  mediaType: 'IMAGE' | 'VIDEO';
  preview?: string;
}

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
