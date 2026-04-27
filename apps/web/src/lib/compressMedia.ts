/**
 * Client-side IMAGE compression only.
 * Video compression is now handled server-side via ffmpeg after upload.
 *
 * Images → browser-image-compression
 *          max 1920 px, quality 0.85
 */

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

  return new File([compressed], file.name, { type: compressed.type });
}
