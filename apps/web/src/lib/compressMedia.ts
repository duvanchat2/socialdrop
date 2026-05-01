'use client';
/**
 * Client-side media utilities.
 *
 * Videos  → uploaded at full original quality (no re-encoding).
 * Images  → lightly compressed with browser-image-compression
 *           (max 1920 px, quality 0.85) to reduce bandwidth.
 */

/**
 * Video passthrough — returns the original file unchanged.
 * The onProgress callback is called once with 100 so callers
 * don't need special-case handling.
 */
export async function compressVideo(
  file: File,
  onProgress?: (pct: number) => void,
  _onLoading?: () => void,
): Promise<File> {
  onProgress?.(100);
  return file;
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
